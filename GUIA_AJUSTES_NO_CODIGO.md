# Guia de ajustes no código: Backend Sistema Salão

Este guia lista **somente o que exige mexer no código ou nos arquivos do repositório**. O que se resolve fora (Postman, Compass, Atlas, VPS, GitHub Settings) não está aqui.

> **Aviso:** não vi o código do backend, só o relatório. Os caminhos de arquivo e nomes de funções abaixo são sugestões. Adapte ao que existe no projeto (por exemplo, ao runner de testes que o `package.json` já usa).

## Visão geral

| # | Tarefa | Prioridade | Arquivos prováveis | Fecha qual item |
|---|--------|-----------|--------------------|-----------------|
| 1 | Ler a porta de variável de ambiente | Alta | `server.js` / `app.js`, `.env.example` | Alterar portas padrão |
| 2 | Configurar `trust proxy` para uso atrás do Nginx | Alta | `app.js` | Rate limit correto na VPS |
| 3 | Ocultar dados sensíveis nos logs (Pino `redact`) | Alta | config do logger | Logs sem credenciais |
| 4 | Escrever testes de segurança (auth, JWT, RBAC, 90 dias) | Alta | `tests/` | Cobertura de 6,12% |
| 5 | Parametrizar o export OTLP para Datadog / New Relic | Média | init do OpenTelemetry, `.env.example` | Observabilidade |
| 6 | Ampliar o escopo do Wapiti no workflow | Média | `.github/workflows/ci-cd.yml` | DAST em staging |
| 7 | Cabeçalhos de segurança com `helmet` (opcional) | Baixa | `app.js` | Reforço geral |
| 8 | Atualizar `.env.example` e `README` | Baixa | raiz do backend | Documentação |

---

## 1. Porta configurável por variável de ambiente

**Por quê:** o professor pediu para trocar portas padrão. A API deve aceitar qualquer porta por configuração, sem valor fixo no código.

**O que fazer:**

```js
// server.js
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  logger.info({ port: PORT }, 'API iniciada');
});
```

**Recomendação para a VPS:** a API escuta numa porta interna (por exemplo `3000`) apenas em `127.0.0.1`, e o Nginx expõe o HTTPS na porta alta (por exemplo `8443`). Nesse caso, em produção use `HOST=127.0.0.1`.

**Checklist**
- [ ] Nenhuma porta fixa no código
- [ ] `PORT` e `HOST` no `.env.example`
- [ ] README explica como mudar a porta

---

## 2. `trust proxy` (atrás do Nginx)

**Por quê:** com o Nginx na frente, o Express enxerga todos os acessos como vindos de `127.0.0.1`. O **rate limit** passa a tratar todo mundo como um único cliente e bloqueia todos de uma vez (o mesmo tipo de problema de bucket que você já teve com o HTTP 429).

```js
// app.js, antes dos middlewares de rate limit
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // 1 = um proxy (Nginx) na frente
}
```

No Nginx, confirme que o `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` está configurado.

**Checklist**
- [ ] `trust proxy` ativo só em produção
- [ ] Teste na VPS: duas máquinas diferentes não compartilham o mesmo limite

---

## 3. Logs sem dados sensíveis (Pino `redact`)

**Por quê:** hoje o relatório diz que os logs não têm credenciais. O `redact` torna isso uma garantia no código, e não só o resultado de um teste.

```js
// logger.js
const pino = require('pino');

module.exports = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.newPassword',
      'req.body.token',
      '*.password',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
});
```

Ajuste os caminhos para o formato real dos seus logs de requisição.

**Também vale:**
- Registrar eventos de segurança: login falho, conta bloqueada, reset solicitado, reset concluído, acesso negado (401/403). Registre **só** identificador e motivo, nunca senha ou token.
- Em produção, escrever logs em `stdout` e deixar o `systemd` ou o `pm2` guardar. Assim os logs do serviço entram na evidência da VPS.

**Checklist**
- [ ] `redact` configurado
- [ ] Eventos de segurança registrados
- [ ] Teste manual: fazer login com senha errada e confirmar que a senha não aparece no log

---

## 4. Testes automatizados de segurança

**Por quê:** a cobertura global é 6,12%, porque só o serviço de cálculo financeiro tem teste. Os fluxos de segurança são justamente o que o relatório defende, então são os melhores candidatos a teste. Isso também transforma os cenários de QA manual pendentes em evidência repetível.

### 4.1 Preparação

- Rode os testes contra um **banco de teste isolado** (por exemplo `MongoMemoryServer` ou um banco separado), nunca contra o banco com dados reais.
- Use `supertest` para chamar a API sem subir a porta.
- Separe a criação do `app` do `listen`, para o `supertest` importar o `app`:

```js
// app.js    -> module.exports = app;
// server.js -> app.listen(...)
```

- **Mocke o envio de e-mail** nos testes, para não enviar nada ao Mailtrap.

```bash
npm install --save-dev supertest mongodb-memory-server
```

Os exemplos usam sintaxe estilo Jest/Vitest (`describe`/`it`/`expect`). Se o projeto usa o runner nativo do Node (`node:test`), adapte as asserções.

### 4.2 Casos de teste mínimos

| Área | Caso | Esperado |
|------|------|----------|
| Cadastro | Senha salva com hash | Valor começa com `$2b$12$` e é diferente da senha enviada |
| Cadastro | E-mail já existente | Mesma resposta 202 e mensagem genérica |
| Login | Credenciais corretas | 200 e JWT |
| Login | Senha errada | 401 sem detalhar se o e-mail existe |
| Rotas protegidas | Sem token | 401 |
| Rotas protegidas | Token inválido ou adulterado | 401 |
| Troca obrigatória | `mustChangePassword = true` acessando relatório | 403 |
| Forgot password | E-mail inexistente | 202 e mensagem genérica |
| Reset | Token válido | 200 e senha alterada |
| Reset | Reutilizar o mesmo token | 400 |
| Reset | Token expirado | 400 |
| Confirmação de e-mail | Token válido uma vez; segunda vez | 200; depois 400 |
| Política de 90 dias | `lastPasswordChange` com mais de 90 dias | Bloqueio até trocar a senha |
| RBAC | Colaboradora acessando relatório | 403 |
| RBAC | Colaboradora acessando só os próprios lançamentos | 200 apenas para os dela |
| Rate limit | Exceder tentativas de login | 429 |
| Rate limit | Fluxos diferentes usam buckets diferentes | Estourar login não bloqueia reset |

### 4.3 Exemplo

```js
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');

describe('Senhas', () => {
  it('armazena a senha com hash bcrypt', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'QA', email: 'qa@example.com', password: 'SenhaForte#2026' })
      .expect(202);

    const user = await User.findOne({ email: 'qa@example.com' }).select('+password');
    expect(user.password).not.toBe('SenhaForte#2026');
    expect(user.password.startsWith('$2b$12$')).toBe(true);
  });
});

describe('Rotas protegidas', () => {
  it('retorna 401 sem token', async () => {
    await request(app).get('/api/transactions').expect(401);
    await request(app).get('/api/reports/dre').expect(401);
  });
});

describe('Política de 90 dias', () => {
  it('bloqueia quando a senha tem mais de 90 dias', async () => {
    const velha = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    await User.updateOne({ email: 'qa@example.com' }, { lastPasswordChange: velha });
    // faça login e tente acessar o relatório; esperado: bloqueio (403)
  });
});
```

Para testar expiração de 15 minutos sem esperar, use relógio falso (`jest.useFakeTimers()` / `vi.useFakeTimers()`) ou altere a data de expiração do token direto no banco de teste.

### 4.4 Cobertura e CI

- Configure um **limite mínimo** de cobertura no CI (por exemplo 60%), para o job falhar se cair.
- Meta realista para a entrega: cobrir `auth`, o middleware JWT e o RBAC. Isso já deve levar a cobertura global a um patamar bem mais honesto que 6,12%.

**Checklist**
- [ ] `app` separado de `listen`
- [ ] Banco de teste isolado
- [ ] E-mail mockado
- [ ] Casos da tabela 4.2 implementados
- [ ] Cobertura nova registrada no relatório

---

## 5. Observabilidade: export OTLP configurável

**Por quê:** Datadog e New Relic aceitam OTLP. Se o endpoint e os cabeçalhos vierem de variáveis de ambiente, a mesma instrumentação serve ao Jaeger local e à plataforma externa, sem trocar código.

**Variáveis padrão do OpenTelemetry (o SDK lê automaticamente):**

```env
# Local (Jaeger)
OTEL_SERVICE_NAME=sistema-salao-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Produção (exemplo, confira o endpoint na documentação do provedor)
# OTEL_EXPORTER_OTLP_ENDPOINT=https://<endpoint-do-provedor>
# OTEL_EXPORTER_OTLP_HEADERS=<cabecalho-de-chave>=<SUA_CHAVE>
```

**No código:** confirme que o exporter **não** tem endpoint nem chave escritos direto. Se tiver, troque por `process.env`:

```js
const exporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
    : undefined,
});
```

> O nome exato do endpoint e do cabeçalho de autenticação de Datadog e New Relic muda com a região e a conta. Confirme na documentação de OTLP de cada um antes de configurar.

**Checklist**
- [ ] Nenhuma chave ou URL fixa no código
- [ ] Variáveis documentadas no `.env.example`
- [ ] Chave real só no `.env` do servidor e nunca no Git

---

## 6. Wapiti: ampliar o escopo no workflow

**Por quê:** o scan local cobriu só 1 URL. No staging, o Wapiti precisa enxergar mais endpoints para a evidência ser relevante.

**Em `.github/workflows/ci-cd.yml`, no job do Wapiti:**

- Aponte para a URL base (`${{ secrets.STAGING_URL }}` ou variável) e **não** para um único endpoint.
- Passe uma lista de URLs de partida (`-u` pode ser repetido) para as rotas públicas: `/health`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`.
- Salve o relatório como artefato do workflow:

```yaml
- name: Salvar relatório do Wapiti
  uses: actions/upload-artifact@v4
  with:
    name: wapiti-report
    path: wapiti-report/
```

- Mantenha `workflow_dispatch` e a trava por `STAGING_URL`, para o job nunca rodar contra sistema de terceiros.
- Para rotas protegidas, o Wapiti suporta autenticação por cabeçalho ou cookie (consulte a documentação dele). Use sempre uma conta de QA e guarde o token como **secret** do GitHub.

**Checklist**
- [ ] Múltiplas URLs de partida
- [ ] Relatório salvo como artefato
- [ ] Alvo restrito ao staging autorizado

---

## 7. Cabeçalhos de segurança com `helmet` (opcional)

O Wapiti costuma apontar cabeçalhos ausentes. O `helmet` resolve a maior parte com uma linha.

```bash
npm install helmet
```

```js
const helmet = require('helmet');
app.use(helmet());
```

Se a API também serve páginas HTML (como a de redefinição de senha), teste se o CSP padrão do `helmet` não quebra a página.

**Checklist**
- [ ] `helmet` ativo
- [ ] Página de reset continua funcionando

---

## 8. Documentação e variáveis

- [ ] `.env.example` com **todas** as variáveis, sem valores reais: `PORT`, `HOST`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`, `LOG_LEVEL`, `OTEL_*`, variáveis de SMTP
- [ ] `README` explicando como rodar testes, cobertura e o que cada variável faz
- [ ] Confirmar que `.env` continua no `.gitignore`
- [ ] Rodar `git log -p -- .env` para garantir que nenhum segredo foi commitado no passado. Se algum foi, **troque a credencial**, porque apagar o arquivo agora não remove o histórico

---

## Ordem sugerida

1. Itens 1, 2 e 3 (rápidos, poucas linhas)
2. Item 4 (maior esforço, maior ganho no relatório)
3. Itens 5 e 6, quando a VPS e a conta do provedor existirem
4. Itens 7 e 8 para fechar

## Antes de entregar

- [ ] `npm run lint`, `npm run typecheck` e `npm test` passando
- [ ] Cobertura atualizada na seção 3 do relatório
- [ ] Prints de cada item novo (testes passando, cobertura, workflow com artefato)
- [ ] Status do relatório trocados por evidência real
