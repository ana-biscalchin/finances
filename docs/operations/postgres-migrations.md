# Migrations PostgreSQL

As migrations PostgreSQL são um job controlado e nunca rodam no startup da API.

## Aplicação

1. Confirme o projeto, branch e banco de destino; staging e produção nunca compartilham o mesmo projeto Neon.
2. Crie ou confirme um ponto de recuperação antes de alterar um banco com dados.
3. Configure `DATABASE_URL` somente no ambiente seguro do job.
4. Execute `pnpm --filter @finances/database db:migrate:postgres`.
5. Inicie o artefato compatível e valide `/health/ready`; a rota só responde `200` após conexão e presença do schema base.
6. Execute smoke autenticado das rotas financeiras antes da promoção.

O comando é repetível: o journal do Drizzle registra migrations já aplicadas. Falha de migration bloqueia o deploy; não se executa migration reversa destrutiva automaticamente.

## CI e rollback

A CI sobe PostgreSQL efêmero, aplica todas as migrations em banco vazio e testa readiness, escrita financeira escopada, rollback e concorrência. O pool possui limite e timeout explícitos, e o encerramento do Fastify fecha as conexões.

Se o artefato falhar após uma migration compatível, reimplante o artefato anterior. Se houver incompatibilidade de schema, interrompa a promoção e restaure staging pelo ponto de recuperação; qualquer ação destrutiva exige revisão e confirmação.
