# STACK.md

> Gerado por `ana-repo-bootstrap` a partir da detecção do `diagnose.sh`.

**Perfil detectado:** Node.js/TypeScript em monorepo
**Evidências:** `package.json`, `pnpm-workspace.yaml`, projetos TypeScript em `apps/` e `packages/`

## Linguagem e runtime

- TypeScript 5.9
- JavaScript ESM (`"type": "module"`)
- Node.js `>=24.16.0`
- Target de compilação: ES2022
- TypeScript em modo estrito

## Gerenciamento de dependências

- pnpm `>=11.5.2`
- Workspace definido em `pnpm-workspace.yaml`
- Lockfile esperado na raiz: `pnpm-lock.yaml`
- Pacotes internos referenciados com `workspace:*`

## Qualidade e testes

- Lint: ESLint 9 com `typescript-eslint`
- Formatação: Prettier 3
- Testes: Vitest 4
- Typecheck: TypeScript project builds
- Verificação completa: `pnpm check`
- Cobertura mínima: não existe gate de cobertura configurado no repositório

## Dependências relevantes

### Frontend

- React 19 e React DOM
- Vite 7
- Mantine 8
- Tabler Icons
- Recharts
- React Router DOM instalado; a navegação principal observada ainda é controlada por estado em `App.tsx`

### API

- Fastify 5
- `@fastify/cors`
- Drizzle ORM
- `tsx` para desenvolvimento

### Persistência

- SQLite local no desenvolvimento e PostgreSQL hospedado em staging/produção
- `better-sqlite3`
- `postgres` como cliente PostgreSQL com pool limitado
- Drizzle ORM e Drizzle Kit
- Banco padrão em `data/financas.sqlite`
- Neon PostgreSQL no plano gratuito para produção inicial, validado com dados sintéticos

## Organização do código

O repositório é um monorepo pnpm separado nas seguintes unidades:

- `apps/web`: interface React, páginas e componentes compartilhados.
- `apps/api`: servidor Fastify e módulos de rotas por área funcional.
- `packages/domain`: tipos, validações e regras financeiras puras reutilizáveis.
- `packages/database`: conexões SQLite/PostgreSQL, schemas e migrations por dialeto, seeds e operações locais de integridade/restauração.
- `packages/shared`: pacote compartilhado ainda mínimo.

A API registra módulos funcionais diretamente no servidor. O domínio concentra regras puras como dinheiro em centavos, datas de negócio, classificação de lançamentos, cálculo de faturas e conciliação. O acesso a SQLite/PostgreSQL fica isolado em `packages/database`, embora parte relevante das agregações e regras de aplicação ainda esteja dentro dos módulos de rota da API.

## Comandos principais

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check
```

Banco de dados:

```bash
pnpm db:generate
pnpm --filter @finances/database db:generate:postgres
DATABASE_URL=... pnpm --filter @finances/database db:migrate:postgres
pnpm db:migrate
pnpm db:seed
pnpm db:setup
```

Serviços locais:

- Web: `http://localhost:5173`
- API: `http://localhost:3000`

Essas URLs são exclusivas de desenvolvimento. A produção inicial usará a URL HTTPS gratuita `*.onrender.com`, sem domínio próprio.

## Observações da detecção

- Os gates foram validados com Node.js 25.3.0 e pnpm 11.5.2.
- O diagnóstico genérico classificou o projeto como `nextjs-node` por encontrar `package.json`, mas o código comprova que o frontend usa React com Vite, não Next.js.
- O backup local está implementado na API e na interface e possui testes automatizados.
- A integração local legada com Google Drive está implementada, mas será retirada/desabilitada no release online inicial.
- Backup local e restauração estão implementados e cobertos por testes de integridade.
- A distribuição será exclusivamente web e online; empacotamento desktop não faz mais parte do escopo.
- O release inicial usará um Render Free Web Service para Fastify + build Vite na mesma origem e Neon Free PostgreSQL; login será próprio por usuário e senha.
- Google Drive será retirado do release online; OAuth Google, multiusuário e domínio próprio ficam no backlog.
- O levantamento de configuração, identidade, persistência, segurança e operação necessário para produção está em `.specs/project/ONLINE-MIGRATION.md`.
