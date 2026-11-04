// Chamadas de /api/imports. Corresponde a backend/src/routes/import.routes.ts.
//
// Papel de cada origem (a API trata as duas de formas diferentes de propósito):
//   Booksy      -> o relatório de agendamentos vira RECEITA (serviço, profissional, valor)
//   InfinitePay -> o extrato vira CAIXA: Pix recebidos e repasses da maquininha, já
//                  líquidos de tarifa, mais as saídas da conta
// O faturamento do mês é sempre o do Booksy. O extrato não entra como receita no DRE —
// seria o mesmo atendimento contado duas vezes —, serve para conferir quanto do que foi
// vendido realmente caiu na conta. Essa comparação é a conciliação.
import { api, postFormData } from './api';
import { ApiResponse, ImportBatch, ImportPreview, ImportResult, ImportSource, PickedFile } from '../types';

export interface ImportRequest {
  source: ImportSource;
  file: PickedFile;
  /** Comissão aplicada às receitas do Booksy, em fração (0.4 = 40%). */
  defaultCommissionRate?: number;
}

/**
 * Monta o multipart. No React Native o FormData aceita { uri, name, type } em vez de um
 * Blob — é assim que o arquivo escolhido pelo expo-document-picker é enviado sem
 * precisar carregá-lo inteiro na memória do app.
 */
function buildForm({ source, file, defaultCommissionRate }: ImportRequest): FormData {
  const form = new FormData();
  form.append('source', source);
  if (defaultCommissionRate !== undefined) {
    form.append('defaultCommissionRate', String(defaultCommissionRate));
  }
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);
  return form;
}

export const importService = {
  /** Simula a importação: mostra o que entraria, sem gravar nada. */
  async preview(request: ImportRequest): Promise<ImportPreview> {
    const response = await postFormData<ApiResponse<ImportPreview>>(
      '/imports/preview',
      buildForm(request)
    );
    return response.data;
  },

  /** Processa de verdade: cria os lançamentos e registra o lote. */
  async process(request: ImportRequest): Promise<ImportResult> {
    const response = await postFormData<ApiResponse<ImportResult>>('/imports', buildForm(request));
    return response.data;
  },

  async listBatches(): Promise<ImportBatch[]> {
    const response = await api.get<ApiResponse<ImportBatch[]>>('/imports');
    return response.data.data;
  },

  /** Desfaz o lote: os lançamentos criados por ele saem das listas e dos relatórios. */
  async rollback(batchId: string): Promise<{ removedCount: number }> {
    const response = await api.delete<ApiResponse<{ removedCount: number }>>(`/imports/${batchId}`);
    return response.data.data;
  },
};

/**
 * MIME types aceitos por origem, para o seletor abrir só o que a API consegue ler.
 * São listas diferentes de propósito: o Booksy exporta planilha e o extrato da
 * InfinitePay sai em PDF pelo app. Oferecer PDF no card do Booksy (ou .xlsx no da
 * InfinitePay) só levaria o arquivo a um 400 depois do upload.
 */
export const ACCEPTED_MIME_TYPES_BY_SOURCE: Record<ImportSource, string[]> = {
  booksy: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/comma-separated-values',
    'text/plain',
  ],
  infinitepay: [
    'application/pdf',
    'text/csv',
    'text/comma-separated-values',
    'text/plain',
  ],
};

/** Formatos de cada origem em texto, para o rótulo do botão de seleção. */
export const ACCEPTED_EXTENSIONS_LABEL: Record<ImportSource, string> = {
  booksy: '.xlsx ou .csv',
  infinitepay: '.pdf ou .csv',
};
