# Regras de negócio

Esta é a referência canônica das regras financeiras atuais da Carteira da Ana.

## Visão do mês e orçamento

- A construção inicial é mensal, com evolução patrimonial de longo prazo no backlog.
- O orçamento tem uma única alocação por mês e subcategoria. Não varia por conta nem por meio de pagamento.
- A interface mostra **planejado**, **gasto**, **disponível** e **acima do planejado**. `Comprometido` não é indicador principal.
- `disponível = max(planejado - gasto, 0)` e `acima do planejado = max(gasto - planejado, 0)`.
- Valor zero remove uma alocação, mediante confirmação na interface.
- Compras parceladas consomem o orçamento pela parcela no mês da fatura. A data original da compra é preservada para análises.
- Transferências e pagamentos de fatura não contam novamente como gasto.
- A API canônica é `GET /monthly-overview?month=YYYY-MM` e `PUT /monthly-budgets`.

## Dinheiro nas contas

- Conta representa onde existe saldo. O saldo atual parte do saldo inicial e soma os lançamentos realizados.
- Receitas, reembolsos e estornos aumentam o saldo; despesas o reduzem.
- `GET /cash-position?month=YYYY-MM` mostra saldo atual, previsões recorrentes, faturas e saldo esperado por conta.
- Recorrências futuras são previsões: não alteram saldo nem gasto até serem confirmadas.
- A data-base explícita do saldo inicial permanece no backlog.

## Lançamentos e categorias

- Valores são inteiros em centavos positivos; o tipo define a direção econômica.
- Datas de negócio usam `YYYY-MM-DD`; meses usam `YYYY-MM`.
- Tipos: `income`, `expense`, `refund` e `chargeback`.
- Lançamentos manuais e importados são realizados (`confirmed`) por padrão. `canceled` não entra em saldos ou agregações.
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

- Regras mensais podem apontar para conta ou cartão e podem ser pausadas, retomadas ou encerradas.
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
- Google Drive é opcional e usa a pasta `Carteira da Ana`.
- Relatórios comparativos, orientação de decisão, patrimônio, reservas completas, dívidas e rentabilidade são backlog.
