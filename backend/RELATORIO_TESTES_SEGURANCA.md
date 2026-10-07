# Relatório Parcial de Testes de Segurança

**Projeto:** Sistema Salão - Nicolle Neris Studio  
**Disciplina:** Projeto Interdisciplinar - Tópicos de Segurança  
**Data dos testes:** 06-07/10/2026  
**Ambiente:** API local no Windows, Node.js 22.14.0, MongoDB Atlas (`test`)  
**Status:** Validação local concluída parcialmente; alguns fluxos de QA e itens externos ainda pendentes. Este relatório registra somente resultados observados ou confirmados; os tutoriais abaixo descrevem resultados esperados, não testes aprovados.

> Este relatório não contém URI, senha, JWT ou outros segredos. Testes relatados pelo usuário estão identificados como tal; os itens que dependem de VPS, GitHub Code Scanning ou staging continuam pendentes.

## 1. Resultado dos Testes Executados

| Requisito | Verificação e evidência | Resultado |
|---|---|---|
| Dependências da API | `npm ci` instalou as dependências do backend. | Aprovado |
| Qualidade do código | `npm run lint` e `npm run typecheck` concluídos sem erros. | Aprovado |
| Testes automatizados | `npm test`: 2 testes passaram; cálculo financeiro e validação de desconto. | Aprovado |
| Cobertura | `npm run coverage` executou; cobertura global observada de 6,12%, pois só há testes do serviço de cálculo. | Executado, cobertura insuficiente |
| Conexão com MongoDB | Log da API confirmou conexão com Atlas e banco `test`; Compass mostrou as coleções `users` e `transactions`. | Aprovado |
| Senha armazenada | O documento visto no Compass apresenta hash bcrypt com prefixo `$2b$12$`; o login real também comparou a senha com sucesso. | Aprovado |
| Login e JWT | Login da conta administrativa retornou papel `admin`; token foi aceito pelo middleware. | Aprovado |
| Troca obrigatória de senha | A conta administrativa retornou `mustChangePassword=true`; acesso ao relatório com JWT foi bloqueado com HTTP 403. | Aprovado para bloqueio obrigatório |
| Rotas protegidas | `GET /api/transactions` e `GET /api/reports/dre` sem token retornaram HTTP 401. | Aprovado |
| Confirmação de e-mail | Usuário confirmou que recebeu a mensagem de QA e concluiu o fluxo pelo link do Mailtrap; código HTTP não foi registrado. | Confirmado pelo usuário; evidência HTTP não capturada |
| Recuperação de senha | Usuário confirmou recebimento do e-mail, redefinição pelo link e rejeição ao reutilizar o link. O POST com UUID fictício também retornou HTTP 400. Login posterior com a nova senha não foi confirmado. | Fluxo relatado como concluído; falta comprovar login novo e guardar status HTTP |
| Rate limit de autenticação | Vários fluxos usavam o mesmo bucket e bloquearam o reset com HTTP 429. Buckets foram separados; typecheck passou, página de reset voltou a HTTP 200 e novo pedido de recuperação respondeu HTTP 202. | Correção aplicada; login pós-reset ainda precisa ser retestado |
| Não enumeração de contas | `POST /api/auth/forgot-password` com e-mail inexistente retornou HTTP 202 e mensagem genérica. | Aprovado |
| Wapiti local | Wapiti 3.3.2 examinou `http://localhost:3000/api/auth/reset-password` com token fictício; encontrou 1 URL/formulário, sem achados de injeção nas categorias executadas. O módulo SSL foi ignorado porque `sslscan` não está instalado. | Executado localmente |
| HTTPS no alvo DAST | Wapiti reportou `Cleartext Submission of Password` (nível 3) e `Unencrypted Channels` (nível 2) porque o alvo de desenvolvimento era `http://localhost`; isso não avalia a configuração HTTPS de produção. | Aviso esperado no teste local; staging pendente |
| Observabilidade OpenTelemetry | API exportou traces via OTLP para Jaeger 2.21 local; `GET /health` gerou tráfego e `/api/v3/services` listou `sistema-salao-api`. | Aprovado localmente |
| Atualizações de vulnerabilidades | Procedimento incluído em `SECURITY.md`; Dependabot semanal configurado para npm e GitHub Actions em `.github/dependabot.yml`. A execução automática depende do commit e de os alertas estarem habilitados no GitHub. | Configurado localmente; ativação remota pendente |
| Segredos fora do Git | `backend/.env` está ignorado e não aparece no índice do Git. | Aprovado |
| Logs da aplicação | Inicialização e requisições apareceram em logs estruturados Pino, sem exibir credenciais. | Aprovado localmente |

## 2. Itens Pendentes de Teste

| Requisito | O que falta para testar |
|---|---|
| Evidência final de autenticação | Repetir login da conta QA com a nova senha e registrar HTTP 200; registrar os status das chamadas de confirmação e recuperação, sem guardar senha/token. |
| Expiração do token | Em uma conta descartável, confirmar a validade de 15 minutos; testar token expirado sem usar a conta administrativa. |
| Política de 90 dias | Em uma conta de QA, ajustar `lastPasswordChange` para mais de 90 dias, verificar o bloqueio e concluir a troca de senha. |
| RBAC colaboradora | Criar/confirmar uma conta de QA colaboradora; provar acesso negado aos relatórios e acesso somente aos lançamentos/comissões próprios. |
| Gestão de usuários | Testar as rotas administrativas de criação, listagem e desativação lógica com uma conta de QA. |
| CodeQL | O workflow analisou o código, mas falhou ao publicar resultados porque Code Scanning está desabilitado no repositório. Habilitar em **Settings > Security** e repetir o workflow. |
| Wapiti/DAST em staging | O scan local foi executado, mas não substitui o teste pedido em homologação. O job GitHub foi ignorado porque `STAGING_URL` não está configurada. Implantar homologação HTTPS autorizada, cadastrar a variável e executar `workflow_dispatch`. |
| Hospedagem e portas | Não há VPS implantada para validar usuário `nodeapp`, SSH `22822`, HTTPS `8443`, firewall, Nginx e logs do sistema. O guia em `backend/DEPLOYMENT.md` é apenas documental. |
| APM externo | Jaeger local comprovado por traces OTLP; integração com Datadog/New Relic ou collector remoto ainda não configurada e não é necessária para a prova local de OpenTelemetry. |
| Logs MongoDB/Nginx | Logs Pino da API foram vistos localmente; logs do Atlas e do Nginx ainda precisam ser demonstrados após implantação. |

## 3. Passos Para Completar a Validação

1. Refaça login da conta QA após o reset e guarde o status HTTP, sem incluir token ou senha nas evidências.
2. Execute os cenários pendentes de 15 minutos, troca após 90 dias e RBAC colaboradora usando somente contas de QA.
3. Peça ao proprietário para enviar os arquivos ao GitHub, habilitar Code Scanning/Dependabot e repetir CodeQL.
4. Para DAST em staging e os requisitos de portas/usuário/logs do host, implante uma VPS de homologação autorizada e HTTPS; não varra sistemas de terceiros.
5. Atualize os status com evidências reais e exporte para PDF ou DOCX.

## 4. Evidências do GitHub Actions

- O job de lint, typecheck e coverage aparece como aprovado.
- O job CodeQL executou a análise, mas a etapa `analyze` falhou no envio porque o repositório informa que Code Scanning não está habilitado.
- O job Wapiti aparece como ignorado por falta de `STAGING_URL` e execução manual.

## 5. Referências do Projeto

- Configuração e execução local: `backend/README.md`
- Procedimentos de VPS: `backend/DEPLOYMENT.md`
- Divulgação responsável: `SECURITY.md`
- Workflow de CI/CodeQL/Wapiti: `.github/workflows/ci-cd.yml`

## 6. Tutorial dos Testes de QA

Use somente contas e dados descartáveis de QA. Os status nesta seção são os **resultados esperados**; não os considere aprovados até executar e registrar o resultado observado. Configure SMTP antes dos testes de e-mail; o passo a passo de instalação está em `backend/README.md`.

### A. Cadastro e confirmação de e-mail

1. No Postman, envie `POST http://localhost:3000/api/auth/register`, Body JSON com `name`, e-mail novo de QA e senha com pelo menos 12 caracteres.
2. Resultado esperado: HTTP `202`.
3. Abra a sandbox do Mailtrap, abra a mensagem mais recente e clique no link no computador onde a API local está rodando.
4. Resultado esperado: resposta de confirmação. Faça `POST /api/auth/login` com a mesma conta e espere HTTP `200` com token. Não inclua o token nas capturas.

### B. Login e JWT

1. Envie `POST /api/auth/login` com e-mail/senha confirmados.
2. Resultado esperado: HTTP `200`, `data.user.role` definido e `data.token` presente.
3. Envie `GET /api/transactions` sem Authorization: esperado `401`.
4. Repita com **Authorization > Bearer Token** e o JWT: esperado `200` para um usuário com política de senha em dia.

### C. Esqueci a senha, uso único e expiração

1. Envie `POST /api/auth/forgot-password` com o e-mail QA. Resultado esperado: HTTP `202` e mensagem genérica.
2. Abra o e-mail mais recente no Mailtrap, clique no link e envie uma senha nova no formulário. Resultado esperado: `Senha redefinida.`.
3. Faça login com a senha nova. Esperado: HTTP `200`; testar a senha antiga deve retornar `401`.
4. Tente enviar o mesmo link/token outra vez. Esperado: HTTP `400` porque o token é de uso único.
5. Para testar os 15 minutos sem esperar, gere outro reset, copie o link apenas para uso local e altere `passwordResetExpiresAt` da conta QA para o passado no Compass. Envie o formulário do link. Esperado: HTTP `400`. Não altere documentos admin.

### D. Troca periódica após 90 dias

1. No Compass, abra `test.users` e edite somente o usuário QA: `lastPasswordChange` para uma data há 91 dias e `mustChangePassword=false`.
2. Faça login. Esperado: HTTP `200` com `mustChangePassword=true`.
3. Use o JWT em uma rota protegida, por exemplo `GET /api/transactions`. Esperado: HTTP `403` com troca obrigatória.
4. Envie `POST /api/auth/change-password` com Bearer token e Body JSON `currentPassword`/`newPassword`. Esperado: HTTP `200`. Faça login com a nova senha e repita uma rota protegida: esperado `200`.

### E. RBAC admin versus colaboradora

1. Faça login como admin e use seu JWT em `POST /api/auth/users` para criar uma colaboradora de QA com `role: "colaborador"` e e-mail novo.
2. Confirme o e-mail via Mailtrap e cumpra a troca de senha obrigatória antes de testar rotas operacionais.
3. Com JWT da colaboradora, chame `GET /api/reports/dre`: esperado `403`.
4. Com o mesmo JWT, chame `GET /api/transactions`: esperado `200`, com apenas os dados próprios.
5. Com JWT admin, chame o mesmo relatório: esperado `200`. Preserve evidência dos status sem incluir credenciais ou tokens.

### F. Rate limit corrigido

Os fluxos de login, cadastro, confirmação, pedido de reset e ação de reset agora têm buckets separados. Gere mais de uma chamada em fluxos diferentes: uma sequência de tentativas de login não deve bloquear a página de redefinição. Respeite o limite específico de cada rota; não faça carga/força bruta.

### G. Regra para fechar cada linha

Antes de marcar um resultado como aprovado, registre data, endpoint/ação, status esperado, status observado e evidência sanitizada. Se não executar, marque **pendente**. Nunca publique senha, JWT, token de reset, URI do Atlas ou dados de pessoas no relatório.