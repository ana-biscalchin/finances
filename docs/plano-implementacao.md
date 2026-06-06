# Plano De Implementacao

Este documento organiza as etapas de codigo do projeto, em ordem recomendada de implementacao.

## Estrategia Geral

Comecar com um web app local funcional e pequeno, mantendo a arquitetura preparada para Electron no futuro.

Prioridades:

- Estrutura limpa do projeto.
- Banco SQLite com migrations desde o inicio.
- Modelos centrais bem definidos antes de telas complexas.
- API local simples e previsivel.
- UI bonita, clara e operacional.
- Relatorios explicativos, nao apenas graficos soltos.

## Etapa 0: Preparacao Do Repositorio

Objetivo: deixar a base do projeto pronta para desenvolvimento.

Tarefas:

- Escolher gerenciador de pacotes.
- Criar estrutura inicial do projeto.
- Configurar TypeScript.
- Configurar lint/format.
- Configurar scripts principais.
- Criar `.gitignore`.
- Manter a pasta `docs` como base de conhecimento do projeto.

Estrutura sugerida:

```text
apps/
├─ web/
└─ api/
packages/
├─ database/
├─ domain/
└─ shared/
data/
docs/
```

Observacao: essa estrutura pode ser ajustada antes do scaffold, mas a separacao entre UI, API, banco e dominio deve ser preservada.

## Etapa 1: Scaffold Do Web App

Objetivo: criar a primeira versao do frontend local.

Stack:

- Vite.
- React.
- TypeScript.
- Mantine.

Tarefas:

- Criar app Vite React TypeScript.
- Instalar Mantine.
- Configurar tema inicial.
- Criar layout base com navegacao lateral ou superior.
- Criar rotas/telas vazias dos principais modulos.
- Criar componentes base de pagina: header, filtros, painel, estado vazio.

Telas vazias iniciais:

- Dashboard.
- Controle mensal.
- Lancamentos.
- Faturas.
- Contas.
- Categorias.
- Reservas.
- Relatorios.
- Configuracoes.

## Etapa 2: Scaffold Da API Local

Objetivo: criar backend local simples.

Stack:

- Node.js.
- Fastify.
- TypeScript.

Tarefas:

- Criar app Fastify.
- Configurar rota `GET /health`.
- Configurar CORS para o frontend local.
- Configurar variaveis de ambiente locais.
- Criar organizacao de rotas por modulo.
- Criar tratamento padrao de erros.
- Criar contratos basicos de resposta.

Rotas iniciais:

- `GET /health`.
- `GET /meta`.

## Etapa 3: Banco SQLite E Drizzle

Objetivo: criar persistencia local com migrations.

Stack:

- SQLite.
- Drizzle ORM.
- Drizzle migrations.

Tarefas:

- Configurar conexao SQLite.
- Definir caminho local inicial do banco em `data/financas.sqlite`.
- Configurar migrations.
- Criar script de migracao.
- Criar script de seed inicial.
- Criar seed dos meios de pagamento brasileiros.
- Criar seed das categorias iniciais da doc.

Primeiras tabelas:

- `accounts`.
- `payment_methods`.
- `category_groups`.
- `category_macros`.
- `category_micros`.
- `transactions`.
- `transfers`.
- `credit_cards`.
- `credit_card_bills`.
- `installments`.
- `reserve_goals`.
- `reserve_movements`.
- `budgets`.

## Etapa 4: Dominio Compartilhado

Objetivo: evitar duplicacao de tipos e regras entre API e frontend.

Tarefas:

- Criar tipos compartilhados.
- Criar enums ou constantes de dominio.
- Criar validadores de entrada.
- Criar helpers de dinheiro e datas.
- Definir convencao de valores monetarios.

Decisao recomendada:

- Guardar dinheiro em centavos inteiros.
- Usar datas em formato ISO `YYYY-MM-DD` para datas de negocio.
- Usar mes de competencia em formato `YYYY-MM`.

## Etapa 5: Cadastros Base

Objetivo: implementar os cadastros que sustentam todo o app.

Modulos:

- Contas.
- Meios de pagamento hardcoded/semeados.
- Categorias.

Tarefas:

- CRUD de contas.
- Arquivamento e restauracao de contas sem apagar historico.
- Confirmar lista final de meios de pagamento brasileiros.
- Expor meios de pagamento como lista fixa para lancamentos e orcamento.
- CRUD completo de grupos, macros e micros.
- Arquivamento/inativacao de categorias.
- Renomeacao preservando historico por ID.
- Fusao de categorias duplicadas.
- Validacoes para evitar duplicidade.

UI:

- Tabelas com busca e filtros.
- Formularios em drawer/modal.
- Estado arquivado/ativo.
- Confirmacao para arquivar itens em uso e acao clara para restaurar.

## Etapa 6: Lancamentos E Transferencias

Objetivo: registrar movimentacoes financeiras do dia a dia.

Tarefas:

- CRUD de lancamentos.
- CRUD de transferencias.
- Filtros por mes, conta, categoria, meio de pagamento e status.
- Status: previsto, confirmado, conciliado, cancelado.
- Diferenciar data do evento e data de impacto no orcamento.
- Evitar que transferencias entrem como despesa.

UI:

- Tela de lancamentos com tabela densa.
- Formulario rapido de novo lancamento.
- Edicao de lancamento.
- Acoes de confirmar, conciliar, duplicar e cancelar.

## Etapa 7: Cartoes, Faturas E Parcelamentos

Objetivo: suportar o fluxo real de cartao de credito.

Tarefas:

- CRUD de cartoes.
- Geracao/identificacao de faturas por vencimento.
- Lancar compra no cartao com data da compra.
- Calcular data de impacto pelo vencimento da fatura.
- Criar parcelas futuras para compras parceladas.
- Vincular parcelas as faturas corretas.
- Quitar fatura via transferencia/pagamento sem duplicar despesa.

UI:

- Tela de cartoes.
- Tela de faturas.
- Detalhe da fatura com compras.
- Visual de parcelas futuras comprometidas.

## Etapa 8: Controle Mensal

Objetivo: criar a tela central do app.

Tarefas:

- Agregar dados por mes.
- Agrupar por meio de pagamento, grupo, macro e micro.
- Calcular orcado, comprometido, realizado, disponivel e percentual usado.
- Suportar despesas de cartao pelo mes de vencimento da fatura.
- Destacar categorias perto do limite ou estouradas.

UI:

- Tabela agrupada.
- Barras de progresso por linha.
- Filtros de mes, grupo, meio de pagamento e categoria.
- Alternancia de agrupamento:
  - grupo -> meio de pagamento -> macro -> micro.
  - meio de pagamento -> grupo -> macro -> micro.

## Etapa 9: Orcamentos

Objetivo: permitir planejamento mensal.

Tarefas:

- Criar orcamento por mes.
- Definir valores por grupo, meio de pagamento, macro e micro.
- Permitir copiar orcamento de outro mes.
- Permitir ajustar valores do mes atual.

UI:

- Tela de edicao de orcamento mensal.
- Edicao inline quando fizer sentido.
- Comparacao com realizado/comprometido.

## Etapa 10: Reservas

Objetivo: controlar reservas/caixinhas simples.

Tarefas:

- CRUD de objetivos de reserva.
- Movimentacoes: aporte, resgate, rendimento, ajuste.
- Vincular opcionalmente a uma conta.
- Calcular saldo atual, total aportado, total resgatado e rendimento acumulado.
- Gerar evolucao mensal.

UI:

- Lista de reservas.
- Detalhe da reserva.
- Grafico de evolucao.
- Progresso contra valor alvo.

## Etapa 11: Dashboard E Relatorios

Objetivo: dar leitura bonita e explicativa dos dados.

Tarefas:

- Dashboard do mes.
- Relatorio de categorias.
- Relatorio de faturas.
- Relatorio de reservas.
- Fluxo mensal.
- Receitas versus despesas.

UI:

- Cards de indicadores.
- Graficos Recharts com tema visual compatível com Mantine.
- Textos curtos explicando cada relatorio.
- Filtros claros e persistentes.

## Etapa 12: Importacao E Exportacao

Objetivo: entrada e saida de dados.

Formatos:

- CSV.
- OFX.

Tarefas:

- Exportar lancamentos em CSV.
- Importar CSV com mapeamento de colunas.
- Importar OFX para extratos.
- Criar tela de revisao antes de gravar importacoes.
- Detectar possiveis duplicidades.

## Etapa 13: Backups

Objetivo: proteger o banco local.

Tarefas:

- Backup manual do SQLite.
- Backup automatico.
- Restauracao.
- Politica de retencao.
- Tela de historico de backups.

## Etapa 14: Qualidade E Testes

Objetivo: reduzir risco nas regras financeiras.

Tarefas:

- Testes unitarios de regras de dominio.
- Testes de calculo do controle mensal.
- Testes de faturas e parcelas.
- Testes de reservas.
- Testes de API para rotas principais.
- Testes basicos de UI para fluxos criticos.

Regras com prioridade de teste:

- Compra no cartao impacta o mes de vencimento da fatura.
- Pagamento de fatura nao duplica despesa.
- Transferencia nao entra como gasto.
- Renomear categoria preserva historico.
- Fusao de categorias move lancamentos corretamente.
- Orcamento calcula disponivel corretamente.

## Etapa 15: Preparacao Para Electron

Objetivo: deixar o app pronto para empacotamento futuro.

Tarefas:

- Revisar dependencias do frontend e backend.
- Definir caminho de banco fora da pasta do app.
- Definir estrategia para iniciar/parar API local no Electron.
- Avaliar se Fastify continua como servidor interno ou se vira IPC.
- Criar build de producao do web app.
- Criar primeira prova de conceito Electron.

## Ordem Recomendada Para Os Primeiros Commits

1. Scaffold do monorepo/local workspace.
2. App Vite com Mantine e rotas vazias.
3. API Fastify com healthcheck.
4. SQLite + Drizzle + primeira migration.
5. Seeds de meios de pagamento e categorias.
6. CRUD de contas.
7. CRUD de categorias completo.
8. CRUD de lancamentos.
9. Transferencias.
10. Cartoes e faturas.
11. Controle mensal.

## Marco De MVP

O MVP fica aceitavel quando for possivel:

- Cadastrar contas.
- Gerenciar categorias e selecionar meios de pagamento fixos.
- Registrar receitas, despesas e transferencias.
- Registrar compras de cartao por fatura.
- Registrar parcelas.
- Ver controle mensal com orcado, comprometido, realizado e disponivel.
- Cadastrar reservas simples.
- Fazer backup basico do banco.
