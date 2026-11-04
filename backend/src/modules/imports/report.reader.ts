// Ponto único de entrada da leitura de arquivos: identifica o formato pelo conteúdo e delega.
//
// A extensão e o MIME do upload vêm do cliente e podem estar errados (celular mandando .xlsx
// como application/octet-stream é rotina), então quem decide o formato é o começo do arquivo:
// "PK\x03\x04" para .xlsx e "%PDF-" para PDF. Texto puro não tem assinatura, então aí vale a
// extensão.
import { AppError } from '../../shared/utils/app-error.js';
import { normalizeHeader } from './spreadsheet.reader.js';
import type { SheetTable } from './import.types.js';
import { isPdf, readPdf } from './pdf.reader.js';
import { readSpreadsheet } from './spreadsheet.reader.js';

/**
 * Lê o relatório enviado e devolve tabelas de texto.
 *
 * Em uma planilha cada tabela é uma aba; em um PDF, cada tabela é uma página. Os parsers
 * trabalham sobre essa mesma forma, então não precisam saber de qual formato vieram.
 */
export function readReport(buffer: Buffer, fileName: string): SheetTable[] {
  if (isPdf(buffer)) return readPdf(buffer);
  if (/\.pdf$/i.test(fileName)) {
    throw new AppError(
      'O arquivo tem extensão .pdf mas o conteúdo não é um PDF.',
      400,
      'UNSUPPORTED_FILE_FORMAT',
    );
  }
  return readSpreadsheet(buffer, fileName);
}

/**
 * Diz de qual relatório uma leitura parece ser, pelo que está escrito nas células.
 *
 * Serve a um engano concreto e fácil de cometer: trocar os dois arquivos de campo na
 * tela de conferência. Sem isto, o Booksy recebia o extrato e respondia "não encontrei a
 * aba Lista de agendamentos" — uma mensagem sobre a estrutura do arquivo, quando o
 * problema era só o campo em que ele foi posto.
 */
export function looksLike(tables: readonly SheetTable[]): 'booksy' | 'infinitepay' | null {
  let booksy = false;
  let statement = false;

  for (const table of tables) {
    if (/^(lista de agendamentos|receita total)/i.test(table.name.trim())) booksy = true;
    for (const row of table.rows) {
      for (const cell of row) {
        const text = normalizeHeader(cell);
        if (!text) continue;
        if (text === 'id da reserva' || text === 'categoria principal') booksy = true;
        if (text === 'tipo de transacao' || text.startsWith('relatorio de movimentacoes')) {
          statement = true;
        }
      }
    }
  }

  // O relatório do Booksy também tem coluna "Serviço" e o extrato também tem "Data", por
  // isso só os marcadores exclusivos acima contam. Empate não decide nada.
  if (booksy === statement) return null;
  return booksy ? 'booksy' : 'infinitepay';
}
