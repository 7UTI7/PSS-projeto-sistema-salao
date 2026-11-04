// Utilitários de formatação para o Nicolle Neris Studio
// Regra do projeto: Moeda sempre formatada como R$ 1.234,56

/**
 * Formata um valor numérico para o padrão de moeda brasileiro (BRL)
 * Exemplo: 1234.56 -> "R$ 1.234,56"
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'R$ 0,00';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Todas as datas são exibidas em UTC, nunca no fuso do aparelho.
 *
 * O importador grava a hora de parede que está no arquivo (um movimento às 02:03 do dia
 * 01/10 vira 2026-10-01T02:03Z) e o filtro de mês também consulta em UTC. Formatar no
 * fuso do celular jogava 8 das 90 movimentações do extrato para o dia anterior — uma
 * delas trocava de mês, aparecendo como 30/09 enquanto contava em outubro.
 */
const UTC = 'UTC' as const;

/**
 * Formata uma data ISO para DD/MM/YYYY
 */
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: UTC,
  }).format(date);
}

/**
 * Formata uma data e hora para DD/MM/YYYY às HH:mm
 */
export function formatDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: UTC,
  }).format(date);
}

/**
 * Formata uma fração como percentual: 0.0399 -> "3,99%".
 * A API trabalha sempre com fração; o percentual existe só para leitura.
 */
export function formatPercent(rate: number | null | undefined, fractionDigits = 2): string {
  if (rate === null || rate === undefined || isNaN(rate)) return '0%';
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(rate);
}

/** Moeda sem casas decimais, para números grandes em cartões (R$ 1.495). */
export function formatCurrencyShort(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Apenas o horário (HH:mm), usado na lista de lançamentos recentes. */
export function formatTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '--:--';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '--:--';

  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: UTC }).format(date);
}

/** "Hoje, 15:40" / "Ontem, 14:15" / "28 ago, 18:00" — rótulo curto da lista. */
export function formatRelativeDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '-';

  // Compara os dias em UTC, igual ao resto da formatação: usar o dia local faria um
  // movimento das 02:00 UTC ser "ontem" para quem está em BRT.
  const startOfDayUtc = (value: Date) =>
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  const daysApart = Math.round((startOfDayUtc(new Date()) - startOfDayUtc(date)) / 86400000);
  const time = formatTime(date);

  if (daysApart === 0) return `Hoje, ${time}`;
  if (daysApart === 1) return `Ontem, ${time}`;

  const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: UTC }).format(date);
  return `${shortDate.replace('.', '')}, ${time}`;
}

/** Participação de uma parte no total, protegida contra divisão por zero. */
export function shareOf(part: number, total: number): number {
  if (!total) return 0;
  return part / total;
}

/**
 * Converte o texto digitado num campo de valor para número.
 * Aceita "1.234,56" e "1234.56"; devolve 0 quando não dá para ler.
 */
export function parseAmountInput(value: string): number {
  const clean = value.trim().replace(/[^\d.,-]/g, '');
  if (!clean) return 0;

  const lastComma = clean.lastIndexOf(',');
  const lastDot = clean.lastIndexOf('.');
  let normalized: string;

  if (lastComma === -1 && lastDot === -1) normalized = clean;
  else if (lastComma > lastDot) normalized = `${clean.slice(0, lastComma).replace(/[.,]/g, '')}.${clean.slice(lastComma + 1)}`;
  else normalized = `${clean.slice(0, lastDot).replace(/[.,]/g, '')}.${clean.slice(lastDot + 1)}`;

  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}
