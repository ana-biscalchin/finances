# Regras de Negocio

Este documento descreve as regras que o app aplica hoje. Ele deve ser a referencia principal antes de alterar calculos financeiros.

## Conceitos centrais

- Conta representa onde existe saldo: conta corrente, carteira, beneficio, investimento ou carteira digital.
- Meio de pagamento representa a trilha usada em uma transacao sem cartao de credito: Pix, dinheiro, debito, boleto e similares.
- Cartao de credito nao e conta nem meio de pagamento operacional de caixa. A compra entra na fatura; a conta so e afetada quando a fatura e paga.
- Lancamento representa receita, despesa, reembolso ou estorno.
- Transferencia entre contas e modelada como dois lancamentos vinculados e nao deve aparecer como gasto economico novo.
- Categoria e subcategoria classificam o motivo economico. O historico se vincula por ID, nao pelo texto.
- Mes de competencia (`budgetMonth`) e o mes em que o lancamento entra no controle mensal.

## Datas e dinheiro

- Datas de negocio usam `YYYY-MM-DD`.
- Meses usam `YYYY-MM`.
- Valores monetarios sao guardados em centavos inteiros.
- `amountCents` deve ser maior que zero; o sinal economico vem do tipo do lancamento.
- Saldos de conta somam receitas, reembolsos e estornos; despesas reduzem saldo.
- Lancamentos `canceled` ficam fora dos saldos e agregacoes.

## Contas

- Tipos aceitos: `checking`, `savings`, `cash`, `investment`, `benefit`, `digital_wallet`.
- Pode existir no maximo uma conta primaria.
- Ao marcar uma conta como primaria, as outras deixam de ser primarias.
- Arquivar conta remove da listagem padrao e tambem remove o status de primaria.
- Restaurar conta apenas reativa; nao torna primaria automaticamente.
- O saldo atual e calculado a partir do saldo inicial mais lancamentos vinculados a conta.
- Contas podem ter meio de pagamento padrao para acelerar lancamentos e pagamento de fatura.

## Meios de pagamento

- A lista e seedada e nao possui CRUD no app.
- Meios atuais: Pix, Dinheiro, Cartao de debito, Cartao de credito, Cartao pre-pago, Boleto, Debito automatico e Transferencia bancaria/TED.
- Em compras comuns, `paymentMethodId` pode ser usado para agrupar a saida.
- Em compras no cartao de credito, `paymentMethodId` deve ficar vazio.
- A agregacao por meio de pagamento mostra compras de cartao no agrupamento virtual de cartao de credito.

## Categorias

- Naturezas aceitas: `income`, `expense`, `transfer`.
- A arvore atual tem dois niveis: categoria e subcategoria.
- Subcategorias possuem comportamento: `fixed`, `variable` ou `extra`.
- Categorias e subcategorias podem ser renomeadas sem perder historico.
- Arquivar categoria ou subcategoria nao apaga lancamentos antigos.
- Restaurar volta a mostrar nas listagens padrao.
- Fusionar subcategorias move lancamentos e orcamentos para a subcategoria destino, depois arquiva a origem.
- Nomes duplicados sao bloqueados no mesmo escopo.

## Lancamentos

- Tipos aceitos: `income`, `expense`, `refund`, `chargeback`.
- Novos lancamentos manuais e importados entram como realizados (`confirmed`) por padrao.
- A previsao de gastos pertence ao Controle mensal/orcamentos, nao ao cadastro de lancamentos.
- Status aceitos internamente por compatibilidade: `planned`, `confirmed`, `reconciled`, `canceled`.
- `confirmed` e `reconciled` aparecem como "Realizado" na interface e entram como realizado nas agregacoes.
- `planned` e legado; uma migration converte lancamentos existentes para `confirmed`, e a UI normal nao cria novos lancamentos previstos.
- Quando ainda existir dado legado com `status = planned`, o controle mensal e alguns relatorios de consumo o tratam como comprometido, nao como movimento realizado de conta.
- `canceled` e legado/compatibilidade; nao aparece no fluxo normal e nao entra no controle mensal nem no saldo.
- Se `budgetMonth` nao for informado, ele vem da data do evento.
- Lancamentos podem ser filtrados por mes, tipo, conta, meio de pagamento e subcategoria.
- Exportacao CSV usa os filtros de lancamentos e inclui IDs, datas, tipo, descricao, valor, conta, meio, subcategoria, cartao, status e observacoes.

## Transferencias

- Transferencia entre contas e criada informando uma conta de destino.
- A API grava dois lancamentos vinculados: um na origem e outro na conta destino.
- O tipo do lancamento vinculado e invertido: despesa na origem vira receita no destino, e vice-versa.
- Editar ou excluir uma transferencia tambem edita ou exclui o lancamento vinculado.
- Transferencias nao devem ser interpretadas como gasto novo no controle mensal.

## Cartao de credito e faturas

- Compras no cartao ficam com `accountId = null` e `paymentMethodId = null`.
- Compras no cartao recebem `creditCardId` e entram na fatura por `budgetMonth`.
- A fatura e identificada por cartao e mes de fatura (`billMonth`).
- Ao buscar uma fatura, se ela nao existir, a API cria a fatura com fechamento e vencimento calculados pelos dias do cartao.
- A tela de faturas abre por padrao no mes seguinte ao mes atual.
- O total exibido da fatura soma apenas compras do cartao daquela fatura; o lancamento de pagamento da fatura nao entra nessa soma.
- O status da fatura e `open` ou `paid`. A UI tambem indica visualmente "fechada" quando a data atual passou do fechamento, mesmo que o status persistido continue `open`.

## Mes da fatura do cartao

- Se o dia da compra for menor que o dia de fechamento, a compra entra na fatura do proprio mes.
- Se o dia da compra for maior ou igual ao dia de fechamento, entra na fatura do mes seguinte.
- O mes da fatura e gravado em `budgetMonth`.
- A data da compra (`eventDate`) permanece sendo a data real da compra.

## Parcelamentos

- Parcelamentos possuem metadados estruturados: uma compra parcelada agrupa parcelas individuais.
- Cada parcela continua sendo um lancamento separado para entrar corretamente em faturas, controle mensal e relatorios.
- O sufixo `(n/total)` na descricao e apresentacao/compatibilidade; a UI deve preferir os metadados de parcela quando existirem.
- Em lancamento manual com `installmentCount > 1`, a API divide o valor em parcelas mensais.
- A ultima parcela recebe eventual diferenca de centavos.
- Cada parcela avanca um mes a partir do `budgetMonth` inicial.
- Na importacao de fatura, uma linha `2/3` gera a parcela atual `2/3` na fatura aberta e as futuras restantes, sem criar a `1/3`.
- Duplicatas de parcelas futuras sao evitadas na confirmacao da importacao.
- Editar uma parcela existente nao deve recriar a serie nem mover automaticamente a parcela para outro mes de fatura.

## Pagamento de fatura

- Marcar fatura como paga exige uma conta de pagamento.
- Se o cartao tiver conta padrao, ela entra sugerida na UI.
- Ao pagar, a API marca a fatura como `paid` e grava um lancamento de despesa ligado a fatura.
- Esse lancamento usa a subcategoria `Movimentacoes Internas > Pagamento de fatura`, quando ela existe.
- O lancamento de pagamento fica com `creditCardBillId`, mas sem `creditCardId`; assim movimenta a conta, mas nao vira compra do cartao.
- Se o pagamento for refeito, o lancamento de pagamento existente e atualizado em vez de duplicado.
- O pagamento impacta a visao mensal no mes de vencimento da fatura.
- A categoria "Pagamento de fatura" e calculada pela soma da fatura: fatura aberta entra como comprometida; fatura paga entra como realizada.

## Controle mensal

- A tela central e `/controle-mensal`.
- A consulta exige `month=YYYY-MM`.
- Agrupamento padrao: natureza, categoria, subcategoria (o comportamento da subcategoria e exibido como etiqueta na frente do nome).
- Agrupamento alternativo: meio de pagamento, natureza, categoria, subcategoria.
- Agrupamento por fonte: conta/carteira, meio de pagamento, natureza, categoria, subcategoria.
- Indicadores principais: planejado/alocado, realizado, comprometido e disponivel.
- O disponivel de despesa e `planejado - realizado - comprometido`.
- Para receita, o disponivel representa diferenca entre recebido/comprometido e planejado.
- O planejamento pode ser feito por subcategoria, por subcategoria + conta/carteira, ou por subcategoria + conta/carteira + meio de pagamento.
- Quando uma alocacao tem conta mas nao tem meio especifico, lancamentos reais daquela conta e subcategoria abatem essa alocacao independentemente do meio.
- Quando uma alocacao tem conta e meio, apenas lancamentos reais com a mesma combinacao abatem essa alocacao.
- O controle mensal tambem retorna resumo por conta com saldo inicial do mes, entradas, saidas e saldo projetado.
- Compras de cartao entram no planejamento pelo mes da fatura, nao pelo mes da compra.
- Pagamento de fatura aparece como movimento de conta quando pago, mas nao duplica o total da fatura nem as compras.
- Despesas sao separadas entre caixa e credito nos totais para apoiar o indicador de independencia de credito.

## Orcamentos

- Orcamentos sao definidos por mes.
- Podem apontar para categoria ou subcategoria.
- Podem opcionalmente ser especificos de uma conta/carteira (`accountId`) e de um meio de pagamento (`paymentMethodId`).
- A chave logica atual e `budgetMonth + subcategoryId + accountId opcional + paymentMethodId opcional`.
- Exemplos suportados: Flash alimentacao + Supermercado, Flash alimentacao + Delivery, Nubank + Delivery via PIX.
- `PUT /budgets` cria, atualiza ou remove o orcamento do escopo informado.
- Valor zero ou menor remove o orcamento existente.
- `POST /budgets/copy` copia os orcamentos de um mes para outro, substituindo os valores equivalentes no destino.

## Importacao CSV

- A importacao possui duas etapas de API: previa e confirmacao.
- O CSV aceita separadores `,`, `;` e tab.
- A primeira linha deve ser cabecalho.
- A tela mapeia colunas de data, descricao, valor, tipo, categoria, conta e parcelas.
- Datas podem ser interpretadas como DMY, MDY ou YMD.
- Valores aceitam formato brasileiro, americano, simbolo de moeda e parenteses para negativo.
- Na importacao geral, duplicidade considera valor, conta e data proxima em ate tres dias.
- Na importacao de fatura, duplicidade considera cartao, descricao normalizada, valor, data proxima e mes da fatura.
- Itens duplicados aparecem desmarcados na previa e tambem sao ignorados na confirmacao quando `preventDuplicates` esta ativo.
- Importacao de fatura sempre cria despesas de cartao, sem conta e sem meio de pagamento.

## Relatorios

- Relatorios atuais usam os endpoints `/reports/*`.
- Ha resumo de faturas de cartao, evolucao diaria, resumo anual, categorias anuais e participacao por meio de pagamento.
- Filtros principais: mes, ano, conta, meio de pagamento, categoria e subcategoria.
- Relatorios ignoram lancamentos cancelados.
- Resumo anual considera apenas movimentos realizados; evolucao diaria acumulada, categorias anuais e participacao por meio de pagamento ainda incluem `planned` legado como consumo comprometido quando houver esse dado no banco.

## Reservas e backups

- Reservas existem no schema (`reserve_goals` e `reserve_movements`), mas ainda nao possuem API/UI implementadas.
- Backups ainda nao possuem API/UI implementadas.
- OFX ainda nao esta implementado.
