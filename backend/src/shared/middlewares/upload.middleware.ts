// Recebe o arquivo de relatório em memória, com limites e lista de formatos permitidos.
// Memória (e não disco) porque o arquivo é lido, convertido e descartado na mesma requisição:
// nada de resto em /tmp e nada de caminho controlado pelo cliente.
import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { AppError } from '../utils/app-error.js';

/** O extrato mensal da InfinitePay em PDF fica em ~100 KB; 8 MB cobre um ano com folga. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.txt', '.tsv', '.pdf'];
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
  'text/csv',
  'text/plain',
  'text/tab-separated-values',
  'application/pdf',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10 },
  fileFilter: (_request, file, callback) => {
    const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    // Extensão e MIME são ambos informados pelo cliente, então valem como triagem;
    // a validação que conta é o readReport, que decide o formato pelo conteúdo do arquivo.
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      callback(new AppError(
        `Formato "${extension || 'sem extensão'}" não aceito. Envie .xlsx, .csv ou .pdf.`,
        400,
        'UNSUPPORTED_FILE_FORMAT',
      ));
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(new AppError(`Tipo de conteúdo "${file.mimetype}" não aceito.`, 400, 'UNSUPPORTED_FILE_FORMAT'));
      return;
    }
    callback(null, true);
  },
});

export const uploadReportFile: RequestHandler = upload.single('file');

/** Traduz os erros do multer para o envelope de erro da API. */
export const uploadErrorHandler: ErrorRequestHandler = (error, _request, _response, next) => {
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(
        `Arquivo acima do limite de ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
        413,
        'FILE_TOO_LARGE',
      ));
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError('Envie um único arquivo no campo "file".', 400, 'UNEXPECTED_FILE'));
    }
    return next(new AppError('Falha ao receber o arquivo enviado.', 400, 'UPLOAD_FAILED'));
  }
  return next(error);
};
