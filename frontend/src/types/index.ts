// Tipos centrais do Frontend - Nicolle Neris Studio
// Alinhados com a especificação técnica do backend e regras de negócio

export type UserRole = 'admin' | 'colaborador';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword?: boolean;
  lastPasswordChange?: string;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'receita' | 'despesa';

export type PaymentMethod =
  | 'dinheiro'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'pix'
  | 'boleto';

export type TransactionStatus = 'pendente' | 'liquidado' | 'cancelado';

export interface Transaction {
  _id: string;
  description: string;
  type: TransactionType;
  category: string;
  grossAmount: number;
  discountAmount?: number;
  baseAmount: number;
  feeRate?: number;
  feeAmount?: number;
  netAmount: number;
  commissionRate?: number;
  commissionAmount?: number;
  studioNetProfit?: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  date: string;
  settledAt?: string;
  professional?: string;
  notes?: string;
  userId: string;
  deleted_at?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionDTO {
  description: string;
  type: TransactionType;
  category: string;
  grossAmount: number;
  discountAmount?: number;
  feeRate?: number;
  commissionRate?: number;
  paymentMethod: PaymentMethod;
  status?: TransactionStatus;
  date: string;
  notes?: string;
}

export interface Category {
  _id: string;
  name: string;
  type: TransactionType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DREReport {
  period: {
    start: string;
    end: string;
  };
  grossRevenue: number;
  discounts: number;
  netRevenue: number;
  cardFees: number;
  commissions: number;
  operationalCosts: number;
  expenses: number;
  netIncome: number;
  breakdownByCategory: Record<string, number>;
}

export interface CashFlowReport {
  period: {
    start: string;
    end: string;
  };
  totalInflow: number;
  totalOutflow: number;
  netBalance: number;
  settledTransactionsCount: number;
  dailyBalance: Array<{
    date: string;
    inflow: number;
    outflow: number;
    balance: number;
  }>;
}

// Envelope padrão da API
export interface ApiResponse<T> {
  status: 'success';
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  status: 'error';
  message: string;
  errors?: Record<string, string[]>;
}
