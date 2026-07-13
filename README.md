# Carteira da Ana

App local para gerenciamento de financas pessoais, com foco em controle mensal, faturas de cartao, categorias gerenciaveis, importacao CSV e relatorios explicativos.

## Estado atual

O projeto ja possui:

- web app em React, TypeScript, Vite e Mantine;
- API local em Node.js e Fastify;
- banco SQLite local via Drizzle;
- CRUD de contas, categorias, lancamentos e cartoes;
- controle mensal com planejamento, realizacao, disponibilidade e visao de caixa;
- faturas de cartao com importacao CSV, parcelamentos e pagamento por conta;
- importacao/exportacao CSV de lancamentos;
- relatorios iniciais com Recharts;
- criacao, listagem, restauracao e exclusao de backups locais;
- integracao opcional de backups com Google Drive.

Ainda nao estao implementados:

- importacao OFX;
- API/UI de reservas, apesar do schema existir;
- configuracoes finais e empacotamento Electron.

## Principios do produto

- O app roda localmente em `localhost`.
- O banco principal fica em SQLite local.
- O controle mensal e a tela central.
- Compras no cartao impactam o mes da fatura.
- Pagamento de fatura movimenta a conta escolhida, mas nao duplica as compras.
- Transferencias entre contas nao representam gasto novo.
- Categorias e subcategorias preservam historico por ID.
- Valores monetarios sao tratados em centavos inteiros.

## Documentacao

- [Memoria do projeto para agentes](AGENTS.md)
- [Regras de negocio](docs/regras-negocio.md)
- [Modulos do projeto](docs/modulos.md)
- [Categorias financeiras](docs/categorias.md)
- [Orientacao de importacao CSV](docs/orientacao-importacao-csv.md)
- [Decisoes tecnicas](docs/decisoes-tecnicas.md)
- [Visual e usabilidade](docs/visual-usabilidade.md)
- [Criterios de qualidade](docs/criterios-qualidade.md)
- [Roadmap de features](.specs/project/ROADMAP.md)

## Desenvolvimento

Requisitos:

- Node.js `>=24.16.0`
- pnpm `>=11.5.2`

Instalacao e desenvolvimento:

```bash
pnpm install
pnpm dev
```

URLs locais:

```text
Web: http://localhost:5173
API: http://localhost:3000
```

Comandos de verificacao:

```bash
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

Arquivo local do banco:

```text
data/financas.sqlite
```

Esse arquivo, backups, `.env` e artefatos de build nao devem ser versionados.
