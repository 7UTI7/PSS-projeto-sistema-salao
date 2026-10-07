# Guia de testes e pendências: Backend Sistema Salão

Resume o que já foi feito no código, o que ainda falta e como executar e mostrar cada teste (código e repositório).

> Todos os comandos `npm` abaixo rodam na pasta `backend/`.

---

## 1. O que já está pronto no código

| Item | Estado | Onde |
|---|---|---|
| Porta e host por variável (`PORT`, `HOST`) | Pronto | `src/config/env.ts`, `src/server.ts` |
| `trust proxy` configurável (`TRUST_PROXY`; padrão 1 em produção, 0 nos demais) | Pronto | `src/app.ts` |
| Logs sem dados sensíveis (Pino `redact`) + eventos de segurança | Pronto | `src/config/logger.ts`, `AuthService.ts`, `errorHandler.ts` |
| Testes automatizados de segurança | Pronto (23 testes, cobertura 74,73%) | `src/tests/` |
| Limite mínimo de cobertura (60%) no CI | Pronto | `vitest.config.ts` |
| Export OTLP configurável (traces) | Pronto | `src/config/instrumentation.ts` |
| Wapiti com várias URLs e relatório como artefato | Pronto, **ainda não executado** | `.github/workflows/ci-cd.yml` |
| `helmet` | Pronto (já existia) | `src/app.ts` |
| `.env.example` e README atualizados | Pronto | `backend/` |

---

## 2. O que ainda falta (depende de fora do código)

### 2.1 Nginx / VPS
O código está pronto. Falta montar o servidor:
1. Instalar o Nginx na VPS, com HTTPS em porta alta (ex.: `8443`).
2. `proxy_pass` para `http://127.0.0.1:3000`.
3. Incluir `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`.
4. No `.env` do servidor: `NODE_ENV=production`, `HOST=127.0.0.1`, `PORT=3000`, `CORS_ORIGIN` com origens explícitas.
5. Demais itens da especificação (seção 5.1): trocar a porta do SSH, desativar login como root, rodar a API com usuário sem privilégios, configurar `logrotate`.

**Como provar depois:** acessar a API pela porta `8443`; confirmar que a porta `3000` não responde de fora; enviar requisições de duas máquinas diferentes e ver que cada uma tem seu próprio limite (429 em uma não afeta a outra).

### 2.2 Datadog ou New Relic
Você precisa de **uma** conta em um dos dois (cadastro no site do provedor; confira o plano gratuito ou de teste atual).
1. Criar a conta e gerar a **chave de API** (New Relic: "license key"; Datadog: "API key").
2. Pegar o **endpoint OTLP** da sua região na documentação do provedor (muda conforme região e conta).
3. Colocar no `.env` do **servidor** (nunca no Git):
   ```env
   OTEL_EXPORTER_OTLP_ENDPOINT=<endpoint-do-provedor>
   OTEL_EXPORTER_OTLP_HEADERS=<cabecalho-de-chave>=<SUA_CHAVE>
   ```
   O nome do cabeçalho de autenticação está na documentação de cada provedor.
4. Subir a API, fazer algumas requisições e conferir os traces no painel.

> **Atenção:** o código exporta só **traces**. A especificação (6.3) também cita memória, CPU e latência p95/p99. Se isso for exigido, pode ser preciso configurar métricas além do que existe hoje. Só dá para confirmar testando com a conta real.

**Alternativa sem conta (já funciona):** Jaeger local.
```bash
docker compose -f docker-compose.observability.yml up -d
# no .env: OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
npm run dev
```
Painel em `http://localhost:16686`. Mostra que a instrumentação funciona; o provedor externo só troca o destino.

### 2.3 Wapiti no GitHub (falta o primeiro disparo)
O job só roda manualmente e se a variável `STAGING_URL` existir:
1. Em *Settings → Secrets and variables → Actions → Variables*, criar `STAGING_URL` (URL do staging autorizado).
2. Em *Settings → Environments*, criar o ambiente `staging`.
3. Em *Actions → Backend CI/CD → Run workflow*.
4. Ao final, baixar o artefato `wapiti-dast-report`.

Depende de um staging no ar (ou seja, da VPS). Se o Wapiti falhar com os parâmetros novos, ajustar o comando no `ci-cd.yml`.

### 2.4 Fora do guia (decisão sua, não alterado)
- `JWT_SECRET` exige 32 caracteres; a especificação pede 64.
- `JWT_EXPIRES_IN` não é lida (token fixo em `8h`).
- SAST via SonarCloud (a especificação cita; o workflow usa só CodeQL).
- `ReportService` com 11% de cobertura (os testes só provam o bloqueio por RBAC).

---

## 3. Como rodar os testes do código

### 3.1 Validação geral (evidência principal)
```bash
npm run lint
npm run typecheck
npm test
npm run coverage
```
- `npm test`: 23 testes passando em 5 arquivos.
- `npm run coverage`: tabela de cobertura (74,73% no total). Relatório em HTML: `coverage/lcov-report/index.html`. Falha se a cobertura cair abaixo de 60%.

### 3.2 Testes de segurança por área
Use `npx vitest run <arquivo> --reporter=verbose`:

| Comando | O que prova |
|---|---|
| `npx vitest run src/tests/auth.test.ts --reporter=verbose` | Hash `$2b$12$`, login, JWT inválido, `mustChangePassword`, reset (válido, reuso, expirado), confirmação de e-mail, política de 90 dias |
| `npx vitest run src/tests/rbac.test.ts --reporter=verbose` | Colaboradora recebe 403 nos relatórios e vê só os próprios lançamentos |
| `npx vitest run src/tests/rateLimit.test.ts --reporter=verbose` | 429 após 10 tentativas de login, sem bloquear o fluxo de reset |
| `npx vitest run src/tests/logger.test.ts --reporter=verbose` | Senhas, tokens e cabeçalhos são ocultados nos logs |

### 3.3 Como funcionam os testes com MongoDB
Você **não precisa configurar nada**. Ao rodar `npm test`, o `mongodb-memory-server` sobe um MongoDB temporário na memória do computador, cria os dados necessários, limpa entre os testes e desliga no final.
- O Atlas e o seu `.env` **não** são usados nos testes; seus dados reais nunca são tocados.
- Nenhum e-mail real é enviado (o envio é simulado).
- Na **primeira** execução é baixado o binário do MongoDB (~100 MB), o que pode demorar alguns minutos e exige internet. Depois fica em cache.
- O CI do GitHub também precisa de internet para essa primeira execução.

### 3.4 Testes manuais (API rodando, com o Atlas e o `.env` normal)
**Porta e host por variável**
```bash
HOST=127.0.0.1 PORT=9090 npm run dev
```
Abrir `http://127.0.0.1:9090/health` → `{"status":"ok"}`. Print do log "API disponível" com `host` e `port`.

**Senha fora do log**
1. Com a API rodando, no Postman: `POST /api/auth/login` com senha errada.
2. No terminal deve aparecer o log `login_failed` e a senha enviada **não** pode aparecer.

**Página de reset com `helmet`**
1. `POST /api/auth/forgot-password` com um e-mail cadastrado (precisa de SMTP configurado, ex.: Mailtrap).
2. Abrir o link recebido no navegador; a página deve carregar e o formulário funcionar (confirma que o CSP do `helmet` não a quebra).

---

## 4. Como testar o repositório (GitHub)

| O que | Como |
|---|---|
| Lint, typecheck e cobertura | Fazer push ou abrir PR; ver o job "Lint, typecheck and coverage" em *Actions*. Artefato `backend-coverage` com o relatório |
| CodeQL (SAST) | Job "CodeQL SAST" no mesmo workflow; resultados em *Security → Code scanning* |
| Wapiti (DAST) | Ver item 2.3 |
| Dependabot | Arquivo `.github/dependabot.yml`; PRs automáticos aparecem em *Pull requests* |
| `.env` fora do Git | `git ls-files | grep .env` deve listar só `.env.example`; `git log -p -- backend/.env` deve vir vazio |

> Se algum segredo já tiver sido commitado, **troque a credencial**: apagar o arquivo não remove o histórico.

---

## 5. Checklist antes de entregar

- [ ] `npm run lint`, `npm run typecheck`, `npm test` e `npm run coverage` passando (prints)
- [ ] Cobertura atualizada no `RELATORIO_TESTES_SEGURANCA.md` (74,73%, medida em `src/services`, `middlewares` e `controllers`)
- [ ] Prints dos testes por área (3.2)
- [ ] Print do teste de porta/host e do log sem senha (3.4)
- [ ] Print do workflow no GitHub com o artefato de cobertura
- [ ] Jaeger local mostrando traces (ou provedor, quando houver conta)
- [ ] Itens de Nginx/VPS, Datadog/New Relic e Wapiti marcados como **"pendente: depende da VPS/conta/staging"**, não como concluídos
- [ ] `backend/coverage/` revisado antes do commit (os arquivos foram regerados)
