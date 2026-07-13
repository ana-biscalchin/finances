# API — Instruções Para Agentes

> Unidade: `apps/api` · Hub: `../../AGENTS.md`

## Propósito

API HTTP local da Carteira da Ana. Registra rotas Fastify, valida entradas, coordena regras financeiras e persiste dados por meio de `@finances/database`.

## Arquivos principais

| Arquivo | Responsabilidade |
| --- | --- |
| `src/server.ts` | Cria o servidor, registra CORS, error handler e módulos de rota |
| `src/http.ts` | Erros e parsers compartilhados da fronteira HTTP |
| `src/modules/budgets.ts` | Orçamentos e agregação do Controle mensal |
| `src/modules/transactions.ts` | Lançamentos, transferências, CSV e parcelamentos |
| `src/modules/credit-cards.ts` | Cartões, faturas, compras e pagamentos |
| `src/modules/accounts.ts` | Contas, saldo, arquivamento e conta principal |
| `src/modules/categories.ts` | Categorias, subcategorias, arquivo e fusão |
| `src/modules/reports.ts` | Agregações dos relatórios |
| `src/modules/reconciliation.ts` | Prévia e confirmação de conciliação |
| `src/modules/backups.ts` | Backup, listagem, restauração e exclusão local |
| `src/modules/settings.ts` | Configurações e integração opcional com Google Drive |

## Como funciona

- `buildServer` cria a instância Fastify e a conexão com o banco.
- Cada módulo exporta uma função `register*Routes`.
- Os módulos recebem a mesma conexão criada por `@finances/database`.
- Entradas HTTP devem ser validadas antes de alcançar regras e persistência.
- Erros esperados retornam status 4xx; erros inesperados são registrados e retornam mensagem genérica.
- Regras puras reutilizáveis devem ser extraídas para `packages/domain`.
- Regras financeiras devem respeitar `docs/regras-negocio.md`.
- Cartões e faturas também devem respeitar as seções correspondentes de `docs/regras-negocio.md`.
- A conexão SQLite é encerrada pelo hook `onClose`.
- Google Drive é opcional e não pode se tornar requisito do fluxo principal.

## Entry points

- Servidor: `src/server.ts`
- Desenvolvimento: `pnpm --filter @finances/api dev`
- Build: `pnpm --filter @finances/api build`
- Health check: `GET /health`
- Metadados: `GET /meta`

## Extensão

Para adicionar uma área funcional:

1. Verifique módulos e helpers existentes antes de criar código.
2. Mantenha regras puras em `packages/domain`.
3. Crie o módulo de rotas em `src/modules`.
4. Valide o payload na fronteira.
5. Registre o módulo em `src/server.ts`.
6. Adicione testes de API com banco temporário e dependências externas mockadas.
7. Atualize as regras ou decisões em `docs` quando o comportamento financeiro mudar.

## Integrações

- `@finances/database`: schema, conexão e SQLite.
- `@finances/domain`: regras financeiras puras.
- Frontend local: consumidor HTTP em `http://localhost:5173`.
- Google OAuth e Drive: apenas nas rotas de configurações e backups remotos.
- Sistema de arquivos: banco e backups locais.

## Testes

```bash
pnpm --filter @finances/api test
pnpm --filter @finances/api typecheck
pnpm --filter @finances/api lint
pnpm --filter @finances/api build
```

Principais suítes:

- `transactions.test.ts`
- `budgets.test.ts`
- `reports.test.ts`
- `categories.test.ts`
- `reconciliation.test.ts`
- `backups.test.ts`
- `settings.test.ts`

## Pontos de atenção

- `budgets.ts` e `transactions.ts` são módulos grandes e concentram múltiplas responsabilidades.
- O Controle mensal é o fluxo principal, mas precisa de avaliação antes de mudanças.
- A documentação antiga sobre backups está desatualizada em relação ao código.
- Google Drive existe no código, mas sua operação real ainda não foi validada.
- Reservas têm schema, mas não possuem rotas.
- Nunca use dados financeiros reais ou credenciais em testes.

## Constituição

Aplicam-se `../../AGENTS.md`, `ana-standards`, `ana-sdd` e `ana-tdd`.
