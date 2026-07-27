# Validação de staging — 2026-07-27

## Recursos

- Render staging: `carteira-da-ana-staging` (`srv-d9jpuj4m0tmc73bg17qg`), plano Free, Ohio.
- URL: `https://carteira-da-ana-staging.onrender.com`.
- Neon staging: `finances-staging` (`morning-math-16002339`), separado de `finances`.
- Branch de aplicação: `feat/online-migration-foundation`.
- Secrets de banco e sessão foram transferidos diretamente entre CLIs e não registrados.

## CI e deploy

- Workflow `CI` run 5 concluiu com sucesso.
- Formatação em escopo, lint, typecheck, build e 179 testes passaram.
- O artefato `finances-<sha>.tar.gz` foi criado e armazenado pelo GitHub Actions.
- O Render clonou o repositório privado e fez auto-deploy do commit
  `99e7c0e883de3278c0a42fb8f8a1067fd794a66c`.

## Smoke

- `/health/live`: `200`, sem detalhes internos.
- `/health/ready`: `200`, confirmando conexão TLS com o Neon.
- `/`: entregou o `index.html` do Vite pela mesma origem HTTPS.
- Origem `https://attacker.example`: sem header CORS permissivo.
- `/api/accounts`: alcançou a fronteira `/api`, mas ainda retorna `500` porque o adapter financeiro
  PostgreSQL pertence à T8. Nenhum dado pessoal foi colocado em staging.

## Persistência

Um marcador sintético `staging-deploy-persistence=synthetic-ok` foi gravado no Neon. O valor
permaneceu após novo deploy, rollback e promoção, comprovando que a persistência da prova não
depende do filesystem do Render.

## Rollback

1. SHA atual `99e7c0e` ficou saudável.
2. Rollback para `65b0b2e` concluiu com status `live`.
3. `/health/live` e `/health/ready` permaneceram saudáveis.
4. O marcador sintético permaneceu no Neon.
5. Promoção de volta para `99e7c0e` concluiu com status `live`.
6. Health checks, frontend e CORS passaram novamente.

## Gates restantes de T4

- A promoção atual do Render recompila o commit; o artefato da CI ainda não é consumido diretamente.
- O job de migration PostgreSQL só pode ser implementado quando T8 fornecer migrations do dialeto
  hospedado.
- Produção não será publicada para contornar esses itens nem antes de autenticação e ownership.
