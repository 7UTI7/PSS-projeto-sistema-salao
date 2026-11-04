// Leitura de PDF: extrai o texto com as coordenadas e reconstrói as linhas visuais da tabela.
//
// Por que um leitor próprio em vez de uma biblioteca: o extrato da InfinitePay é gerado pelo
// Chromium ("imprimir em PDF" da página web — Producer "Skia/PDF"), um subconjunto pequeno e
// previsível do formato: sem criptografia, sem object streams, fontes Type0/Identity-H com
// /ToUnicode. Isso cabe em um arquivo, reaproveita o fflate que já descompacta o .xlsx e evita
// somar uma dependência de alguns megabytes a um projeto com SECURITY.md.
//
// Por que extrair com coordenadas e não o texto corrido: o PDF desenha os textos na ordem que
// quer, não na ordem de leitura. No extrato, a coluna "Nome" é desenhada em bloco, depois das
// outras, então quem lê em ordem de stream associa o nome à linha errada — o pdftotext comete
// exatamente esse erro neste arquivo. Com a posição de cada glifo, a linha visual é reconstruída
// pelo que está na mesma altura (y) e a célula pelo espaçamento horizontal (x).
import { unzlibSync } from 'fflate';
import { AppError } from '../../shared/utils/app-error.js';
import type { SheetTable } from './import.types.js';

/** Todo PDF começa com "%PDF-". */
export function isPdf(buffer: Buffer): boolean {
  return buffer.length > 5
    && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
}

/** Tolerância vertical para dois glifos contarem como a mesma linha, em unidades do PDF. */
const SAME_LINE_TOLERANCE = 2.5;

/** Vão horizontal, em fração do corpo da fonte, a partir do qual começa outra célula. */
const CELL_GAP_RATIO = 0.6;

/** Ligaduras tipográficas que a fonte usa no lugar de duas letras ("ﬁnal" -> "final"). */
const LIGATURES: ReadonlyMap<string, string> = new Map([
  ['ﬀ', 'ff'],
  ['ﬁ', 'fi'],
  ['ﬂ', 'fl'],
  ['ﬃ', 'ffi'],
  ['ﬄ', 'ffl'],
  [' ', ' '],
]);

type Matrix = readonly [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

interface PdfObject {
  dict: string;
  /** Offset e tamanho do stream dentro do buffer original, ou null quando o objeto não tem stream. */
  stream: { start: number; length: number } | null;
}

interface FontInfo {
  /** CID -> texto, a partir do /ToUnicode. */
  cmap: ReadonlyMap<number, string>;
  /** CID -> largura em milésimos do corpo da fonte, a partir do /W. */
  widths: ReadonlyMap<number, number>;
  defaultWidth: number;
}

interface Glyph {
  x: number;
  y: number;
  /** Largura já em unidades do dispositivo, para saber onde o glifo termina. */
  width: number;
  size: number;
  text: string;
}

export function readPdf(buffer: Buffer): SheetTable[] {
  // latin1 mapeia cada byte em um caractere, então índice de string = índice de byte:
  // dá para usar expressão regular na estrutura do arquivo sem corromper os streams.
  const raw = buffer.toString('latin1');
  const objects = parseObjects(raw);
  if (objects.size === 0) {
    throw new AppError('Não foi possível ler a estrutura do PDF.', 400, 'INVALID_PDF');
  }

  const pages = collectPages(raw, objects, buffer);
  if (pages.length === 0) {
    throw new AppError('O PDF não tem páginas legíveis.', 400, 'INVALID_PDF');
  }

  const tables: SheetTable[] = [];
  let totalGlyphs = 0;

  pages.forEach((page, index) => {
    const content = page.contents
      .map((ref) => inflateObject(objects.get(ref), buffer))
      .filter((text): text is string => text !== null)
      .join('\n');

    const glyphs = extractGlyphs(content, page.fonts);
    totalGlyphs += glyphs.length;
    tables.push({ name: `Página ${index + 1}`, rows: glyphsToRows(glyphs) });
  });

  if (totalGlyphs === 0) {
    throw new AppError(
      'Este PDF não tem texto — provavelmente é um documento digitalizado ou uma imagem. '
        + 'Baixe o relatório direto do aplicativo da InfinitePay, pela opção de exportar.',
      400,
      'PDF_WITHOUT_TEXT',
    );
  }

  return tables;
}

// ---------------------------------------------------------------------------
// Estrutura do arquivo
// ---------------------------------------------------------------------------

/**
 * Varre o arquivo procurando "N 0 obj". Ler a tabela xref seria o caminho formal, mas uma
 * varredura encontra também os objetos de arquivos com xref danificada, que é justamente
 * quando o leitor precisa ser tolerante.
 */
function parseObjects(raw: string): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>();
  const pattern = /(\d+)\s+0\s+obj\b/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const number = Number(match[1]);
    const bodyStart = match.index + match[0].length;
    const bodyEnd = raw.indexOf('endobj', bodyStart);
    const body = raw.slice(bodyStart, bodyEnd === -1 ? raw.length : bodyEnd);

    const streamMatch = /stream\r?\n/.exec(body);
    if (!streamMatch) {
      objects.set(number, { dict: body, stream: null });
      continue;
    }

    const dict = body.slice(0, streamMatch.index);
    const start = bodyStart + streamMatch.index + streamMatch[0].length;
    objects.set(number, { dict, stream: { start, length: streamLength(raw, dict, start) } });
  }

  // Um /Length indireto ("/Length 12 0 R") só pode ser resolvido depois de indexar tudo.
  for (const [number, object] of objects) {
    if (!object.stream || object.stream.length >= 0) continue;
    const reference = /\/Length\s+(\d+)\s+0\s+R/.exec(object.dict);
    const target = reference ? objects.get(Number(reference[1])) : undefined;
    const declared = target ? Number(/-?\d+/.exec(target.dict)?.[0] ?? NaN) : NaN;
    const length = Number.isFinite(declared) && declared >= 0
      ? declared
      : Math.max(0, raw.indexOf('endstream', object.stream.start) - object.stream.start);
    objects.set(number, { dict: object.dict, stream: { start: object.stream.start, length } });
  }

  return objects;
}

/** Usa o /Length declarado quando ele realmente termina em "endstream"; senão procura o fim. */
function streamLength(raw: string, dict: string, start: number): number {
  const declared = /\/Length\s+(\d+)/.exec(dict);
  if (declared) {
    const length = Number(declared[1]);
    const after = raw.slice(start + length, start + length + 20);
    if (/^\s*endstream/.test(after)) return length;
  }
  if (/\/Length\s+\d+\s+0\s+R/.test(dict)) return -1; // resolvido na segunda passada
  const end = raw.indexOf('endstream', start);
  return end === -1 ? 0 : end - start;
}

function inflateObject(object: PdfObject | undefined, buffer: Buffer): string | null {
  if (!object?.stream || object.stream.length <= 0) return null;
  const data = buffer.subarray(object.stream.start, object.stream.start + object.stream.length);

  if (!object.dict.includes('/FlateDecode')) return data.toString('latin1');

  // Predictor é usado em xref streams e imagens, nunca nos streams de texto que interessam aqui.
  if (/\/Predictor\s+([2-9]|\d\d)/.test(object.dict)) return null;

  try {
    return Buffer.from(unzlibSync(new Uint8Array(data))).toString('latin1');
  } catch {
    return null;
  }
}

/**
 * Monta a lista de páginas na ordem de leitura, percorrendo /Kids a partir do catálogo.
 * A ordem dos objetos no arquivo não é a ordem das páginas, então ordenar por número de
 * objeto embaralharia o extrato.
 */
function collectPages(
  raw: string,
  objects: Map<number, PdfObject>,
  buffer: Buffer,
): Array<{ contents: number[]; fonts: Map<string, FontInfo> }> {
  const fontCache = new Map<number, FontInfo>();
  const pages: Array<{ contents: number[]; fonts: Map<string, FontInfo> }> = [];
  const visited = new Set<number>();

  const walk = (reference: number): void => {
    if (visited.has(reference)) return;
    visited.add(reference);
    const object = objects.get(reference);
    if (!object) return;

    if (/\/Type\s*\/Pages\b/.test(object.dict)) {
      for (const kid of references(/\/Kids\s*\[([^\]]*)\]/.exec(object.dict)?.[1] ?? '')) {
        walk(kid);
      }
      return;
    }
    if (!/\/Type\s*\/Page\b/.test(object.dict)) return;

    pages.push({
      contents: contentReferences(object.dict),
      fonts: pageFonts(object.dict, objects, fontCache, buffer),
    });
  };

  const root = /\/Root\s+(\d+)\s+0\s+R/.exec(raw);
  const catalog = root ? objects.get(Number(root[1])) : undefined;
  const pagesReference = catalog ? /\/Pages\s+(\d+)\s+0\s+R/.exec(catalog.dict) : null;
  if (pagesReference) walk(Number(pagesReference[1]));

  // Sem catálogo utilizável, cai para a ordem dos objetos: pior que /Kids, melhor que falhar.
  if (pages.length === 0) {
    for (const [number] of [...objects].sort((a, b) => a[0] - b[0])) walk(number);
  }

  return pages;
}

function references(list: string): number[] {
  return [...list.matchAll(/(\d+)\s+0\s+R/g)].map((match) => Number(match[1]));
}

function contentReferences(dict: string): number[] {
  const array = /\/Contents\s*\[([^\]]*)\]/.exec(dict);
  if (array) return references(array[1] ?? '');
  const single = /\/Contents\s+(\d+)\s+0\s+R/.exec(dict);
  return single ? [Number(single[1])] : [];
}

/** Resolve /Resources /Font, que pode estar embutido na página ou em um objeto separado. */
function pageFonts(
  dict: string,
  objects: Map<number, PdfObject>,
  cache: Map<number, FontInfo>,
  buffer: Buffer,
): Map<string, FontInfo> {
  let source = dict;
  const external = /\/Resources\s+(\d+)\s+0\s+R/.exec(dict);
  if (external) source = objects.get(Number(external[1]))?.dict ?? dict;

  const fonts = new Map<string, FontInfo>();
  const block = /\/Font\s*<<([\s\S]*?)>>/.exec(source);
  if (!block) return fonts;

  for (const match of (block[1] ?? '').matchAll(/\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R/g)) {
    const name = match[1];
    const reference = Number(match[2]);
    if (!name) continue;
    const font = cache.get(reference) ?? loadFont(reference, objects, buffer);
    if (font) {
      cache.set(reference, font);
      fonts.set(name, font);
    }
  }
  return fonts;
}

function loadFont(reference: number, objects: Map<number, PdfObject>, buffer: Buffer): FontInfo | null {
  const font = objects.get(reference);
  if (!font) return null;

  const toUnicode = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(font.dict);
  const cmap = toUnicode
    ? parseToUnicode(inflateObject(objects.get(Number(toUnicode[1])), buffer) ?? '')
    : new Map<number, string>();

  // As larguras ficam na fonte descendente (CIDFontType2), não no dicionário Type0.
  const descendant = /\/DescendantFonts\s*\[\s*(\d+)\s+0\s+R/.exec(font.dict);
  const child = descendant ? objects.get(Number(descendant[1])) : undefined;
  const widthSource = child?.dict ?? font.dict;

  return {
    cmap,
    widths: parseWidths(widthSource),
    defaultWidth: Number(/\/DW\s+(-?[\d.]+)/.exec(widthSource)?.[1] ?? 1000),
  };
}

/**
 * O /ToUnicode é um CMap em PostScript. Só os blocos bfchar (um a um) e bfrange (faixas)
 * importam para transformar o código do glifo em texto legível.
 */
export function parseToUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>();

  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const entry of (block[1] ?? '').matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(parseInt(entry[1] ?? '0', 16), hexToText(entry[2] ?? ''));
    }
  }

  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const entry of (block[1] ?? '').matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const low = parseInt(entry[1] ?? '0', 16);
      const high = parseInt(entry[2] ?? '0', 16);
      const base = parseInt(entry[3] ?? '0', 16);
      for (let cid = low; cid <= high && cid - low < 65_536; cid += 1) {
        map.set(cid, String.fromCodePoint(base + cid - low));
      }
    }
  }

  return map;
}

function hexToText(hex: string): string {
  let text = '';
  for (let index = 0; index + 3 < hex.length + (hex.length % 4 === 0 ? 0 : 4); index += 4) {
    const code = parseInt(hex.slice(index, index + 4), 16);
    if (Number.isFinite(code)) text += String.fromCharCode(code);
  }
  return text.replace(/\0/g, '');
}

/** /W é uma lista mista: "cid [w w w]" para sequências e "primeiro ultimo w" para faixas. */
export function parseWidths(dict: string): Map<number, number> {
  const widths = new Map<number, number>();
  const block = /\/W\s*\[([\s\S]*?)\]\s*(?:\/|>>|$)/.exec(dict);
  if (!block) return widths;

  const tokens = [...(block[1] ?? '').matchAll(/\[|\]|-?[\d.]+/g)].map((match) => match[0]);
  let index = 0;

  while (index < tokens.length) {
    const first = Number(tokens[index]);
    if (!Number.isFinite(first)) { index += 1; continue; }

    if (tokens[index + 1] === '[') {
      let cid = first;
      index += 2;
      while (index < tokens.length && tokens[index] !== ']') {
        widths.set(cid, Number(tokens[index]));
        cid += 1;
        index += 1;
      }
      index += 1;
      continue;
    }

    const last = Number(tokens[index + 1]);
    const width = Number(tokens[index + 2]);
    if (Number.isFinite(last) && Number.isFinite(width) && last >= first && last - first < 65_536) {
      for (let cid = first; cid <= last; cid += 1) widths.set(cid, width);
    }
    index += 3;
  }

  return widths;
}

// ---------------------------------------------------------------------------
// Interpretação do content stream
// ---------------------------------------------------------------------------

type Operand =
  | { kind: 'number'; value: number }
  | { kind: 'name'; value: string }
  | { kind: 'bytes'; value: number[] }
  | { kind: 'array'; value: Operand[] };

function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

/**
 * Percorre os operadores de texto do content stream mantendo a matriz do texto (Tm) e a do
 * dispositivo (CTM), e devolve cada pedaço de texto já posicionado na página.
 */
function extractGlyphs(content: string, fonts: Map<string, FontInfo>): Glyph[] {
  const glyphs: Glyph[] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = IDENTITY;
  let textMatrix: Matrix = IDENTITY;
  let lineMatrix: Matrix = IDENTITY;
  let font: FontInfo | null = null;
  let size = 0;
  let leading = 0;
  let charSpacing = 0;
  let horizontalScale = 1;
  let operands: Operand[] = [];

  const numbers = (): number[] => operands
    .filter((operand): operand is { kind: 'number'; value: number } => operand.kind === 'number')
    .map((operand) => operand.value);

  const translate = (tx: number, ty: number): void => {
    lineMatrix = multiply([1, 0, 0, 1, tx, ty], lineMatrix);
    textMatrix = lineMatrix;
  };

  const show = (items: Operand[]): void => {
    if (!font) return;
    for (const item of items) {
      if (item.kind === 'number') {
        // Ajuste de kerning dentro de um TJ: desloca o texto sem desenhar nada.
        textMatrix = multiply([1, 0, 0, 1, (-item.value / 1000) * size * horizontalScale, 0], textMatrix);
        continue;
      }
      if (item.kind !== 'bytes') continue;

      for (let index = 0; index + 1 < item.value.length; index += 2) {
        const cid = ((item.value[index] ?? 0) << 8) | (item.value[index + 1] ?? 0);
        const device = multiply(textMatrix, ctm);
        const scale = Math.hypot(device[0], device[1]) || 1;
        const width = ((font.widths.get(cid) ?? font.defaultWidth) / 1000) * size;
        const text = font.cmap.get(cid) ?? '';

        if (text !== '') {
          glyphs.push({
            x: device[4],
            y: device[5],
            width: width * horizontalScale * scale,
            size: size * scale,
            text,
          });
        }
        textMatrix = multiply([1, 0, 0, 1, (width + charSpacing) * horizontalScale, 0], textMatrix);
      }
    }
  };

  for (const token of tokenize(content)) {
    if (token.kind !== 'operator') {
      operands.push(token.operand);
      continue;
    }

    const values = numbers();
    switch (token.value) {
      case 'q':
        stack.push(ctm);
        break;
      case 'Q':
        ctm = stack.pop() ?? ctm;
        break;
      case 'cm':
        if (values.length >= 6) ctm = multiply(values.slice(-6) as unknown as Matrix, ctm);
        break;
      case 'BT':
        textMatrix = lineMatrix = IDENTITY;
        break;
      case 'Tm':
        if (values.length >= 6) textMatrix = lineMatrix = values.slice(-6) as unknown as Matrix;
        break;
      case 'Td':
        if (values.length >= 2) translate(values[values.length - 2] ?? 0, values[values.length - 1] ?? 0);
        break;
      case 'TD':
        if (values.length >= 2) {
          leading = -(values[values.length - 1] ?? 0);
          translate(values[values.length - 2] ?? 0, values[values.length - 1] ?? 0);
        }
        break;
      case 'T*':
        translate(0, -leading);
        break;
      case 'TL':
        leading = values[values.length - 1] ?? leading;
        break;
      case 'Tc':
        charSpacing = values[values.length - 1] ?? charSpacing;
        break;
      case 'Tz':
        horizontalScale = (values[values.length - 1] ?? 100) / 100;
        break;
      case 'Tf': {
        const name = operands.find((operand): operand is { kind: 'name'; value: string } => operand.kind === 'name');
        if (name) font = fonts.get(name.value) ?? null;
        size = values[values.length - 1] ?? size;
        break;
      }
      case 'Tj':
      case 'TJ':
        show(operands.flatMap((operand) => (operand.kind === 'array' ? operand.value : [operand])));
        break;
      case "'":
      case '"':
        translate(0, -leading);
        show(operands.filter((operand) => operand.kind === 'bytes'));
        break;
      default:
        break;
    }
    operands = [];
  }

  return glyphs;
}

type Token =
  | { kind: 'operand'; operand: Operand }
  | { kind: 'operator'; value: string };

const WHITESPACE = new Set([' ', '\n', '\r', '\t', '\f', '\0']);
const DELIMITERS = new Set(['(', ')', '<', '>', '[', ']', '{', '}', '/', '%']);

function* tokenize(content: string): Generator<Token> {
  let index = 0;

  while (index < content.length) {
    const char = content[index] ?? '';

    if (WHITESPACE.has(char)) { index += 1; continue; }

    if (char === '%') {
      while (index < content.length && content[index] !== '\n') index += 1;
      continue;
    }

    if (char === '<' && content[index + 1] === '<') { index += 2; continue; }
    if (char === '>' && content[index + 1] === '>') { index += 2; continue; }

    if (char === '<') {
      const end = content.indexOf('>', index);
      const hex = content.slice(index + 1, end === -1 ? content.length : end).replace(/[^0-9A-Fa-f]/g, '');
      const bytes: number[] = [];
      for (let at = 0; at < hex.length; at += 2) {
        bytes.push(parseInt(hex.slice(at, at + 2).padEnd(2, '0'), 16));
      }
      yield { kind: 'operand', operand: { kind: 'bytes', value: bytes } };
      index = end === -1 ? content.length : end + 1;
      continue;
    }

    if (char === '(') {
      const [bytes, next] = readLiteralString(content, index);
      yield { kind: 'operand', operand: { kind: 'bytes', value: bytes } };
      index = next;
      continue;
    }

    if (char === '[') {
      const [items, next] = readArray(content, index + 1);
      yield { kind: 'operand', operand: { kind: 'array', value: items } };
      index = next;
      continue;
    }

    if (char === ']' || char === '{' || char === '}') { index += 1; continue; }

    if (char === '/') {
      let end = index + 1;
      while (end < content.length && !WHITESPACE.has(content[end] ?? '') && !DELIMITERS.has(content[end] ?? '')) {
        end += 1;
      }
      yield { kind: 'operand', operand: { kind: 'name', value: content.slice(index + 1, end) } };
      index = end;
      continue;
    }

    let end = index;
    while (end < content.length && !WHITESPACE.has(content[end] ?? '') && !DELIMITERS.has(content[end] ?? '')) {
      end += 1;
    }
    const word = content.slice(index, end === index ? index + 1 : end);
    index = end === index ? index + 1 : end;

    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) {
      yield { kind: 'operand', operand: { kind: 'number', value: Number(word) } };
    } else if (word !== '') {
      yield { kind: 'operator', value: word };
    }
  }
}

/** Strings literais aceitam parênteses balanceados e escapes com barra invertida. */
function readLiteralString(content: string, start: number): [number[], number] {
  const bytes: number[] = [];
  let depth = 1;
  let index = start + 1;

  while (index < content.length && depth > 0) {
    const char = content[index] ?? '';
    if (char === '\\') {
      const next = content[index + 1] ?? '';
      const escapes: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 };
      if (next in escapes) {
        bytes.push(escapes[next] ?? 0);
        index += 2;
      } else if (/[0-7]/.test(next)) {
        const octal = /^[0-7]{1,3}/.exec(content.slice(index + 1))?.[0] ?? '0';
        bytes.push(parseInt(octal, 8) & 0xff);
        index += 1 + octal.length;
      } else {
        bytes.push(next.charCodeAt(0) & 0xff);
        index += 2;
      }
      continue;
    }
    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth === 0) { index += 1; break; }
    }
    bytes.push(char.charCodeAt(0) & 0xff);
    index += 1;
  }

  return [bytes, index];
}

function readArray(content: string, start: number): [Operand[], number] {
  const items: Operand[] = [];
  let index = start;

  while (index < content.length) {
    const char = content[index] ?? '';
    if (char === ']') return [items, index + 1];
    if (WHITESPACE.has(char)) { index += 1; continue; }

    if (char === '<') {
      const end = content.indexOf('>', index);
      const hex = content.slice(index + 1, end === -1 ? content.length : end).replace(/[^0-9A-Fa-f]/g, '');
      const bytes: number[] = [];
      for (let at = 0; at < hex.length; at += 2) {
        bytes.push(parseInt(hex.slice(at, at + 2).padEnd(2, '0'), 16));
      }
      items.push({ kind: 'bytes', value: bytes });
      index = end === -1 ? content.length : end + 1;
      continue;
    }

    if (char === '(') {
      const [bytes, next] = readLiteralString(content, index);
      items.push({ kind: 'bytes', value: bytes });
      index = next;
      continue;
    }

    let end = index;
    while (end < content.length && !WHITESPACE.has(content[end] ?? '') && !DELIMITERS.has(content[end] ?? '')) {
      end += 1;
    }
    const word = content.slice(index, end === index ? index + 1 : end);
    index = end === index ? index + 1 : end;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) items.push({ kind: 'number', value: Number(word) });
  }

  return [items, index];
}

// ---------------------------------------------------------------------------
// Reconstrução da tabela
// ---------------------------------------------------------------------------

/**
 * Agrupa os glifos por altura (cada grupo é uma linha visual) e, dentro da linha, separa as
 * células onde o vão horizontal é maior do que o avanço natural da fonte. Esse vão é o que
 * distingue "espaço entre palavras" de "espaço entre colunas".
 */
export function glyphsToRows(glyphs: readonly Glyph[]): string[][] {
  if (glyphs.length === 0) return [];

  const sorted = [...glyphs].sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines: Glyph[][] = [];

  for (const glyph of sorted) {
    const current = lines[lines.length - 1];
    const reference = current?.[0];
    if (current && reference && Math.abs(reference.y - glyph.y) <= SAME_LINE_TOLERANCE) {
      current.push(glyph);
    } else {
      lines.push([glyph]);
    }
  }

  const rows: string[][] = [];
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
    const cells: string[] = [];
    let cell = '';
    let cursor = Number.NEGATIVE_INFINITY;

    for (const glyph of line) {
      if (cell !== '' && glyph.x - cursor > glyph.size * CELL_GAP_RATIO) {
        cells.push(cell);
        cell = '';
      }
      cell += glyph.text;
      cursor = glyph.x + glyph.width;
    }
    if (cell !== '') cells.push(cell);

    const cleaned = cells.map(normalizeCell).filter((text) => text !== '');
    if (cleaned.length > 0) rows.push(cleaned);
  }

  return rows;
}

function normalizeCell(text: string): string {
  let result = '';
  for (const char of text) result += LIGATURES.get(char) ?? char;
  return result.replace(/\s+/g, ' ').trim();
}
