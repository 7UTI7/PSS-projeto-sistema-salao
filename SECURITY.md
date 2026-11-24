# Segurança

## Divulgação responsável

Não publique vulnerabilidades em issues, pull requests ou canais públicos. Envie a descrição, passos de reprodução e impacto para o contato privado de segurança mantido pelos responsáveis do projeto (Security Advisories do GitHub ou canal privado da equipe).

- Confirmação e triagem inicial: até 24 horas após o recebimento.
- Vulnerabilidade crítica: plano de correção em até 72 horas após confirmação, com atualização de status ao relator.
- Demais severidades: prazo de correção definido durante a triagem, considerando impacto e mitigação disponível.

Não inclua dados pessoais, credenciais ou dados reais de clientes nos relatos. Testes devem ocorrer apenas em ambientes autorizados.

## Acompanhamento de vulnerabilidades e atualizações

- Mantenha habilitados no GitHub o dependency graph, Dependabot alerts e Dependabot security updates em **Settings > Security**. O arquivo `.github/dependabot.yml` também agenda atualizações semanais para dependências npm do backend e GitHub Actions.
- Revise alertas e pull requests do Dependabot ao menos uma vez por semana. Para severidade crítica, faça triagem imediata e siga o SLA de correção crítica acima; não aguarde o ciclo semanal.
- Antes de aceitar atualização, revise o advisory e o changelog do fornecedor, atualize o lockfile e execute `npm ci`, `npm run lint`, `npm run typecheck`, `npm run coverage` e CodeQL. Faça DAST em homologação autorizada após mudanças de maior risco.
- Acompanhe novos avisos no GitHub Security Advisories e nos alertas do próprio repositório. Registre a data, pacote afetado, versão corrigida, responsável, decisão e resultado dos testes no PR ou registro acadêmico, sem incluir tokens ou dados pessoais.
- Dependabot abre pull requests; atualizações de dependência não devem ser mescladas automaticamente sem revisão e CI verde.

## Como cada comunidade recebe e divulga vulnerabilidades

Vulnerabilidade em uma ferramenta de terceiros deve ser reportada **ao mantenedor da ferramenta**, pelo canal privado dele, e não neste repositório. Canais oficiais das tecnologias usadas no projeto (consultados em 24/11/2026):

| Tecnologia | Como reportar | Como acompanhar divulgações |
|---|---|---|
| Node.js (runtime) | Programa no HackerOne (https://hackerone.com/nodejs), conforme https://nodejs.org/en/about/security-reporting; avaliado pelo modelo de ameaças do `SECURITY.md` do repositório nodejs/node | Página de segurança e posts "Security Releases" no blog do nodejs.org; calendário de fim de vida em https://nodejs.org/en/about/previous-releases |
| Express | Política de segurança única da organização expressjs no GitHub (Security Advisories privados); CVEs emitidos via OpenJS | https://expressjs.com/en/advanced/security-updates.html |
| MongoDB / Atlas | Formulário de bugs de segurança e programa no HackerOne, descritos em https://www.mongodb.com/docs/manual/tutorial/create-a-vulnerability-report/ | MongoDB Security Alerts (https://www.mongodb.com/resources/products/alerts), com feed RSS |
| Mongoose | Relato privado pela aba *Security* de https://github.com/Automattic/mongoose | GitHub Security Advisories do repositório (ex.: GHSA-664h-wqgq-64gw, corrigido na 8.24.1) |
| Expo / React Native | Expo: vulnerability-disclosures@expo.dev (https://expo.dev/support-options); React Native: programa de bug bounty da Meta (https://www.facebook.com/whitehat) | Categoria "Security notices" do blog do Expo e advisories de https://github.com/expo/expo/security |
| Pacotes npm (bcrypt, jsonwebtoken, zod, nodemailer etc.) | Mantenedor de cada pacote, pela aba *Security* do repositório no GitHub | GitHub Advisory Database (https://github.com/advisories), `npm audit` e alertas do Dependabot |
| Base geral | — | CVE (https://www.cve.org), NVD (https://nvd.nist.gov) e OWASP Top 10 |

A CI executa `npm audit --omit=dev --audit-level=high` no backend e no frontend: dependência de produção com vulnerabilidade alta ou crítica quebra o build. Versões de runtime fora de suporte também são tratadas como vulnerabilidade; por isso o projeto exige Node.js 22.15+ e a CI usa o Node.js 24 LTS (o Node.js 20 chegou ao fim de vida em abril de 2026).

## Controles implementados

O backend requer segredos por ambiente, armazena apenas hashes de senha (bcrypt, custo 12) e de tokens temporários (SHA-256), exige senha forte (12+ caracteres com maiúscula, minúscula, número e símbolo), força a troca a cada 90 dias, cifra o nome dos usuários em repouso (AES-256-GCM), limita tentativas de autenticação, redige campos sensíveis dos logs, grava logs em arquivo com rotação e evita hard delete de lançamentos financeiros. Segredos e URLs reais de ambientes não devem ser versionados.