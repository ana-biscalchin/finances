# Financas Pessoais

App local para gerenciamento de financas pessoais, com foco em controle mensal, cartao de credito por fatura, categorias gerenciaveis, reservas simples e relatorios explicativos.

## Objetivo

Criar um app local, inicialmente como web app em `localhost`, com banco SQLite e possibilidade futura de empacotamento como aplicativo desktop com Electron.

## Stack Planejada

- Frontend: React, TypeScript e Vite.
- UI: Mantine.
- Backend/API local: Node.js e Fastify.
- Banco de dados: SQLite.
- ORM/migrations: Drizzle.
- Tabelas densas: TanStack Table.
- Graficos: Recharts.
- Empacotamento futuro: Electron.

## Principios Do Produto

- Banco local no inicio, com backups simples.
- Controle mensal como tela central do app.
- Despesas de cartao impactam o mes de vencimento da fatura.
- Pagamento de fatura nao duplica despesa.
- Transferencias entre contas nao entram como gasto.
- Categorias, macros e micros devem ser gerenciaveis e renomeaveis.
- Relatorios devem ser bonitos, claros e explicativos.

## Documentacao

- [Memoria do projeto para agentes](AGENTS.md)
- [TODO inicial](TODO.md)
- [Decisoes tecnicas](docs/decisoes-tecnicas.md)
- [Modulos do projeto](docs/modulos.md)
- [Categorias financeiras](docs/categorias.md)
- [Visual e usabilidade](docs/visual-usabilidade.md)
- [Plano de implementacao](docs/plano-implementacao.md)
- [Criterios de qualidade](docs/criterios-qualidade.md)

## Status

Projeto em fase de planejamento tecnico e funcional.

Scaffold inicial em andamento com workspace `pnpm`.

Banco e dominio iniciais configurados com SQLite, Drizzle, migration e seed.

## Desenvolvimento

Requisitos:

- Node.js `>=24.16.0`
- pnpm `>=11.5.2`

Comandos:

```bash
pnpm install
pnpm dev
pnpm check
```

Comandos especificos:

```bash
pnpm dev:web
pnpm dev:api
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Banco local:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:setup
```

O banco local fica em:

```text
data/financas.sqlite
```

Esse arquivo nao deve ser versionado.
