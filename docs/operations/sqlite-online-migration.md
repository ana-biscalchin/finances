# Migração SQLite para o PostgreSQL online

A ferramenta `db:import:sqlite` abre a origem em modo somente leitura, valida o `integrity_check`,
exige `MIGRATION_OWNER_USERNAME` e grava os dados financeiros na proprietária indicada. O `owner_id`
da origem nunca é confiado: ele é substituído pelo ID da proprietária resolvida no destino.

## Dry-run

```bash
SOURCE_DATABASE_PATH=data/financas.sqlite \
DATABASE_URL='postgresql://...' \
MIGRATION_OWNER_USERNAME=ana \
MIGRATION_DRY_RUN=true \
pnpm --filter @finances/database db:import:sqlite
```

O relatório contém apenas caminho, fingerprint, contagens e totais agregados; não registra descrições,
nomes de contas ou valores individuais.

## Execução e aceite

1. Faça cópia/point-in-time restore do destino e preserve a origem original.
2. Execute o dry-run e revise contagens, totais por tipo, transferências e faturas.
3. Execute sem `MIGRATION_DRY_RUN` dentro do job operacional controlado.
4. Execute novamente: chaves existentes são ignoradas e não há duplicação.
5. Consulte o relatório e valide o workflow financeiro autenticado no staging.

Uma falha interrompe a transação e deixa o destino no estado anterior ao lote. O rollback operacional
é restaurar o ponto criado antes da execução; a ferramenta não executa SQL reverso destrutivo.
