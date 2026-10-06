# Backend - Sistema Salão

API em Node.js 20+, TypeScript 5, Express 5 e MongoDB Atlas/Mongoose 8. Os módulos ficam separados por responsabilidade em `src/`: `config`, `models`, `controllers`, `services`, `middlewares`, `routes`, `utils` e `scripts`.

## Execução local

1. Use Node.js 20 ou superior e configure um MongoDB Atlas acessível.
2. Copie `.env.example` para `.env` e defina `MONGO_URI`, `JWT_SECRET` (mínimo 32 caracteres) e `PORT`. SMTP completo é necessário para enviar confirmação e recuperação de senha.
3. Execute `npm install`, depois `npm run bootstrap:admin` uma vez para criar o primeiro admin a partir das variáveis `BOOTSTRAP_ADMIN_*` no `.env`.
4. Inicie com `npm run dev`; verifique `GET /health`.

Para validar a entrega: `npm run lint`, `npm run typecheck`, `npm run test` e `npm run coverage`.

## Rotas iniciais

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/verify-email`
- `POST /api/auth/forgot-password`, `GET|POST /api/auth/reset-password`, `POST /api/auth/change-password`
- `POST /api/auth/users`, `GET /api/auth/users`, `DELETE /api/auth/users/:id` (somente admin; desativação lógica, sem hard delete)
- `GET|POST /api/transactions` e `DELETE /api/transactions/:id` (soft delete)
- `GET /api/reports/dre` e `GET /api/reports/cash-flow` (somente admin; `start` e `end` em ISO 8601)

Cadastro público sempre cria `colaborador`; somente o admin pode criar outras contas ou atribuir papel. O JWT expira em 8 horas e o papel é recarregado do banco em cada requisição. Senhas usam bcrypt com 12 rounds e até 72 bytes (limite efetivo do bcrypt). Tokens de confirmação/reset são UUID v4 aleatórios, armazenados como SHA-256 e expiram em 15 minutos.

O cálculo de receita segue a ordem solicitada: base = bruto - desconto; taxa = base × alíquota; líquido = base - taxa; comissão = base × percentual; resultado do estúdio = líquido - comissão. A comissão não reduz o valor liquidado pela maquininha. Cada valor é arredondado a centavos. Despesas não passam pelo cálculo de receita.

## Observações de operação

O serviço SMTP precisa estar configurado para os fluxos de e-mail. O link de redefinição abre o formulário HTML leve da API e envia `token` e `password` a `POST /api/auth/reset-password`; o app mobile pode substituir esse destino por um deep link próprio. Em produção, defina `CORS_ORIGIN` com origens explícitas e use HTTPS. `OTEL_EXPORTER_OTLP_ENDPOINT` habilita exportação de traces OpenTelemetry; Datadog e New Relic podem consumir OTLP.

Veja [DEPLOYMENT.md](DEPLOYMENT.md) para a VPS e o guia de divulgação responsável em [../SECURITY.md](../SECURITY.md).