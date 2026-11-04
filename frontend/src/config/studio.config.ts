// Parâmetros do estúdio que ainda não têm cadastro na API.
//
// Tudo aqui é configuração local: o backend não tem módulo de metas nem de regras de
// comissão (ver "Limitações conhecidas" em Documents/RELATORIO_BACKEND.md). Enquanto
// não tiver, estes valores ficam num só lugar em vez de espalhados pelas telas.

/** Meta de faturamento bruto do mês, usada na barra de progresso do Dashboard. */
export const MONTHLY_REVENUE_GOAL = 5000;

/**
 * Comissão padrão da profissional, aplicada como sugestão no lançamento manual e na
 * importação do Booksy (que não traz o percentual). Fração, não percentual: 0.4 = 40%.
 */
export const DEFAULT_COMMISSION_RATE = 0.4;

// A tabela de taxa por forma de pagamento saiu daqui: ela vive no servidor
// (DEFAULT_PAYMENT_FEE_RATES, em modules/transactions/calculation.service.ts). O app
// deixa o campo vazio e o servidor aplica o padrão da forma de pagamento escolhida.
