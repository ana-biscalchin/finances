# Web — Instruções Para Agentes

> Unidade: `apps/web` · Hub: `../../AGENTS.md`

## Propósito

Interface local da Carteira da Ana. Apresenta os fluxos financeiros, coleta ações da usuária e consome a API Fastify por HTTP.

## Arquivos principais

| Arquivo | Responsabilidade |
| --- | --- |
| `src/main.tsx` | Inicialização da aplicação React |
| `src/theme.ts` | Configuração visual do Mantine |
| `src/app/App.tsx` | Shell, navegação e carregamento de dados compartilhados |
| `src/app/monthly-control/ControleMensalPage.tsx` | Controle mensal por competência |
| `src/app/monthly-control/CashMonthlyView.tsx` | Controle mensal por caixa e projeções |
| `src/app/transactions/TransactionsPage.tsx` | CRUD, filtros e importação de lançamentos |
| `src/app/transactions/ReconciliationWizard.tsx` | Fluxo visual de conciliação CSV |
| `src/app/cards/BillsPage.tsx` | Cartões, faturas, compras, parcelas e pagamentos |
| `src/app/accounts/AccountsPage.tsx` | Gerenciamento de contas |
| `src/app/categories/CategoriesPage.tsx` | Categorias e subcategorias |
| `src/app/reports/ReportsPage.tsx` | Relatórios e gráficos |
| `src/app/settings/SettingsPage.tsx` | Backups locais e integração Google Drive |
| `src/app/shared` | Componentes e helpers reutilizados entre páginas |

## Como funciona

- `main.tsx` monta a aplicação com o tema Mantine.
- `App.tsx` funciona como shell e seleciona a página atual por estado.
- As páginas consultam a API configurada por `VITE_API_URL`, com fallback para `http://localhost:3000`.
- Estado de formulário e carregamento fica próximo da página que o utiliza.
- Erros de API devem aparecer na interface e também passar pelos helpers de `shared/errors.ts`.
- Formatação financeira reutiliza `@finances/domain`.
- Componentes repetidos entre páginas devem ser avaliados para `src/app/shared`.
- Regras financeiras não devem ser reimplementadas em componentes React.
- Datas de negócio devem usar os helpers existentes e evitar conversões UTC acidentais.
- O Controle mensal é a área prioritária, mas precisa ser avaliado antes de qualquer redesenho.

## Entry points

- Aplicação: `src/main.tsx`
- Shell: `src/app/App.tsx`
- Desenvolvimento: `pnpm --filter @finances/web dev`
- Build: `pnpm --filter @finances/web build`
- URL local: `http://localhost:5173`

## Extensão

Para adicionar ou alterar um fluxo visual:

1. Consulte `docs/visual-usabilidade.md`.
2. Varra a página, os módulos vizinhos e `src/app/shared`.
3. Reutilize componentes, tipos e helpers existentes.
4. Mantenha chamadas HTTP na borda da página ou em abstração compartilhada já existente.
5. Não copie regras financeiras da API para a interface.
6. Exponha estados de carregamento, vazio, sucesso e erro.
7. Adicione teste unitário para transformação ou regra visual extraída.
8. Execute revisão visual no navegador quando o ambiente estiver disponível.

## Integrações

- API local em `http://localhost:3000`.
- `@finances/domain` para formatação e regras puras compartilhadas.
- Mantine para componentes e layout.
- Tabler Icons para ícones.
- Recharts para visualizações.
- `localStorage` para preferências locais de interface.
- Google Drive é acessado somente por meio da API local.

## Testes

```bash
pnpm --filter @finances/web test
pnpm --filter @finances/web typecheck
pnpm --filter @finances/web lint
pnpm --filter @finances/web build
```

Testes observados:

- `src/app/date-format.test.ts`
- `src/app/transactions/import-preview.test.ts`

## Pontos de atenção

- `ControleMensalPage.tsx`, `TransactionsPage.tsx`, `BillsPage.tsx` e `ReportsPage.tsx` são páginas grandes.
- O Controle mensal ainda não está satisfatório; primeiro diagnostique os problemas com a usuária.
- A navegação principal usa estado em `App.tsx`, apesar de React Router estar instalado.
- Tipos de resposta da API são definidos localmente em várias páginas.
- Não há uma camada central de cliente HTTP observada.
- Configurações e backup existem na interface, embora documentos antigos indiquem que ainda seriam futuros.
- A direção final entre web e desktop permanece aberta.

## Constituição

Aplicam-se `../../AGENTS.md`, `ana-standards`, `ana-sdd` e `ana-tdd`.
