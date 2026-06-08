# TODO

Lista inicial para comecar o codigo do projeto.

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
- [x] Implementar CRUD completo de categorias, grupos, macros e micros.
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
- [x] Criar agregacao do controle mensal na API:
  - [x] Endpoint de resumo de orcamento (calculo de orcado, realizado, comprometido e disponivel).
  - [x] Tratar impacto de fatura de cartao consolidada no orcamento do mes correspondente.
  - [x] Calcular automaticamente o valor de "Pagamento de fatura" a partir da soma das faturas de cartões com vencimento no mês.
- [x] Criar interface do controle mensal:
  - [x] Tela principal com tabela mostrando o balanco do mes, com agrupamentos por categorias e meio de pagamento.
  - [x] Seletor de mes e filtros basicos.
  - [x] Ajustar nomenclaturas de comportamento sob Receitas para "Receitas Fixas", "Receitas Variáveis" e "Receitas Extras".
- [x] Testar regra de cartao por vencimento da fatura.
- [x] Testar que quitacao de fatura nao duplica despesa.

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
- [ ] **Frontend (UI)**:
  - [ ] Instalar a biblioteca `recharts` no `apps/web`.
  - [ ] Implementar gráfico de barras horizontais para despesas por categoria.
  - [ ] Implementar gráfico de linha simples mostrando evolução diária de saldo/gastos.
  - [ ] Adicionar área de "Próximos Vencimentos" de faturas de cartão.
  - [ ] Vincular filtros ao seletor de mês global da aplicação.

## Reservas (Caixinhas)

- [ ] **Modelagem e Banco**:
  - [ ] Confirmar tabelas de reservas (`reserve_goals` e `reserve_movements`) no schema Drizzle.
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
- [x] Testar regra de cartao por vencimento da fatura.
- [x] Testar que pagamento de fatura nao duplica despesa.
- [x] Testar que transferencia nao entra como gasto.
- [x] Testar renomeacao de categoria preservando historico.
- [x] Testar fusao de categorias.
- [ ] Testar backup para nao sobrescrever dados sem confirmacao.
- [ ] Manter diffs pequenos e revisar tarefas acima de 1000 linhas com mais rigor.
