# Regras de negócio

Esta é a referência canônica das regras financeiras atuais da Carteira da Ana.

## Visão do mês e orçamento

- A construção inicial é mensal, com evolução patrimonial de longo prazo no backlog.
- O orçamento é composto por alocações de `mês + subcategoria + conta + forma de pagamento` ou de `mês + subcategoria + cartão de crédito`.
- Somente subcategorias de natureza `expense` aceitam orçamento e aparecem no detalhamento orçado; categorias de receita alimentam os indicadores de entrada, nunca os de gasto.
- O total planejado da subcategoria e do mês é sempre a soma das alocações; não existe um total paralelo ou valor sem origem.
- Conta e forma são granulares: Nubank · Pix, Nubank · Débito e Nubank · Boleto podem ter valores planejados e realizados independentes.
- A interface mostra **planejado**, **gasto**, **disponível** e **acima do planejado**. `Comprometido` não é indicador principal.
- `disponível = max(planejado - gasto, 0)` e `acima do planejado = max(gasto - planejado, 0)`.
- Uma alocação exige valor positivo; removê-la do conjunto salvo remove seu planejamento.
- Compras parceladas consomem o orçamento pela parcela no mês da fatura. A data original da compra é preservada para análises.
- Transferências entre contas próprias aparecem em uma seção separada do painel e não alteram orçamento, gasto, receita ou disponível.
- Pagamentos de fatura não contam novamente como gasto.
- As APIs canônicas são `GET /monthly-overview?month=YYYY-MM`, `PUT /monthly-budget-allocations` e `POST /monthly-budget-allocations/copy`.
- Entradas são planejadas separadamente do orçamento por `mês + subcategoria de receita + conta de destino` por meio de `PUT /monthly-income-plans`.
- O painel concilia receitas confirmadas/conciliadas como recebido e mostra previsto, a receber, acima do previsto e entrada não planejada.

## Dinheiro nas contas

- Conta representa onde existe saldo. Pix, débito e pré-pago são formas associadas à conta e não carregam saldo próprio.
- Flash Alimentação e Flash Conveniência são contas de benefício independentes; o saldo não usado permanece para o mês seguinte.
- Uma conta pode aceitar várias formas ativas e ter no máximo uma forma padrão.
- O saldo atual parte do saldo inicial e soma os lançamentos realizados.
- Receitas, reembolsos e estornos aumentam o saldo; despesas o reduzem.
- Lançamentos `planned` não alteram o saldo atual: receitas previstas aumentam o saldo esperado e despesas previstas o reduzem.
- O restante das entradas planejadas aumenta o saldo esperado da conta de destino; previsão explícita, recorrência e lançamento previsto equivalentes não são somados em duplicidade.
- Na projeção, uma despesa prevista e o orçamento restante da mesma categoria representam o mesmo compromisso; vale o maior dos dois, sem dupla contagem.
- `GET /cash-position?month=YYYY-MM` separa entradas livres, benefícios, plano direto restante, compras esperadas no cartão, faturas e saldo esperado por conta.
- Recorrências futuras são previsões: não alteram saldo nem gasto até serem confirmadas.
- A data-base explícita do saldo inicial permanece no backlog.

## Lançamentos e categorias

- Valores são inteiros em centavos positivos; o tipo define a direção econômica.
- Datas de negócio usam `YYYY-MM-DD`; meses usam `YYYY-MM`.
- Tipos: `income`, `expense`, `refund` e `chargeback`.
- `income` aceita somente categoria de receita; `expense`, `refund` e `chargeback` aceitam somente categoria de despesa.
- Lançamentos manuais e importados são realizados (`confirmed`) por padrão. `canceled` não entra em saldos ou agregações.
- Despesa de consumo em conta exige uma forma ativa associada. Compra no cartão usa somente o cartão.
- Categorias e subcategorias usam IDs internos, podem ser renomeadas e preservam o histórico.
- Exclusão de lançamento é definitiva. Arquivamento de cadastros continua restaurável quando aplicável.
- O escopo monetário atual é exclusivamente BRL.

## Transferências

- Transferências são agregados próprios em `account_transfers`, criados por `POST /transfers`.
- Origem e destino devem ser contas ativas diferentes e o valor deve ser positivo.
- A operação cria duas pernas atômicas: saída na origem e entrada no destino, ambas ligadas por `transferId`.
- Criar, editar ou excluir é transacional: as duas pernas mudam juntas ou nenhuma muda.
- Transferências movimentam caixa, mas nunca representam receita ou despesa econômica.

## Cartões, faturas e parcelas

- Compra no cartão não movimenta conta: usa `creditCardId` e deixa `accountId` e `paymentMethodId` vazios.
- A data da compra é preservada; o `budgetMonth` é o mês da fatura calculado pelo fechamento do cartão.
- Parcelamentos geram uma transação por parcela e eventual diferença de centavos fica na última.
- A fatura pode receber múltiplos pagamentos parciais, principal, juros e multa.
- Cada pagamento exige conta, data e chave idempotente; movimenta caixa sem duplicar o gasto já reconhecido nas compras.
- Reversão é explícita e preserva histórico. Após pagamento, campos financeiros da fatura ficam bloqueados; apenas nome e categoria das compras podem mudar.
- Situações derivadas incluem aberta, parcial, mínimo atingido, paga e atrasada.
- Dívidas fora de cartão e investimentos/rentabilidade permanecem no backlog.

## Recorrências

- Regras mensais podem apontar para conta+forma ou cartão e podem ser pausadas, retomadas ou encerradas.
- Uma previsão não cria transação. A confirmação cria no máximo uma ocorrência real por regra e mês.
- Dia 29–31 é ajustado ao último dia do mês.
- No cartão, a ocorrência confirmada entra na fatura calculada; parcelamentos não são recorrências.
- Alterações de série preservam fatos passados.

## Importação CSV

- O fluxo padrão é simples: arquivo, prévia/revisão e confirmação.
- Categoria é opcional e pode ser corrigida depois ou em lote na revisão.
- Duplicatas determinísticas começam desmarcadas e são ignoradas na confirmação.
- A confirmação reutiliza as mesmas validações da criação manual e é atômica.
- Não existe conciliação bancária robusta no escopo atual; assistência por IA e OFX ficam para evolução futura.

## Backups e evolução

- Backups locais podem ser criados, listados, restaurados e excluídos na API e na interface.
- A restauração valida o arquivo e cria um ponto de segurança antes de substituir o estado atual.
- Google Drive existe apenas no protótipo local legado e será retirado do release online inicial; uma eventual reintrodução fica no backlog.
- Relatórios comparativos, orientação de decisão, patrimônio, reservas completas, dívidas e rentabilidade são backlog.
