# Tasks — Distribuição online da Carteira da Ana

**Design:** `.specs/features/online-distribution/design.md`

**Especificação:** `.specs/project/ONLINE-MIGRATION.md`

**Decisão:** `.specs/codebase/decisions/001-distribuicao-online.md`

**Status:** ready

> Estas tasks descrevem a execução futura; nenhuma delas foi implementada nesta etapa. Cada task de produção deve seguir RED → GREEN → REFACTOR, terminar em commit pequeno e atualizar a documentação quando uma decisão mudar.

---

## Plano de execução

```text
Fase 0 — Gates:
T1

Fase 1 — Fundação de produção:
T1 → T2 → T3
      └────→ T4

Fase 2 — Identidade e dados:
T3,T4 → T5 → T6 → T7 → T8

Fase 3 — Produto autenticado:
T5,T6 → T9
T7,T8 → T10
T5 → T11 [P]

Fase 4 — Segurança e operação:
T9,T10,T11 → T12 → T13
T8,T10 → T14 [P]

Fase 5 — Lançamento:
T12,T13,T14 → T15 → T16
```

`[P]` indica trabalho que pode avançar em paralelo após estabilização das dependências. As escolhas estão no ADR 002; T1 é bloqueante apenas para validar que Render Free e Neon Free continuam adequados e sem custo nos limites vigentes.

---

## Fase 0 — Decisões e prova

### T1: Provar Render Free e Neon Free

**Execução:** concluída em 2026-07-27. Evidências em `docs/operations/free-tier-proof.md` e `docs/operations/staging-validation-2026-07-27.md`.

- **O quê:** subir uma prova sem dados pessoais com Fastify servindo o build Vite no Render Free e conectando ao Neon Free PostgreSQL.
- **Onde:** `.specs/codebase/decisions/`, `.specs/codebase/ARCHITECTURE.md`, `.specs/codebase/STACK.md`, documentação de infraestrutura a criar.
- **Depende de:** nenhuma.
- **Reusa:** ADRs 001/002, levantamento online e design aprovado.
- **Pronto quando:**
  - [ ] Web e API respondem pela mesma URL HTTPS `*.onrender.com`.
  - [ ] Neon aceita conexão TLS, migrations e pool dentro dos limites gratuitos.
  - [ ] Novo deploy preserva os dados de teste conforme a estratégia escolhida.
  - [ ] Cold start/suspensão, logs, secrets e limites gratuitos dos dois serviços foram registrados.
  - [ ] Backup e restauração mínimos do banco de prova foram executados.
  - [ ] Nenhuma cobrança é ativada sem aprovação e existe critério documentado para abandonar o plano gratuito.
- **Testes/checks:** smoke HTTP, persistência entre deploys, restore de prova e inspeção de logs.
- **Gate:** prova gratuita aprovada; se falhar, novo ADR antes de T2.
- **Commit:** `chore(platform): prove free hosted topology`

---

## Fase 1 — Fundação de produção

### T2: Criar configuração tipada por ambiente

**Execução:** concluída em 2026-07-27 no PR 23.

- **O quê:** centralizar e validar configuração de API, Neon, URL pública do Render, CORS local, cookies, senha/sessão, logs e feature flags no startup.
- **Onde:** `apps/api/src/config/`, `apps/api/src/server.ts`, `packages/database/src/connection.ts`, `.env.example` sem segredos e testes.
- **Depende de:** T1.
- **Reusa:** leitura atual de `PORT`, `HOST`, `DATABASE_PATH` e criação de conexão.
- **Pronto quando:**
  - [ ] Produção falha rápido com configuração ausente, inválida ou com URL de localhost.
  - [ ] Segredos nunca são incluídos em mensagens de validação ou logs.
  - [ ] Local/test continuam fáceis de executar com defaults explicitamente não produtivos.
  - [ ] Produção não aceita variáveis, secrets ou callbacks do Google Drive.
  - [ ] Testes cobrem todos os branches de configuração e redaction.
- **Testes:** unitários de configuração e startup da API.
- **Gate:** `pnpm --filter @finances/api test && pnpm --filter @finances/api typecheck`.
- **Commit:** `feat(api): validate environment configuration`

### T3: Consolidar o cliente HTTP e a topologia da API

**Execução:** concluída em 2026-07-27 para a fronteira HTTP. As rotas financeiras em staging só ficarão funcionais sobre PostgreSQL após T8.

- **O quê:** remover `fetch`/URLs duplicadas, usar `/api` em produção, restringir CORS e adicionar limites/headers/health checks.
- **Onde:** `apps/web/src/app/shared/api-client.ts`, páginas que chamam `fetch`, `apps/api/src/server.ts`, testes web/API e configuração do proxy.
- **Depende de:** T2.
- **Reusa:** `api-client.ts`, `errors.ts` e normalização de erro da API.
- **Pronto quando:**
  - [ ] `rg 'http://localhost:3000|fetch\\(' apps/web/src/app` só encontra exceções documentadas de desenvolvimento/teste.
  - [ ] Toda chamada de negócio usa o cliente compartilhado com cookies e timeout.
  - [ ] Produção usa mesma origem ou allowlist exata, nunca `origin: true`.
  - [ ] `/health/live` e `/health/ready` não expõem dados ou secrets.
  - [ ] Payload excessivo e origem não permitida são rejeitados.
- **Testes:** unitários do cliente, integração CORS/health/payload e smoke por proxy.
- **Gate:** testes web/API, typecheck e lint dos pacotes.
- **Commit:** `feat(platform): establish production http boundary`

### T4: Preparar CI, artefatos e ambientes isolados

**Execução:** parcial em 2026-07-27. CI, staging isolado, auto-deploy, smoke e rollback foram validados. O consumo direto do artefato imutável e o job de migration PostgreSQL dependem da T8; produção permanece bloqueada.

- **O quê:** criar pipeline reprodutível para checks, build imutável, staging, produção e promoção manual, sem migrations destrutivas no startup.
- **Onde:** configuração de CI/CD e deploy do Render/Neon, runbook inicial em `docs/operations/`.
- **Depende de:** T1 e T2.
- **Reusa:** `pnpm check`, builds dos workspaces e scripts de migration existentes.
- **Pronto quando:**
  - [ ] PR executa format, lint, typecheck, testes e build.
  - [ ] Staging e produção possuem bancos, usuárias e secrets separados.
  - [ ] Artefato é versionado por commit e promovido sem rebuild divergente.
  - [ ] Migration é job controlado e impede deploy incompatível.
  - [ ] Rollback do artefato foi ensaiado em staging.
- **Testes/checks:** pipeline completo, deploy/smoke staging e rollback.
- **Gate:** CI obrigatório e staging saudável.
- **Commit:** `ci: add hosted delivery pipeline`

---

## Fase 2 — Identidade e dados

### T5: Implementar usuário, senha e sessão segura

**Execução:** concluída localmente em 2026-07-27. O bootstrap hospedado sobre PostgreSQL será conectado na T8; até lá, produção permanece bloqueada.

- **O quê:** implementar bootstrap privado, login por usuário/senha, Argon2id, sessão opaca, logout, mudança de senha, expiração e resolução da usuária autenticada.
- **Onde:** `packages/database` para `users`/`sessions`, `apps/api/src/auth/`, `apps/api/src/server.ts`, novas rotas de sessão, `apps/web/src/app/session/` e testes.
- **Depende de:** T3 e T4.
- **Reusa:** Fastify hooks, cliente HTTP e configuração tipada.
- **Pronto quando:**
  - [ ] Rotas protegidas retornam `401` sem sessão válida.
  - [ ] Senha e token de sessão são persistidos somente como hashes seguros.
  - [ ] Tabelas `users` e `sessions` possuem constraints, expiração e índices necessários.
  - [ ] Cookie de sessão é `HttpOnly`, `Secure`, `SameSite=Lax` e nunca usa `localStorage`.
  - [ ] Não existe endpoint público de cadastro ou recuperação de senha.
  - [ ] Bootstrap idempotente não recebe senha por argumento visível nem a registra em log.
  - [ ] Login aplica rate limiting, atraso progressivo e resposta genérica.
  - [ ] Logout, expiração, revogação e rotação de sessão funcionam.
  - [ ] CSRF/origin é validado nas mutações conforme a topologia.
  - [ ] Mudança de senha exige a atual e revoga sessões existentes.
- **Testes:** unitários de Argon2id/sessão e integração/E2E de login, força bruta, logout, mudança e expiração.
- **Gate:** pacote API/web completo e revisão de segurança da sessão.
- **Commit:** `feat(auth): add private password sessions`

### T6: Adicionar propriedade financeira ao schema

**Execução:** concluída em 2026-07-27 no PR 23, com propriedade direta nas raízes financeiras e herança validada nos filhos.

- **O quê:** referenciar a usuária criada em T5, adicionar `ownerId` às raízes financeiras, converter unicidades/índices e definir herança de propriedade dos filhos.
- **Onde:** `packages/database/src/schema.ts`, migrations Drizzle, seeds e testes do banco.
- **Depende de:** T5.
- **Reusa:** IDs, timestamps, FKs e padrões de migration existentes.
- **Pronto quando:**
  - [x] Todas as entidades da matriz do design possuem propriedade direta ou herdada documentada.
  - [x] Constraints compostas permitem os mesmos nomes/chaves para proprietárias diferentes.
  - [x] Nenhum registro financeiro novo aceita `ownerId` nulo.
  - [x] Migration local atribui somente a proprietária bootstrap explicitamente configurada.
  - [x] Testes cobrem FK, unicidade por proprietária e rollback de falha.
- **Testes:** integração database em banco efêmero para ambos os dialetos suportados.
- **Gate:** `pnpm --filter @finances/database test` e revisão do plano de migration.
- **Commit:** `feat(database): scope financial data by owner`

### T7: Criar repositórios e serviços obrigatoriamente escopados

**Execução:** concluída em 2026-07-27 no PR 23. Todas as rotas e serviços financeiros propagam `ownerId`, incluindo referências cruzadas e idempotência.

- **O quê:** propagar `RequestContext` e `ownerId` por todas as consultas, comandos, agregações e validações de referências.
- **Onde:** `apps/api/src/application/`, `apps/api/src/modules/`, camada de repositórios a criar e testes da API.
- **Depende de:** T6.
- **Reusa:** services existentes e transações Drizzle/SQLite.
- **Pronto quando:**
  - [x] Não existe método de repositório de negócio com `ownerId` opcional.
  - [x] Listar, ler, alterar e excluir sempre incluem escopo da sessão.
  - [x] Conta, cartão, categoria e outras referências cruzadas são validadas dentro da mesma propriedade.
  - [x] IDs de outra proprietária retornam resposta não enumerável e não sofrem mutação.
  - [x] Chaves de idempotência são únicas por proprietária.
  - [x] Testes percorrem todos os módulos com Ana e uma segunda identidade.
- **Testes:** integração API + banco, matriz automatizada de IDOR.
- **Gate:** suíte completa da API e revisão de query/authorization.
- **Commit:** `feat(api): enforce owner scoped data access`

### T8: Adaptar a persistência ao banco hospedado

**Execução:** concluída em 2026-07-28 no PR 23. Schema, migration repetível, pool, readiness do schema completo, shutdown, bootstrap e workflow financeiro PostgreSQL foram validados na CI e no Neon. A migration versionada foi aplicada e reaplicada com sucesso no branch principal de staging `br-bold-hill-avumh96d`; o smoke financeiro passou 4/4 e o Render permaneceu saudável. Produção não foi alterada.

- **O quê:** implementar conexão, schema, migrations e comportamento transacional no banco aprovado, mantendo SQLite somente onde decidido.
- **Onde:** `packages/database/`, configuração da API, migrations e testes de integração.
- **Depende de:** T6 e T7.
- **Reusa:** Drizzle schema, conexão atual, services e testes de integridade.
- **Pronto quando:**
  - [x] Datas, centavos, enums, FKs, unicidades e transações têm comportamento equivalente.
  - [x] Pool possui limites, timeout e shutdown gracioso.
  - [x] API não inicia pronta antes de conectar e verificar o schema compatível.
  - [x] Migrations são repetíveis em banco vazio e upgrade suportado.
  - [x] Suíte financeira passa contra o banco-alvo em CI.
- **Testes:** integração database/API no banco-alvo e testes de concorrência essenciais.
- **Gate:** suíte completa com serviço de banco real no CI.
- **Commit:** `feat(database): support hosted production database`

---

## Fase 3 — Produto autenticado e migração

### T9: Adicionar bootstrap de sessão ao frontend

**Execução:** implementação concluída em 2026-07-28 no branch de trabalho. O frontend agora resolve a sessão antes de montar qualquer tela financeira, oferece acesso, carregamento, indisponibilidade, expiração por `401` e logout, com credenciais mantidas em cookie HttpOnly pela API.

- **O quê:** criar provider de sessão, telas de acesso/carregamento/expiração/indisponibilidade e proteger o carregamento dos dados financeiros.
- **Onde:** `apps/web/src/app/session/`, `apps/web/src/app/App.tsx`, cliente HTTP e testes web.
- **Depende de:** T5 e T7.
- **Reusa:** estrutura atual de `App`, Mantine, tratamento de erro compartilhado e navegação existente.
- **Pronto quando:**
  - [x] Nenhuma página financeira consulta a API antes de resolver a sessão.
  - [x] `401` limpa estado sensível e leva ao acesso sem loop.
  - [x] Refresh preserva sessão válida e logout remove acesso.
  - [x] Estados possuem mensagens acessíveis e não exibem detalhes internos.
  - [x] Testes cobrem loading, autenticada, expirada e indisponível.
- **Testes:** unit/component e E2E do bootstrap.
- **Gate:** testes, typecheck, lint, build e revisão visual responsiva.
- **Commit:** `feat(web): add authenticated application shell`

### T10: Implementar a migração reconciliada do SQLite

**Execução:** concluída em 2026-07-28 no branch de trabalho. O runtime local foi convertido para PostgreSQL em uma instância Neon exclusiva de debug; o SQLite local vazio foi removido de forma destrutiva. O importador legado permanece disponível para fixtures e eventuais arquivos externos, mas não é mais caminho de execução da aplicação.

- **O quê:** criar ferramenta idempotente de leitura do SQLite, importação para a proprietária de destino e relatório de reconciliação.
- **Onde:** `packages/database/src/migration/` ou workspace de tooling dedicado, fixtures e runbook.
- **Depende de:** T8.
- **Reusa:** schema legado, migrations, helpers de integridade e regras de classificação do domínio.
- **Pronto quando:**
  - [x] Origem é aberta read-only e nunca alterada.
  - [x] `ownerId` vem de parâmetro operacional validado, não do legado.
  - [x] Segunda execução não duplica registros.
  - [x] Contagens, FKs, totais por mês/tipo, transferências e faturas são reconciliados.
  - [x] Falha intermediária não deixa lote publicável incompleto.
  - [x] Relatório omite descrições e valores sensíveis dos logs gerais.
  - [x] Runbook cobre backup, dry-run, execução, aceite e rollback.
- **Testes:** fixtures legadas, dry-run, idempotência, falha injetada e reconciliação.
- **Gate:** concluído para o estado atual: não havia dados locais a transportar; a API local/staging usa PostgreSQL e a ferramenta de importação foi validada por testes e CI.
- **Commit:** `feat(database): migrate local portfolio online`

### T11: Retirar Google Drive do release online

**Execução:** concluída em 2026-07-28. A configuração de produção rejeita variáveis e habilitação do Drive, as rotas não são registradas no release online e a interface hospedada não exibe a aba do Google Drive.

- **O quê:** remover/desabilitar rotas, configurações, secrets e interface do Google Drive no build de produção online.
- **Onde:** `apps/api/src/modules/settings.ts`, adapter a criar, schema de integrações, `SettingsPage.tsx` e testes.
- **Depende de:** T3.
- **Reusa:** testes de settings para provar ausência das rotas e manter as demais preferências.
- **Pronto quando:**
  - [x] Produção não registra callbacks, rotas ou handlers do Google.
  - [x] UI não solicita client ID/secret nem mostra ações do Drive.
  - [x] Configurações/tokens legados não são migrados ao PostgreSQL.
  - [x] Documentação aponta exportação e backup operacional como substitutos.
- **Testes:** integração de rotas ausentes, teste visual/settings e busca por secrets/callbacks no build.
- **Gate:** suíte settings e inspeção do artefato.
- **Commit:** `refactor(settings): remove drive from online release`

---

## Fase 4 — Segurança, dados e operação

### T12: Separar backup operacional, exportação e restauração

**Execução:** concluída em 2026-07-28 para o release PostgreSQL. A API oferece exportação autenticada, sem persistência no servidor, e as rotas SQLite de restore não são registradas no runtime PostgreSQL. O restore completo permanece procedimento operacional do provedor, documentado em `docs/operations/online-recovery.md`.

- **O quê:** configurar backup/PITR e retenção, criar exportação autenticada e remover restauração integral da superfície pública.
- **Onde:** infraestrutura, `apps/api/src/modules/backups.ts`, `SettingsPage.tsx`, storage adapter e `docs/operations/`.
- **Depende de:** T9, T10 e decisão de T11.
- **Reusa:** validação de integridade e testes de backup atuais como referência.
- **Pronto quando:**
  - [x] Backup operacional segue RPO/retenção aprovados e não depende do filesystem da API.
  - [x] Restore completo é procedimento operacional com confirmação e auditoria.
  - [x] Exportação contém somente dados da sessão e não é persistida pela API.
  - [x] Rotas atuais de restaurar SQLite inteiro não estão públicas em produção.
  - [ ] Restore em staging atinge RTO e passa por verificação financeira.
- **Testes:** integração export/ownership, restore drill e inspeção de artefatos.
- **Gate:** ensaio de recuperação aprovado.
- **Commit:** `feat(platform): establish online data recovery`

### T13: Aplicar hardening e modelo de ameaças

- **O quê:** concluir controles de headers, CSRF, CORS, rate limit, upload, erros, secrets, logs e dependências.
- **Onde:** edge, `apps/api`, cliente web, CI e documentação de segurança.
- **Depende de:** T12.
- **Reusa:** validações de CSV, error handler e configuração das tasks anteriores.
- **Pronto quando:**
  - [ ] Matriz de ameaças do design possui controle e teste automatizado ou risco aceito.
  - [ ] Logs testados não contêm tokens, cookies, connection strings, CSV, descrições ou valores.
  - [ ] Upload inválido/grande e abuso de endpoints sensíveis são limitados.
  - [ ] Cookies, CSP, HSTS e headers passam no checklist aprovado.
  - [ ] Dependências/imagens não possuem vulnerabilidade crítica sem aceite registrado.
- **Testes:** segurança de integração, scanner de dependências/imagem e revisão manual.
- **Gate:** checklist OWASP e revisão antes do go-live.
- **Commit:** `security: harden hosted financial application`

### T14: Implementar observabilidade e runbooks

- **O quê:** adicionar logs estruturados sanitizados, métricas, erros, alertas, custo e procedimentos operacionais.
- **Onde:** API, infraestrutura e `docs/operations/`.
- **Depende de:** T8 e T10.
- **Reusa:** logger Fastify e health checks de T3.
- **Pronto quando:**
  - [ ] Dashboard mostra disponibilidade, latência, `5xx`, banco e release.
  - [ ] Alertas cobrem indisponibilidade, erro, backup atrasado e custo sem dados financeiros.
  - [ ] Exceção é correlacionável por `requestId` e versão do artefato.
  - [ ] Runbooks cobrem API, banco, login, deploy, migration, restore, senha e segredo.
  - [ ] Um exercício em staging valida alertas e pelo menos um runbook.
- **Testes/checks:** falhas sintéticas, inspeção de redaction e exercício operacional.
- **Gate:** aceite operacional.
- **Commit:** `feat(operations): add production observability`

---

## Fase 5 — Homologação e lançamento

### T15: Executar homologação online completa

- **O quê:** validar regressão financeira, identidade, isolamento, dispositivos, migração, recuperação, performance básica e acessibilidade dos novos estados.
- **Onde:** staging, suítes automatizadas e roteiro de UAT.
- **Depende de:** T12, T13 e T14.
- **Reusa:** todas as suítes existentes e o seed de demonstração.
- **Pronto quando:**
  - [ ] `pnpm check` passa no artefato candidato.
  - [ ] Fluxos de contas, categorias, lançamentos, cartões, faturas, mensal, recorrências, importação e relatórios passam.
  - [ ] Matriz de duas identidades não encontra acesso horizontal.
  - [ ] Login, expiração, logout e indisponibilidade passam nos navegadores suportados.
  - [ ] Migração, rollback de aplicação e restore foram ensaiados.
  - [ ] Ana aprova visualmente os novos estados e a reconciliação financeira.
- **Testes:** unit, integração, E2E, segurança, restore drill e UAT visual.
- **Gate:** go/no-go assinado.
- **Commit:** `test: validate online release candidate`

### T16: Migrar e publicar o release privado

- **O quê:** executar janela final, congelar escrita local, fazer backup, migrar, reconciliar, liberar HTTPS e monitorar.
- **Onde:** produção e registro operacional da release.
- **Depende de:** T15.
- **Reusa:** pipeline, ferramenta de migração, runbooks e dashboards.
- **Pronto quando:**
  - [ ] Backup final e dry-run foram aprovados antes do freeze.
  - [ ] Migração final coincide com o relatório de reconciliação aceito.
  - [ ] Acesso é limitado às identidades aprovadas.
  - [ ] Smoke financeiro e observabilidade estão saudáveis.
  - [ ] Origem local permanece imutável durante o período de rollback.
  - [ ] Incidentes e desvios são registrados; modo antigo só é encerrado após estabilidade.
- **Testes/checks:** migration final, smoke, reconciliação e monitoramento intensivo.
- **Gate:** aceite pós-deploy.
- **Commit:** `chore(release): launch hosted carteira da ana`

---

## Definição global de pronto

- decisão, design e documentação refletem o comportamento entregue;
- código novo passa por RED → GREEN → REFACTOR e possui testes proporcionais ao risco;
- nenhuma query financeira ou integração usa propriedade fornecida pelo cliente;
- nenhuma credencial ou dado financeiro aparece em repositório, build, log ou telemetria;
- migrations, deploy, rollback, backup e restore são reproduzíveis;
- `pnpm check` passa no ambiente suportado;
- mudanças visuais são revisadas em desktop e viewport móvel;
- cada task termina em commit pequeno, sem banco, backup, `.env` ou artefato de build.
