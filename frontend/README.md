# 📱 Frontend Mobile — Nicolle Neris Studio

> Aplicativo mobile de gestão financeira e retaguarda operacional para o estúdio de beleza **Nicolle Neris Studio**, desenvolvido para o curso de **Desenvolvimento de Software Multiplataforma (DSM) — FATEC Zona Leste**.

---

## 📋 Sumário

1. [Visão Geral do Aplicativo](#1-visão-geral-do-aplicativo)
2. [O Que Foi Feito (Registro de Arquitetura)](#2-o-que-foi-feito-registro-de-arquitetura)
3. [Estrutura de Pastas e Onde Inserir Suas Telas](#3-estrutura-de-pastas-e-onde-inserir-suas-telas)
4. [Tutorial de Instalação e Execução](#4-tutorial-de-instalação-e-execução)
5. [Como Conectar com a API Backend](#5-como-conectar-com-a-api-backend)
6. [Scripts Úteis e Comandos de Validação](#6-scripts-úteis-e-comandos-de-validação)

---

## 1. Visão Geral do Aplicativo

O aplicativo mobile atua como a **retaguarda financeira e analítica** do estúdio, consumindo a API REST Node.js/MongoDB do projeto. Ele permite:

- **Autenticação Segura (RBAC):** Perfis `admin` (proprietária) e `colaborador` (profissionais).
- **Lançamentos Rápidos:** Registro ágil de receitas e despesas com apuração automática de taxas de cartão, comissões de parceiras e lucro líquido do estúdio.
- **Relatórios Gerenciais (Admin):** Visualização consolidada de **DRE Gerencial** (regime de competência) e **Fluxo de Caixa** (regime de caixa por liquidação).
- **Segurança Proativa:** Suporte a expiração de sessão JWT (8h), rate limiting e política obrigatória de troca periódica de senha a cada 90 dias.

---

## 2. O Que Foi Feito (Registro de Arquitetura)

Toda a infraestrutura do frontend foi configurada e validada para que o foco fique 100% no desenvolvimento e estilização das telas:

### ⚙️ 2.1. Ambiente Expo & React Native Estabilizado
- Configurado com **Expo SDK 58 (Managed Workflow)**, React 19.3 e React Native 0.88.
- Validação total via `npx expo-doctor`: **20/20 checks aprovados**, 100% compatível com a versão atual do Expo Go (iOS e Android).

### 🧩 2.2. Dependências Essenciais Instaladas (via `npx expo install`)
- **Navegação:** `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`, `react-native-screens`, `react-native-safe-area-context`.
- **Estado Global:** `zustand` com persistência em armazenamento seguro (`expo-secure-store`).
- **Requisições & Cache:** `axios` com interceptores configurados e `@tanstack/react-query` para cache assíncrono de dados.
- **Ícones & Fontes:** `@expo/vector-icons` (Ionicons) e `expo-font`.

### 🛡️ 2.3. Tipagem TypeScript Estrita (`src/types/index.ts`)
- Tipos TypeScript estritos alinhados aos modelos do backend e à documentação técnica:
  - `User`, `UserRole` (`admin` | `colaborador`)
  - `Transaction`, `PaymentMethod`, `TransactionStatus`, `CreateTransactionDTO`
  - `Category`, `DREReport`, `CashFlowReport`
  - Envelopes padronizados de resposta: `ApiResponse<T>` e `ApiErrorResponse`
- Proibição estrita do tipo `any` respeitada.

### 🌐 2.4. Cliente HTTP Axios & Serviços (`src/services/`)
- `api.ts`: Instância pré-configurada com base URL parametrizável, timeout e interceptores:
  - **Request Interceptor:** Anexa automaticamente `Authorization: Bearer <token>` em todas as requisições autenticadas.
  - **Response Interceptor:** Detecta erro `401` (sessão expirada) e executa logout limpo.
  - `getApiErrorMessage()`: Extrai mensagens tratadas da API para exibição ao usuário.
- Módulos de serviço implementados:
  - `auth.service.ts`: Login, registro, esqueci a senha, redefinição, troca de senha e gestão de usuários.
  - `transaction.service.ts`: Listagem com filtros, criação, atualização, liquidação (`settle`) e exclusão lógica.
  - `category.service.ts`: Listagem e criação de categorias validadas no catálogo.
  - `report.service.ts`: Apuração de DRE Simplificada e Fluxo de Caixa por período (ISO).

### 🔐 2.5. Estado de Autenticação (`src/store/authStore.ts`)
- Zustand store persistindo token JWT e usuário com `expo-secure-store`.
- Suporte imediato à política de troca obrigatória de senha (`mustChangePassword: true`), redirecionando o usuário para a tela de redefinição caso necessário.

### 🧭 2.6. Navegação & Roteamento (`src/navigation/`)
- `AppNavigator.tsx`: Controle inteligente de fluxo:
  - Exibe Splash/Loading enquanto restaura a sessão.
  - Se deslogado $\rightarrow$ Navega para a **AuthStack** (`Login`, `ForgotPassword`).
  - Se logado com troca de senha pendente $\rightarrow$ Bloqueia o acesso e exibe `ChangePasswordMandatory`.
  - Se logado $\rightarrow$ Navega para as **MainTabs** (`Dashboard`, `Transactions`, `NewTransaction`, `Reports`, `Settings`).
- `types.ts`: Param lists fortemente tipadas (`RootStackParamList`, `AuthStackParamList`, `MainTabParamList`).

### 💵 2.7. Utilitários Monetários (`src/utils/formatters.ts`)
- `formatCurrency(val)`: Garante o padrão exigido pelas regras de negócio: **`R$ 1.234,56`**.
- `formatDate(date)` / `formatDateTime(date)`: Formatação amigável pt-BR.

---

## 3. Estrutura de Pastas e Onde Inserir Suas Telas

A estrutura foi organizada para facilitar a colagem e adaptação do seu código já existente:

```text
frontend/
├── assets/                    # Ícones e imagens da aplicação
├── src/
│   ├── components/            # Seus componentes reutilizáveis (botões, inputs, cards)
│   ├── navigation/
│   │   ├── AppNavigator.tsx   # Gerenciador dos stacks e tabs
│   │   └── types.ts           # Tipagens de rotas e parâmetros
│   ├── screens/
│   │   ├── auth/              # Telas de Autenticação
│   │   │   ├── LoginScreen.tsx           <-- Cole seu código de Login aqui
│   │   │   ├── ForgotPasswordScreen.tsx  <-- Cole seu código de Recuperação aqui
│   │   │   └── ChangePasswordScreen.tsx  <-- Cole seu código de Troca de Senha aqui
│   │   └── main/              # Telas Principais do App
│   │       ├── DashboardScreen.tsx       <-- Cole seu Dashboard aqui
│   │       ├── TransactionsScreen.tsx    <-- Cole sua lista de lançamentos aqui
│   │       ├── NewTransactionScreen.tsx  <-- Cole o formulário de 3 toques aqui
│   │       ├── ReportsScreen.tsx         <-- Cole os relatórios DRE/Fluxo aqui
│   │       └── SettingsScreen.tsx        <-- Cole o perfil/configurações aqui
│   ├── services/              # Chamadas Axios para a API (prontas para uso)
│   ├── store/                 # Gerenciamento de estado Zustand (pronto para uso)
│   ├── types/                 # Interfaces e DTOs TypeScript (prontos para uso)
│   └── utils/                 # Formatadores BRL e datas
├── App.tsx                    # Ponto de entrada com Providers
├── app.json                   # Configurações do Expo
├── package.json
└── tsconfig.json
```

---

## 4. Tutorial de Instalação e Execução

Siga os passos abaixo para rodar o frontend na sua máquina:

### 4.1. Pré-requisitos
- **Node.js** 20.x ou superior.
- **npm** (ou **bun**).
- **Dispositivo Móvel** com o app **Expo Go** instalado (disponível na Google Play Store e Apple App Store) **OU** um emulador Android/iOS configurado no computador.

### 4.2. Instalação das Dependências

Abra o terminal na pasta `frontend`:

```bash
cd frontend
npm install
```

> **Atenção:** Se precisar instalar novas dependências no futuro, utilize sempre o comando:
> ```bash
> npx expo install <nome-do-pacote>
> ```

### 4.3. Inicialização do Projeto

Execute o comando para iniciar o servidor Metro Bundler:

```bash
npm start
```

Ou diretamente pelo Expo CLI:

```bash
npx expo start
```

### 4.4. Como Abrir o App no Celular ou Emulador

Ao iniciar, o terminal exibirá um **QR Code**:

- **No Celular Físico (Android):** Abra o aplicativo **Expo Go**, toque em *"Scan QR Code"* e aponte para o QR Code no terminal.
- **No Celular Físico (iOS):** Abra a **Câmera padrão do iPhone**, aponte para o QR Code e toque no banner que surge para abrir no Expo Go.
- **No Emulador Android:** Com o emulador já aberto, pressione a tecla `a` no terminal.
- **No Simulador iOS:** Pressione a tecla `i` no terminal.
- **No Navegador Web:** Pressione a tecla `w` no terminal para abrir localmente em `http://localhost:8081`.

---

## 5. Como Conectar com a API Backend

### 5.1. Rodando no Computador ou Navegador Web
Se estiver executando no navegador web (`w`), a URL padrão `http://localhost:3000/api` funciona diretamente.

### 5.2. Rodando no Celular Físico via Wi-Fi (Expo Go)
Quando você roda no celular físico, `localhost` se refere ao próprio smartphone, não ao seu computador onde a API está rodando.

1. Descubra o IP local do seu computador na rede Wi-Fi:
   - **Linux/macOS:** `ip addr` ou `ifconfig` (procure algo como `192.168.1.X` ou `192.168.0.X`).
   - **Windows:** `ipconfig` (procure *Endereço IPv4*).
2. Crie ou configure um arquivo `.env` dentro da pasta `frontend/`:
   ```bash
   EXPO_PUBLIC_API_URL=http://192.168.1.X:3000/api
   ```
   *(Substitua `192.168.1.X` pelo IP real da sua máquina)*.
3. Certifique-se de que o backend está rodando no mesmo computador e conectado à mesma rede Wi-Fi.

---

## 6. Scripts Úteis e Comandos de Validação

| Comando | Descrição |
|---|---|
| `npm start` | Inicia o servidor Metro do Expo |
| `npx tsc --noEmit` | Valida tipagem TypeScript (deve terminar sem nenhum erro) |
| `npx expo-doctor` | Executa diagnóstico completo de saúde das dependências Expo |
| `npx expo install --fix` | Corrige automaticamente versões incompatíveis de bibliotecas |
| `npx expo lint` | Executa análise estática de código com ESLint |

---

*Nicolle Neris Studio — Desenvolvido para fins acadêmicos na FATEC Zona Leste.*
