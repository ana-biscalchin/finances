# Plano de migração para distribuição online

**Elaborado em:** 2026-07-27

**Base da estimativa:** protótipo atual; estimativas em dias úteis de engenharia de uma pessoa

**Decisão relacionada:** [ADR 001 — Distribuição exclusivamente online](../codebase/decisions/001-distribuicao-online.md)

## Resumo executivo

A arquitetura React + Fastify pode ser preservada, assim como a maior parte das regras financeiras em `packages/domain`. O release inicial será privado para Ana, com autenticação própria, Render Free Web Service e Neon Free PostgreSQL. A refatoração relevante está nas fronteiras de autenticação, propriedade, persistência, configuração e operação.

Para um primeiro release online **privado, de usuária única e sem cadastro público**, o esforço provável é de **25 a 40 dias úteis**, incluindo testes, migração de dados e estabilização. Para transformar o produto desde já em **multiusuário com cadastro**, a faixa sobe para **40 a 65 dias úteis**. As faixas não incluem evolução funcional do produto nem tempo de espera de fornecedores.

As decisões estão fechadas no ADR 002. Permanece incerteza de aproximadamente ±30% até que a prova confirme os limites vigentes do Render Free, Neon Free, autenticação própria e backups sem custo.

## Evidências encontradas no código

| Achado                                                                                             | Impacto online                                                                                            |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| API sem autenticação e sem proprietário nos contratos atuais                                       | qualquer pessoa com acesso poderia ler ou alterar todos os dados                                          |
| SQLite padrão em `data/financas.sqlite`                                                            | depende de disco persistente e limita opções de escala/alta disponibilidade                               |
| backups e restauração operam em diretórios do servidor                                             | o comportamento atual não equivale a backup externo gerenciado e restauração pode afetar toda a instância |
| Google OAuth usa callbacks e redirects de `localhost`                                              | a integração será retirada do release online inicial                                                      |
| CORS é permissivo e a API escuta em todas as interfaces                                            | precisa de origem explícita, headers seguros, limites e topologia de produção                             |
| frontend tem fallback de API para `http://localhost:3000`, inclusive fora do cliente compartilhado | precisa consolidar o cliente HTTP e preferir mesma origem ou variável validada no build                   |
| configurações do Google Drive são persistidas como configuração global                             | rotas, configuração e interface serão removidas/desabilitadas no release                                  |
| não há automação de deploy/produção documentada                                                    | precisa de ambientes, migrations, health checks, logs, alertas e rollback                                 |

## Premissas da estimativa

- uma pessoa desenvolvedora familiarizada com o repositório;
- manutenção de React/Vite, Fastify, Drizzle e monorepo pnpm;
- um ambiente de homologação e um de produção;
- região sem requisito específico e tráfego pessoal/baixo no primeiro release;
- migração única do banco pessoal atual, com validação e rollback;
- autenticação própria apenas para Ana, sem cadastro público, com senha Argon2id e sessão opaca;
- Render Free Web Service servindo frontend e API na mesma origem `*.onrender.com`;
- Neon Free PostgreSQL em produção e SQLite somente no desenvolvimento/migração;
- OAuth Google, multiusuário, domínio próprio e Google Drive adiados.

## Decisões fechadas

1. **Acesso:** somente Ana, sem cadastro público.
2. **Autenticação:** usuário e senha próprios no PostgreSQL; senha somente como hash Argon2id; sessão opaca em cookie seguro.
3. **Hospedagem:** Render Free Web Service, sem domínio próprio e sem requisito de região.
4. **Persistência:** Neon Free PostgreSQL.
5. **Google Drive:** retirado do release online inicial.
6. **Backlog:** OAuth Google, multiusuário e domínio próprio.

Ainda é necessário validar na prova os limites vigentes dos planos gratuitos e fechar a retenção possível sem custo. Mudança para plano pago exige aprovação.

## Plano por etapa

### 0. Prova de implantação gratuita — 2 a 4 dias

- criar Render Free Web Service, Neon Free PostgreSQL e inventário de segredos;
- servir build Vite e API Fastify na mesma origem `*.onrender.com`;
- subir uma prova mínima de web + API + banco;
- validar TLS, cold start/suspensão, rede, limites gratuitos, logs e persistência após novo deploy.

**Saída:** prova aprovada ou nova decisão caso os planos gratuitos não atendam ao mínimo.

### 1. Configuração e fronteira HTTP — 3 a 5 dias

- criar configuração tipada e validada na inicialização;
- remover URLs de produção fixas e centralizar todo acesso no cliente HTTP compartilhado;
- servir web e API na mesma origem quando possível; caso contrário, restringir CORS por allowlist;
- configurar proxy, HTTPS, headers seguros, limite de payload e rate limiting;
- separar health/readiness de rotas com dados.

**Saída:** artefatos reproduzíveis por ambiente, sem fallback silencioso de produção para localhost.

### 2. Autenticação própria, autorização e posse dos dados — 7 a 12 dias

- implementar usuário, hash Argon2id, login, sessão opaca, logout, mudança de senha e rate limiting;
- adicionar `userId`/`ownerId` às entidades raiz e propagar escopo por consultas, comandos e agregações;
- impedir IDs fornecidos pelo cliente de atravessarem a fronteira de propriedade;
- proteger todas as rotas, inclusive relatórios, importação, backups e configurações;
- criar bootstrap operacional idempotente da Ana, sem endpoint público de cadastro;
- adicionar testes de isolamento horizontal e negação de acesso.

**Saída:** nenhuma operação financeira ocorre sem identidade e autorização verificadas no servidor.

### 3. Banco hospedado e migração de dados — 5 a 8 dias

- adaptar o pacote de persistência e migrations ao Neon PostgreSQL;
- revisar diferenças de tipos, datas, transações e constraints se houver migração para PostgreSQL;
- criar migration de propriedade e script idempotente de importação do SQLite pessoal;
- validar contagens, totais financeiros, chaves e integridade antes/depois;
- ensaiar backup, rollback e restauração em homologação.

**Saída:** banco de produção reproduzível e dados migrados com relatório de reconciliação.

### 4. Backups, retirada do Google Drive e ciclo de dados — 3 a 6 dias

- substituir a expectativa de diretórios locais por snapshots/backups externos e política de retenção;
- separar backup operacional da plataforma de exportação recuperável pela usuária;
- redesenhar ou desabilitar a restauração integral pela interface, pois ela pode afetar outras identidades;
- retirar/desabilitar rotas, configurações e interface do Google Drive no release online;
- documentar e testar recuperação, exportação e exclusão.

**Saída:** RPO/RTO definidos e restauração ensaiada, sem depender do filesystem efêmero da aplicação.

### 5. Segurança e privacidade — 3 a 5 dias

- modelar ameaças das rotas financeiras, login por senha, importação CSV e administração;
- proteger cookies/sessões contra CSRF conforme a topologia escolhida;
- validar arquivos, fórmulas em exportação CSV, payloads e mensagens de erro;
- aplicar logs sem conteúdo financeiro ou tokens e configurar rotação de segredos;
- fazer revisão de dependências e checklist OWASP antes do go-live.

**Saída:** checklist de segurança aprovado e riscos residuais registrados.

### 6. Entrega, observabilidade e operação — 3 a 5 dias

- criar CI para `pnpm check`, build, migrations e deploy controlado;
- definir homologação/produção, promoção, rollback e compatibilidade de migrations;
- adicionar logs estruturados, captura de exceções, métricas básicas, uptime e alertas;
- escrever runbooks de indisponibilidade, falha de migration e restauração;
- configurar orçamento e alertas de custo.

**Saída:** deploy repetível, observável e reversível.

### 7. Homologação e lançamento — 2 a 4 dias

- executar regressão dos fluxos financeiros críticos;
- testar login, expiração de sessão, acesso indevido, navegadores e dispositivos;
- ensaiar migração final, rollback e restauração;
- publicar gradualmente e acompanhar erros e integridade financeira.

**Saída:** aceite do release e registro de validação pós-migração.

## Matriz de esforço

| Frente                              | Release privado | Multiusuário desde o início | Risco |
| ----------------------------------- | --------------: | --------------------------: | ----- |
| Decisões e prova de implantação     |           2–4 d |                       2–4 d | médio |
| Configuração e HTTP                 |           3–5 d |                       3–5 d | baixo |
| Autenticação e isolamento           |          7–12 d |                     14–22 d | alto  |
| Banco e migração                    |           5–8 d |                      6–10 d | alto  |
| Backups e ciclo de dados            |           3–6 d |                       4–7 d | alto  |
| Segurança e privacidade             |           3–5 d |                       4–7 d | alto  |
| Entrega e observabilidade           |           3–5 d |                       3–5 d | médio |
| Homologação e lançamento            |           2–4 d |                       3–5 d | médio |
| **Subtotal sequencial**             |     **28–49 d** |                 **39–65 d** |       |
| **Faixa provável com sobreposição** |     **25–40 d** |                 **40–65 d** |       |

As atividades podem se sobrepor, mas uma única pessoa não obtém paralelismo integral. O caminho privado reduz onboarding, administração e isolamento entre várias contas, mas **não elimina autenticação, autorização nem segurança**.

## O que pode ser reaproveitado

- frontend React/Vite e biblioteca visual;
- API Fastify e divisão dos módulos;
- regras puras e testes de `packages/domain`;
- schema conceitual, migrations Drizzle como referência e contratos financeiros;
- suítes de regressão existentes para contas, categorias, lançamentos, faturas, transferências, recorrências e relatórios;
- cliente HTTP compartilhado, que deve virar o único ponto de acesso da interface.

## Critérios de pronto para publicar

- todas as rotas de negócio exigem sessão e validam propriedade no servidor;
- nenhuma origem arbitrária acessa a API com credenciais;
- segredos não ficam no repositório, frontend, banco em texto aberto ou logs;
- migrations e migração do SQLite foram ensaiadas com reconciliação financeira;
- backup e restauração foram executados com sucesso no ambiente hospedado;
- deploy e rollback são documentados e reproduzíveis;
- monitoramento alerta falhas da API, banco e jobs;
- fluxos críticos e testes de isolamento passam no CI;
- política de dados e procedimento de exportação/exclusão estão definidos.

## Itens explicitamente adiados

- Electron e qualquer instalador desktop;
- escala multi-região;
- aplicativo móvel nativo;
- cadastro público, caso o primeiro release seja privado;
- login Google/OAuth, multiusuário e domínio próprio;
- novas features financeiras não necessárias à migração.
