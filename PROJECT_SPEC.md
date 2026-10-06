# ESPECIFICAÇÃO DE DESENVOLVIMENTO E GUIA DE AGENTES (AGENTS_SPEC.md)
> **Projeto:** Sistema de Gestão Financeira — Nicolle Neris Studio  
> **Instituição:** FATEC Zona Leste — Curso de Desenvolvimento de Software Multiplataforma (DSM)  
> **Foco de Interface:** Aplicativo Mobile Native (React Native / Expo) + API RESTful + Persistência Híbrida (SQL + NoSQL)  
> **Status do Documento:** Especificação Técnica Principal & Instruções para Agentes Autônomos de Código  

---

## 1. VISÃO GERAL E OBJETIVO DO PROJETO

O **Sistema Salão Nicolle Neris Studio** é uma aplicação mobile-first desenvolvida para centralizar, simplificar e dar visibilidade total à gestão financeira do estúdio de beleza. O foco exclusivo da aplicação é a **saúde financeira, fluxo de caixa, DRE gerencial e controle financeiro de estoque**, eliminando a opacidade causada pelo uso pulverizado de máquinas de cartão, recebimentos via Pix e agendas externas.

### 1.1. Premissas de Negócio & Convivência com Legados
* **Convivência com o Booksy:** O aplicativo **NÃO substitui o Booksy**. O Booksy permanece como a plataforma oficial de agendamentos das clientes. O sistema atua como **retaguarda analítica financeira**, ingerindo dados do Booksy (.xlsx/.csv) e da InfinitePay (.pdf/.csv).
* **Usabilidade Inspirada no Mobills:** Foco absoluto na velocidade de lançamento no balcão do salão. A interface mobile deve permitir registrar uma entrada/saída no modo **"Lançamento Rápido" em até 3 toques e menos de 15 segundos**.
* **Segregação de Perfis (RBAC):** Administradora (Nicolle) visualiza faturamento total, DRE, margem e relatórios globais. Colaboradoras (parceiras) possuem acesso restrito aos seus próprios lançamentos e baixas operacionais.

---

## 2. ESCOPO DEFINITIVO (ATIVO E NEGATIVO)

### 2.1. Escopo Ativo (O que DEVE ser desenvolvido)
1. **Módulo 1 — Autenticação e RBAC:** Login via e-mail/senha, JWT, criptografia Bcrypt e perfis `ADMIN` e `COLABORADOR`.
2. **Módulo 2 — Lançamentos Financeiros (Estrutura Mobills):** Registro de receitas/despesas com separação de valor bruto, descontos, taxas de maquininha e valor líquido. Botão flutuante para **Lançamento Rápido**.
3. **Módulo 3 — Pipeline de Ingestão e Conciliação:** Upload de relatórios Booksy (.xlsx/.csv) e InfinitePay (.pdf/.csv), conciliação de recebíveis e histórico de lotes com suporte a *rollback*.
4. **Módulo 4 — Controle Financeiro de Estoque (Estilo FinBeauty):** Inventário de insumos, cálculo do valor imobilizado, baixa por uso e alertas de estoque crítico.
5. **Módulo 5 — DRE Gerencial e Fluxo de Caixa:** Apuração automática de DRE Simplificada (Receita Bruta $\rightarrow$ Taxas $\rightarrow$ Receita Líquida $\rightarrow$ Custos Variáveis $\rightarrow$ Margem de Contribuição $\rightarrow$ Despesas Fixas $\rightarrow$ Lucro Líquido) e Fluxo de Caixa acumulado.
6. **Módulo 6 — Dashboard Mobile & Indicadores:** Cards de resumo, Ticket Médio, faturamento por profissional, formas de pagamento e barra de metas do mês.

### 2.2. Escopo Negativo (O que NÃO DEVE ser desenvolvido)
* ❌ Agenda ou Calendário de Marcação (Mantido 100% no Booksy).
* ❌ CRM, Cadastro de Clientes ou Anamnese.
* ❌ Automações de Marketing, Disparos de WhatsApp ou Chatbots.
* ❌ Motor de Cálculo Automático de Comissões (Comissões são informadas como linha de despesa operacional).
* ❌ Site Vitrine / Página Pública (Entregue por outra equipe).

---

## 3. ARQUITETURA TÉCNICA E STACK DE TECNOLOGIAS

```
+-----------------------------------------------------------------------+
|                    CLIENTE MOBILE (React Native / Expo)                |
|  [ Zustand / TanStack Query ] -> [ Axios Client ] -> [ Mobile UI ]    |
+-----------------------------------------------------------------------+
                                   | (HTTPS / JSON / JWT)
                                   v
+-----------------------------------------------------------------------+
|                       BACKEND API RESTful (Node.js)                   |
|  [ Express / NestJS ] -> [ Controllers -> Services -> Repositories ]   |
+-----------------------------------------------------------------------+
         |                                           |
         v (3FN Transacional)                        v (Documentos Ingeridos)
+-----------------------------------+     +-----------------------------+
| PostgreSQL / MySQL                |     | MongoDB                     |
| - Users, Transactions, Inventory  |     | - Raw Ingestion Batches     |
| - Categories, DRE Classifications |     | - Parsed JSON Logs          |
+-----------------------------------+     +-----------------------------+
```

### 3.1. Mobile Application (App)
* **Framework:** React Native com **Expo (Managed Workflow / Development Builds)**.
* **Linguagem:** TypeScript (Strict Mode).
* **Navegação:** React Navigation (Stack + Bottom Tabs).
* **Estilização / UI:** NativeWind (Tailwind CSS para React Native) ou React Native Paper / StyleSheet modular.
* **Gerenciamento de Estado:** **Zustand** (para estado global de sessão/UI) e **TanStack Query (React Query)** (para cache e sincronização com a API).
* **Requisições HTTP:** Axios com interceptors de renovação de Token JWT.
* **Recursos Nativos:** Expo DocumentPicker / ImagePicker (para anexo de comprovantes) e Expo FileSystem.

### 3.2. Backend API
* **Ambiente / Linguagem:** Node.js 20+ LTS com TypeScript 5+ e Express.js.
* **Arquitetura:** Arquitetura em Camadas (Layered Clean Architecture):
  * `Controllers`: Validação de DTOs e controle de HTTP Status Code.
  * `Services`: Regras de negócio contábeis, cálculos e pipelines.
  * `Repositories`: Acesso abstrato aos bancos de dados.
* **Banco de dados / ODM:** MongoDB Atlas com Mongoose 8+ para os modelos `User`, `Transaction` e `ImportBatch` desta atividade.
* **Autenticação / validação / logs:** JWT com expiração de até 8 horas, bcrypt com 12 rounds, Zod para DTOs e ambiente, e Pino para logs JSON com redação de segredos.
* **Processamento de Arquivos:** `xlsx` / `exceljs` para planilhas do Booksy; `pdf-parse` / `pdf2json` para extratos da InfinitePay.

### 3.3. Persistência Híbrida
* **Relacional (PostgreSQL/MySQL - 3FN):**
  * Tabelas: `users`, `categories`, `transactions` (receitas/despesas), `inventory_items`, `inventory_logs`, `ingestion_batches`.
  * **Regra de Imutabilidade:** Proibido `HARD DELETE`. Adotar obrigatoriamente `SOFT DELETE` (`deleted_at TIMESTAMP`) com logs de auditoria.
* **NoSQL (MongoDB):**
  * Coleções: `raw_booksy_imports`, `raw_infinitepay_imports`, `audit_logs`.
  * Guardar o payload bruto JSON das planilhas/PDFs enviados para rastreabilidade contábil.

---

## 4. MODELAGEM DE DADOS E REGRAS FINANCEIRAS

### 4.1. Estrutura da DRE Simplificada
A engine de relatório financeiro deve seguir estritamente o fluxo contábil:

$$\begin{aligned}
(+) & \text{ Receita Bruta (Serviços + Produtos + Cursos)} \\
(-) & \text{ Descontos e Abatimentos Concedidos} \\
(-) & \text{ Taxas de Meios de Pagamento (Maquininha/Cartão)} \\
\hline
(=) & \text{ Receita Líquida Operacional} \\
(-) & \text{ Custos Variáveis (Insumos consumidos + Comissões repassadas)} \\
\hline
(=) & \text{ Margem de Contribuição} \\
(-) & \text{ Despesas Fixas (Aluguel, Água, Luz, Internet)} \\
(-) & \text{ Pró-labore da Proprietária} \\
\hline
(=) & \text{ Resultado / Lucro Líquido do Período}
\end{aligned}$$

### 4.2. Categorias Oficiais de Lançamento
* **Receitas:** `Atendimentos Nicolle`, `Atendimentos Stephany`, `Venda de Produtos`, `Cursos/Procedimentos Extras`.
* **Despesas Fixas:** `Aluguel + IPTU + Água`, `Energia Elétrica`, `Internet/Sistemas`.
* **Despesas Variáveis/Operacionais:** `Salário / Pro-labore`, `Comissão Stephany`, `Materiais e Insumos (Nina Star, Anali, Atacadão Lash, Casa da Beleza)`, `Compras Studio`, `Uber / Transporte`.

---

## 5. DIVISÃO DE AGENTES E DIVISÃO DE TRABALHO (WORK BREAKDOWN)

Para permitir a execução paralela por agentes autônomos de IA (Cursor / Devin / Claude Code), o projeto está dividido em **5 Agentes Especialistas**:

```
+-----------------------------------------------------------------------------------+
|                                 AGENTE DE REQUISITOS                              |
|                                (Especificação Master)                             |
+-----------------------------------------------------------------------------------+
           |                     |                     |                     |
           v                     v                     v                     v
   +---------------+     +---------------+     +---------------+     +---------------+
   |   AGENTE 1    |     |   AGENTE 2    |     |   AGENTE 3    |     |   AGENTE 4    |
   | Database & API|     | Mobile React  |     | Ingestion &   |     | Financial &   |
   |   Core Stack  |     |   Native UI   |     |  Parser Pipeline|   | DRE Engine    |
   +---------------+     +---------------+     +---------------+     +---------------+
           \                     /                     \                     /
            v                   v                       v                   v
+-----------------------------------------------------------------------------------+
|                                     AGENTE 5                                      |
|                             (QA, Security & Compliance)                           |
+-----------------------------------------------------------------------------------+
```

---

### 🤖 AGENTE 1: Backend Infrastructure & Database Architect
**Responsabilidade:** Criar a estrutura base da API REST, conexão com PostgreSQL (Prisma) e MongoDB (Mongoose), autenticação JWT e rotas CRUD básicas.

* **Tarefas Principais:**
  1. Configurar projeto Node.js + TypeScript com Express/NestJS em arquitetura em camadas.
  2. Implementar schema Prisma/SQL na 3FN com tabelas: `User`, `Category`, `Transaction`, `InventoryItem`, `IngestionBatch`.
  3. Configurar Mongoose/MongoDB para armazenar payloads brutos de relatórios.
  4. Desenvolver middleware de autenticação JWT e verificação de `RBAC` (`ADMIN` x `COLABORADOR`).
  5. Criar endpoints REST CRUD com suporte a `soft delete` (`deleted_at`).

---

### 🤖 AGENTE 2: React Native Mobile UI/UX Engineer
**Responsabilidade:** Construir o aplicativo mobile focado no padrão Mobills, garantindo navegação rápida, formulário de Lançamento Rápido em 3 toques e interface mobile-first.

* **Tarefas Principais:**
  1. Inicializar app Expo com TypeScript, React Navigation (Tabs + Stacks) e NativeWind/Tailwind.
  2. Implementar fluxo de telas: `LoginScreen`, `DashboardScreen`, `TransactionsScreen`, `InventoryScreen`, `ReportsScreen`.
  3. Criar componente flutuante **"Modo Lançamento Rápido"** (`QuickEntryModal`) que captura valor, categoria e forma de pagamento em < 15 segundos.
  4. Integrar Zustand para controle de estado de usuário/sessão e TanStack Query para requisições na API.
  5. Implementar suporte a upload/captura de comprovantes (Expo ImagePicker / DocumentPicker).

---

### 🤖 AGENTE 3: Ingestion & Parser Pipeline Engineer
**Responsabilidade:** Desenvolver a engine de importação de relatórios heterogêneos (.xlsx do Booksy e .pdf/.csv da InfinitePay) e o sistema de conciliação e auditoria.

* **Tarefas Principais:**
  1. Criar `BooksyParserService` para ler planilhas `.xlsx`/`.csv` extraindo checkout, serviço, valor bruto, taxa e forma de pagamento.
  2. Criar `InfinitePayParserService` para processar extratos `.pdf`/`.csv` extraindo entradas Pix, depósitos e separando taxas de liquidação.
  3. Implementar módulo de desduplicação (evitar importar a mesma transação duas vezes com base em hash/ID único do Booksy/InfinitePay).
  4. Salvar arquivo e payload original no MongoDB (`InboundBatchDoc`) e transformar dados em registros na tabela `Transaction` (PostgreSQL).
  5. Criar lógica de **reversão de lote (Rollback)** executando exclusão lógica das transações geradas por uma importação específica.

---

### 🤖 AGENTE 4: Financial Engine & DRE Analytics Specialist
**Responsabilidade:** Implementar os algoritmos de apuração contábil, cálculo de Fluxo de Caixa, DRE Simplificada, valuation de estoque e consolidação de KPIs.

* **Tarefas Principais:**
  1. Implementar `DRECalculationService` seguindo a fórmula contábil oficial (Receita Bruta $\rightarrow$ Deduções $\rightarrow$ Taxas $\rightarrow$ Custos Variáveis $\rightarrow$ Margem $\rightarrow$ Despesas Fixas $\rightarrow$ Lucro).
  2. Desenvolver `CashFlowService` com agrupamentos temporais (Diário, Semanal, Mensal) calculando saldo inicial, entradas, saídas e saldo acumulado.
  3. Criar rotinas do módulo de Estoque: Baixa financeira por uso/perda, cálculo do valor total imobilizado e detecção de alerta de estoque mínimo.
  4. Implementar endpoints de Dashboard agregando: Ticket Médio, faturamento por profissional, ranking de serviços e meta x realizado.

---

### 🤖 AGENTE 5: QA, Security & Compliance Agent
**Responsabilidade:** Garantir cobertura de testes, validação de performance mobile, segurança da API e aderência aos requisitos não funcionais.

* **Tarefas Principais:**
  1. Escrever testes unitários e de integração (Jest / Supertest) para as regras de DRE e parsers de planilha.
  2. Garantir criptografia Bcrypt (fator mínimo 12) nas senhas e expiração de JWT em <= 8 horas.
  3. Validar tempo de resposta dos endpoints da API ($\le 1,5$s no P95) e tempo de importação em lote ($\le 5,0$s para 1000 linhas).
  4. Testar conformidade de contraste visual (WCAG 2.1 AA) e performance no mobile (payload inicial $< 3$MB).
  5. Garantir sanitização contra SQL Injection, XSS e validação de permissões RBAC em todos os endpoints HTTP.

---

## 6. GUIA E REGRAS DE EXECUÇÃO PARA OS AGENTES DE CÓDIGO

Qualquer Agente de IA trabalhando neste repositório DEVE cumprir rigorosamente as seguintes diretrizes:

1. **Nunca Utilizar Hard Delete:** Registros financeiros **jamais** devem ser deletados com `DELETE FROM`. Utilize sempre atualização de `deleted_at = NOW()`.
2. **Tipagem Estrita (TypeScript):** Proibido o uso de `any`. Toda resposta de API, DTO e props de componente React Native deve possuir interface/type explicitamente definido.
3. **Formatação de Moeda:** Todos os valores monetários no aplicativo e nas respostas da API devem estar padronizados em Reais (`R$ 1.234,56`), mantendo a precisão de 2 casas decimais no banco de dados (`DECIMAL(10,2)` ou inteiros em centavos).
4. **Respostas da API Padronizadas:**
   ```json
   {
     "success": true,
     "data": { ... },
     "message": "Operação realizada com sucesso",
     "timestamp": "2026-09-22T10:00:00Z"
   }
   ```
5. **Tratamento de Erros:** Não expor stack trace do banco de dados na resposta HTTP. Tratar exceções com mensagens claras e HTTP Status Codes apropriados (`400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `422 Unprocessable Entity`).
