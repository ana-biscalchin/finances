# Carteira da Ana

Aplicacao web para gerenciamento de financas pessoais, com foco em controle mensal, faturas de cartao, categorias gerenciaveis, importacao CSV e relatorios explicativos.

O produto será disponibilizado online e não terá versão executável. O estado atual ainda é um protótipo local; autenticação, persistência hospedada, segurança e operação precisam ser concluídas antes da publicação.

## Estado atual

O projeto ja possui:

- web app em React, TypeScript, Vite e Mantine;
- API local em Node.js e Fastify;
- banco SQLite local via Drizzle;
- CRUD de contas, categorias, lancamentos e cartoes;
- controle mensal com orçamento distribuído por conta/cartão, acompanhamento de entradas previstas, recebidas e a receber por categoria e conta, disponibilidade e visão de caixa;
- contas com formas de pagamento associadas, incluindo benefícios pré-pagos separados;
- faturas de cartao com importacao CSV, parcelamentos e pagamento por conta;
- importacao/exportacao CSV de lancamentos;
- relatorios iniciais com Recharts;
- criacao, listagem, restauracao e exclusao de backups locais;
- integracao local legada de backups com Google Drive, que será retirada do release online inicial.

Ainda nao estao implementados:

- importacao OFX;
- API/UI de reservas, apesar do schema existir;
- preparação para produção online, incluindo autenticação, banco hospedado, backups e deploy.

## Principios do produto

- Em produção, o app será acessado online por HTTPS; `localhost` permanece somente para desenvolvimento.
- O protótipo usa SQLite local. A produção usará Neon PostgreSQL.
- O release inicial será privado para Ana, com usuário e senha, hospedado no Render sem domínio próprio.
- O controle mensal e a tela central.
- Compras no cartao impactam o mes da fatura.
- Pagamento de fatura movimenta a conta escolhida, mas nao duplica as compras.
- Transferencias entre contas nao representam gasto novo.
- Categorias e subcategorias preservam historico por ID.
- Valores monetarios sao tratados em centavos inteiros.

## Documentacao

- [Memoria do projeto para agentes](AGENTS.md)
- [Regras de negocio](docs/regras-negocio.md)
- [Categorias financeiras](docs/categorias.md)
- [Arquitetura](.specs/codebase/ARCHITECTURE.md)
- [Stack e comandos](.specs/codebase/STACK.md)
- [Decisão de distribuição online](.specs/codebase/decisions/001-distribuicao-online.md)
- [Plano e estimativa da migração online](.specs/project/ONLINE-MIGRATION.md)

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
pnpm db:reset:dev
```

Para preencher uma base de desenvolvimento com um cenário financeiro fictício do mês atual:

```bash
pnpm db:seed:demo
```

O seed de demonstração usa IDs próprios e não deve ser executado sobre a base pessoal.

O reset é destrutivo e exclusivo para desenvolvimento/UAT. Ele exige `DATABASE_PATH`, `DEVELOPMENT_DATABASE_ROOT`, `RESET_ENVIRONMENT=development|uat` e `ALLOW_DESTRUCTIVE_DATABASE_RESET=RESET`.

Arquivo local do banco:

```text
data/financas.sqlite
```

Esse arquivo, backups, `.env` e artefatos de build nao devem ser versionados.
