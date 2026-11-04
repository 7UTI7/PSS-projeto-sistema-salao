// Leitura de planilhas: converte .xlsx e .csv em tabelas de texto, sem dependência pesada.
import { unzipSync, strFromU8 } from 'fflate';
import { AppError } from '../../shared/utils/app-error.js';
import type { SheetTable } from './import.types.js';

/** Dia 0 da contagem serial do Excel (1899-12-30, por causa do bug do ano 1900). */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

/** Um .xlsx é um ZIP; um ZIP sempre começa com "PK\x03\x04". */
function isZip(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

export function readSpreadsheet(buffer: Buffer, fileName: string): SheetTable[] {
  if (isZip(buffer)) return readXlsx(buffer);
  if (/\.(csv|txt|tsv)$/i.test(fileName)) return [readCsv(buffer, fileName)];
  throw new AppError(
    'Formato não reconhecido. Envie o relatório em .xlsx ou .csv.',
    400,
    'UNSUPPORTED_FILE_FORMAT',
  );
}

// ---------------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------------

function readXlsx(buffer: Buffer): SheetTable[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new AppError('Não foi possível abrir a planilha: arquivo corrompido.', 400, 'CORRUPT_SPREADSHEET');
  }

  const workbook = entryAsText(files, 'xl/workbook.xml');
  if (!workbook) throw new AppError('A planilha não tem a estrutura de um .xlsx.', 400, 'INVALID_XLSX');

  const sharedStrings = readSharedStrings(entryAsText(files, 'xl/sharedStrings.xml'));
  const relations = readRelations(entryAsText(files, 'xl/_rels/workbook.xml.rels'));
  const tables: SheetTable[] = [];

  for (const sheet of workbook.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const attributes = sheet[1] ?? '';
    const name = decodeXml(attribute(attributes, 'name') ?? `Planilha ${tables.length + 1}`);
    const relationId = attribute(attributes, 'r:id') ?? attribute(attributes, 'id');
    const target = relationId ? relations.get(relationId) : undefined;
    const content = target ? entryAsText(files, normalizeTarget(target)) : undefined;
    if (content) tables.push({ name, rows: readSheetRows(content, sharedStrings) });
  }

  if (tables.length === 0) throw new AppError('A planilha não tem abas legíveis.', 400, 'EMPTY_SPREADSHEET');
  return tables;
}

function entryAsText(files: Record<string, Uint8Array>, path: string): string | undefined {
  const entry = files[path];
  return entry ? strFromU8(entry) : undefined;
}

/** Caminhos nos rels vêm relativos a xl/ (e às vezes absolutos, com /xl/ na frente). */
function normalizeTarget(target: string): string {
  const clean = target.replace(/^\/+/, '');
  return clean.startsWith('xl/') ? clean : `xl/${clean}`;
}

function attribute(attributes: string, name: string): string | undefined {
  const match = new RegExp(`${name.replace(':', '\\:')}="([^"]*)"`).exec(attributes);
  return match?.[1];
}

function readRelations(xml: string | undefined): Map<string, string> {
  const relations = new Map<string, string>();
  if (!xml) return relations;
  for (const relation of xml.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const attributes = relation[1] ?? '';
    const id = attribute(attributes, 'Id');
    const target = attribute(attributes, 'Target');
    if (id && target) relations.set(id, decodeXml(target));
  }
  return relations;
}

/** sharedStrings.xml guarda cada texto uma única vez; as células referenciam pelo índice. */
function readSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const strings: string[] = [];
  for (const item of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const fragments = [...(item[1] ?? '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)];
    strings.push(fragments.map((fragment) => decodeXml(fragment[1] ?? '')).join(''));
  }
  return strings;
}

/** Converte "C5" em 2 (índice da coluna, base zero). */
function columnIndex(reference: string): number {
  const letters = /^([A-Z]+)/.exec(reference.toUpperCase())?.[1] ?? 'A';
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function readSheetRows(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];

  for (const row of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cell of (row[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cell[1] ?? '';
      const index = columnIndex(attribute(attributes, 'r') ?? 'A1');
      while (cells.length <= index) cells.push('');
      cells[index] = readCellValue(attribute(attributes, 't'), cell[2] ?? '', sharedStrings);
    }

    // O atributo r da linha é a posição real na planilha: respeitá-lo mantém o
    // alinhamento quando a exportação omite linhas totalmente vazias.
    const declaredIndex = Number(attribute(row[1] ?? '', 'r'));
    if (Number.isFinite(declaredIndex) && declaredIndex > 0) {
      while (rows.length < declaredIndex - 1) rows.push([]);
      rows[declaredIndex - 1] = cells;
    } else {
      rows.push(cells);
    }
  }

  return rows;
}

function readCellValue(type: string | undefined, body: string, sharedStrings: string[]): string {
  const inline = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
    .map((match) => decodeXml(match[1] ?? ''))
    .join('');
  const value = decodeXml(/<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '');

  if (type === 's') {
    const index = Number(value);
    return Number.isInteger(index) ? (sharedStrings[index] ?? '') : '';
  }
  if (type === 'inlineStr') return inline;
  if (type === 'b') return value === '1' ? 'true' : 'false';
  if (type === 'e') return '';
  return value || inline;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, String.fromCharCode(39))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Exportações brasileiras alternam entre ";" e ","; decide pelo que aparece mais na 1ª linha. */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  let best = ',';
  let bestCount = -1;
  for (const candidate of [';', ',', '\t']) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function readCsv(buffer: Buffer, fileName: string): SheetTable {
  // Exportações do Excel vêm com BOM; sem remover, o 1º cabeçalho nunca casa.
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let cells: string[] = [];
  let value = '';
  let quoted = false;

  for (let position = 0; position < text.length; position += 1) {
    const char = text[position];

    if (quoted) {
      if (char === '"') {
        if (text[position + 1] === '"') {
          value += '"';
          position += 1;
        } else {
          quoted = false;
        }
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(value);
      value = '';
    } else if (char === '\n') {
      cells.push(value);
      rows.push(cells);
      cells = [];
      value = '';
    } else if (char !== '\r') {
      value += char ?? '';
    }
  }

  if (value !== '' || cells.length > 0) {
    cells.push(value);
    rows.push(cells);
  }

  return { name: fileName, rows };
}

// ---------------------------------------------------------------------------
// Conversão de valores de célula
// ---------------------------------------------------------------------------

/**
 * "1.495" é ambíguo: 1495 em pt-BR, 1,495 em en-US. A convenção que resolve é o número
 * de casas depois do separador — 3 casas é agrupamento de milhar, 1 ou 2 é decimal.
 * "0.123" fica de fora porque ninguém escreve zero como parte inteira de um milhar.
 */
function isThousandsOnly(digits: string): boolean {
  const match = /^(\d+)([.,])(\d{3})$/.exec(digits);
  return match !== null && match[1] !== '0';
}

/**
 * Converte o texto de uma célula em número, tolerando os formatos que aparecem
 * nas exportações: "R$ 1.234,56", "1,234.56", "1234,56" e "(50,00)" (negativo).
 */
export function parseAmount(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;

  const negative = /^\(.*\)$/.test(text) || text.includes('-');
  const digits = text.replace(/[^\d.,]/g, '');
  if (!digits) return null;

  const lastComma = digits.lastIndexOf(',');
  const lastDot = digits.lastIndexOf('.');
  let normalized: string;

  if (lastComma === -1 && lastDot === -1) {
    normalized = digits;
  } else if (isThousandsOnly(digits)) {
    normalized = digits.replace(/[.,]/g, '');
  } else if (lastComma > lastDot) {
    // Vírgula é o separador decimal (pt-BR): o que vem antes é milhar.
    normalized = `${digits.slice(0, lastComma).replace(/[.,]/g, '')}.${digits.slice(lastComma + 1)}`;
  } else {
    normalized = `${digits.slice(0, lastDot).replace(/[.,]/g, '')}.${digits.slice(lastDot + 1)}`;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

/**
 * Converte o texto de uma célula em data, aceitando dd/mm/aaaa (com hora opcional),
 * ISO 8601 e o número serial do Excel.
 */
export function parseSpreadsheetDate(raw: string): Date | null {
  const text = raw.trim();
  if (!text) return null;

  const brazilian = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(text);
  if (brazilian) {
    const [, day, month, rawYear, hour, minute, second] = brazilian;
    const year = Number(rawYear);
    const date = new Date(Date.UTC(
      year < 100 ? 2000 + year : year,
      Number(month) - 1,
      Number(day),
      Number(hour ?? 0),
      Number(minute ?? 0),
      Number(second ?? 0),
    ));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const date = new Date(text.length === 10 ? `${text}T00:00:00.000Z` : text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Serial do Excel: 45000 ≈ 2023-03-15. Os limites evitam confundir com um valor qualquer.
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 20_000 && serial < 80_000) {
    return new Date(EXCEL_EPOCH_MS + Math.round(serial * MS_PER_DAY));
  }

  return null;
}

/** Normaliza cabeçalhos para comparação: sem acento, sem pontuação, minúsculo. */
export function normalizeHeader(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
