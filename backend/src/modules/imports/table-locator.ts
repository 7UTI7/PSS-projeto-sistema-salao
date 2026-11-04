// Localiza a aba e a linha de cabeçalho de uma exportação e indexa as colunas por apelido.
// As plataformas mudam a ordem e a grafia das colunas entre versões; procurar pelo nome
// (em vez de fixar a posição) evita que uma atualização do Booksy quebre a importação.
import { AppError } from '../../shared/utils/app-error.js';
import { normalizeHeader, parseAmount, parseSpreadsheetDate } from './spreadsheet.reader.js';
import type { SheetTable } from './import.types.js';

/** Apelidos aceitos para uma coluna, já na forma normalizada. */
export type ColumnAliases = Record<string, readonly string[]>;

export interface LocatedTable {
  sheetName: string;
  /** Número da linha de cabeçalho na planilha (base 1), usado nas mensagens de erro. */
  headerLine: number;
  headers: string[];
  dataRows: string[][];
  /** Nome lógico da coluna -> índice na linha. */
  columns: Map<string, number>;
}

export function findSheet(tables: SheetTable[], aliases: readonly string[]): SheetTable | undefined {
  const wanted = aliases.map(normalizeHeader);
  return tables.find((table) => wanted.includes(normalizeHeader(table.name)));
}

/**
 * Procura, nas primeiras linhas da aba, a que contém todos os cabeçalhos obrigatórios.
 * Exportações costumam ter título e subtítulo antes da tabela (no Booksy, a tabela começa
 * na linha 5), então varrer é mais confiável do que assumir que o cabeçalho é a linha 1.
 */
export function locateTable(
  table: SheetTable,
  aliases: ColumnAliases,
  required: readonly string[],
  searchDepth = 25,
): LocatedTable {
  const limit = Math.min(table.rows.length, searchDepth);

  for (let index = 0; index < limit; index += 1) {
    const row = table.rows[index] ?? [];
    const columns = mapColumns(row, aliases);
    if (required.every((name) => columns.has(name))) {
      return {
        sheetName: table.name,
        headerLine: index + 1,
        headers: row.map((cell) => cell.trim()).filter(Boolean),
        dataRows: table.rows.slice(index + 1),
        columns,
      };
    }
  }

  const found = table.rows
    .slice(0, limit)
    .flat()
    .map((cell) => cell.trim())
    .filter(Boolean)
    .slice(0, 20);

  throw new AppError(
    `Não encontrei as colunas esperadas na aba "${table.name}". `
      + `Faltam: ${required.join(', ')}. Colunas lidas: ${found.join(' | ') || '(nenhuma)'}.`,
    400,
    'UNRECOGNIZED_COLUMNS',
  );
}

function mapColumns(row: readonly string[], aliases: ColumnAliases): Map<string, number> {
  const columns = new Map<string, number>();

  row.forEach((cell, index) => {
    const header = normalizeHeader(cell);
    if (!header) return;
    for (const [name, candidates] of Object.entries(aliases)) {
      if (!columns.has(name) && candidates.includes(header)) columns.set(name, index);
    }
  });

  return columns;
}

/** Leitores de célula que já respeitam o índice opcional vindo de columns.get(). */
export function cellText(row: readonly string[], index: number | undefined): string {
  if (index === undefined) return '';
  return (row[index] ?? '').trim();
}

export function cellAmount(row: readonly string[], index: number | undefined): number | null {
  return parseAmount(cellText(row, index));
}

export function cellDate(row: readonly string[], index: number | undefined): Date | null {
  return parseSpreadsheetDate(cellText(row, index));
}

/** Uma linha é "vazia" quando nenhuma célula tem conteúdo — fim da tabela, na prática. */
export function isBlankRow(row: readonly string[]): boolean {
  return row.every((cell) => cell.trim() === '');
}
