# Roadmap De Features

Este arquivo lista apenas o que ainda nao foi implementado ou ainda precisa de revisao. Quando uma tarefa for concluida, remova daqui ou substitua por uma proxima pendencia real.

## Prioridade Atual

- [x] Revisar importacao CSV de lancamentos: na ultima etapa, ao escolher forma de pagamento, confirmar se o valor esta sendo salvo corretamente.
- [x] Verificar as demais edicoes da etapa final de importacao CSV: tipo, conta, forma de pagamento e categoria.
- [x] Melhorar a tabela de lancamentos para evitar colunas cortadas, especialmente conta, meio de pagamento e categoria.
- [x] Na visualizacao de lancamentos, exibir a categoria como tag e deixar a subcategoria como texto principal.
- [x] Permitir filtros explicitos por lancamentos sem forma de pagamento, sem conta e sem categoria.

## Relatorios

- [x] Diferenciar formas de pagamento no grafico de barras do relatorio por categoria.
- [x] Evoluir relatorios de faturas com parcelas futuras comprometidas e composicao por categoria.
- [ ] Criar relatorios de reservas quando o modulo de reservas estiver implementado.

## Importacao E Orientacao

- [ ] Implementar importacao OFX para extratos bancarios.

## Reservas / Caixinhas

- [ ] Criar CRUD de caixinhas de reserva com nome, valor alvo, data limite e conta vinculada.
- [ ] Criar rotas para movimentacoes de reserva: aporte, resgate, rendimento e ajuste.
- [ ] Definir como aportes e resgates de reserva impactam conta, caixa, patrimonio e relatorios.
- [ ] Criar testes de API validando saldo de reservas, rendimentos e vinculo com conta.
- [ ] Criar tela de Reservas com progresso por objetivo.
- [ ] Criar fluxo visual de aporte e resgate debitando ou creditando a conta vinculada.


## Empacotamento Futuro

- [ ] Definir estrategia para Electron: backend embutido ou comunicacao IPC.
- [ ] Definir local padrao do banco SQLite no app empacotado.
- [ ] Criar fluxo de build desktop instalavel.

## Qualidade Continua

- [ ] Manter diffs pequenos por etapa funcional.
- [ ] Revisar tarefas acima de 1000 linhas com rigor extra e testes adicionais.
- [ ] Antes de novas features, mapear reaproveitamento em `apps/web/src/app/shared/` e `packages/domain/` sem criar abstracoes desnecessarias.
