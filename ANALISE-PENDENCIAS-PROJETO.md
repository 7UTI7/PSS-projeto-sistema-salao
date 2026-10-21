# ANÁLISE DE PENDÊNCIAS — SISTEMA NICOLLE NERIS STUDIO

**Data da análise:** 20/10/2026
**Base documental:** `documentacao-completa-projeto-nicolle-neris-studio.md` e `especificacao-tecnica-backend.md`
**Base de código:** branch `main`, commit `69a25b7`

Este documento compara o que as duas especificações exigem com o que existe de fato em `backend/` e `frontend/`. Cada pendência aponta o arquivo onde está (ou deveria estar) a implementação.

---

## 1. RESUMO EXECUTIVO

| Fase do roadmap (doc. completa, seção 8) | Situação | % estimado |
|---|---|---|
| **Fase 1** — Setup & Database | Concluída | 100% |
| **Fase 2** — Autenticação & RBAC | Quase concluída (3 desvios da spec) | ~90% |
| **Fase 3** — Core Financeiro | Parcial (CRUD incompleto, alíquotas vindas do cliente) | ~55% |
| **Fase 4** — Importação & Lotes | **Não iniciada** | 0% |
| **Fase 5** — Relatórios & Aggregations | Parcial (estrutura da DRE incompleta, sem agregações, sem exportação) | ~40% |
| **Fase 6** — Front-End Integration | **Não iniciada** (template padrão do Expo) | 0% |
| **Fase 7** — CI/CD & Hardening | Parcial (CI pronto; VPS, APM e SonarCloud pendentes) | ~55% |

**Estado geral:** Backend ≈ 60% · Frontend ≈ 2% (apenas scaffold)

**Validação executada nesta análise (backend):**
- `npm run lint` — passa, sem avisos
- `npm run typecheck` — passa
- `npm run coverage` — **23 testes passando** em 5 arquivos, cobertura total **74,73%**

**Os 3 bloqueios mais críticos, em ordem:**
1. **Frontend inexistente.** `frontend/App.tsx` é o template `create-expo-app` sem alteração. O MVP é "100% Mobile App" — sem o app não há entregável.
2. **Módulo de importação/conciliação (Fase 4) ausente.** É a dor nº 2 do estudo de caso ("ausência de conciliação bancária") e não existe uma linha de código dela.
3. **A DRE e o Fluxo de Caixa não têm nenhum teste.** `ReportService.ts` está com **11,29%** de cobertura — os testes atuais só provam o bloqueio de RBAC, nunca os valores. Em um sistema financeiro, é a lacuna de qualidade mais grave.

---

## 2. BACKEND — O QUE JÁ ESTÁ PRONTO

Para não confundir o que falta com o que existe:

| Módulo | Arquivos |
|---|---|
| Setup TS + Express 5 + Mongoose 8 | `src/app.ts`, `src/server.ts`, `src/config/database.ts` |
| Validação de ambiente com Zod e *fail-fast* | `src/config/env.ts` |
| Logger Pino estruturado com `redact` | `src/config/logger.ts` |
| Auth completo (registro, login, confirmação, esqueci/redefinir, troca) | `src/controllers/AuthController.ts`, `src/services/AuthService.ts` |
| bcrypt 12 rounds, JWT, RBAC, política de 90 dias | `src/models/User.ts`, `src/middlewares/` |
| Rate limiting segmentado por fluxo | `src/middlewares/rateLimiter.ts` |
| Gestão de usuários pelo admin (criar/listar/desativar) | `src/routes/auth.routes.ts` |
| Cálculo financeiro nos 5 passos, com arredondamento em centavos | `src/services/CalculationService.ts` |
| Transações: listar, criar, excluir (soft delete) | `src/controllers/TransactionController.ts` |
| Relatórios DRE e Fluxo de Caixa (versão simplificada) | `src/services/ReportService.ts` |
| Tratamento global de erros + `AppError` | `src/middlewares/errorHandler.ts`, `src/utils/AppError.ts` |
| Helmet, CORS restritivo, `trust proxy` configurável | `src/app.ts` |
| OpenTelemetry (traces) + Jaeger local | `src/config/instrumentation.ts`, `docker-compose.observability.yml` |
| CI: lint, typecheck, cobertura mínima 60%, CodeQL, Wapiti manual | `.github/workflows/ci-cd.yml` |
| Dependabot (npm do backend + GitHub Actions) | `.github/dependabot.yml` |
| Script de bootstrap do admin inicial | `src/scripts/bootstrapAdmin.ts` |

---

## 3. BACKEND — O QUE FALTA

### 3.1. Fase 4 — Importação e Conciliação Assistida · **0% · CRÍTICO**

Item 5 do Escopo Ativo e Fase 4 do roadmap. Não existe nada:

- [ ] **`src/controllers/ImportController.ts`** — não existe (a spec lista em 2.1)
- [ ] **`src/services/ImportService.ts`** — não existe
- [ ] **`src/routes/import.routes.ts`** — não existe; `src/routes/index.ts` registra apenas `/auth`, `/transactions` e `/reports`
- [ ] **Parser de CSV do Booksy** — nenhuma dependência de parsing no `package.json` (sem `csv-parse`, `papaparse` ou equivalente)
- [ ] **Parser de PDF da InfinitePay** — nenhuma dependência (sem `pdf-parse`, `pdfjs-dist` ou equivalente)
- [ ] **Recebimento de arquivo (upload)** — nenhum middleware de `multipart/form-data` (sem `multer`). Hoje o `app.ts` só aceita `express.json({ limit: '1mb' })`
- [ ] **Fila de conferência e aprovação do lote** — sem endpoints de revisão, aprovação ou reversão. O status `rolled_back` existe no modelo mas nenhuma rota o atinge
- [ ] **Processamento assíncrono** — a documentação (item 5 do escopo) exige "processamento assíncrono"; não há fila, worker nem job
- [ ] **Vínculo lote ↔ lançamento** — o campo `importBatchId` está na documentação (seção 3.2) mas **não existe** em `src/models/Transaction.ts`. Sem ele é impossível reverter um lote importado
- [ ] **Deduplicação** — `contentHash` está declarado e indexado em `src/models/ImportBatch.ts` mas nenhum código o calcula ou consulta

> **Nota:** `src/models/ImportBatch.ts` é **código morto** hoje — nenhum arquivo do projeto o importa.

### 3.2. Categorias Personalizadas · **0%**

Item 4 do Escopo Ativo ("Gerenciamento flexível de categorias de receitas e despesas") e atribuição exclusiva do `admin` (seção 5.1).

- [ ] Sem modelo `Category` / coleção `categories`
- [ ] Sem CRUD nem rotas `/api/categories`
- [ ] Hoje `category` é uma **string livre** em `src/models/Transaction.ts:48` — sem catálogo, sem validação, sem padronização. Dois lançamentos podem gravar "Aluguel" e "aluguel" como categorias distintas e quebrar a DRE

### 3.3. Exportação de Relatórios · **0%**

Item 7 do Escopo Ativo ("Emissão de dados em formatos Excel (.xlsx) e CSV").

- [ ] Sem endpoint de exportação em `src/routes/report.routes.ts`
- [ ] Sem dependência de geração de planilha (`exceljs`, `xlsx` ou equivalente) no `package.json`

### 3.4. CRUD de Transações Incompleto (Fase 3)

`src/routes/transaction.routes.ts` tem só `GET /`, `POST /` e `DELETE /:id`:

- [ ] **`GET /api/transactions/:id`** — detalhe de um lançamento
- [ ] **`PUT`/`PATCH /api/transactions/:id`** — a Fase 3 pede "CRUD da coleção `transactions`"; não há **edição**. Um lançamento errado só pode ser apagado e refeito
- [ ] **Liquidação de lançamento** — não há rota para mudar `status: 'pendente' → 'liquidada'` e preencher `settledAt`. Como o Fluxo de Caixa filtra exatamente por `status: 'liquidada'` (`ReportService.ts:52`), **hoje o relatório de caixa nasce sempre vazio** a menos que o cliente envie `status` e `settledAt` já no POST
- [ ] **Paginação e filtros** — `TransactionService.list()` tem `.limit(500)` fixo e nenhum filtro por período, tipo, categoria ou profissional. Não serve para a tela de histórico do app

### 3.5. Core Financeiro — Parametrização · **ALTO RISCO**

O cálculo em si (`CalculationService.ts`) está correto e segue a ordem da spec 3.1. O problema é **de onde vêm as alíquotas**:

- [ ] **A taxa da maquininha é enviada pelo cliente.** `TransactionController.ts:12` declara `paymentFeeRate: z.number().min(0).max(1).default(0)`. A spec 3.1 passo 2 diz "Alíquota da Maquininha **conforme modalidade**" — ou seja, uma tabela do servidor por `credito`/`debito`/`pix`. Hoje o app pode mandar `0` e zerar a taxa, que é justamente a dor nº 1 do estudo de caso ("opacidade nas taxas")
- [ ] **A comissão é enviada pelo cliente.** `TransactionController.ts:13`, mesmo padrão. Pior: **a colaboradora define a própria comissão** no corpo da requisição
- [ ] **Sem coleção/configuração de parâmetros** — falta algo como `settings` ou `professionals` guardando alíquotas por modalidade e percentual por profissional, com edição restrita ao `admin`
- [ ] **Vínculo profissional ↔ usuário hardcoded.** `TransactionService.professionalFor()` (linhas 94-98) mapeia `admin → 'Nicolle'` e `colaborador → 'Stefany'`. Não existe campo `professional` em `src/models/User.ts`. Um segundo admin ou uma segunda colaboradora quebram a regra silenciosamente
- [ ] **Despesa com tratamento inconsistente.** Em `TransactionService.create()` (linhas 53-59), a despesa grava `netAmount: +grossAmount` e `studioNetProfit: -grossAmount` — sinais opostos para o mesmo fato. E `discountAmount` é ignorado em despesas

### 3.6. Relatórios (Fase 5)

- [ ] **A DRE não devolve a estrutura especificada.** `ReportService.getDre()` retorna 7 totais (`receitaBruta`, `descontos`, `taxas`, `receitaLiquida`, `custosVariaveis`, `despesasFixas`, `resultado`). Faltam, conforme spec 3.2 e doc. 4.2:
  - **Margem de Contribuição / Lucro Bruto** como linha isolada
  - **Retirada de Pró-labore** como linha própria — hoje cai dentro de `despesasFixas` ou `custosVariaveis` conforme o `costType`, misturada com aluguel e luz
  - **Insumos diretos** separados das **Comissões** dentro dos Custos Variáveis
- [ ] **O Fluxo de Caixa não devolve Saldo Inicial nem Saldo Final.** A spec 4.3 define `Saldo Inicial + Entradas - Saídas = Saldo Final`. `getCashFlow()` devolve só a série diária de variação
- [ ] **Sem *aggregation pipelines* do MongoDB.** A Fase 5 pede explicitamente "pipelines de agregação". A implementação atual é `find().lean()` + laço em memória (`ReportService.ts:11-45`), que carrega todos os documentos do período para o processo Node
- [ ] **Colaboradora sem acesso às próprias comissões.** A spec 4.2 prevê que o perfil `colaborador` veja "o histórico de suas próprias comissões". Hoje `report.routes.ts:12` aplica `rbacMiddleware('admin')` em **todas** as rotas de relatório
- [ ] **Zero testes de valores financeiros.** `ReportService.ts` com **11,29%** de cobertura. Nenhum teste verifica se a DRE fecha ou se o fluxo de caixa soma certo

### 3.7. Desvios da Especificação em Autenticação

| Item | Especificação | Código atual |
|---|---|---|
| TTL do token de confirmação de e-mail | **24 horas** (doc. 5.2 e spec 4.3.1) | **15 minutos** — `AuthService.ts:11` usa um único `TOKEN_TTL_MS` para confirmação e reset |
| Histórico das últimas 3 senhas | Obrigatório (doc. 5.2 e spec 4.3.3) | **Não implementado** — sem campo no `User.ts`, sem verificação no reset/troca |
| Tamanho mínimo do `JWT_SECRET` | 64 caracteres (spec 5.2) | 32 — `env.ts:16` (`z.string().min(32)`) |
| `JWT_EXPIRES_IN` como variável | Listada como variável crítica (spec 5.2) | **Não existe** no `env.ts`; expiração fixa em `'8h'` dentro do `AuthService.ts:118` |

### 3.8. Divergências entre os Modelos do Código e da Documentação

A seção 3 da documentação completa define schemas que **não batem** com o código. Precisa decidir qual é a fonte da verdade e alinhar (recomendo ajustar a documentação ao código onde o código está melhor, e o código onde falta campo):

| Campo | Documentação (seção 3) | Código |
|---|---|---|
| `Transaction.status` | `['pago', 'pendente', 'conciliado']` | `['pendente', 'liquidada', 'cancelada']` |
| `Transaction.origin` | `['manual', 'booksy_import', 'infinitepay_import']` | `['manual', 'booksy', 'infinitepay']` |
| `Transaction.costType` | inclui `'nao_se_aplica'` como default | opcional, só `['fixo', 'variavel']` |
| `Transaction.importBatchId` | existe (`ref: 'ImportBatch'`) | **ausente** |
| `ImportBatch` | `importedBy`, `importedAt`, `totalRows`, `processedCount`; status `['pendente_revisao','sucesso','erro','revertido']` | `createdBy`, `contentHash`; status `['received','processed','failed','rolled_back']`; **sem** contadores de linhas |
| `User.passwordChangedAt` | nome usado na doc. completa | `lastPasswordChange` (nome usado na spec do backend — a doc. completa é que está desatualizada) |

### 3.9. Infraestrutura, DevOps e Observabilidade (Fase 7)

- [ ] **CI não cobre o frontend** — o workflow filtra `paths: ['backend/**']`; o Dependabot aponta só para `/backend`
- [ ] **Sem documentação de API (OpenAPI/Swagger)** — o time de frontend não tem contrato formal para consumir

### 3.10. Higiene do Repositório (achados desta análise)

- [ ] **`backend/.env.example` contém credenciais reais de sandbox do Mailtrap** versionadas no Git (`SMTP_USER=48f5951364e9fd`, `SMTP_PASSWORD=d9226c…`). **Rotacionar essa credencial no Mailtrap** e substituir por placeholders. Apagar do arquivo não limpa o histórico
- [ ] **`backend/.env.example` tem chaves duplicadas** — `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `CORS_ORIGIN` e `API_PUBLIC_URL` aparecem duas vezes, com valores diferentes. Ambíguo para quem for configurar
- [ ] **`backend/coverage/` está versionado** (24 arquivos em `git ls-files`). É artefato de build e o CI já o publica como *artifact*; deveria entrar no `.gitignore`
- [ ] **`.gitignore` não cobre `dist/`** nem `coverage/`

---

## 4. FRONTEND — O QUE FALTA · **~98% DO TRABALHO**

**Estado atual:** `frontend/` é o scaffold intocado do `create-expo-app`. `frontend/App.tsx` renderiza literalmente *"Open up App.tsx to start working on your app!"*. `frontend/AGENTS.md` e `frontend/LICENSE` também são do template.

### 4.1. Dependências nunca instaladas

O `frontend/package.json` tem **4 dependências**: `expo`, `expo-status-bar`, `react`, `react-native`. Falta tudo o que a arquitetura exige:

- [ ] **`@react-navigation/native`, `/native-stack`, `/bottom-tabs`** — a doc. 2.2 define "React Navigation (Stack + Bottom Tabs)"
- [ ] **`nativewind` + `tailwindcss`** — a doc. 2.2 define NativeWind como estilização
- [ ] **`expo-font` + fontes Inter ou Roboto** — a doc. 2.2 traz isso como **regra explícita de tipografia** ("proibindo fontes serifadas")
- [ ] **Cliente HTTP** (`axios` ou wrapper de `fetch`) para consumir a API
- [ ] **`expo-secure-store`** — o JWT precisa de armazenamento seguro; `AsyncStorage` não serve para token
- [ ] **`expo-document-picker`** — obrigatório para o upload de CSV/PDF da importação
- [ ] **Biblioteca de gráficos** (`victory-native`, `react-native-gifted-charts` ou similar) para a DRE e o fluxo de caixa
- [ ] **`react-hook-form` + `zod`** para os formulários de lançamento
- [ ] **Date picker** para selecionar `occurredAt` / `settledAt` e o período dos relatórios

### 4.2. Estrutura e configuração

- [ ] **Nenhuma estrutura de pastas** — falta `src/screens/`, `src/components/`, `src/services/`, `src/contexts/`, `src/hooks/`, `src/navigation/`, `src/theme/`
- [ ] **`app.json` é o do template** — `name` e `slug` são literalmente `"frontend"`, sem identidade do produto, sem `projectId` do EAS
- [ ] **Sem `eas.json`** — a doc. 2.2 prevê build via Expo Application Services
- [ ] **Sem variável de ambiente para a URL da API** — falta `app.config.ts` com `EXPO_PUBLIC_API_URL` (hoje a URL teria que ser hardcoded)
- [ ] **`package.json` sem scripts de `lint`, `typecheck` e `test`** — só `start`, `android`, `ios`, `web`
- [ ] **Zero testes** no frontend, e nenhum job de CI cobrindo a pasta

### 4.3. Camada de integração com a API

- [ ] Serviço HTTP com `baseURL` e injeção do header `Authorization: Bearer`
- [ ] **Contexto de autenticação** (login, logout, persistência da sessão, papel do usuário)
- [ ] **Interceptor de erros** que trate os códigos que a API já devolve:
  - `401 UNAUTHORIZED` → logout e volta para o login
  - `403 PASSWORD_CHANGE_REQUIRED` → **redirecionar para a troca obrigatória de senha** (o backend bloqueia *todas* as rotas protegidas nesse estado; sem esse tratamento o app simplesmente travará)
  - `429` → mensagem de "muitas tentativas"
- [ ] **Tipos TypeScript compartilhados** com os contratos do backend

### 4.4. Telas — nenhuma existe

**Autenticação**
- [ ] Login
- [ ] Cadastro
- [ ] Aviso de "confirme seu e-mail"
- [ ] Esqueci minha senha
- [ ] Redefinir senha (hoje o fluxo cai no HTML servido pela própria API em `AuthController.resetPasswordPage` — decidir se o app usa *deep link* próprio)
- [ ] **Troca obrigatória de senha** (90 dias / `mustChangePassword`) — obrigatória para o app funcionar

**Operação**
- [ ] Dashboard / home com os números do dia
- [ ] **Lançamento rápido de receita em até 3 toques** — proposta de valor central da doc. 1.3
- [ ] Lançamento de despesa (com escolha de custo fixo/variável)
- [ ] Histórico de lançamentos com filtros e período
- [ ] Detalhe / edição / exclusão de lançamento
- [ ] Marcar lançamento como liquidado

**Admin**
- [ ] Gestão de categorias
- [ ] Parametrização de alíquotas e percentuais de comissão
- [ ] **Importação de arquivos** (seleção do CSV/PDF + acompanhamento do lote)
- [ ] **Fila de conferência e aprovação da conciliação**
- [ ] **DRE Gerencial** com todas as linhas da estrutura
- [ ] **Fluxo de Caixa** com saldo inicial e final
- [ ] Exportação / compartilhamento de .xlsx e .csv
- [ ] Gestão de usuários (criar, listar, desativar)

**Colaboradora**
- [ ] Visão restrita: lançamento rápido + histórico das próprias comissões, **sem** dados consolidados do estúdio

### 4.5. Navegação e RBAC na UI

- [ ] **Navegação condicionada ao papel** — as abas de DRE, Fluxo de Caixa, Importação e Usuários não podem nem aparecer para o perfil `colaborador` (doc. 5.1). Hoje nada disso existe
- [ ] Guarda de rota para sessão expirada e para `mustChangePassword`

---

## 5. ORDEM RECOMENDADA DE EXECUÇÃO

A ordem abaixo prioriza desbloquear o frontend (o caminho crítico) sem deixar o backend inconsistente.

### Prioridade 0 — decisões a tomar antes de codar
1. **Render ou VPS+Nginx?** Os dois documentos se contradizem (§3.9). Essa escolha muda todo o trabalho da Fase 7.
2. **Qual documento é a fonte da verdade para os schemas?** Alinhar as divergências de §3.8 — em especial decidir se `importBatchId` entra no `Transaction` (recomendo que sim, é o que viabiliza reverter lotes).
3. **Rotacionar a credencial do Mailtrap** exposta em `.env.example` (§3.10).

### Prioridade 1 — habilitar o frontend
4. Mover alíquotas e comissões para o servidor (§3.5) — muda o contrato da API, então vem **antes** de o app ser escrito.
5. CRUD de categorias (§3.2) — o formulário de lançamento depende dele.
6. Completar o CRUD de transações: edição, detalhe, liquidação, filtros e paginação (§3.4).
7. Publicar o contrato da API (OpenAPI) para o time de frontend trabalhar em paralelo.

### Prioridade 2 — frontend em paralelo com relatórios
8. Scaffold do app: dependências, estrutura, NativeWind, fontes Inter/Roboto, navegação, contexto de auth, cliente HTTP com os interceptors (§4.1 a §4.3).
9. Telas de autenticação + troca obrigatória de senha + lançamento rápido (§4.4).
10. Corrigir a estrutura da DRE e do Fluxo de Caixa (§3.6) e **escrever os testes financeiros** — tirar o `ReportService` dos 11% de cobertura.
11. Telas de relatório e exportação.

### Prioridade 3 — Fase 4 completa
12. Upload, parsers de CSV/PDF, `ImportService`, lote, fila de conferência, aprovação e reversão (§3.1).
13. Telas de importação e conciliação.

### Prioridade 4 — fechar a Fase 7
14. Deploy conforme a decisão P0, hardening, SonarCloud, métricas de APM, primeiro disparo do Wapiti (§3.9).
15. Ajustar os desvios de auth: TTL de 24 h na confirmação, histórico de 3 senhas, `JWT_EXPIRES_IN`, `JWT_SECRET` de 64 (§3.7).
16. Higiene do repositório: `.gitignore` para `coverage/` e `dist/`, limpar o `.env.example` duplicado (§3.10).

---

## 6. OBSERVAÇÕES FINAIS

- O backend que existe tem **boa qualidade**: lint e typecheck limpos, 23 testes passando, segurança bem trabalhada (redact de logs, rate limit segmentado por fluxo, recarga de identidade no `authMiddleware` para permitir revogação, resposta genérica em `register` e `forgot-password` contra enumeração de usuários). O problema não é o que foi feito, é a **extensão** do que ainda não foi.
- A cobertura de 74,73% é boa **no agregado**, mas está mal distribuída: middlewares a 96,77% e `ReportService` a 11,29%. Em um sistema financeiro, o número que precisa estar alto é justamente o do relatório.
- As pendências de infraestrutura já estavam mapeadas em `GUIA_TESTES_E_PENDENCIAS.md` e foram **confirmadas** nesta análise. O que aquele guia não cobria — e é o foco deste documento — são as lacunas **funcionais**: importação, categorias, exportação, CRUD incompleto, estrutura da DRE e o frontend inteiro.
