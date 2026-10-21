# Guia de Testes Manuais no Postman

Este guia ensina a testar, à mão no Postman, as três exigências de backend do artefato:

1. **CRUD completo de Transações**, incluindo o `PUT /api/transactions/:id`
2. **CRUD de Categorias** em `/api/categories`
3. **Liquidação**: mudar de `pendente` para `liquidada` preenchendo `settledAt`

São 17 requisições, na ordem. Cada passo diz o que enviar e **o que olhar na resposta** —
é essa observação que serve de evidência para o professor.

---

## Parte 0 — Preparação

### 0.1. Suba a API

Abra um terminal (PowerShell) e deixe rodando:

```powershell
cd backend
npm run dev
```

Espere aparecer `Conexão com MongoDB estabelecida`. **Não feche este terminal** — se fechar,
a API cai e o Postman passa a dar erro de conexão.

### 0.2. Crie a Collection

No Postman: `New` → `Collection` → nome **Sistema Salão – API**.

Vá criando as requisições dentro dela (`Add request`) conforme o guia. Dá para ir
alterando uma só requisição a cada passo, mas salvar uma por passo deixa a demonstração
muito mais fácil: você clica de cima para baixo e conta a história.

### 0.3. Crie o Environment

`New` → `Environment` → nome **Local**, com estas quatro variáveis:

| Variable | Initial value |
|---|---|
| `baseUrl` | `http://localhost:3000` |
| `token` | *(deixe vazio)* |
| `categoriaId` | *(deixe vazio)* |
| `lancamentoId` | *(deixe vazio)* |

Salve e **selecione `Local`** no seletor de environment, no canto superior direito. Se
esquecer de selecionar, o `{{baseUrl}}` não é substituído e a requisição falha.

### 0.4. As três regras que valem para quase toda requisição

- **Token:** aba `Authorization` → Type **Bearer Token** → no campo Token escreva `{{token}}`.
- **Corpo JSON:** aba `Body` → marque **raw** → no dropdown à direita troque `Text` por **JSON**.
- **Variáveis:** `{{baseUrl}}`, `{{token}}`, `{{categoriaId}}` e `{{lancamentoId}}` são
  substituídas pelo Postman na hora do envio.

> **Atenção:** o teste grava no banco configurado em `MONGO_URI`, que por padrão é o
> MongoDB Atlas. Os passos 16 e 17 apagam o que foi criado. Se preferir não tocar no banco
> real, aponte `MONGO_URI` para um MongoDB local antes de subir a API.

---

## Parte 1 — Autenticação

### 1. A API está no ar?

| | |
|---|---|
| Método | `GET` |
| URL | `{{baseUrl}}/health` |
| Auth | `No Auth` |
| Body | nenhum |

**Esperado:** `200 OK` com `{"status":"ok"}`.

Se der *Error: connect ECONNREFUSED*, a API não está rodando — volte ao passo 0.1.

---

### 2. Login do admin

| | |
|---|---|
| Método | `POST` |
| URL | `{{baseUrl}}/api/auth/login` |
| Auth | `No Auth` |
| Body | raw / JSON |

```json
{
  "email": "seu.admin@exemplo.com",
  "password": "SuaSenhaAqui"
}
```

**Esperado:** `200 OK`. A resposta tem esta forma:

```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { "id": "...", "name": "...", "role": "admin", "mustChangePassword": false }
  }
}
```

**Agora copie o `data.token`** (todo o texto entre as aspas, é bem longo) e cole na
variável `token` do Environment, na coluna **Current value**. Todas as próximas
requisições usam esse token.

> O token expira em **8 horas**. Se do nada tudo começar a dar `401`, refaça o login.

#### Se o login der errado

| O que apareceu | O que fazer |
|---|---|
| `401` *"E-mail ou senha inválidos."* | A senha não é a que está no banco. A variável `BOOTSTRAP_ADMIN_PASSWORD` do `.env` só vale para o primeiro acesso: se a senha já foi trocada, o `.env` está desatualizado. Use a senha atual, ou redefina com `POST {{baseUrl}}/api/auth/forgot-password` enviando `{"email":"..."}`. |
| `200`, mas com `"mustChangePassword": true` | A conta exige troca de senha e **todas** as outras rotas vão responder `403` até você trocar. Veja o passo 2.1. |
| `429` *"Muitas tentativas."* | Limite de 10 tentativas de login por 15 minutos. Espere. |

#### 2.1. Troca de senha obrigatória (só se precisar)

| | |
|---|---|
| Método | `POST` |
| URL | `{{baseUrl}}/api/auth/change-password` |
| Auth | Bearer `{{token}}` |
| Body | raw / JSON |

```json
{
  "currentPassword": "SuaSenhaAtual",
  "newPassword": "NovaSenhaForte#2026"
}
```

**Esperado:** `200 OK`. Depois **repita o passo 2** com a senha nova e atualize o `token`.

---

### 3. Prova de que as rotas são protegidas

Pegue a requisição do passo 4 (ou crie uma nova) e mande **sem token**:

| | |
|---|---|
| Método | `GET` |
| URL | `{{baseUrl}}/api/categories` |
| Auth | **`No Auth`** |

**Esperado:** `401 Unauthorized`.

Isso demonstra o middleware JWT. Depois volte o Auth para `Bearer Token`.

---

## Parte 2 — CRUD de Categorias (`/api/categories`)

> Exigência do artefato: *"Criar o Model Category.ts no Mongoose, o Controller, Service e
> as rotas CRUD (GET, POST, PUT, DELETE)."*

Da aqui para frente, **todas** as requisições vão com `Authorization: Bearer {{token}}`.

### 4. READ da coleção — listar o catálogo

| | |
|---|---|
| Método | `GET` |
| URL | `{{baseUrl}}/api/categories` |

**Esperado:** `200 OK` com um array em `data` (pode vir vazio se o catálogo estiver limpo).

---

### 5. CREATE — cadastrar uma categoria

| | |
|---|---|
| Método | `POST` |
| URL | `{{baseUrl}}/api/categories` |
| Body | raw / JSON |

```json
{
  "name": "Servicos de Cabelo",
  "kind": "receita",
  "active": true
}
```

**Esperado:** `201 Created`.

**O que mostrar na resposta:**
- `data._id` — o identificador gerado pelo MongoDB
- `data.kind` = `"receita"` — restringe a categoria a lançamentos de receita
- `data.createdAt` e `data.updatedAt` — preenchidos automaticamente pelo Mongoose

**Copie o `data._id`** para a variável `categoriaId` do Environment.

> O campo `kind` aceita `receita`, `despesa` ou `ambos`. Se você omitir, o padrão é `ambos`.

---

### 6. READ unitário — buscar pelo `_id`

| | |
|---|---|
| Método | `GET` |
| URL | `{{baseUrl}}/api/categories/{{categoriaId}}` |

**Esperado:** `200 OK` com a categoria criada no passo anterior.

---

### 7. UPDATE — editar a categoria

| | |
|---|---|
| Método | `PUT` |
| URL | `{{baseUrl}}/api/categories/{{categoriaId}}` |
| Body | raw / JSON |

```json
{
  "name": "Servicos de Cabelo",
  "kind": "ambos",
  "active": true
}
```

**Esperado:** `200 OK`.

**O que mostrar:** `kind` passou de `"receita"` para `"ambos"`, o `updatedAt` mudou e o
`_id` continua o mesmo — foi edição, não um registro novo.

---

### 8. Regra de unicidade — nome repetido é recusado

| | |
|---|---|
| Método | `POST` |
| URL | `{{baseUrl}}/api/categories` |
| Body | raw / JSON |

```json
{
  "name": "servicos de cabelo",
  "kind": "ambos",
  "active": true
}
```

**Esperado:** `409 Conflict` — *"Já existe uma categoria com este nome."*

**O que explicar:** repare que o nome foi enviado **todo em minúsculas** e mesmo assim
colidiu. O índice usa *collation* pt-BR, então `"Servicos"` e `"servicos"` são o mesmo
nome. É isso que evita a DRE quebrar com "Aluguel" e "aluguel" como categorias diferentes.

*(O `DELETE` de categoria fecha o CRUD e está no passo 17, depois dos testes de transação,
porque os lançamentos dependem desta categoria existir.)*

---

## Parte 3 — Categoria validada contra o catálogo

> Exigência: *"Substituir a string livre de categoria por vínculo com o modelo ou
> validação do catálogo de categorias do admin."*

### 9. Lançamento com categoria inexistente é recusado

| | |
|---|---|
| Método | `POST` |
| URL | `{{baseUrl}}/api/transactions` |
| Body | raw / JSON |

```json
{
  "type": "receita",
  "description": "Teste com categoria inexistente",
  "grossAmount": 100,
  "discountAmount": 0,
  "paymentFeeRate": 0,
  "professionalCommissionRate": 0,
  "professional": "Nicolle",
  "category": "Categoria Que Nao Existe",
  "paymentMethod": "pix",
  "occurredAt": "2026-10-21",
  "status": "pendente",
  "origin": "manual"
}
```

**Esperado:** `400 Bad Request` — *"Categoria inválida ou inativa no catálogo."*

**O que explicar:** o campo `category` não aceita mais texto livre. Antes de gravar, o
`TransactionService` consulta o catálogo de categorias e recusa o que não estiver lá,
ativo e com o `kind` compatível com o tipo do lançamento.

---

## Parte 4 — CRUD completo de Transações (`/api/transactions`)

> Exigência: *"Criar a rota e a lógica no TransactionController e TransactionService para
> permitir edição (PUT/PATCH) de um lançamento."*

### 10. CREATE — criar o lançamento

| | |
|---|---|
| Método | `POST` |
| URL | `{{baseUrl}}/api/transactions` |
| Body | raw / JSON |

```json
{
  "type": "receita",
  "description": "Corte e escova",
  "grossAmount": 150,
  "discountAmount": 10,
  "paymentFeeRate": 0.0399,
  "professionalCommissionRate": 0.4,
  "professional": "Nicolle",
  "category": "Servicos de Cabelo",
  "paymentMethod": "credito",
  "occurredAt": "2026-10-21",
  "status": "pendente",
  "origin": "manual"
}
```

**Esperado:** `201 Created`.

**O que mostrar na resposta — este é o passo mais rico da demonstração.** Você enviou
apenas o valor bruto, o desconto e as alíquotas; **todo o resto foi calculado no
servidor**:

| Campo na resposta | Valor | De onde vem |
|---|---|---|
| `feeAmount` | `5.59` | base (150 − 10 = 140) × 3,99% da maquininha |
| `commissionAmount` | `56` | base 140 × 40% da profissional |
| `netAmount` | `134.41` | base 140 − taxa 5,59 |
| `studioNetProfit` | `78.41` | líquido 134,41 − comissão 56 |
| `status` | `"pendente"` | padrão de um lançamento novo |
| `settledAt` | **não aparece** | lançamento pendente não tem data de liquidação |

Guarde esses números: o `settledAt` ausente é o ponto de partida da Parte 5.

**Copie o `data._id`** para a variável `lancamentoId`.

> Se der `400`, confira: `occurredAt` precisa ser uma data válida; para `type: "despesa"` o
> campo `costType` (`fixo` ou `variavel`) é obrigatório; e a `category` precisa existir no
> catálogo (passo 5).

---

### 11. READ — listar os lançamentos

| | |
|---|---|
| Método | `GET` |
| URL | `{{baseUrl}}/api/transactions` |

**Esperado:** `200 OK` com o lançamento do passo 10 na lista.

---

### 12. UPDATE — a operação que faltava no CRUD

| | |
|---|---|
| Método | `PUT` |
| URL | `{{baseUrl}}/api/transactions/{{lancamentoId}}` |
| Body | raw / JSON |

```json
{
  "type": "receita",
  "description": "Corte, escova e hidratacao (editado via PUT)",
  "grossAmount": 200,
  "discountAmount": 10,
  "paymentFeeRate": 0.0399,
  "professionalCommissionRate": 0.4,
  "professional": "Nicolle",
  "category": "Servicos de Cabelo",
  "paymentMethod": "credito",
  "occurredAt": "2026-10-21",
  "status": "pendente",
  "origin": "manual"
}
```

**Esperado:** `200 OK`.

**O que mostrar:**
- `_id` **igual** ao do passo 10 — foi uma edição, não um registro novo
- `grossAmount` agora é `200` e a `description` mudou
- `netAmount` passou de `134.41` para **`182.42`** — o servidor **recalculou** tudo a
  partir da nova base (200 − 10 = 190; taxa 7,58; 190 − 7,58 = 182,42)

> **Importante:** é `PUT`, que substitui o recurso. Mande sempre o **corpo completo** — se
> você omitir um campo obrigatório, recebe `400`, e não uma atualização parcial.

---

### 13. UPDATE em `_id` inexistente

Mesma requisição do passo 12, trocando só a URL por:

`{{baseUrl}}/api/transactions/ffffffffffffffffffffffff`

**Esperado:** `404 Not Found` — *"Lançamento não encontrado."*

**O que explicar:** o id tem formato válido de ObjectId (24 caracteres hexadecimais), mas
não existe. Se você mandar algo que não seja um ObjectId, como `123`, a resposta é `400`
*"Identificador inválido."* — são erros diferentes, validados em camadas diferentes.

---

## Parte 5 — Liquidação e Fluxo de Caixa

> Exigência: *"Garantir que a transação possa mudar de pendente para liquidada,
> preenchendo a data settledAt (necessário para alimentar a lógica do Fluxo de Caixa)."*

Esta é a parte mais convincente da demonstração, porque o **mesmo** relatório muda de
resultado por causa de uma única edição.

### 14. Fluxo de Caixa ANTES de liquidar

| | |
|---|---|
| Método | `GET` |
| URL | `{{baseUrl}}/api/reports/cash-flow?start=2026-10-01T00:00:00.000Z&end=2026-10-31T23:59:59.000Z` |

**Esperado:** `200 OK`, e o lançamento **não aparece** (`data` vazio, ou sem o valor dele).

**O que explicar:** o Fluxo de Caixa é regime de caixa — filtra por `settledAt` e
`status: "liquidada"`. O lançamento está pendente, então ainda não é dinheiro em caixa.

> As datas precisam ser ISO 8601 **completas, com hora e `Z`**. Se mandar só `2026-10-01`,
> a resposta é `400` *"Informe start e end como datas ISO 8601."*
> Esta rota é exclusiva de `admin`: com um usuário `colaborador`, dá `403`.

---

### 15. LIQUIDAR — mudar de pendente para liquidada

Mesma requisição do passo 12, mudando **apenas** o `status`:

| | |
|---|---|
| Método | `PUT` |
| URL | `{{baseUrl}}/api/transactions/{{lancamentoId}}` |
| Body | raw / JSON |

```json
{
  "type": "receita",
  "description": "Corte, escova e hidratacao (editado via PUT)",
  "grossAmount": 200,
  "discountAmount": 10,
  "paymentFeeRate": 0.0399,
  "professionalCommissionRate": 0.4,
  "professional": "Nicolle",
  "category": "Servicos de Cabelo",
  "paymentMethod": "credito",
  "occurredAt": "2026-10-21",
  "status": "liquidada",
  "origin": "manual"
}
```

**Esperado:** `200 OK`.

**O que mostrar:** o campo **`settledAt` apareceu na resposta**, preenchido com a data e
hora do momento (`"settledAt": "2026-10-21T19:27:43.896Z"`), embora você não tenha
enviado esse campo. O serviço preenche sozinho ao detectar a mudança para `liquidada`.

> Para registrar a data **real** do recebimento em vez de "agora", basta incluir
> `"settledAt": "2026-10-20T00:00:00.000Z"` no corpo.

---

### 16. Fluxo de Caixa DEPOIS de liquidar

Repita **exatamente** a requisição do passo 14.

**Esperado:** `200 OK`, e agora o relatório traz o dia da liquidação com o valor líquido:

```json
{ "status": "success", "data": [ { "date": "2026-10-21", "amount": 182.42 } ] }
```

**O que explicar:** o par de requisições 14 → 16, sem nenhuma outra mudança além do `PUT`
do passo 15, prova a exigência inteira: a liquidação preenche `settledAt` e é isso que
alimenta o Fluxo de Caixa.

**Bônus:** mande o `PUT` do passo 12 outra vez (`status: "pendente"`). O `settledAt`
desaparece da resposta, e o passo 16 volta a não mostrar o valor. Ou seja: a regra vale
nos dois sentidos.

---

## Parte 6 — DELETE: fechando o CRUD

### 17. Apagar o lançamento e a categoria

**17a.** `DELETE` `{{baseUrl}}/api/transactions/{{lancamentoId}}`
→ **`204 No Content`** (resposta sem corpo, é o correto para DELETE).

Rode de novo o passo 11: o lançamento **não aparece mais** na listagem. É *soft delete* —
o documento continua no MongoDB com o campo `deletedAt` preenchido, para preservar o
histórico, mas todas as consultas o ignoram.

**17b.** `DELETE` `{{baseUrl}}/api/categories/{{categoriaId}}`
→ **`204 No Content`**.

**Fechamento da demonstração:** mande de novo o `POST` do passo 10, com a mesma
`"category": "Servicos de Cabelo"`. Agora dá **`400`** — *"Categoria inválida ou inativa
no catálogo."* Ou seja: o catálogo de fato controla o que pode ser lançado.

---

## Checklist para o professor

| Exigência do artefato | Passos | Evidência |
|---|---|---|
| `PUT /api/transactions/:id` completando o CRUD | 12, 13 | `200` com o mesmo `_id` e valores recalculados; `404` em id inexistente |
| CRUD de Categorias: `GET`, `POST`, `PUT`, `DELETE` | 4, 5, 6, 7, 17b | `200`, `201`, `200`, `200`, `204` |
| Categoria validada contra o catálogo | 9, 17b | `400` "Categoria inválida ou inativa no catálogo." |
| Liquidação preenchendo `settledAt` | 15 | campo `settledAt` preenchido pelo servidor |
| `settledAt` alimentando o Fluxo de Caixa | 14 → 16 | o mesmo relatório passa de vazio para `182.42` |
| Cálculo financeiro no servidor | 10 | `feeAmount`, `commissionAmount`, `netAmount`, `studioNetProfit` |
| Autenticação JWT e RBAC | 2, 3, 14 | `401` sem token; `403` em rota de admin com colaborador |
| Unicidade de categorias | 8 | `409` com o nome em caixa diferente |

---

## Resumo dos endpoints

| Método | Rota | Perfil | Status de sucesso |
|---|---|---|---|
| `GET` | `/health` | público | `200` |
| `POST` | `/api/auth/login` | público | `200` |
| `POST` | `/api/auth/change-password` | autenticado | `200` |
| `GET` | `/api/categories` | autenticado | `200` |
| `GET` | `/api/categories/:id` | admin | `200` |
| `POST` | `/api/categories` | admin | `201` |
| `PUT` | `/api/categories/:id` | admin | `200` |
| `DELETE` | `/api/categories/:id` | admin | `204` |
| `GET` | `/api/transactions` | autenticado | `200` |
| `POST` | `/api/transactions` | autenticado | `201` |
| `PUT` | `/api/transactions/:id` | autenticado | `200` |
| `DELETE` | `/api/transactions/:id` | autenticado | `204` |
| `GET` | `/api/reports/dre` | admin | `200` |
| `GET` | `/api/reports/cash-flow` | admin | `200` |

## Tabela de erros

| Status | Significado no projeto |
|---|---|
| `400` | Corpo inválido (Zod), categoria fora do catálogo, `_id` malformado ou período de data inválido |
| `401` | Sem token, token expirado, ou credenciais erradas no login |
| `403` | Perfil sem permissão (RBAC), ou troca de senha obrigatória pendente |
| `404` | `_id` com formato válido que não existe no banco |
| `409` | Nome de categoria já cadastrado |
| `429` | Rate limit: 10 logins / 15 min, 120 requisições / min na API |
