// Ponto único de entrada da leitura de arquivos: identifica o formato pelo conteúdo e delega.
//
// A extensão e o MIME do upload vêm do cliente e podem estar errados (celular mandando .xlsx
// como application/octet-stream é rotina), então quem decide o formato é o começo do arquivo:
// "PK\x03\x04" para .xlsx e "%PDF-" para PDF. Texto puro não tem assinatura, então aí vale a
// extensão.
import { AppError } from '../../shared/utils/app-error.js';
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
