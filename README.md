# 💇 Sistema Salão — Nicolle Neris Studio
 
> Projeto acadêmico desenvolvido para a **FATEC Zona Leste** — Curso de Desenvolvimento de Software Multiplataforma (DSM).

Sistema de gestão financeira mobile-first para o estúdio de beleza Nicolle Neris Studio, focado em centralizar e dar total visibilidade ao fluxo de caixa, DRE gerencial e controle financeiro de estoque.

---

## 📋 Sobre o Projeto

O **Sistema Salão** atua como **retaguarda analítica financeira**, convivendo com o Booksy (plataforma de agendamentos) e a InfinitePay (maquininha de cartão). Ele ingere dados de ambos os sistemas e oferece uma visão unificada e clara da saúde financeira do negócio.

### ✅ Funcionalidades Previstas

| Módulo | Descrição |
|---|---|
| 🔐 Autenticação & RBAC | Login JWT com perfis `ADMIN` e `COLABORADOR` |
| 💸 Lançamentos Financeiros | Receitas/despesas com Lançamento Rápido em 3 toques |
| 📊 Pipeline de Ingestão | Importação de relatórios Booksy (.xlsx) e InfinitePay (.pdf/.csv) |
| 📦 Controle de Estoque | Inventário de insumos, valor imobilizado e alertas |
| 📈 DRE & Fluxo de Caixa | Apuração automática da DRE Simplificada e Fluxo de Caixa |
| 📱 Dashboard Mobile | KPIs, Ticket Médio, faturamento por profissional e metas |

---

## 🏗️ Arquitetura

```
PSS-projeto-sistema-salao/
├── frontend/          # Aplicativo Mobile (React Native / Expo + TypeScript)
│   └── src/
│       ├── components/    # Componentes reutilizáveis
│       ├── screens/       # Telas do aplicativo
│       ├── navigation/    # Configuração do React Navigation
│       ├── store/         # Estado global (Zustand)
│       ├── services/      # Comunicação com API (Axios)
│       └── utils/         # Utilitários e helpers
│
├── backend/           # API RESTful (Node.js 20 + TypeScript + Express + MongoDB)
│   ├── src/
│   │   ├── config/        # Ambiente, MongoDB, logs e instrumentação
│   │   ├── controllers/   # HTTP e validação dos DTOs
│   │   ├── models/        # Schemas Mongoose
│   │   ├── services/      # Regras de autenticação e finanças
│   │   ├── routes/        # Rotas modulares
│   │   └── middlewares/   # JWT, RBAC e tratamento de erros
│   └── DEPLOYMENT.md      # Guia de implantação VPS
│
├── agents/            # Documentação e scripts dos agentes de IA
└── skills/            # Skills e runbooks para os agentes
```

---

## 🛠️ Stack de Tecnologias

### Frontend (Mobile)
- **React Native** com **Expo** (Managed Workflow)
- **TypeScript** (Strict Mode)
- **React Navigation** (Stack + Bottom Tabs)
- **Zustand** (estado global) + **TanStack Query** (cache de dados)
- **NativeWind** (estilização Tailwind para React Native)
- **Axios** (requisições HTTP com interceptors JWT)

### Backend (API)
- **Node.js 20+** + **TypeScript 5+** com **Express** em camadas
- **Mongoose 8+** → **MongoDB Atlas** (persistência da API)
- **JWT** + **bcrypt com 12 rounds** (autenticação e segurança)
- **Zod** (DTOs e variáveis de ambiente) + **Pino** (logs JSON com redação)
- **OpenTelemetry** opcional para exportação de traces via OTLP

Para instalar e executar a API localmente, consulte [backend/README.md](backend/README.md). A política de divulgação responsável está em [SECURITY.md](SECURITY.md).

---

## 🤖 Agentes de IA

O desenvolvimento é organizado em 5 agentes especialistas:

| Agente | Responsabilidade |
|---|---|
| `backend-architect` | API REST, banco de dados, JWT e RBAC |
| `mobile-engineer` | Expo, telas, navegação e estado global |
| `pipeline-engineer` | Importação e parsing de relatórios |
| `financial-engineer` | DRE, Fluxo de Caixa e KPIs |
| `qa-security` | Testes, segurança e performance |

---

## 📐 Regras de Desenvolvimento

- ❌ **Proibido Hard Delete** — sempre usar `soft delete` (`deleted_at`)
- ❌ **Proibido `any`** — tipagem estrita em todo o projeto
- 💰 **Moeda** — sempre `R$ 1.234,56` (DECIMAL 10,2 no banco)
- 🔒 **Bcrypt** — fator mínimo 12 nas senhas
- ⏱️ **JWT** — expiração ≤ 8 horas

---

*Projeto desenvolvido para fins acadêmicos — FATEC Zona Leste, DSM.*
