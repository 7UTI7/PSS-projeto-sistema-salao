// Tradução dos enums da API para o texto que aparece na tela.
// Centralizar evita que cada tela escreva "Liquidada" de um jeito diferente.
import type {
  CategoryKind,
  CostType,
  ImportBatchStatus,
  ImportSource,
  PaymentMethod,
  TransactionOrigin,
  TransactionStatus,
  TransactionType,
} from '../types';

export const transactionTypeLabels: Record<TransactionType, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  pix: 'Pix',
  credito: 'Crédito',
  debito: 'Débito',
  dinheiro: 'Dinheiro',
  nao_informado: 'Não informado',
};

export const transactionStatusLabels: Record<TransactionStatus, string> = {
  pendente: 'Pendente',
  liquidada: 'Liquidada',
  cancelada: 'Cancelada',
};

export const transactionOriginLabels: Record<TransactionOrigin, string> = {
  manual: 'Manual',
  booksy: 'Booksy',
  infinitepay: 'InfinitePay',
};

export const costTypeLabels: Record<CostType, string> = {
  fixo: 'Custo fixo',
  variavel: 'Custo variável',
};

export const categoryKindLabels: Record<CategoryKind, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
  ambos: 'Receita e despesa',
};

export const importSourceLabels: Record<ImportSource, string> = {
  booksy: 'Booksy',
  infinitepay: 'InfinitePay',
};

export const importBatchStatusLabels: Record<ImportBatchStatus, string> = {
  received: 'Em processamento',
  processed: 'Importado',
  failed: 'Falhou',
  rolled_back: 'Desfeito',
};
