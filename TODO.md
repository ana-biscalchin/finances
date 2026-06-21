# TODO

Backlog e status do projeto.

## Agora

- [x] Decidir gerenciador de pacotes: `pnpm`, `npm workspaces` ou outro.
- [x] Confirmar estrutura inicial do workspace.
- [x] Criar scaffold do monorepo/local workspace.
- [x] Configurar scripts raiz para `typecheck`, `lint`, `test` e `build`.
- [x] Definir comando unico de verificacao local, por exemplo `check`.
- [x] Garantir que toda tarefa de codigo passe pelo loop fechado: typecheck, lint, testes relevantes e build.
- [x] Criar `apps/web` com Vite + React + TypeScript.
- [x] Instalar e configurar Mantine no frontend.
- [x] Criar layout base do app com navegacao e telas vazias.
- [x] Criar `apps/api` com Fastify + TypeScript.
- [x] Criar rota `GET /health`.
- [x] Configurar CORS entre web e API local.
- [x] Criar scripts raiz para rodar web e API.

## Banco E Dominio

- [x] Criar pacote `packages/domain`.
- [x] Criar pacote `packages/shared`.
- [x] Criar pacote `packages/database`.
- [x] Configurar SQLite.
- [x] Configurar Drizzle.
- [x] Criar primeira migration.
- [x] Definir convencao de dinheiro em centavos.
- [x] Definir helpers de datas: `YYYY-MM-DD` e `YYYY-MM`.
- [x] Criar tabelas iniciais de contas, meios de pagamento e categorias.
- [x] Criar seed de meios de pagamento brasileiros.
- [x] Criar seed das categorias iniciais.
- [x] Criar primeiros testes unitarios para helpers de dinheiro e datas.

## Primeiros Modulos

- [x] Implementar CRUD de contas.
- [x] Testar CRUD de contas na API.
- [x] Implementar restauracao de contas arquivadas.
- [x] Padronizar validacao de contas na API com erro 400.
- [x] Planejar exclusao definitiva de contas como acao separada do arquivamento.
- [x] Confirmar lista final hardcoded de meios de pagamento.
- [x] Expor meios de pagamento hardcoded para uso em lancamentos e orcamento.
- [x] Implementar CRUD completo de categorias e subcategorias.
- [x] Implementar arquivamento de categorias.
- [x] Implementar renomeacao preservando historico por ID.
- [x] Implementar fusao de categorias duplicadas.
- [x] Testar regras de arquivamento e renomeacao de categorias.
- [x] Testar regra de fusao de categorias.
- [x] Implementar CRUD de lancamentos.
- [x] Implementar transferencias entre contas.
- [x] Testar que transferencias nao entram como gasto.

## Cartao E Controle Mensal

- [x] Implementar cadastro de cartoes de credito.
- [x] Implementar faturas por mes de vencimento.
- [x] Implementar compras no cartao com data da compra e data de impacto.
- [x] Implementar parcelamentos.
- [x] Implementar quitacao de fatura sem duplicar despesa.
- [x] Ajustes de tela no modulo de Faturas:
  - [x] Ao carregar a pagina de faturas, sempre mostrar o mes seguinte (mes atual + 1) por padrao.
  - [x] Melhorar exibicao do status da fatura (aberta, fechada, paga).
  - [x] Facilitar navegacao entre faturas de diferentes meses (mes anterior/proximo rápido).
  - [x] Mostrar area de lancamento rapido na fatura com cartao de credito ja selecionado.
  - [x] Permitir excluir compras individuais e selecionadas na fatura.
  - [x] Adicionar botao de importacao de fatura CSV.
  - [x] Importar faturas parceladas por colunas de parcela, criando parcelas futuras sem duplicar.
- [x] Criar agregacao do controle mensal na API:
  - [x] Endpoint de resumo de orcamento (calculo de orcado, realizado, comprometido e disponivel).
  - [x] Tratar impacto de fatura de cartao consolidada no orcamento do mes correspondente.
  - [x] Calcular automaticamente o valor de "Pagamento de fatura" a partir da soma das faturas de cartões com vencimento no mês.
  - [x] Ao marcar fatura como paga, escolher a conta de pagamento e refletir a saída na visão mensal.
- [x] Criar interface do controle mensal:
  - [x] Tela principal com tabela mostrando o balanco do mes, com agrupamentos por categorias e meio de pagamento.
  - [x] Seletor de mes e filtros basicos.
  - [x] Ajustar nomenclaturas de comportamento sob Receitas para "Receitas Fixas", "Receitas Variáveis" e "Receitas Extras".
- [x] Testar regra de cartao por vencimento da fatura.
- [x] Testar que quitacao de fatura nao duplica despesa.
- [x] Segregar despesas entre à vista (caixa) e cartão de crédito nas agregações da API.
- [x] Implementar barra de progresso segmentada (SplitProgressBar) diferenciando métodos de pagamento no frontend.
- [x] Adicionar o card de "Independência de Crédito" para monitorar a autonomia de caixa mensal.
- [x] Renomear nomenclaturas de "Orçado" para "Planejado/Alocado".
- [x] Corrigir input do valor planejado para aceitar decimais com vírgula (formato brasileiro) e remover placeholders.
- [x] Otimizar fluxo de cliques: adicionar foco automático e seleção completa do texto ao abrir o input para digitação imediata.
- [x] Evitar recarga/scroll para o topo e manter categorias colapsadas após salvar um planejamento (atualização in-place).
- [x] Permitir colapsar a área de Resumo e de Saldos no Controle Mensal (Competência e Caixa).
- [x] Iniciar categorias macros e subcategorias colapsadas por padrão em todos os níveis.
- [x] Persistir os estados de abertura/fechamento das seções de resumo e categorias no `localStorage` do usuário.
- [x] Fazer a visualização mensal acompanhar o mês mais antigo registrado no banco de dados.
- [x] Simplificar lançamentos como realizados e mover previsões para alocações mensais por fonte/conta.
- [x] Permitir orçamento mensal por subcategoria + conta/carteira + meio de pagamento opcional.

## Importação, Exportação E Backups

- [x] **Exportação (CSV)**:
  - [x] **Backend**: Criar rota `GET /transactions/export` que retorna CSV com filtros de mês aplicados.
- [x] **Importação (CSV)**:
  - [x] **Backend/Shared**: Criar parser de CSV dinâmico que processe cabeçalhos variáveis.
  - [x] **Backend**: Criar rota `POST /transactions/import-preview` que recebe o CSV e o mapeamento de colunas, retornando uma prévia dos lançamentos estruturados com detecção de possíveis duplicidades (mesmo valor, conta e data próxima de 3 dias).
  - [x] **Backend**: Criar rota `POST /transactions/import-confirm` para salvar os lançamentos revisados.
  - [x] **Frontend**: Tela de upload com mapeamento de colunas dinâmico (Data, Descrição, Valor, Categoria, Conta) e campo de Conta de Destino opcional.
  - [x] **Frontend**: Painel de reconciliação permitindo revisar, desmarcar duplicados detectados e confirmar a importação final.
- [ ] **[Melhoria Futura] Importação (OFX)**:
  - [ ] **Backend/Frontend**: Analisar e implementar parser de arquivos de extrato OFX.
- [ ] **Backups**:
  - [ ] **Backend**: Criar rota `POST /backups/create` copiando SQLite para `data/backups/`.
  - [ ] **Backend**: Criar rota `GET /backups` para listar backups existentes.
  - [ ] **Backend**: Criar rota `POST /backups/:name/restore` para restaurar (gerando backup de segurança antes).
  - [ ] **Frontend**: Tela de configurações com controle de backup/restauro.

## Relatórios

- [x] **Decisão de produto**:
  - [x] Remover Dashboard como primeira página; a visão inicial do app é o Controle mensal.
- [x] **Frontend (UI)**:
  - [x] Instalar a biblioteca `recharts` no `apps/web`.
  - [x] Implementar gráfico de barras horizontais para despesas por categoria.
  - [x] Implementar gráfico de linha simples mostrando evolução diária de saldo/gastos.
  - [x] Adicionar área de "Próximos Vencimentos" de faturas de cartão.
  - [x] Vincular filtros ao seletor de mês global da aplicação.

## Reservas (Caixinhas)

- [ ] **Modelagem e Banco**:
  - [x] Confirmar tabelas de reservas (`reserve_goals` e `reserve_movements`) no schema Drizzle.
- [ ] **Backend (API)**:
  - [ ] Criar CRUD para caixinhas de reserva (nome, valor alvo, data limite, conta).
  - [ ] Criar rotas para registrar movimentações (Aporte, Resgate, Rendimento, Ajuste).
  - [ ] Criar testes de integração validando os saldos e rendimentos calculados.
- [ ] **Frontend (UI)**:
  - [ ] Tela de Reservas com progresso circular/linear.
  - [ ] Form de criação/edição e fluxo visual de aporte/resgate debitando/creditando de conta.

## Qualidade

- [x] Configurar testes unitarios.
- [x] Configurar testes de API.
- [x] Configurar verificacao de build.
- [x] Documentar no README os comandos de desenvolvimento e verificacao.
- [x] Revisar documentacao, listar regras de negocio atuais e remover plano defasado.
- [x] Testar regra de cartao por vencimento da fatura.
- [x] Testar que pagamento de fatura nao duplica despesa.
- [x] Testar que transferencia nao entra como gasto.
- [x] Testar renomeacao de categoria preservando historico.
- [x] Testar fusao de categorias.
- [ ] Testar backup para nao sobrescrever dados sem confirmacao.
- [ ] Manter diffs pequenos e revisar tarefas acima de 1000 linhas com mais rigor.

## Refatoracao Financeira

- [x] Implementar fundacao financeira da API:
  - [x] Centralizar classificacao financeira em `packages/domain`.
  - [x] Centralizar calculo de datas/mes de fatura de cartao.
  - [x] Normalizar compras no cartao para nao movimentarem conta antes da fatura.
  - [x] Ignorar lancamentos cancelados no saldo de contas.
  - [x] Proteger relatorios contra duplicidade de pagamento de fatura.
  - [x] Proteger relatorios contra transferencias como consumo/receita.
- [x] Separar API do controle mensal por visao de competencia e caixa.
- [x] Criar abas de competencia e caixa no Controle mensal.
- [x] Revisar relatorios e textos da UI com a nova linguagem financeira (Bloco 4 do plano).
- [x] Conciliação Financeira Automática (Bloco 5):
  - [x] Motor de pontuação de matching por proximidade, descrição e valor exato em `packages/domain/src/reconciliation.ts`.
  - [x] Endpoints `/reconciliation/match-preview` e `/reconciliation/confirm` na API em `apps/api/src/modules/reconciliation.ts`.
  - [x] Interface visual de conciliação (Wizard lado a lado) no frontend em `apps/web/src/app/transactions/ReconciliationWizard.tsx`.
- [x] Correção de Categorização Dupla de Movimentações Internas no Controle Mensal
- [x] Criação do Guia Completo de Features e Fluxos Visuais (`docs/guia-features-fluxos.md`)
- [x] Auditoria completa de performance e diagnóstico de lentidão (`docs/auditoria-performance.md`)
- [x] Habilitar modo WAL e sincronismo NORMAL no SQLite para escritas instantâneas
- [x] Otimização das queries de cálculo de saldo no Controle Mensal (Removido carregamento total do banco de dados na RAM)
- [x] Adicionar índices compostos nas chaves estrangeiras (`accountId`, `creditCardBillId`, `creditCardId`) em `transactions`
- [x] Corrigir exclusão de transações de cartão de crédito e cascade com tabela `installments` na API
- [x] Otimizar carregamento de referências de contas e meios de pagamento eliminando o gargalo N+1 de saldo de contas
- [x] Padronizar todos os campos de valor financeiro (Saldo Inicial, Limite, Valor) sem placeholder e com seleção automática no foco.
- [x] Implementar o seletor flexível de data com digitação de dia + calendário oculto na tela de Faturas.
- [x] Implementar busca textual (descrição, observação, data, categoria) na tela de Lançamentos.
- [x] Corrigir relatórios de competência para usarem `budgetMonth` em compras de cartão.
- [x] Bloquear transferências incompletas e atualizar conta de destino ao editar transferência.
- [x] Consolidar orçamentos equivalentes ao fundir subcategorias.
- [x] Remover edição manual enganosa do mês da fatura no formulário de lançamentos.
- [x] Incluir compras legadas sem `creditCardBillId` no resumo de faturas dos relatórios.
- [x] Padronizar todos os seletores de categoria utilizando o componente unificado `CategorySelect` em todo o aplicativo.
- [x] Implementar busca inteligente com pontuação (score por prefixo de subcategoria, prefixo de categoria pai e substring) no `CategorySelect`.
- [x] Eliminar nível intermediário de comportamento (Fixa/Variável/Extra) da árvore de controle mensal no backend e frontend, substituindo-o por tags/badges inline nas subcategorias.
- [x] Limpar código órfão, imports não utilizados e adequar a documentação de regras financeiras à nova arquitetura da árvore.
- [x] Eliminar as visualizações "Por Fonte" e "Por Meio" do Controle Mensal, consolidando na visualização unificada "Por Categoria".
- [x] Permitir e gerenciar estornos (`chargeback`) e reembolsos (`refund`) de compras de cartão de crédito nas faturas:
  - [x] Atualizar validações da API para aceitar esses tipos em lançamentos associados a cartão de crédito.
  - [x] Liberar seletor de Tipo (Despesa/Reembolso/Estorno) nos drawers de criação e edição da tela de faturas.
  - [x] Garantir que estornos e reembolsos compensem corretamente o valor total da fatura.
  - [x] Habilitar detecção automática de estorno no preview e confirmação de importação de fatura via CSV.
- [x] Melhorar o modal de edição de limites no Controle Mensal para exibir e gerenciar planejamentos por fonte-método e visualizar os lançamentos correspondentes agrupados.

