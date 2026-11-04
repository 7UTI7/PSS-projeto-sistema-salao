// Cálculo do período (mês) usado nos relatórios.
//
// Os endpoints de relatório exigem start e end como datas ISO 8601 completas
// (z.string().datetime() no backend): mandar "2026-08-01" devolve 400. Por isso
// todo range sai daqui já com hora e com Z.

/** Mês de referência no formato "YYYY-MM" — a chave que viaja no estado do app. */
export type PeriodKey = string;

export interface PeriodRange {
  /** Primeiro instante do mês, em ISO com Z. */
  start: string;
  /** Último instante do mês, em ISO com Z. */
  end: string;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function currentPeriodKey(reference: Date = new Date()): PeriodKey {
  return toPeriodKey(reference.getFullYear(), reference.getMonth());
}

export function toPeriodKey(year: number, monthIndex: number): PeriodKey {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function parsePeriodKey(key: PeriodKey): { year: number; monthIndex: number } {
  const [year, month] = key.split('-');
  const parsedYear = Number(year);
  const parsedMonth = Number(month);

  if (!Number.isInteger(parsedYear) || !Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }
  return { year: parsedYear, monthIndex: parsedMonth - 1 };
}

/**
 * Intervalo fechado do mês. O fim é 23:59:59.999 do último dia porque o backend
 * compara com $lte — usar o dia 1º do mês seguinte incluiria lançamentos a mais.
 */
export function periodRange(key: PeriodKey): PeriodRange {
  const { year, monthIndex } = parsePeriodKey(key);
  return {
    start: new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0)).toISOString(),
    end: new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)).toISOString(),
  };
}

/**
 * Mês a que uma data pertence, lido em UTC.
 *
 * Tem de ser UTC: o importador grava a hora de parede do arquivo, então um movimento de
 * 01/10 às 02:03 é 2026-10-01T02:03Z. Lido no fuso do celular viraria setembro, e o mês
 * sugerido depois da importação sairia errado.
 */
export function periodKeyOf(date: string | Date): PeriodKey {
  const value = typeof date === 'string' ? new Date(date) : date;
  return toPeriodKey(value.getUTCFullYear(), value.getUTCMonth());
}

/** "Agosto 2026" — o rótulo do seletor de período no cabeçalho. */
export function periodLabel(key: PeriodKey): string {
  const { year, monthIndex } = parsePeriodKey(key);
  return `${MONTH_NAMES[monthIndex] ?? ''} ${year}`;
}

/** Desloca o mês de referência (−1 = mês anterior). */
export function shiftPeriod(key: PeriodKey, months: number): PeriodKey {
  const { year, monthIndex } = parsePeriodKey(key);
  const shifted = new Date(Date.UTC(year, monthIndex + months, 1));
  return toPeriodKey(shifted.getUTCFullYear(), shifted.getUTCMonth());
}

/** Quantos dias faltam até o fim do mês (0 quando o mês já passou). */
export function daysLeftInPeriod(key: PeriodKey, reference: Date = new Date()): number {
  const { year, monthIndex } = parsePeriodKey(key);
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  const today = Date.UTC(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const remaining = Math.ceil((lastDay.getTime() - today) / 86_400_000);
  return Math.max(remaining, 0);
}

/** true quando a data ISO cai dentro do mês de referência. */
export function isWithinPeriod(isoDate: string, key: PeriodKey): boolean {
  const range = periodRange(key);
  return isoDate >= range.start && isoDate <= range.end;
}

/** Lista os últimos N meses, do mais recente para o mais antigo, para o seletor. */
export function recentPeriods(count: number, reference: Date = new Date()): PeriodKey[] {
  const base = currentPeriodKey(reference);
  return Array.from({ length: count }, (_value, index) => shiftPeriod(base, -index));
}
