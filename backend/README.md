# Backend - Sistema Salão

API em Node.js 20+, TypeScript 5, Express 5 e MongoDB Atlas/Mongoose 8. Os módulos ficam separados por responsabilidade em `src/`: `config`, `models`, `controllers`, `services`, `middlewares`, `routes`, `utils` e `scripts`.

## Execução local

### Pré-requisitos

- Node.js 20 ou superior e npm.
- Um cluster MongoDB Atlas e o endereço IP de desenvolvimento permitido em **Network Access**.
- Postman para os testes HTTP.
- Uma caixa SMTP de teste (por exemplo, Mailtrap Email Sandbox) para confirmação e reset de senha.
- Docker Desktop apenas para a observabilidade local com Jaeger.

### Instalação e configuração

No PowerShell, execute a partir desta pasta (`backend`):

```powershell
npm ci
Copy-Item .env.example .env
```

Edite `.env` localmente. Defina `PORT=3000`, `MONGO_URI` com a URI do Atlas, `MONGO_DB_NAME=test`, `JWT_SECRET` com pelo menos 32 caracteres e `CORS_ORIGIN=http://localhost:8081`. Não compartilhe nem versione `.env`. Se o DNS SRV falhar na sua rede, preencha `MONGO_DNS_SERVERS`; caso contrário, deixe a variável vazia.

Para testar e-mail, preencha todas as variáveis `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM` com os dados da sandbox. A configuração deve estar completa antes de iniciar a API. Use credenciais somente no arquivo local e não no Postman, README, screenshots ou GitHub.

Crie o primeiro administrador apenas se ainda não existir, preenchendo `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` e rodando:

```powershell
npm run bootstrap:admin
```

Esse comando é de uso único: não o rode novamente para trocar uma senha ou para uma conta existente. A conta admin do ambiente de QA já criada não precisa de outro bootstrap.

Inicie a API:

```powershell
npm run dev
```

Abra `http://localhost:3000/health`; o esperado é `{"status":"ok"}`. A conexão ao MongoDB aparece no log de inicialização. Deixe esse terminal aberto enquanto usa Postman.

Se mudar valores de `.env`, pare a API com `Ctrl+C` e inicie-a novamente. Para encerrar, use `Ctrl+C` no terminal da API.

Para validar a entrega:

```powershell
npm run lint
npm run typecheck
npm test
npm run coverage
```

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

### Observabilidade local (OpenTelemetry + Jaeger)

Com Docker Desktop iniciado, rode `docker compose -f docker-compose.observability.yml up -d` nesta pasta. Defina `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces` e `OTEL_SERVICE_NAME=sistema-salao-api` no `.env`, reinicie a API e gere tráfego com `GET /health`. Abra `http://localhost:16686`, selecione `sistema-salao-api` e procure traces recentes. O Jaeger usa armazenamento em memória: traces desaparecem quando o container é removido/recriado. Portas são limitadas a loopback e este setup é somente para desenvolvimento.

Para encerrar o Jaeger, rode `docker compose -f docker-compose.observability.yml down`.

## Roteiro rápido no Postman

Em todas as requisições JSON, selecione **Body > raw > JSON**. Não use vírgula depois do último campo. Nunca registre senha, token JWT ou token de reset em evidência.

1. **Cadastro e confirmação:** `POST http://localhost:3000/api/auth/register` com `name`, um e-mail de QA novo e uma senha de pelo menos 12 caracteres. Esperado: `202`. Abra a mensagem na sandbox e clique no link no mesmo computador. A tela deve confirmar o e-mail. Se repetir cadastro, use outro endereço de QA.
2. **Login:** `POST /api/auth/login` com o e-mail e senha confirmados. Esperado: `200` e `data.token`. Copie o token somente para o campo Bearer Token do Postman.
3. **Esqueci a senha:** `POST /api/auth/forgot-password` com o e-mail QA. Esperado: `202` e uma mensagem genérica. Abra o e-mail mais recente na sandbox, clique no link e envie uma senha nova no formulário. Esperado: `Senha redefinida.`. Faça login com a nova senha (`200`). Reenvio do mesmo token deve falhar com `400`.
4. **Expiração de 15 minutos:** solicite outro reset para QA, localize `passwordResetExpiresAt` no Compass e, só nessa conta descartável, ajuste a data para o passado. Envie o formulário do link recebido. Esperado: `400`, token inválido/expirado.
5. **Troca após 90 dias:** no documento da conta QA, ajuste `lastPasswordChange` para uma data há 91 dias e `mustChangePassword=false`. Faça login: esperado `200` com `mustChangePassword=true`. Use o JWT em `GET /api/transactions`: esperado `403`. Troque a senha com `POST /api/auth/change-password`; esperado `200`. Não altere a conta admin.
6. **RBAC admin/colaborador:** com JWT admin, crie colaboradora QA usando `POST /api/auth/users`; confirme o e-mail e complete a troca obrigatória de senha. Com o token de colaboradora, `GET /api/reports/dre` deve retornar `403`; `GET /api/transactions` deve retornar apenas lançamentos próprios. Com token admin válido, o relatório deve responder `200`.

## Instalações externas e dependências do professor

- **Wapiti local:** requer Wapiti/Python; o scan local da rota de reset já foi executado e está descrito em `RELATORIO_TESTES_SEGURANCA.md`. Não é o mesmo que DAST em staging.
- **Wapiti em staging:** requer API implantada em URL HTTPS acessível pelo GitHub Actions e variável `STAGING_URL` no ambiente GitHub `staging`; depois, execute manualmente o workflow **Backend CI/CD**.
- **CodeQL/Dependabot:** os arquivos de workflow/configuração estão no repositório; o proprietário precisa enviar as alterações e habilitar Code Scanning e alertas/atualizações do Dependabot nas configurações do repo.
- **VPS/portas/logs do host:** requer VPS Ubuntu e acesso administrativo. Siga `DEPLOYMENT.md`; não tente mudar SSH/Nginx na máquina Windows local.
- **OpenTelemetry local:** Docker Desktop + Compose para subir Jaeger. O nome do serviço aparecerá em `http://localhost:16686`.
- **Datadog/New Relic:** não são necessários para a prova OpenTelemetry local; um collector Jaeger foi configurado e testado. Integração APM externa precisa de conta/endpoint próprio.

Veja [DEPLOYMENT.md](DEPLOYMENT.md) para a VPS e o guia de divulgação responsável em [../SECURITY.md](../SECURITY.md).
## Configuração por variável de ambiente

| Variável | Para que serve |
|---|---|
| `PORT` | Porta da API (obrigatória). Troque a porta padrão só editando o `.env`. |
| `HOST` | Interface de escuta (padrão `0.0.0.0`). Atrás do Nginx use `127.0.0.1`. |
| `NODE_ENV` | `development`, `test` ou `production`. |
| `LOG_LEVEL` | Nível do Pino (`info` por padrão; `debug` em desenvolvimento). Senhas, tokens e cabeçalhos de autenticação são sempre ocultados (`redact`). |
| `TRUST_PROXY` | Número de proxies confiáveis. Padrão: `1` em produção, `0` nos demais. Exige `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` no Nginx; sem isso o rate limit trata todos como um único IP. |
| `MONGO_URI`, `MONGO_DB_NAME` | Conexão com o MongoDB. |
| `JWT_SECRET` | Chave de assinatura do JWT (mínimo 32 caracteres). |
| `SMTP_*` | Envio de e-mail (todas ou nenhuma). |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Base OTLP/HTTP; o código acrescenta `/v1/traces`. Vazio desativa a exportação. |
| `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME` | Lidas pelo SDK do OpenTelemetry (chave do Datadog/New Relic só no `.env` do servidor). |

Exemplo: `HOST=127.0.0.1 PORT=9090 npm run dev`.

## Testes e cobertura

```bash
npm test            # testes de unidade e de segurança
npm run coverage    # relatório de cobertura (src/services, middlewares, controllers)
```

Os testes de segurança (`src/tests/`) usam `supertest` e um MongoDB em memória (`mongodb-memory-server`), nunca o banco real, e substituem o envio de e-mail por uma caixa em memória. Na primeira execução o binário do MongoDB é baixado (~100 MB) e fica em cache.
