// Parâmetros do estúdio que ainda não têm cadastro na API.
//
// Ficou quase vazio de propósito, e os dois que saíram valem registro:
//
// - A META MENSAL virou valor editável e mora em store/goalStore.ts, persistida no
//   aparelho. Antes era uma constante aqui, então mudá-la exigia alterar o código.
// - A COMISSÃO saiu inteira: o estúdio não trabalha com repasse por profissional. O
//   servidor ainda tem o campo no lançamento, mas nada mais envia percentual, então ele
//   fica sempre em zero.
// - A TABELA DE TAXAS por forma de pagamento foi para o servidor
//   (DEFAULT_PAYMENT_FEE_RATES, em modules/transactions/calculation.service.ts), para o
//   app não carregar número de negócio.

export {};
