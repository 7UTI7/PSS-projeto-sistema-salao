# Segurança

## Divulgação responsável

Não publique vulnerabilidades em issues, pull requests ou canais públicos. Envie a descrição, passos de reprodução e impacto para o contato privado de segurança mantido pelos responsáveis do projeto (Security Advisories do GitHub ou canal privado da equipe).

- Confirmação e triagem inicial: até 24 horas após o recebimento.
- Vulnerabilidade crítica: plano de correção em até 72 horas após confirmação, com atualização de status ao relator.
- Demais severidades: prazo de correção definido durante a triagem, considerando impacto e mitigação disponível.

Não inclua dados pessoais, credenciais ou dados reais de clientes nos relatos. Testes devem ocorrer apenas em ambientes autorizados.

## Controles implementados

O backend requer segredos por ambiente, armazena apenas hashes de senha e de tokens temporários, limita tentativas de autenticação, redige campos sensíveis dos logs e evita hard delete de lançamentos financeiros. Segredos e URLs reais de ambientes não devem ser versionados.