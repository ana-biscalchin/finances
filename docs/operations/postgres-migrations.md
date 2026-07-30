# Migrations PostgreSQL

As migrations PostgreSQL são um job controlado e nunca rodam no startup da API.

## Desenvolvimento local

O desenvolvimento local usa PostgreSQL para manter o mesmo comportamento do staging. Defina a
`DATABASE_URL` de uma branch Neon exclusiva para desenvolvimento e um `SESSION_SECRET` local; não
aponte a aplicação para o branch compartilhado de staging. Depois execute:

```bash
export DATABASE_DIALECT=postgres
export DATABASE_URL='postgresql://...'
export SESSION_SECRET='uma-chave-local-com-pelo-menos-32-caracteres'
export AUTH_ENABLED=true
pnpm db:migrate:postgres
pnpm dev:postgres
```

O SQLite continua no repositório apenas como origem legada de importação e fixture de testes. Ele não
é mais o banco recomendado para executar a aplicação local.

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
