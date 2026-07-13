# Database — Instruções Para Agentes

> Unidade: `packages/database` · Hub: `../../AGENTS.md`

## Propósito

Fornecer persistência SQLite local para a Carteira da Ana: conexão, schema Drizzle, migrations, seeds, validação de integridade e suporte à restauração.

## Arquivos principais

| Arquivo | Responsabilidade |
| --- | --- |
| `src/index.ts` | API pública do pacote |
| `src/connection.ts` | Caminho do banco, conexão, integridade e restauração |
| `src/schema.ts` | Tabelas, colunas, índices e relações Drizzle |
| `src/migrate.ts` | Execução das migrations |
| `src/seed.ts` | Aplicação idempotente dos dados iniciais |
| `src/seed-data.ts` | Meios de pagamento e taxonomia inicial |
| `drizzle.config.ts` | Configuração de geração das migrations |
| `drizzle/` | Histórico versionado de migrations |

## Como funciona

- `resolveDatabasePath` usa `DATABASE_PATH` quando definido e, caso contrário, `data/financas.sqlite`.
- `createDatabaseConnection` garante o diretório e abre o SQLite com `better-sqlite3`.
- O schema Drizzle descreve contas, categorias, cartões, faturas, lançamentos, parcelas, reservas, orçamentos e configurações.
- Migrations atualizam estruturas existentes sem apagar histórico.
- Seeds cadastram dados fixos e iniciais de forma repetível.
- `validateDatabaseIntegrity` executa verificação SQLite antes de restaurações.
- `restoreDatabaseOnline` substitui o conteúdo do banco por meio da API de backup do SQLite.
- A API fecha a conexão no encerramento do servidor.
- Arquivos SQLite e backups são dados locais sensíveis e nunca devem ser versionados.

## Entry points

- API pública: `src/index.ts`
- Schema: `src/schema.ts`
- Migration: `src/migrate.ts`
- Seed: `src/seed.ts`
- Configuração Drizzle: `drizzle.config.ts`

## Extensão

Para alterar o banco:

1. Verifique o schema, migrations existentes e consumidores da API.
2. Avalie impacto e reversibilidade antes de modificar dados persistidos.
3. Altere `src/schema.ts` cirurgicamente.
4. Gere uma migration com `pnpm db:generate`.
5. Revise integralmente o SQL gerado.
6. Teste migration e aplicação contra banco temporário.
7. Atualize seeds somente quando os dados iniciais precisarem mudar.
8. Documente impacto, compatibilidade e rollback.
9. Nunca edite silenciosamente uma migration já aplicada.

## Integrações

- Consumido por `apps/api`.
- Drizzle ORM representa schema e queries.
- Drizzle Kit gera migrations.
- `better-sqlite3` fornece conexão e backup online.
- Sistema de arquivos armazena banco e backups locais.

## Testes e verificações

```bash
pnpm --filter @finances/database test
pnpm --filter @finances/database typecheck
pnpm --filter @finances/database lint
pnpm --filter @finances/database build
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Testes de integração com banco aparecem principalmente nas suítes de `apps/api`, usando bancos temporários.

## Pontos de atenção

- Mudanças de schema e restaurações são operações de alto risco.
- Faça backup antes de qualquer operação manual sobre dados reais.
- Nunca use o banco real em testes automatizados.
- Valores monetários devem permanecer como inteiros em centavos.
- Relações históricas devem usar IDs estáveis.
- Reservas existem no schema, mas não têm consumidores de API ou interface.
- A restauração local possui implementação e testes, mas não foi executada nesta sessão.
- A integração Google Drive pertence à API, não a este pacote.

## Constituição

Aplicam-se `../../AGENTS.md`, `ana-standards`, `ana-sdd` e `ana-tdd`.
