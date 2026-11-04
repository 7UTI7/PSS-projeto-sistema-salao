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

/**
 * Taxa sugerida por forma de pagamento, em fração. Serve apenas para pré-preencher o
 * formulário — o valor que vale é o que a dona confirma antes de salvar, e o cálculo
 * final é sempre feito no servidor.
 */
export const SUGGESTED_PAYMENT_FEE_RATES: Record<string, number> = {
  pix: 0,
  dinheiro: 0,
  debito: 0.0139,
  credito: 0.0399,
};
