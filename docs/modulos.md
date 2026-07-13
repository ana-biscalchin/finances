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
- Ver valores planejados, realizados, comprometidos e disponiveis no comportamento atual.
- Evoluir a leitura principal para planejado, gasto e disponivel, indicando quando estiver acima do planejado, conforme a spec ativa.
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
- Importar CSV com previa, mapeamento de colunas e prevencao de duplicatas.
- Conciliar extratos pelo fluxo atual de correspondencias, planejado para simplificacao.

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
- `docs/regras-negocio.md`

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

### Backups e configuracoes

Status: implementado parcialmente.

Funcoes atuais:

- Criar, listar e excluir backups locais do SQLite.
- Validar e restaurar backup com ponto de seguranca anterior a restauracao.
- Configurar e usar integracao opcional com Google Drive.
- Exibir o caminho local dos dados e o historico de backups.

Ainda faltam:

- Retencao e rotacao automatica.
- Verificacao periodica dos backups.
- Preferencias gerais que nao sejam de backup.

Arquivos principais:

- `apps/api/src/modules/backups.ts`
- `apps/api/src/modules/settings.ts`
- `apps/web/src/app/settings/SettingsPage.tsx`
- `apps/api/src/backups.test.ts`

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

### OFX

Status: nao implementado.

CSV ja existe para importacao/exportacao. OFX permanece como melhoria futura.

### Configuracoes

Status: parcialmente implementado.

Backup local, restauracao e integracao opcional com Google Drive estao implementados. Preferencias
gerais, leitura OFX, autenticacao local e criptografia ainda nao foram definidos.

## Fluxos financeiros principais

### Compra e pagamento de cartao

1. A compra preserva a data original e entra no mes da respectiva fatura.
2. A compra aumenta a fatura e o consumo mensal, mas nao altera uma conta.
3. O pagamento cria a saida na conta pagadora sem somar uma segunda despesa ao consumo.
4. Parcelas futuras permanecem em suas respectivas faturas, mesmo quando o banco repete a data original.

### Competencia e caixa

- `Visao do mes` explica planejamento e consumo economico.
- `Dinheiro nas contas` explica entradas, saidas, faturas e risco de saldo negativo.
- A mesma compra de cartao aparece como consumo no mes da parcela e como caixa apenas quando a fatura e paga.

### Importacao

O comportamento atual oferece mapeamento, previa, protecao contra duplicidade e um conciliador por
pontuacao. A direcao aprovada e uma conferencia simples antes da confirmacao; matching avancado e IA
nao devem orientar novas implementacoes agora.

### Transferencia interna

A API representa a transferencia por uma saida na origem e uma entrada equivalente no destino.
Ambas ficam vinculadas e devem ser tratadas atomicamente, sem impacto em consumo ou renda.
