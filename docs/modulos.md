# Modulos do Projeto

Este documento registra o estado funcional atual do app. Para regras detalhadas de calculo, veja [Regras de Negocio](regras-negocio.md).

## Visao geral

O app e um web app local para financas pessoais, com:

- frontend React/Vite/Mantine em `apps/web`;
- API Fastify em `apps/api`;
- SQLite local via Drizzle em `packages/database`;
- regras e helpers de dominio em `packages/domain`.

A tela central do produto e o **Controle mensal**. As demais telas alimentam ou explicam essa visao.

## Implementado

### Controle mensal

Status: implementado.

Funcoes principais:

- Selecionar mes de analise.
- Ver valores planejados, realizados, comprometidos e disponiveis.
- Alternar entre regime de competencia e regime de caixa.
- Agrupar a visao de competencia por categoria e subcategoria.
- Editar planejamento mensal inline.
- Editar planejamentos por subcategoria, conta/fonte e meio opcional no detalhe.
- Separar gasto de caixa e gasto de cartao.
- Mostrar resumo por conta na visao de competencia e fluxo/saldos na visao de caixa.
- Calcular pagamento de fatura a partir das faturas com vencimento no mes.

Arquivos principais:

- `apps/api/src/modules/budgets.ts`
- `apps/web/src/app/monthly-control/ControleMensalPage.tsx`
- `apps/api/src/budgets.test.ts`

### Lancamentos

Status: implementado.

Funcoes principais:

- Criar, editar, listar e excluir lancamentos.
- Suportar receitas, despesas, reembolsos e estornos.
- Criar novos lancamentos como realizados por padrao.
- Manter status internos (`planned`, `confirmed`, `reconciled`, `canceled`) apenas para compatibilidade, importacoes e conciliacao.
- Filtrar por mes, conta, meio de pagamento, categoria e tipo.
- Criar transferencias entre contas por lancamentos vinculados.
- Exportar CSV.
- Importar CSV com previa, mapeamento de colunas, reconciliacao e prevencao de duplicatas.

Arquivos principais:

- `apps/api/src/modules/transactions.ts`
- `apps/web/src/app/transactions/TransactionsPage.tsx`
- `apps/api/src/transactions.test.ts`

### Contas

Status: implementado.

Funcoes principais:

- Criar, editar, listar, arquivar e restaurar contas.
- Calcular saldo atual a partir do saldo inicial e lancamentos.
- Definir uma conta primaria.
- Definir meio de pagamento padrao por conta.

Arquivos principais:

- `apps/api/src/modules/accounts.ts`
- `apps/web/src/app/accounts/AccountsPage.tsx`

### Categorias

Status: implementado.

Funcoes principais:

- Gerenciar categorias e subcategorias.
- Definir natureza da categoria: receita, despesa ou transferencia.
- Definir comportamento da subcategoria: fixo, variavel ou extra.
- Arquivar e restaurar sem apagar historico.
- Fusionar subcategorias duplicadas, movendo lancamentos e orcamentos.

Arquivos principais:

- `apps/api/src/modules/categories.ts`
- `apps/web/src/app/categories/CategoriesPage.tsx`
- `apps/api/src/categories.test.ts`

### Cartoes e faturas

Status: implementado.

Funcoes principais:

- Gerenciar cartoes de credito.
- Criar faturas automaticamente por cartao e mes.
- Lancar compras diretamente na fatura.
- Importar CSV de fatura.
- Gerar parcelas futuras a partir de colunas de parcela.
- Excluir compras individuais ou selecionadas da fatura.
- Marcar fatura como paga escolhendo a conta de pagamento.
- Registrar saida de conta ao pagar fatura sem duplicar as compras.

Arquivos principais:

- `apps/api/src/modules/credit-cards.ts`
- `apps/web/src/app/cards/BillsPage.tsx`
- `docs/regras-cartao.md`

### Orcamentos

Status: implementado dentro do modulo de controle mensal.

Funcoes principais:

- Criar e atualizar valores planejados por mes.
- Planejar por subcategoria e, quando necessario, detalhar por fonte/conta e meio de pagamento opcional.
- Criar alocacoes combinando subcategoria + conta/carteira + meio opcional.
- Comparar planejado vs realizado por categoria e abrir o detalhamento por fonte/metodo.
- Copiar orcamentos de um mes para outro.
- Remover planejamento quando o valor informado e zero.

Arquivos principais:

- `apps/api/src/modules/budgets.ts`
- `apps/web/src/app/monthly-control/ControleMensalPage.tsx`

### Relatorios

Status: implementado parcialmente.

Funcoes atuais:

- Resumo de faturas de cartao.
- Evolucao diaria.
- Resumo anual.
- Categorias anuais.
- Participacao por meio de pagamento.
- Filtros compartilhados por mes, ano, conta, meio e categoria.

Arquivos principais:

- `apps/api/src/modules/reports.ts`
- `apps/web/src/app/reports/ReportsPage.tsx`
- `apps/api/src/reports.test.ts`

### Meios de pagamento

Status: implementado como seed/lista fixa.

Funcoes principais:

- Expor meios cadastrados por `GET /payment-methods`.
- Usar meios em lancamentos, orcamentos e relatorios.

Arquivo principal:

- `packages/database/src/seed-data.ts`

## Parcial ou futuro

### Reservas

Status: schema criado, sem API/UI.

Ja existem tabelas:

- `reserve_goals`
- `reserve_movements`

Falta implementar:

- CRUD de objetivos.
- Movimentacoes de aporte, resgate, rendimento e ajuste.
- Tela de reservas.
- Relatorios de evolucao de reservas.

### Backups

Status: nao implementado.

Falta implementar:

- Criar backup manual do SQLite.
- Listar backups.
- Restaurar backup com confirmacao.
- Definir retencao e local padrao.

### OFX

Status: nao implementado.

CSV ja existe para importacao/exportacao. OFX permanece como melhoria futura.

### Configuracoes

Status: tela placeholder.

Preferencias, backup/restauro, leitura OFX, autenticacao local e criptografia ainda nao foram definidos.
