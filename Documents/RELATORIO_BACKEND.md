# Relatório Técnico do Back-End

## Sistema de Gestão Financeira — Nicolle Neris Studio

**Curso:** Desenvolvimento de Software Multiplataforma — FATEC Zona Leste
**Módulo:** Back-End
**Repositório:** `PSS-projeto-sistema-salao`

---

## Sumário

1. [Visão geral e funcionamento](#1-visão-geral-e-funcionamento)
2. [Estrutura do back-end](#2-estrutura-do-back-end)
3. [Banco de dados NoSQL e dicionário de dados](#3-banco-de-dados-nosql-e-dicionário-de-dados)
4. [Controllers e rotas sob a ótica da orientação a objetos](#4-controllers-e-rotas-sob-a-ótica-da-orientação-a-objetos)
5. [Ferramentas, componentes e APIs utilizadas](#5-ferramentas-componentes-e-apis-utilizadas)
6. [Análise de vantagens e desvantagens](#6-análise-de-vantagens-e-desvantagens)
7. [Apresentação do funcionamento](#7-apresentação-do-funcionamento)
8. [Limitações conhecidas e próximos passos](#8-limitações-conhecidas-e-próximos-passos)

---

## 1. Visão geral e funcionamento

### 1.1. O problema que o sistema resolve

O Nicolle Neris Studio opera com três sistemas que não conversam entre si: o **Booksy**
(agendamento de clientes), a **InfinitePay** (recebimento por cartão e Pix) e o controle
financeiro informal, feito em papel e aplicativos pessoais. O resultado é que a
proprietária não consegue responder perguntas básicas do negócio: quanto sobrou de fato no
mês, quanto cada profissional gerou, quanto foi pago de taxa de maquininha.

O back-end deste projeto atua como **retaguarda analítica financeira**: não substitui o
Booksy nem a InfinitePay, mas centraliza os lançamentos e entrega duas visões que hoje não
existem — a **DRE gerencial** (regime de competência) e o **Fluxo de Caixa** (regime de
caixa).

### 1.2. Como a aplicação funciona

A API é um serviço **REST stateless**: não guarda sessão em memória, pois a identidade do
usuário viaja em um token JWT a cada requisição. Isso permite reiniciar ou escalar o
servidor sem derrubar ninguém.

O ciclo de vida de uma requisição é sempre o mesmo:

```
Cliente (app mobile / Postman)
      │  HTTPS + JSON + header Authorization: Bearer <JWT>
      ▼
┌─────────────────────────────────────────────────────────────┐
│ Express (app.ts)                                            │
│  Helmet → CORS → body parser → logger → rate limiter        │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ routes/        verbo + caminho + middlewares da rota        │
│                authMiddleware → passwordPolicy → rbac       │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ controllers/   valida o corpo com Zod e monta a resposta    │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ services/      regra de negócio: cálculo, liquidação, RBAC  │
│                de dados (quem vê o quê)                     │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ models/        schemas Mongoose: tipos, enums e índices     │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
                  MongoDB Atlas (cloud)
```

Qualquer exceção lançada em qualquer camada é capturada pelo `errorHandler`, o último
middleware da cadeia, que devolve sempre o mesmo envelope:

```json
{ "status": "error", "message": "Categoria inválida ou inativa no catálogo." }
```

E as respostas de sucesso seguem o envelope equivalente:

```json
{ "status": "success", "data": { } }
```

Essa uniformidade importa na prática: o aplicativo mobile trata erro em um único lugar, em
vez de interpretar cada rota de um jeito diferente.

### 1.3. O núcleo financeiro

A regra mais importante do sistema é o desmembramento de uma receita. O cliente envia
apenas o valor bruto, o desconto e as alíquotas; o servidor calcula o resto em cinco
passos, arredondando em centavos a cada etapa (`CalculationService`):

| Passo | Fórmula | Exemplo (bruto 150, desconto 10, taxa 3,99%, comissão 40%) |
|---|---|---|
| 1. Base de cálculo | `grossAmount − discountAmount` | 140,00 |
| 2. Taxa da maquininha | `base × paymentFeeRate` | 5,59 |
| 3. Valor líquido recebido | `base − feeAmount` | 134,41 |
| 4. Comissão da profissional | `base × professionalCommissionRate` | 56,00 |
| 5. Lucro do estúdio | `netAmount − commissionAmount` | 78,41 |

O cálculo **nunca** é feito no aplicativo. Ele vive no servidor por dois motivos: o cliente
não pode ser fonte de verdade de valor financeiro, e a alíquota da maquininha muda por
modalidade de pagamento — centralizar evita que uma versão antiga do app grave valores
errados no banco.

### 1.4. Os dois regimes contábeis

É aqui que `occurredAt` e `settledAt` deixam de ser dois campos de data e passam a ser a
espinha dorsal do sistema:

- **DRE gerencial — regime de competência.** Usa `occurredAt`, a data em que o serviço foi
  prestado. Responde "quanto o negócio produziu no mês".
- **Fluxo de Caixa — regime de caixa.** Usa `settledAt`, a data em que o dinheiro entrou na
  conta, e considera somente lançamentos com `status: "liquidada"`. Responde "quanto
  dinheiro eu tenho".

Um atendimento feito em 28 de outubro e recebido em 5 de novembro entra na DRE de outubro
e no Fluxo de Caixa de novembro. É a diferença entre lucro e liquidez, e o sistema a
representa explicitamente em vez de misturar as duas coisas.

---

## 2. Estrutura do back-end

### 2.1. Arquitetura em camadas

O projeto segue **arquitetura em camadas** com separação de responsabilidades. Cada camada
só conhece a camada imediatamente abaixo, e o fluxo é unidirecional:

`routes/` → `controllers/` → `services/` → `models/`

| Camada | Pasta | Responsabilidade | O que ela **não** faz |
|---|---|---|---|
| Rotas | `src/routes/` | Declara verbo, caminho e cadeia de middlewares | Não contém lógica nem validação de corpo |
| Controllers | `src/controllers/` | Traduz HTTP em chamada de serviço: valida DTOs com Zod, repassa o usuário autenticado, serializa a resposta | Não contém regra de negócio nem acessa o banco |
| Services | `src/modules/*/` | Regra de negócio: cálculo, liquidação, escopo de visibilidade por perfil | Não conhece `Request` nem `Response` do Express |
| Models | `src/models/` | Schemas Mongoose: tipos, `enum`, `required`, `unique`, índices | Não contém regra de negócio |

### 2.2. Organização de pastas

```
backend/src/
├── models/                     # (M) Schemas Mongoose
│   ├── user.model.ts
│   ├── category.model.ts
│   ├── transaction.model.ts
│   └── import-batch.model.ts
├── controllers/                # (C) Camada HTTP e validação com Zod
│   ├── auth.controller.ts
│   ├── category.controller.ts
│   ├── transaction.controller.ts
│   └── report.controller.ts
├── routes/                     # Endpoints REST
│   ├── index.ts                # agrupa todos os routers sob /api
│   ├── auth.routes.ts
│   ├── category.routes.ts
│   ├── transaction.routes.ts
│   └── report.routes.ts
├── modules/                    # Regra de negócio isolada por domínio
│   ├── auth/           auth.service.ts, auth.types.ts
│   ├── categories/     category.service.ts
│   ├── transactions/   transaction.service.ts, calculation.service.ts
│   └── reports/        report.service.ts
├── shared/                     # Código transversal
│   ├── middlewares/    auth, rbac, password-policy, rate-limiter, error-handler
│   ├── utils/          app-error, async-handler, email.service
│   └── types/          express.d.ts
├── config/                     # env, database, logger, instrumentation
├── scripts/                    # bootstrap-admin
├── tests/                      # testes de integração
├── app.ts                      # monta o Express
└── server.ts                   # ponto de entrada
```

### 2.3. Sobre a camada de repositório

A arquitetura clássica em camadas prevê um **Repository** entre o service e o banco. Neste
projeto esse papel é exercido pelos **schemas Mongoose**, seguindo o padrão *Active
Record*: o model encapsula a coleção, os tipos, os índices e as restrições de integridade,
e é o único ponto do sistema que acessa o MongoDB. Nenhum controller ou rota executa query.

A escolha foi deliberada. Uma camada de repositório adicional só se paga quando existe a
possibilidade real de trocar o banco ou quando as consultas são complexas o bastante para
merecer abstração própria. Para o escopo deste MVP, ela acrescentaria uma camada de
indireção sem ganho prático — ao custo de mais arquivos para manter. A documentação registra
a decisão para que ela seja uma escolha consciente, e não uma omissão.

### 2.4. Tratamento de erros e validação

Dois mecanismos sustentam a robustez da API:

**`AppError`** — toda falha de negócio lança uma instância dessa classe, com mensagem,
status HTTP e código interno (`AppError('Lançamento não encontrado.', 404, 'NOT_FOUND')`).
O `errorHandler` global a converte na resposta padronizada. Erros inesperados, que não são
`AppError`, são registrados no log e devolvidos como `500` genérico — nunca expondo stack
trace ou detalhe interno ao cliente.

**`asyncHandler`** — o Express 4 não captura rejeições de `Promise` em handlers `async`,
o que faria o processo travar silenciosamente. Esse utilitário envolve cada handler e
encaminha a rejeição ao `errorHandler`, garantindo que nenhum erro assíncrono se perca.

---

## 3. Banco de dados NoSQL e dicionário de dados

### 3.1. Justificativa da escolha do NoSQL

O projeto usa **MongoDB Atlas**, um banco NoSQL orientado a documentos, em vez de um banco
relacional. A decisão se apoia em três características do domínio:

1. **Documentos naturalmente autocontidos.** Um lançamento financeiro é consultado sempre
   por inteiro: a tela precisa de descrição, valor bruto, taxa, comissão e líquido ao mesmo
   tempo. Em um modelo relacional normalizado, isso exigiria *joins* a cada consulta; como
   documento único, é uma leitura só.
2. **Esquema em evolução.** Durante o MVP, campos foram acrescentados conforme o
   entendimento do negócio amadureceu (`settledAt`, `costType`, `studioNetProfit`). No
   MongoDB isso não exige migração de tabela.
3. **Relacionamentos rasos.** O domínio tem poucas relações, e todas de referência simples
   (lançamento → usuário que o criou). Não há a malha de chaves estrangeiras que justifica
   um banco relacional.

A integridade que o SGBD relacional daria por `CHECK` e `FOREIGN KEY` é garantida aqui em
duas camadas: pelo **schema Mongoose** (`enum`, `required`, `min`, `maxlength`, índice
`unique`) e pelos **schemas Zod** nos controllers, que rejeitam dados inválidos antes de
chegarem ao banco.

### 3.2. Relação entre o banco e o back-end

A ligação é feita pelo **Mongoose**, um ODM (*Object-Document Mapper*). Ele cumpre três
funções:

- **Tipagem.** Cada schema é declarado com um tipo TypeScript (`Schema<TransactionFields>`),
  então o compilador acusa erro ao ler um campo que não existe ou gravar o tipo errado.
- **Validação em nível de banco.** As restrições do schema são aplicadas em toda escrita,
  independentemente de qual parte do código a originou.
- **Conexão e índices.** A conexão é estabelecida uma única vez no início
  (`config/database.ts`) e reaproveitada via *connection pool*.

Convenções adotadas em todas as coleções:

- **`_id`** — `ObjectId` de 12 bytes gerado pelo MongoDB, chave primária de todo documento.
- **`createdAt` / `updatedAt`** — mantidos automaticamente pela opção `timestamps: true`.
- **`deletedAt`** — implementa *soft delete*. Em vez de remover o documento, o `DELETE`
  grava a data de exclusão; todas as consultas filtram por `deletedAt: null`. Para um
  sistema financeiro isso é requisito, não preferência: o histórico tem de ser auditável.
- **`versionKey: false`** — desativa o campo `__v`, que não é usado pelo projeto.

### 3.3. Dicionário de dados

Convenções das tabelas: **Obrig.** indica `required` no schema; **Padrão** é o valor
atribuído quando o campo é omitido; `select: false` marca campos que **nunca** são
retornados em consulta, a menos que explicitamente solicitados.

#### Coleção `users`

Armazena as contas de acesso e os dados de segurança de senha.

| Campo | Tipo | Obrig. | Padrão | Restrições e observações |
|---|---|---|---|---|
| `_id` | ObjectId | sim | auto | Chave primária |
| `name` | String | sim | — | `trim`, máx. 120 caracteres |
| `email` | String | sim | — | **único**, `lowercase`, `trim`, máx. 254 |
| `passwordHash` | String | sim | — | Hash bcrypt com 12 *rounds*. `select: false` |
| `role` | String | sim | `colaborador` | `enum`: `admin`, `colaborador` |
| `lastPasswordChange` | Date | sim | `Date.now` | Base da política de expiração de 90 dias |
| `mustChangePassword` | Boolean | sim | `false` | `true` bloqueia todas as rotas até a troca |
| `emailVerified` | Boolean | sim | `false` | Login só é permitido com `true` |
| `emailVerificationTokenHash` | String | não | — | SHA-256 do token enviado. `select: false` |
| `emailVerificationExpiresAt` | Date | não | — | Validade de 15 minutos. `select: false` |
| `passwordResetTokenHash` | String | não | — | SHA-256 do token de redefinição. `select: false` |
| `passwordResetExpiresAt` | Date | não | — | Validade de 15 minutos. `select: false` |
| `createdAt` | Date | sim | auto | |
| `updatedAt` | Date | sim | auto | |
| `deletedAt` | Date \| null | não | `null` | *Soft delete*; **indexado** |

**Índices:** `email` (único) e `deletedAt`.

**Decisão de segurança relevante:** os tokens de verificação e de redefinição **nunca** são
gravados em texto claro. O sistema guarda apenas o hash SHA-256; o valor original só existe
no e-mail enviado. Assim, um vazamento do banco não permite redefinir senhas de ninguém.

#### Coleção `categories`

Catálogo de categorias financeiras, gerenciado pelo perfil `admin`.

| Campo | Tipo | Obrig. | Padrão | Restrições e observações |
|---|---|---|---|---|
| `_id` | ObjectId | sim | auto | Chave primária |
| `name` | String | sim | — | `trim`, máx. 100. **Único com collation pt-BR** |
| `kind` | String | sim | `ambos` | `enum`: `receita`, `despesa`, `ambos` |
| `active` | Boolean | não | `true` | Categoria inativa não aceita novos lançamentos |
| `createdAt` | Date | sim | auto | |
| `updatedAt` | Date | sim | auto | |
| `deletedAt` | Date \| null | não | `null` | *Soft delete*; **indexado** |

**Índices:** `name` único com `collation: { locale: 'pt', strength: 2 }` e `deletedAt`.

**Por que a collation importa:** `strength: 2` torna a comparação insensível a maiúsculas e
a acentos. Sem isso, "Aluguel", "aluguel" e "ALUGUEL" seriam três categorias distintas, e a
DRE apresentaria a mesma despesa fragmentada em três linhas. É a correção direta do problema
que a categoria em texto livre causava.

#### Coleção `transactions`

Lançamentos financeiros: receitas e despesas. É a coleção central do sistema.

| Campo | Tipo | Obrig. | Padrão | Restrições e observações |
|---|---|---|---|---|
| `_id` | ObjectId | sim | auto | Chave primária |
| `type` | String | sim | — | `enum`: `receita`, `despesa`. **Indexado** |
| `description` | String | sim | — | `trim`, máx. 240 |
| `grossAmount` | Number | sim | — | Valor bruto; `min: 0` |
| `discountAmount` | Number | não | `0` | Desconto comercial; `min: 0` |
| `feeAmount` | Number | não | `0` | Taxa da maquininha. **Calculado no servidor** |
| `professional` | String | sim | — | `enum`: `Nicolle`, `Stefany`. **Indexado** |
| `commissionAmount` | Number | não | `0` | Comissão. **Calculada no servidor** |
| `studioNetProfit` | Number | sim | — | Lucro do estúdio. **Calculado no servidor** |
| `netAmount` | Number | sim | — | Líquido recebido. **Calculado no servidor** |
| `category` | String | sim | — | máx. 100. Validado contra `categories` |
| `costType` | String | não | — | `enum`: `fixo`, `variavel`. Obrigatório para `despesa` |
| `paymentMethod` | String | sim | — | `enum`: `pix`, `credito`, `debito`, `dinheiro` |
| `occurredAt` | Date | sim | — | Data do fato gerador. **Base da DRE.** Indexado |
| `settledAt` | Date | não | — | Data da liquidação. **Base do Fluxo de Caixa** |
| `status` | String | sim | `pendente` | `enum`: `pendente`, `liquidada`, `cancelada` |
| `origin` | String | sim | `manual` | `enum`: `manual`, `booksy`, `infinitepay` |
| `createdBy` | ObjectId | sim | — | **Referência** a `users._id` |
| `createdAt` | Date | sim | auto | |
| `updatedAt` | Date | sim | auto | |
| `deletedAt` | Date \| null | não | `null` | *Soft delete*; **indexado** |

**Índices:** `type`, `professional`, `occurredAt`, `deletedAt` e o índice composto
`{ occurredAt: 1, type: 1, deletedAt: 1 }`, que atende diretamente à consulta da DRE —
filtrar por período, por tipo e excluir os apagados.

**Observações sobre o modelo:**

- Os quatro campos calculados (`feeAmount`, `commissionAmount`, `netAmount`,
  `studioNetProfit`) são **gravados já apurados**, em vez de recalculados na leitura. Isso
  preserva o valor histórico: se a alíquota da maquininha mudar amanhã, os lançamentos
  antigos continuam refletindo a taxa realmente cobrada na época.
- A relação com `users` é por **referência** (`createdBy`), não por documento embutido. Um
  usuário aparece em centenas de lançamentos; embutir duplicaria os dados e tornaria
  impossível atualizar um nome em um só lugar.
- `category` guarda o **nome** da categoria, validado contra o catálogo na escrita, em vez
  de um `ObjectId`. A consequência é discutida na seção 6.5.

#### Coleção `importbatches`

Lotes de arquivos importados do Booksy e da InfinitePay.

> **Status:** coleção **modelada, ainda sem implementação**. O schema existe e está
> versionado, mas nenhum código do projeto o utiliza: não há controller, service nem rota de
> importação. Consta neste dicionário por integrar o modelo de dados projetado; a
> implementação está prevista para a etapa seguinte (seção 8).

| Campo | Tipo | Obrig. | Padrão | Restrições e observações |
|---|---|---|---|---|
| `_id` | ObjectId | sim | auto | Chave primária |
| `source` | String | sim | — | `enum`: `booksy`, `infinitepay` |
| `fileName` | String | sim | — | máx. 255 |
| `contentHash` | String | sim | — | Hash do conteúdo. **Indexado**, para deduplicação |
| `rawPayload` | Mixed | sim | — | Conteúdo bruto preservado para auditoria |
| `status` | String | não | `received` | `enum`: `received`, `processed`, `failed`, `rolled_back` |
| `createdBy` | ObjectId | sim | — | **Referência** a `users._id` |
| `createdAt` | Date | sim | auto | |
| `updatedAt` | Date | sim | auto | |
| `deletedAt` | Date \| null | não | `null` | *Soft delete* |

**Índices:** `contentHash`.

### 3.4. Relacionamentos entre as coleções

```
users
  │ 1
  │
  │ N        createdBy (ObjectId, ref: 'User')
  ├──────────── transactions
  │ N
  └──────────── importbatches

categories
  │ 1
  │  name (validado na escrita por CategoryService.assertActive)
  │ N
  └──────────── transactions
```

| Relação | Cardinalidade | Implementação |
|---|---|---|
| `users` → `transactions` | 1:N | Referência por `createdBy` |
| `users` → `importbatches` | 1:N | Referência por `createdBy` |
| `categories` → `transactions` | 1:N | Validação por nome na escrita (não é referência física) |

---

## 4. Controllers e rotas sob a ótica da orientação a objetos

### 4.1. Orientação a objetos aplicada

O back-end não usa funções soltas: cada controller e cada service é uma **classe**, e os
quatro pilares da OO aparecem de forma concreta.

**Encapsulamento.** Os métodos públicos da classe são a interface da camada; o que é
detalhe interno fica `private`. No `TransactionService`:

```typescript
export class TransactionService {
  async list(actor: AuthenticatedUser): Promise<unknown[]> { /* público */ }
  async create(input: CreateTransactionInput, actor: AuthenticatedUser) { /* público */ }
  async update(transactionId: string, input: CreateTransactionInput, actor: AuthenticatedUser) { }

  private resolveSettledAt(status, settledAt?): Date | undefined { /* interno */ }
  private calculate(input) { /* interno */ }
  private professionalFor(actor: AuthenticatedUser): Professional { /* interno */ }
}
```

A regra de liquidação está em `resolveSettledAt`, um método privado chamado tanto pelo
`create` quanto pelo `update`. Nenhum código externo pode preencher `settledAt` por conta
própria e furar a regra — a invariante "liquidada sempre tem data de liquidação" fica
garantida pela própria classe.

**Abstração.** O controller não sabe como o lançamento é calculado nem como é persistido.
Ele conhece apenas a assinatura `transactionService.update(id, dados, usuário)`. Trocar
toda a implementação interna do service não exige tocar no controller.

**Composição e injeção de dependência.** Os controllers recebem seus serviços pelo
construtor, com valor padrão:

```typescript
export class TransactionController {
  constructor(private readonly transactionService = new TransactionService()) {}
}
```

Em produção a instância padrão é usada; em teste é possível injetar um dublê. O mesmo
padrão aparece no `TransactionService`, que **compõe** outros dois objetos — o
`CalculationService` (núcleo financeiro reutilizável) e o `CategoryService` (validação do
catálogo) — em vez de reimplementar essas responsabilidades.

**Responsabilidade única.** `CalculationService` só calcula: não conhece HTTP, banco nem
usuário. Por isso é testável isoladamente, sem subir servidor nem banco
(`calculation.service.test.ts`).

### 4.2. Como as rotas se ligam aos controllers

Cada arquivo de rotas instancia o controller uma vez e mapeia **verbo HTTP → método da
classe**. Não há lógica nas rotas:

```typescript
// src/routes/transaction.routes.ts
const router = Router();
const controller = new TransactionController();

router.use(authMiddleware, passwordPolicyMiddleware);
router.get('/',       asyncHandler((req, res) => controller.list(req, res)));
router.post('/',      asyncHandler((req, res) => controller.create(req, res)));
router.put('/:id',    asyncHandler((req, res) => controller.update(req, res)));
router.delete('/:id', asyncHandler((req, res) => controller.remove(req, res)));

export default router;
```

O `router.use(...)` aplica a cadeia de middlewares a **todas** as rotas do arquivo: a
autenticação é garantida por construção, não por disciplina de quem escreve cada rota. O
`routes/index.ts` agrupa os routers de todos os domínios sob o prefixo `/api`.

### 4.3. As operações CRUD em detalhe

#### `GET /api/transactions` — READ (coleção)

Método `list()`. Além de listar, aplica **RBAC em nível de dados**: o perfil determina
tanto *quais* documentos quanto *quais campos* o usuário recebe.

```typescript
const filter = actor.role === 'admin'
  ? { deletedAt: null }
  : { deletedAt: null, professional: this.professionalFor(actor) };

if (actor.role === 'colaborador') {
  query.select('type description grossAmount commissionAmount category occurredAt status');
}
```

A colaboradora vê apenas os próprios atendimentos, e sem os campos de margem do estúdio
(`studioNetProfit`, `netAmount`, `feeAmount`). Negar o acesso ao *endpoint* não bastaria: é
preciso restringir a projeção, senão o dado sensível viajaria na resposta.

**Resposta:** `200 OK` com `{ "status": "success", "data": [...] }`

#### `POST /api/transactions` — CREATE

Método `create()`. Sequência executada:

1. Controller valida o corpo com Zod. Falha → `400 VALIDATION_ERROR`.
2. Service verifica a permissão de negócio: colaboradora só registra receita própria →
   `403 FORBIDDEN`.
3. `CategoryService.assertActive()` confere a categoria no catálogo → `400 INVALID_CATEGORY`.
4. `CalculationService` apura taxa, comissão, líquido e lucro.
5. `resolveSettledAt()` define `settledAt` conforme o status.
6. `Transaction.create()` persiste, e o Mongoose aplica as validações do schema.

**Resposta:** `201 Created` com o documento completo, incluindo os campos calculados.

#### `PUT /api/transactions/:id` — UPDATE

Método `update()`. Esta é a operação que completou o CRUD. Pontos de projeto:

- **Validação do identificador** antes de qualquer consulta:
  `z.string().regex(/^[a-f\d]{24}$/i)`. Um id malformado devolve `400 INVALID_ID` sem tocar
  o banco; um id bem formado que não existe devolve `404 NOT_FOUND`. São erros distintos
  para causas distintas.
- **O filtro de busca carrega a autorização.** O documento é localizado com um filtro que
  já embute o escopo do usuário:

  ```typescript
  const filter = actor.role === 'admin'
    ? { _id: transactionId, deletedAt: null }
    : { _id: transactionId, professional: this.professionalFor(actor), deletedAt: null };
  ```

  Uma colaboradora que tente editar o lançamento de outra profissional recebe `404`, porque
  o documento não existe *no escopo dela*. A verificação de permissão e a busca são a mesma
  operação atômica — não há janela entre "achei" e "posso?".
- **Recálculo obrigatório.** Os valores derivados são recalculados a partir da nova entrada.
  O cliente não consegue enviar um `netAmount` arbitrário: mesmo se enviar, o campo é
  sobrescrito pelo resultado do `CalculationService`.
- **Semântica de substituição.** Sendo `PUT`, o corpo completo é exigido. Isso evita a
  ambiguidade do `PATCH` entre "campo ausente" e "campo que deve ser esvaziado" — relevante
  justamente em `settledAt` e `costType`, que podem precisar ser removidos.

**Resposta:** `200 OK` com o documento atualizado e o **mesmo `_id`**.

#### `DELETE /api/transactions/:id` — DELETE

Método `remove()`, que chama `softDelete()`. Não há remoção física: a operação grava
`deletedAt` com a data atual, e todas as consultas passam a ignorar o documento.

```typescript
const result = await Transaction.updateOne(filter, { $set: { deletedAt: new Date() } });
if (result.matchedCount === 0) throw new AppError('Lançamento não encontrado.', 404, 'NOT_FOUND');
```

O `matchedCount === 0` cobre três casos com a mesma resposta `404`: o id não existe, já foi
apagado, ou pertence a outra profissional. Para um sistema financeiro, preservar o
histórico é requisito de auditoria.

**Resposta:** `204 No Content`, sem corpo.

### 4.4. Tabela completa de endpoints

| Método | Rota | Perfil | Operação | Sucesso |
|---|---|---|---|---|
| `GET` | `/health` | público | *Health check* | `200` |
| `POST` | `/api/auth/register` | público | Cadastro com confirmação por e-mail | `202` |
| `POST` | `/api/auth/login` | público | Autenticação, emite JWT | `200` |
| `GET` | `/api/auth/verify-email` | público | Confirma o e-mail por token | `200` |
| `POST` | `/api/auth/forgot-password` | público | Solicita redefinição | `202` |
| `POST` | `/api/auth/reset-password` | público | Redefine com token | `200` |
| `POST` | `/api/auth/change-password` | autenticado | Troca a própria senha | `200` |
| `POST` | `/api/auth/users` | admin | Cria usuário | `202` |
| `GET` | `/api/auth/users` | admin | Lista usuários | `200` |
| `DELETE` | `/api/auth/users/:id` | admin | Desativa usuário | `204` |
| `GET` | `/api/categories` | autenticado | READ coleção | `200` |
| `GET` | `/api/categories/:id` | admin | READ unitário | `200` |
| `POST` | `/api/categories` | admin | CREATE | `201` |
| `PUT` | `/api/categories/:id` | admin | UPDATE | `200` |
| `DELETE` | `/api/categories/:id` | admin | DELETE (*soft*) | `204` |
| `GET` | `/api/transactions` | autenticado | READ coleção, escopo por perfil | `200` |
| `POST` | `/api/transactions` | autenticado | CREATE | `201` |
| `PUT` | `/api/transactions/:id` | autenticado | UPDATE | `200` |
| `DELETE` | `/api/transactions/:id` | autenticado | DELETE (*soft*) | `204` |
| `GET` | `/api/reports/dre` | admin | DRE por competência | `200` |
| `GET` | `/api/reports/cash-flow` | admin | Fluxo de Caixa por liquidação | `200` |

### 4.5. Códigos de status e seu significado no projeto

| Código | Quando ocorre |
|---|---|
| `200` | Operação concluída com corpo de resposta |
| `201` | Recurso criado (`POST`) |
| `202` | Aceito para processamento assíncrono (envio de e-mail) |
| `204` | Concluído sem corpo (`DELETE`) |
| `400` | Corpo inválido (Zod), categoria fora do catálogo, id malformado, período inválido |
| `401` | Token ausente, inválido ou expirado; credenciais incorretas |
| `403` | Perfil sem permissão (RBAC) ou troca de senha pendente |
| `404` | Recurso inexistente **ou** fora do escopo do usuário |
| `409` | Conflito de unicidade (nome de categoria, e-mail) |
| `429` | Limite de requisições excedido |
| `500` | Erro inesperado; detalhe só no log do servidor |

---

## 5. Ferramentas, componentes e APIs utilizadas

### 5.1. Núcleo da aplicação

| Ferramenta | Versão | Finalidade | Aplicação concreta no projeto |
|---|---|---|---|
| **Node.js** | 20 LTS | Runtime JavaScript no servidor | Executa a API. O modelo de I/O não bloqueante atende bem a carga do projeto, dominada por espera de banco e de rede |
| **TypeScript** | 5.9 | Tipagem estática | *Strict mode* com `exactOptionalPropertyTypes` e `noUncheckedIndexedAccess`. Os tipos dos schemas Mongoose impedem ler campo inexistente em tempo de compilação |
| **Express** | 5.1 | Framework web | Roteamento modular (`Router`) e cadeia de middlewares. Toda a arquitetura de camadas se apoia nesse encadeamento |
| **MongoDB Atlas** | cloud | Banco NoSQL gerenciado | Armazena as quatro coleções. Backup, réplicas e TLS são responsabilidade do provedor |
| **Mongoose** | 8.19 | ODM | Schemas tipados, validação em nível de banco, índices, *connection pool* e a opção `timestamps` |

### 5.2. Segurança

| Ferramenta | Finalidade | Aplicação concreta no projeto |
|---|---|---|
| **jsonwebtoken** | Autenticação stateless | Token assinado com HS256, validade de 8 h, `subject` com o id do usuário e `role` no payload. Validado pelo `authMiddleware` em cada requisição |
| **bcrypt** | Hash de senha | 12 *rounds*. O custo proposital torna ataque de força bruta inviável. `passwordHash` é `select: false` |
| **Helmet** | Cabeçalhos HTTP de segurança | Aplica CSP, `X-Content-Type-Options`, HSTS e correlatos. Combinado com `app.disable('x-powered-by')`, deixa de anunciar a tecnologia do servidor |
| **CORS** | Controle de origem | Em produção, somente as origens listadas em `CORS_ORIGIN`; a configuração curinga é recusada na inicialização |
| **express-rate-limit** | Mitigação de força bruta e abuso | *Buckets* independentes: 120 req/min na API, 10 tentativas de login/15 min, 5 cadastros/h. Separar os limites evita que consulta de e-mail consuma as tentativas de login |
| **Zod** | Validação de entrada | Schemas por rota; nenhum dado chega ao service sem passar por `safeParse`. Também valida as variáveis de ambiente na inicialização |

Além das bibliotecas, dois mecanismos próprios: o **RBAC** (`rbacMiddleware`) e a
**política de senha de 90 dias** (`passwordPolicyMiddleware`), que bloqueia todas as rotas
protegidas enquanto a troca estiver pendente.

### 5.3. Comunicação e observabilidade

| Ferramenta | Finalidade | Aplicação concreta no projeto |
|---|---|---|
| **Nodemailer** | E-mail transacional via SMTP | Confirmação de cadastro e redefinição de senha. O token vai no e-mail; o banco guarda só o hash |
| **Pino** + **pino-http** | Log estruturado em JSON | Uma linha JSON por requisição, com método, rota, status e tempo de resposta. Os *serializers* registram apenas a URL sem query string, para não vazar dado sensível no log |
| **OpenTelemetry** | Tracing distribuído | Instrumentação automática de Express e MongoDB; exportação OTLP. Permite ver onde o tempo é gasto dentro de uma requisição |
| **Jaeger** (Docker) | Visualização de traces | Ambiente local de observabilidade (`docker-compose.observability.yml`) |

### 5.4. Qualidade, testes e automação

| Ferramenta | Finalidade | Aplicação concreta no projeto |
|---|---|---|
| **Vitest** | Testes automatizados | 25 testes em 6 arquivos. `calculation.service.test.ts` testa a regra financeira isolada; os demais são de integração |
| **Supertest** | Requisições HTTP em teste | Exercita a API de verdade, da rota ao banco, sem subir servidor em porta |
| **mongodb-memory-server** | MongoDB em memória | Cada execução roda contra banco limpo e descartável. Os testes não dependem de rede nem do Atlas |
| **ESLint** + **typescript-eslint** | Análise estática de estilo | `npm run lint` no pipeline |
| **GitHub Actions** | CI/CD | *Job* `quality` (lint, typecheck, cobertura) e *job* `codeql` (SAST) a cada push e PR |
| **CodeQL** | SAST | Varre o código em busca de injeção, exposição de dados e caminhos não tratados |
| **Wapiti** | DAST | Varredura dinâmica contra o ambiente de *staging*, acionada manualmente |
| **Dependabot** | Dependências vulneráveis | Monitora o `package-lock.json` e abre PR quando surge CVE |

Limiar de cobertura configurado: **60%** em *statements*, *branches*, *functions* e
*lines*. O pipeline falha abaixo disso.

### 5.5. APIs e serviços externos

Vale uma distinção, porque o termo "API" aparece em dois sentidos no artefato:

**A API que o projeto expõe** é a REST documentada na seção 4.4, consumida pelo aplicativo
React Native e por clientes HTTP como o Postman.

**Os serviços externos que o projeto consome** são três, todos de infraestrutura:

| Serviço | Protocolo | Uso |
|---|---|---|
| MongoDB Atlas | driver MongoDB sobre TLS | Persistência |
| Servidor SMTP | SMTP | Envio de e-mail transacional |
| Coletor OTLP (Jaeger) | OTLP/HTTP | Recebimento de traces |

**O projeto não consome APIs de terceiros.** Essa é uma informação importante e
frequentemente mal compreendida: o Booksy e a InfinitePay entram no sistema por **arquivo
exportado** (`.xlsx`, `.pdf`, `.csv`), não por integração programática — e essa ingestão
ainda não está implementada (seção 8). Não existe, portanto, chamada a API externa de
agendamento ou de pagamento.

---

## 6. Análise de vantagens e desvantagens

Cada tecnologia é avaliada pelo que entrega e pelo que cobra, considerando o contexto real:
um MVP acadêmico, desenvolvido por equipe pequena, para um estúdio com duas profissionais.

### 6.1. Node.js e Express

**Vantagens**

- **Uma só linguagem no projeto inteiro.** O front-end é React Native; back-end em
  JavaScript/TypeScript elimina a troca de contexto e permite compartilhar tipos e
  validações entre as duas pontas.
- **I/O não bloqueante adequado ao perfil de carga.** As requisições são dominadas por
  espera de banco e de rede, exatamente o cenário em que o modelo de evento do Node rende
  mais que o de uma thread por requisição.
- **Express é minimalista e previsível.** A arquitetura em camadas foi construída sobre a
  cadeia de middlewares, sem framework ditando estrutura.
- **Ecossistema npm maduro** para tudo que o projeto precisou: JWT, bcrypt, rate limit,
  validação, log.

**Desvantagens**

- **Single-thread limita trabalho de CPU.** Um processamento pesado bloquearia o *event
  loop*. Mitigado por ora porque não existe tarefa CPU-bound; a futura importação de
  planilhas pode precisar de fila ou *worker thread*.
- **Minimalismo cobra decisões de arquitetura.** O Express não impõe estrutura: a separação
  em camadas é disciplina da equipe, não garantia do framework. Em equipe grande isso
  tenderia a divergir — foi a razão de documentar a estrutura explicitamente.
- **Tratamento manual de erro assíncrono.** O Express não captura rejeição de `Promise`,
  o que exigiu o utilitário `asyncHandler` em cada rota. Esquecer de usá-lo em uma rota
  nova derruba o processo.
- **Dependências transitivas aumentam a superfície de risco**, daí o Dependabot e o CodeQL
  no pipeline.

### 6.2. TypeScript

**Vantagens**

- **Erros detectados em compilação, não em produção.** No domínio financeiro, confundir
  `netAmount` com `studioNetProfit` é bug caro; o compilador acusa.
- **Contratos explícitos entre camadas.** `CreateTransactionInput` e `AuthenticatedUser`
  documentam a fronteira entre controller e service de forma verificável.
- ***Strict mode* agressivo.** `exactOptionalPropertyTypes` e `noUncheckedIndexedAccess`
  pegam a classe de erro mais comum em JavaScript: assumir que um valor opcional existe.
- **Refatoração segura.** A reorganização das pastas deste projeto foi validada por
  `tsc --noEmit`, que apontaria qualquer import quebrado.

**Desvantagens**

- **Etapa de build.** Existe um passo de compilação entre escrever e executar, e o *runtime*
  em desenvolvimento depende do `tsx`.
- **Curva de aprendizado** em tipos avançados — genéricos de schema, tipos utilitários.
- **Tipagem não alcança a borda.** Dado que vem de requisição HTTP é `any` na prática; a
  segurança de tipo depende da validação Zod em tempo de execução. É por isso que as duas
  ferramentas são usadas juntas, e não uma em lugar da outra.
- **Tipos de terceiros podem divergir** da biblioteca real, exigindo `skipLibCheck`.

### 6.3. MongoDB Atlas e Mongoose

**Vantagens**

- **Documento alinhado ao modelo de leitura.** Um lançamento é lido por inteiro, em uma
  consulta, sem *join*.
- **Esquema flexível durante o MVP.** Campos foram acrescentados conforme o negócio foi
  entendido, sem migração de tabela.
- **Operação gerenciada.** Backup, réplicas, TLS e monitoramento ficam com o provedor —
  decisivo para uma equipe sem DBA.
- **Mongoose devolve o rigor que o NoSQL não impõe:** `enum`, `required`, `unique`, índices
  e tipagem TypeScript, aplicados em toda escrita.
- **Índices compostos sob medida.** `{ occurredAt, type, deletedAt }` atende exatamente à
  consulta da DRE.

**Desvantagens**

- **Sem integridade referencial.** O MongoDB não tem `FOREIGN KEY`: apagar um usuário não
  impede que `createdBy` aponte para um id inexistente. A consistência depende da
  aplicação.
- **Transações multi-documento exigem réplica e são mais custosas** que em banco
  relacional. O projeto não precisou delas; a importação de lotes com *rollback* vai
  precisar.
- **Agregações financeiras em JavaScript.** DRE e Fluxo de Caixa carregam os lançamentos do
  período e somam em memória, em vez de usar `$group` no banco ou `GROUP BY` do SQL.
  Funciona bem no volume atual (centenas de lançamentos por mês) e é mais legível e
  testável; com anos de histórico, precisará migrar para *aggregation pipeline*.
- **Desnormalização é aposta.** Gravar os valores calculados preserva o histórico, mas
  significa que um erro de cálculo não se corrige recalculando: exige script de correção
  nos documentos já gravados.
- **Dependência de provedor.** Cluster na nuvem implica latência de rede e exige liberar IP
  em *Network Access* — um atrito real no desenvolvimento local.

### 6.4. JWT e bcrypt

**Vantagens**

- **Stateless.** Não há sessão em memória: o servidor reinicia ou escala sem derrubar
  usuário logado.
- **Autorização no próprio token.** O `role` viaja no payload, então o RBAC não consulta o
  banco a cada requisição.
- **bcrypt com custo ajustável.** Os 12 *rounds* tornam força bruta inviável, e o fator
  pode subir conforme o hardware evolui.
- **bcrypt já embute o *salt***, eliminando a classe de erro de gerenciá-lo manualmente.

**Desvantagens**

- **Token não pode ser revogado antes de expirar.** Um JWT vazado é válido por até 8 h.
  Mitigado pela validade curta; revogação de verdade exigiria *blacklist* ou *refresh
  token* — e aí se perde parte do benefício de ser stateless.
- **Papel desatualizado até o token expirar.** Rebaixar um usuário de `admin` só surte
  efeito no próximo login, porque o `role` está no token.
- **O segredo é ponto único de falha.** Vazar `JWT_SECRET` permite forjar qualquer
  identidade. Daí o mínimo de 32 caracteres validado na inicialização e a proibição de
  versionar `.env`.
- **bcrypt é lento de propósito**, o que torna o endpoint de login naturalmente mais custoso
  — razão a mais para o *rate limit* específico.
- **bcrypt limita a senha a 72 bytes**, limite tratado explicitamente na validação.

### 6.5. Zod e a validação de categoria

**Vantagens**

- **Validação e tipo na mesma declaração.** O schema Zod gera o tipo TypeScript, evitando
  que validação e tipo divirjam.
- **Falha cedo e em um só lugar.** O corpo é validado na entrada do controller; nenhum dado
  inválido chega à regra de negócio.
- **Também protege a configuração.** As variáveis de ambiente passam por Zod na
  inicialização: faltando uma obrigatória, o processo encerra em vez de subir quebrado
  (*fail-fast*).
- **Validação condicional expressiva.** O `superRefine` exige `costType` somente quando o
  lançamento é despesa.

**Desvantagens**

- **Validação duplicada.** As regras existem no Zod (entrada) e no schema Mongoose (banco).
  É redundância proposital — defesa em profundidade —, mas são dois lugares para manter em
  sincronia.
- **Mensagem de erro genérica.** O controller devolve `"Dados de entrada inválidos."` sem
  dizer qual campo falhou. Decisão de segurança, já que detalhar expõe a estrutura interna,
  mas custa clareza para quem integra. Um detalhamento só em ambiente de desenvolvimento
  seria o melhor dos dois mundos.

**Sobre a decisão de validar a categoria por nome.** O campo `category` em `transactions`
guarda o nome, validado contra o catálogo na escrita, em vez de um `ObjectId` referenciando
`categories`.

| | Nome validado (adotado) | Referência por `ObjectId` |
|---|---|---|
| Leitura | Nome já disponível, sem *join* | Exige `populate` ou segunda consulta |
| Renomear categoria | Lançamentos antigos ficam com o nome antigo | Propaga automaticamente |
| Integridade | Garantida na escrita pela aplicação | Mais próxima de uma chave estrangeira |
| Relatórios | Agrupamento direto por nome | Exige resolver a referência |

A escolha privilegia a leitura, que é a operação dominante, e resolve o problema central —
o fim da string livre, com catálogo e unicidade insensível a maiúsculas e acentos. A
contrapartida assumida é que renomear uma categoria não reescreve o histórico. Para a DRE
isso é até desejável: o relatório de um mês passado continua mostrando a nomenclatura
vigente naquele mês. Um sistema maior provavelmente usaria referência por `ObjectId`.

### 6.6. Soluções de arquitetura adotadas

| Decisão | Vantagem | Desvantagem assumida |
|---|---|---|
| **Camadas (routes → controllers → services → models)** | Responsabilidades isoladas; regra de negócio testável sem HTTP | Mais arquivos e indireção que um CRUD em arquivo único |
| **Model Mongoose como repositório (*Active Record*)** | Menos uma camada para manter; menos código de passagem | Acopla a regra ao Mongoose; trocar de ODM afetaria os services |
| ***Soft delete*** em todas as coleções | Histórico auditável; exclusão reversível | Toda consulta precisa filtrar `deletedAt: null` — esquecer em uma consulta nova vaza dado apagado |
| **Valores financeiros calculados no servidor** | Cliente não é fonte de verdade; alíquota centralizada | Mudança de regra exige script para corrigir dados antigos |
| **Valores derivados gravados no documento** | Preserva o valor histórico real | Desnormalização: um erro de cálculo persiste no banco |
| **RBAC no filtro da consulta** | Autorização e busca são atômicas; sem janela de verificação | Mesma resposta `404` para "não existe" e "não é seu", o que confunde ao depurar |
| **`PUT` com corpo completo (em vez de `PATCH`)** | Semântica sem ambiguidade para limpar campos como `settledAt` | Cliente precisa enviar todos os campos a cada edição |
| **Envelope único de resposta** | Cliente trata sucesso e erro em um só lugar | Um nível extra de aninhamento (`data`) em toda resposta |

---

## 7. Apresentação do funcionamento

O funcionamento pode ser demonstrado por duas vias complementares, ambas sem depender da
interface do aplicativo.

### 7.1. Demonstração manual pela API (Postman)

O documento **`GUIA_TESTES_POSTMAN.md`** traz o roteiro completo, com 17 requisições em
ordem, os corpos JSON prontos e o que observar em cada resposta. A sequência comprova as
exigências do artefato:

| Exigência | Passos | Evidência observável |
|---|---|---|
| CRUD completo de Transações | 10 a 13 | `201` no CREATE, `200` no UPDATE **com o mesmo `_id`**, `204` no DELETE |
| CRUD de Categorias | 4 a 8, 17b | `200`, `201`, `200`, `200`, `204`, e `409` na unicidade |
| Categoria validada no catálogo | 9, 17b | `400` "Categoria inválida ou inativa no catálogo." |
| Liquidação com `settledAt` | 15 | Campo `settledAt` preenchido pelo servidor |
| `settledAt` alimentando o Fluxo de Caixa | 14 → 16 | O mesmo relatório passa de vazio para `182.42` |
| Cálculo financeiro no servidor | 10 | `feeAmount`, `commissionAmount`, `netAmount`, `studioNetProfit` |
| Autenticação JWT e RBAC | 2, 3 | `401` sem token |

O trecho mais demonstrativo é o par **14 → 16**: o mesmo `GET /api/reports/cash-flow` é
executado antes e depois do `PUT` que liquida o lançamento, e o saldo do período passa de
vazio para `182.42` sem nenhuma outra alteração. Isso evidencia, em duas requisições, toda
a cadeia: edição → liquidação → `settledAt` → regime de caixa.

### 7.2. Verificação automatizada

```powershell
cd backend
npm test
```

**Resultado:** 25 testes em 6 arquivos, todos passando. Não exige banco nem servidor no ar —
o `mongodb-memory-server` levanta um MongoDB descartável por execução.

| Arquivo | Cobre |
|---|---|
| `category-transaction.test.ts` | CRUD de categorias restrito ao admin, recusa de categoria fora do catálogo, e o `PUT` que liquida preenchendo `settledAt` e limpa ao voltar para pendente |
| `calculation.service.test.ts` | A regra financeira isolada, sem HTTP nem banco |
| `auth.test.ts` | Hash bcrypt de 12 *rounds*, login, resposta `401` genérica, redefinição de senha com token de uso único, política de 90 dias |
| `rbac.test.ts` | Colaboradora vê só os próprios lançamentos; relatórios negados a ela; despesa e exclusão alheia bloqueadas |
| `rateLimit.test.ts` | `429` após o limite de tentativas de login |
| `logger.test.ts` | Configuração do log estruturado |

A diferença entre as duas vias merece registro: o roteiro do Postman demonstra **o
comportamento**, em uma conversa com a API rodando de verdade; a suíte automatizada
demonstra **a regra**, de forma repetível e verificável por qualquer pessoa que clone o
repositório.

---

## 8. Limitações conhecidas e próximos passos

Registrar o que ainda não está pronto é parte da honestidade técnica do relatório.

| Limitação | Situação atual | Encaminhamento |
|---|---|---|
| **Pipeline de ingestão Booksy/InfinitePay** | A coleção `importbatches` está modelada, com hash de conteúdo para deduplicação, mas **não há código que a utilize**: sem controller, service ou rota | Implementar `/api/imports` com *upload*, *parsing* de `.xlsx`/`.csv`/`.pdf`, deduplicação por `contentHash` e *rollback* de lote |
| **Vínculo lote ↔ lançamento** | `transactions` não tem `importBatchId` | Acrescentar o campo; sem ele não é possível reverter um lote importado |
| **Profissional fixada em código** | `professionalFor()` mapeia `admin → Nicolle` e `colaborador → Stefany`; `users` não tem campo `professional` | Criar o vínculo no modelo `User`. Hoje, uma segunda colaboradora quebraria a regra silenciosamente |
| **Controle de estoque** | Previsto no escopo do produto, não iniciado | Modelar insumos e consumo por atendimento |
| **Histórico de senhas** | A política de 90 dias está implementada, mas **não há** bloqueio de reutilização de senhas anteriores | Guardar os últimos hashes em `users` e comparar na troca |
| **Agregação em memória** | DRE e Fluxo de Caixa somam os lançamentos em JavaScript | Migrar para *aggregation pipeline* quando o volume justificar |
| **Mensagens de validação genéricas** | `400` não informa o campo que falhou | Detalhar as *issues* do Zod apenas em ambiente de desenvolvimento |

---

## Referências internas do repositório

| Documento | Conteúdo |
|---|---|
| `README.md` | Visão geral do projeto e da stack |
| `especificacao-tecnica-backend.md` | Especificação técnica e arquitetural detalhada |
| `GUIA_TESTES_POSTMAN.md` | Roteiro de testes manuais da API, passo a passo |
| `backend/README.md` | Instalação, configuração e execução local |
| `backend/DEPLOYMENT.md` | Implantação em VPS |
| `backend/RELATORIO_TESTES_SEGURANCA.md` | Resultados dos testes de segurança |
| `SECURITY.md` | Política de divulgação de vulnerabilidades |
