# ADR 001 — Distribuição exclusivamente online

- **Status:** aceita
- **Data:** 2026-07-27
- **Responsável pela decisão:** Ana

## Contexto

O protótipo foi construído como aplicação web local: frontend e API rodam em `localhost`, o banco SQLite e os backups ficam no mesmo dispositivo e a possibilidade de empacotamento desktop permanecia aberta. A decisão de produto agora é disponibilizar a Carteira da Ana online, sem gerar um executável.

Expor a implementação atual diretamente à internet não é seguro. Ela ainda pressupõe uma única usuária confiável, não possui autenticação nem autorização, armazena dados e credenciais no filesystem local do servidor e contém URLs de desenvolvimento fixas em alguns fluxos.

## Decisão

- A Carteira da Ana será uma aplicação web hospedada e acessada por HTTPS.
- Não haverá empacotamento Electron nem distribuição de executável.
- React/Vite e Fastify permanecem como base; a separação entre interface, API, domínio e persistência também permanece.
- O ambiente local continuará existindo somente para desenvolvimento e testes.
- A publicação online só poderá ocorrer depois de autenticação, autorização por proprietária do dado, gestão segura de segredos, persistência hospedada, backups externos e configuração de produção.
- A arquitetura do primeiro release foi posteriormente definida no ADR 002, priorizando serviços gratuitos e baixo custo.

## Consequências

### Positivas

- acesso por navegador sem instalação ou atualização manual;
- uma única versão em produção;
- possibilidade de acesso em mais de um dispositivo;
- caminho mais simples para operação, monitoramento e backups centralizados.

### Custos e riscos

- autenticação e isolamento de dados deixam de ser opcionais;
- a operação passa a exigir HTTPS, gestão de segredos, observabilidade, deploy e resposta a incidentes;
- SQLite e backups locais precisam ser reavaliados para armazenamento persistente e concorrência no ambiente hospedado;
- integrações OAuth precisam usar callbacks configuráveis e URLs públicas;
- dados financeiros passam a exigir controles explícitos de privacidade, retenção, exportação e exclusão.

## Decisões complementares

- Render, Neon PostgreSQL, autenticação própria, acesso somente para Ana e retirada do Google Drive estão registrados no ADR 002.
- OAuth Google, multiusuário e domínio próprio foram adiados para o backlog.

A migração de SQLite para PostgreSQL continua sendo trabalho de implementação e está detalhada no plano de migração online.
