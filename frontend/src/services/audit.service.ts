// Chamadas de /api/audits. Corresponde a backend/src/routes/audit.routes.ts.
//
// A auditoria confronta o que o Booksy diz que foi vendido com o que entrou na conta da
// InfinitePay. Os dois relatórios vão no MESMO envio: um mês só faz sentido conferido dos
// dois lados, e importar um de cada vez é o que permitia ver meio mês e achar que o
// arquivo tinha sido lido errado.
//
// Nenhum número é calculado aqui. A diferença, o desfecho e os três saldos vêm do
// servidor a cada leitura — é a mesma conta para a tela de Importar e para o Painel.
import { api, postFormData } from './api';
import { ApiResponse, AuditEntryInput, AuditSubmitResult, AuditSummary, PickedFile } from '../types';
import type { PeriodKey } from '../utils/period';

export interface AuditSubmitRequest {
  booksy: PickedFile;
  infinitepay: PickedFile;
  /** Comissão aplicada às receitas do Booksy, em fração (0.4 = 40%). */
}

/**
 * Monta o multipart com os dois arquivos. No React Native o FormData aceita
 * { uri, name, type } em vez de um Blob — é assim que o arquivo escolhido pelo
 * expo-document-picker é enviado sem carregá-lo inteiro na memória do app.
 */
function buildForm({ booksy, infinitepay }: AuditSubmitRequest): FormData {
  const form = new FormData();
  for (const [field, file] of [['booksy', booksy], ['infinitepay', infinitepay]] as const) {
    form.append(field, {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
  }
  return form;
}

export const auditService = {
  /** Estado do mês: os dois totais, a diferença, o desfecho e os três saldos. */
  async getSummary(period: PeriodKey): Promise<AuditSummary> {
    const response = await api.get<ApiResponse<AuditSummary>>('/audits', { params: { period } });
    return response.data.data;
  },

  /** Envia os dois relatórios juntos e devolve a auditoria de cada mês tocado. */
  async submit(request: AuditSubmitRequest): Promise<AuditSubmitResult> {
    const response = await postFormData<ApiResponse<AuditSubmitResult>>('/audits', buildForm(request));
    return response.data;
  },

  /** O Lançamento Manual que justifica a diferença, com a auditoria já recalculada. */
  async addEntry(period: PeriodKey, entry: AuditEntryInput): Promise<AuditSummary> {
    const response = await api.post<ApiResponse<AuditSummary>>(`/audits/${period}/entries`, entry);
    return response.data.data;
  },
};

/** Rótulo de cada motivo e o que ele faz, para a tela não ter de explicar o sinal. */
export const AUDIT_REASON_LABELS: Record<AuditEntryInput['reason'], { label: string; help: string }> = {
  dinheiro: {
    label: 'Pago em dinheiro',
    help: 'O serviço está no Booksy, mas o cliente pagou em espécie e o valor não passou pela conta.',
  },
  taxa: {
    label: 'Taxa descontada',
    help: 'A InfinitePay retém a tarifa antes de repassar, então caiu menos do que foi vendido.',
  },
  gorjeta: {
    label: 'Gorjeta ou extra',
    help: 'Caiu na conta um valor que não é atendimento.',
  },
  estorno: {
    label: 'Estorno',
    help: 'Um valor voltou para o cliente depois de já ter entrado.',
  },
  outro: {
    label: 'Outro motivo',
    help: 'Diga de que lado está a sobra; descreva o que aconteceu.',
  },
};
