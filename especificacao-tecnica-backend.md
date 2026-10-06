# ESPECIFICAÇÃO TÉCNICA E ARQUITETURAL DO BACK-END
## SISTEMA DE GESTÃO FINANCEIRA — NICOLLE NERIS STUDIO

---

**Documento:** Guia Definitivo de Desenvolvimento do Back-End  
**Projeto:** Back-Office Financeiro e Analítico  
**Stakeholder:** Nicolle Neris Studio  
**Versão:** 1.0.0  
**Status:** Aprovado / Especificação Oficial  

---

## 1. VISÃO GERAL E ARQUITETURA

O sistema de Gestão Financeira do **Nicolle Neris Studio** é uma aplicação projetada para resolver a fragmentação operacional entre o agendamento de clientes (**Booksy**), o recebimento físico/digital (**InfinitePay** / Pix) e o controle financeiro informal (papel e aplicativos pessoais). O Back-End atua como a inteligência central do ecossistema (*Back-Office Financeiro*), provendo APIs RESTful de alta performance, seguras e auditáveis para consumo exclusivo pela aplicação mobile em React Native/Expo.

### 1.1. Stack Tecnológica Definitiva

- **Linguagem:** TypeScript (v5+) executado sobre ambiente fortemente tipado.
- **Runtime / Ambiente de Execução:** Node.js (v20+ LTS).
- **Framework Web:** Express.js (v4/v5) utilizando arquitetura baseada em middlewares e roteamento modular.
- **Banco de Dados:** MongoDB Atlas (Cloud - NoSQL) com armazenamento de documentos JSON/BSON.
- **Mapeamento de Dados (ODM):** Mongoose (v8+) com esquemas estritamente tipados e validações em nível de banco.
- **Autenticação e Autorização:** JSON Web Token (JWT) com controle de acesso baseado em papéis (RBAC - *Role-Based Access Control*).
- **Segurança de Credenciais:** `bcrypt` com fator de custo (*salting*) configurado para no mínimo 12 rodadas.

### 1.2. Arquitetura de Conexão dos Componentes

```
┌─────────────────────────────────────────────────────────┐
│              Front-End Mobile (React Native / Expo)     │
└────────────────────────────┬────────────────────────────┘
                             │  HTTPS / REST / JSON
                             ▼
┌─────────────────────────────────────────────────────────┐
│            Proxy Reverso / Firewall (Nginx)             │
│            Porta Alta HTTPS (ex: 8443)                  │
└────────────────────────────┬────────────────────────────┘
                             │  Reverse Proxy
                             ▼
┌─────────────────────────────────────────────────────────┐
│               Back-End API Node.js (Express)            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Middlewares  │─►│ Controllers  │─►│   Services    │ │
│  │ (Auth/RBAC)  │  │ (Validation) │  │ (Core Finance)│ │
│  └──────────────┘  └──────────────┘  └───────┬───────┘ │
└────────────────────────────────────────────────┼────────┘
                                                 │ Mongoose ODM
                                                 ▼
┌─────────────────────────────────────────────────────────┐
│             MongoDB Atlas (Cloud Cluster)               │
│   Collections: users, transactions, import_batches      │
└─────────────────────────────────────────────────────────┘
```

---

## 2. ESTRUTURA DE PASTAS E PADRÕES

A estrutura do projeto segue o padrão de **Arquitetura em Camadas (Layered Architecture)** com separação clara de responsabilidades (*Separation of Concerns*), permitindo testabilidade isolada e manutenibilidade contínua.

### 2.1. Organização do Repositório (`src/`)

```
backend-nicolle-neris/
├── .github/
│   └── workflows/
│       ├── ci-cd.yml               # Pipeline de Build, Testes, SAST e DAST
│       └── dependabot.yml          # Monitoramento de vulnerabilidades em pacotes
├── .env.example                    # Modelo de variáveis de ambiente (sem segredos)
├── .gitignore
├── SECURITY.md                     # Política de divulgação responsável de vulnerabilidades
├── package.json
├── tsconfig.json
├── sonar-project.properties        # Configuração da análise estática SonarCloud
└── src/
    ├── @types/                     # Extensões de tipos globais do TypeScript (ex: Express Request)
    ├── config/                     # Configurações do banco, ambiente e serviços externos
    │   ├── database.ts             # Conexão Mongoose com MongoDB Atlas
    │   ├── env.ts                  # Validação das variáveis de ambiente com Zod/Joi
    │   └── logger.ts               # Logger estruturado (Winston/Pino)
    ├── controllers/                # Camada de Entrada / Validação de DTOs e Respostas HTTP
    │   ├── AuthController.ts
    │   ├── TransactionController.ts
    │   ├── ImportController.ts
    │   └── ReportController.ts
    ├── services/                   # Camada de Regra de Negócio (Cálculos de Taxas/Comissões/DRE)
    │   ├── AuthService.ts
    │   ├── TransactionService.ts
    │   ├── CalculationService.ts   # Core financeiro reutilizável
    │   ├── ImportService.ts        # Ingestão de arquivos Booksy e InfinitePay
    │   └── ReportService.ts        # Consolidação de DRE e Fluxo de Caixa
    ├── models/                     # Schemas e Interfaces do Mongoose
    │   ├── User.ts
    │   ├── Transaction.ts
    │   └── ImportBatch.ts
    ├── middlewares/                # Interceptadores de Requisições
    │   ├── authMiddleware.ts       # Validação e Decodificação do Token JWT
    │   ├── rbacMiddleware.ts       # Controle de Perfil (Admin vs. Colaborador)
    │   ├── errorHandler.ts         # Tratamento global de exceções
    │   └── rateLimiter.ts          # Proteção contra ataques de Força Bruta / DoS
    ├── routes/                     # Definição das Rotas da API REST
    │   ├── index.ts
    │   ├── auth.routes.ts
    │   ├── transaction.routes.ts
    │   ├── import.routes.ts
    │   └── report.routes.ts
    ├── utils/                      # Funções Utilitárias e Helpers
    │   ├── AppError.ts             # Classe customizada para tratamento de erros
    │   └── emailService.ts         # Envio de e-mails transacionais (Nodemailer)
    └── server.ts                   # Ponto de entrada da aplicação
```

### 2.2. Padrões de Código e Tratamento de Erros

1. **Tratamento Global de Exceções:** Todo erro de negócio deve lançar uma instância de `AppError(message, statusCode)`. O middleware `errorHandler` intercepta essas exceções e formata a resposta padronizada:
   ```json
   {
     "status": "error",
     "message": "Descrição amigável da falha para o cliente",
     "code": "CODIGO_INTERNO_ERRO"
   }
   ```
2. **Validação Rigorosa de Inputs:** Todas as requisições devem ser validadas no Controller utilizando schemas tipados (Zod) antes de atingir a camada de Service.

---

## 3. LÓGICA DE NEGÓCIO (CORE FINANCEIRO)

O módulo financeiro é o coração da aplicação. Ele garante que os valores cobrados dos clientes sejam desmembrados corretamente entre taxas da maquininha, comissão do profissional e lucro retido pelo estúdio.

### 3.1. Ordem Definitiva do Cálculo Financeiro

Para cada lançamento de atendimento, o sistema deve executar a seguinte sequência matemática no `CalculationService`:

1. **Base de Cálculo:**
   $$\text{Base} = \text{Valor Bruto (grossAmount)} - \text{Desconto Comercial (discountAmount)}$$
2. **Taxa da Maquininha Isolada (InfinitePay):**
   $$\text{Taxa Isolada (feeAmount)} = \text{Base} \times \text{Alíquota da Maquininha (conforme modalidade)}$$
3. **Valor Líquido Recebido no Banco:**
   $$\text{Valor Líquido (netAmount)} = \text{Base} - \text{Taxa Isolada (feeAmount)}$$
4. **Comissão do Profissional Responsável (Nicolle ou Stefany):**
   $$\text{Comissão (commissionAmount)} = \text{Base} \times \text{Percentual da Profissional}$$
5. **Lucro Líquido Retido pelo Estúdio:**
   $$\text{Lucro do Estúdio (studioNetProfit)} = \text{Valor Líquido (netAmount)} - \text{Comissão (commissionAmount)}$$

### 3.2. Distinção de Regimes Contábeis

- **DRE Gerencial (Regime de Competência):**
  - Utiliza estritamente o campo **`occurredAt`** (Data em que o serviço foi prestado).
  - Estrutura de Apuração:
    ```
    (+) Receita Operacional Bruta (Serviços + Vendas)
    (-) Deduções Comerciais (Descontos cedidos)
    (-) Taxas de Intermediação e Maquininha Isoladas (InfinitePay)
    (=) RECEITA OPERACIONAL LÍQUIDA
    (-) Custos Variáveis Operacionais (Comissões de Nicolle/Stefany + Insumos diretos)
    (=) MARGEM DE CONTRIBUIÇÃO / LUCRO BRUTO DO ESTÚDIO
    (-) Despesas Fixas Operacionais (Aluguel, Luz, Água, Internet)
    (-) Retirada de Pró-Labore
    (=) RESULTADO GERENCIAL LÍQUIDO DO PERÍODO
    ```

- **Fluxo de Caixa (Regime de Caixa):**
  - Utiliza estritamente o campo **`settledAt`** (Data em que o valor efetivamente caiu na conta corrente).
  - Apuração: `Saldo Inicial + Entradas Liquidadas - Saídas Liquidadas = Saldo Final em Caixa`.

---

## 4. POLÍTICAS DE ACESSO E IDENTIDADE

### 4.1. Criptografia de Senhas (Hashing)
- **Regra Estrita:** Proibição absoluta do armazenamento de senhas em texto claro (*plain text*).
- **Implementação:** Criptografia realizada na camada de Service antes da gravação no MongoDB, utilizando a biblioteca `bcrypt` com *salt* gerado aleatoriamente e mínimo de **12 rounds**.

### 4.2. Controle de Acesso Baseado em Funções (RBAC)
- **Perfis Definidos:**
  - `admin` (Proprietária / Nicolle): Acesso irrestrito a relatórios da DRE, Fluxo de Caixa, gestão de usuários, conciliação de lotes e parametrização de categorias.
  - `colaborador` (Parceira / Stefany): Acesso operacional restrito para lançamento rápido de atendimentos e visualização do histórico de suas próprias comissões.

### 4.3. Ciclo de Vida da Conta e Recuperação de Senhas
1. **Confirmação de E-mail no Cadastro:** Ao cadastrar um novo usuário, um e-mail transacional é disparado com um token assinado e expirável (validade de 24 horas). A conta permanece inativa até a validação do link.
2. **Fluxo "Esqueci a Senha":**
   - O usuário solicita a redefinição informando o e-mail cadastrado.
   - O sistema gera um token aleatório criptográfico (UUID v4 armazenado com hash no banco) com validade estrita de **15 minutos**.
   - Um link único de redefinição é enviado por e-mail. Após o uso ou expiração, o token é invalidado imediatamente.
3. **Política de Alteração Periódica de Senhas:**
   - Senhas devem expirar automaticamente a cada **90 dias**.
   - O schema do usuário mantém o campo `lastPasswordChange: Date`.
   - Um middleware verifica a data no login; caso exceda o limite, a requisição é redirecionada com a flag `mustChangePassword: true`, bloqueando outras ações até a atualização.
   - O sistema mantém o registro dos últimos 3 hashes de senha para evitar a reativação de senhas recentes.

---

## 5. SEGURANÇA DE SERVIÇOS E INFRAESTRUTURA

### 5.1. Hospedagem e Servidor Privado (VPS)
- **Ambiente Recomendado:** Servidor Virtual Privado (VPS Linux — Ubuntu Server 22.04 LTS ou Debian 12 Minimal).
- **Inibição de Portas Padrões:**
  - Troca da porta padrão de acesso SSH (de 22 para uma porta alta não padrão, ex: `22822`).
  - Troca das portas expostas da API Express (desabilitar porta 3000 em ambiente aberto e expor a aplicação em portas altas internas como `8443` ou `9090` atrás do Nginx).
- **Gestão de Usuários e Privilégios:**
  - Desativação completa do login direto como `root`.
  - Criação de usuário operacional com permissão sudo restrita.
  - Execução dos processos da API Node.js sob um usuário do sistema sem privilégios administrativos e sem acesso a shell (`nodeapp` / `nogroup`).

### 5.2. Gestão de Segredos e Variáveis de Ambiente
- **Proteção no Código-Fonte:** Proibição do commit de arquivos `.env` ou qualquer credencial hardcoded no repositório Git.
- **Injeção de Variáveis:** Utilização da biblioteca `dotenv` validada via `Zod` na inicialização do servidor. Se uma variável obrigatória estiver ausente, a aplicação interrompe a execução (*fail-fast*).
- **Lista de Variáveis Críticas:**
  - `PORT`: Porta alta de execução do servidor.
  - `MONGO_URI`: String de conexão criptografada com autenticação e TLS do MongoDB Atlas.
  - `JWT_SECRET`: Chave simétrica de alta entropia (mínimo de 64 caracteres aleatórios).
  - `JWT_EXPIRES_IN`: Duração do token (ex: `8h`).
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: Configurações de envio de e-mail.

### 5.3. Logs Estruturados e Auditoria
- **Servidor API:** Implementação de logger estruturado (`Winston` ou `Pino`) salvando requisições, erros e transações sensíveis em formato JSON.
- **Banco de Dados:** Ativação dos logs de auditoria e profiling do MongoDB Atlas para registrar alterações administrativas e falhas de autenticação.
- **Rotação de Logs:** Configuração do `logrotate` no SO para prevenir esgotamento de disco na VPS.

---

## 6. PIPELINE DE DEVOPS, TESTES E OBSERVABILIDADE

### 6.1. Integracao Continua (CI/CD) via GitHub Actions
O pipeline automatizado deve ser executado a cada *Push* ou *Pull Request* direcionado às branches `main` ou `develop`:

```yaml
name: Node.js Back-End CI/CD & Security Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install Dependencies
        run: npm ci
      - name: Linter & Typecheck
        run: |
          npm run lint
          npm run typecheck
      - name: Run Unit & Integration Tests
        run: npm run test:coverage

  sast-security:
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: SonarCloud Scan (SAST)
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
      - name: CodeQL Analysis
        uses: github/codeql-action/analyze@v3

  dast-security:
    needs: sast-security
    runs-on: ubuntu-latest
    steps:
      - name: Wapiti DAST Vulnerability Scan
        run: |
          sudo apt-get update && sudo apt-get install -y wapiti
          wapiti -u https://staging-api.nicolleneris.com.br/ -f html -o /tmp/wapiti-report.html
```

### 6.2. Análise Estática (SAST) e Dinâmica (DAST)
- **SAST (Static Application Security Testing):**
  - **SonarCloud / CodeQL:** Analisa o código TypeScript em busca de falhas de injeção (NoSQL Injection), exposição de dados sensíveis, caminhos não tratados e dívida técnica.
- **DAST (Dynamic Application Security Testing):**
  - **Wapiti:** Ferramenta executada em ambiente de homologação para simular ataques externos (Cross-Site Scripting, Parameter Tampering, Broken Auth) contra os endpoints ativos da API.

### 6.3. Observabilidade e Monitoramento em Tempo Real
- **APM (Application Performance Monitoring):** Integração com **Datadog** ou **New Relic** utilizando seus agentes nativos em Node.js.
- **Métricas Monitoradas:**
  - Taxa de erros por endpoint (HTTP 5xx / 4xx).
  - Tempo médio de resposta da API (Latência p95 / p99).
  - Utilização de memória Heap e CPU no processo Node.js.
  - Tempo de execução de queries e comandos no MongoDB Atlas.

---

## 7. PROCEDIMENTOS DE GOVERNANÇA E SEGURANÇA

### 7.1. Política de Divulgação de Vulnerabilidades (`SECURITY.md`)
O repositório deve conter um arquivo `SECURITY.md` definindo o canal e as diretrizes de reporte responsável:
- **Canal Seguro:** Vulnerabilidades devem ser reportadas diretamente para o e-mail do time de engenharia (`seguranca@nicolleneris.com.br`) e jamais abertas como *Issues* públicas no GitHub.
- **SLA de Triagem:** Confirmação do recebimento do relatório em até **24 horas**.
- **SLA de Correção:** Emissão de patch de segurança (*hotfix*) em até **72 horas** para vulnerabilidades críticas.

### 7.2. Atualização Contínua e Gestão de Dependências
- **Dependabot / Snyk:** Configurado para verificar diariamente o arquivo `package-lock.json`, gerando Pull Requests automáticos sempre que uma dependência com vulnerabilidade conhecida (CVE) for identificada.
- **Reuniões de Manutenção:** Realização de revisões quinzenais pela equipe de engenharia para aplicar atualizações secundárias do Node.js, Mongoose e pacotes auxiliares.

---
*Fim da Especificação Técnica Back-End — Nicolle Neris Studio.*
