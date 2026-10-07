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

## Controles implementados

O backend requer segredos por ambiente, armazena apenas hashes de senha e de tokens temporários, limita tentativas de autenticação, redige campos sensíveis dos logs e evita hard delete de lançamentos financeiros. Segredos e URLs reais de ambientes não devem ser versionados.