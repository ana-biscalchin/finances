# Regras de Negocio: Cartao de Credito

Este documento aprofunda as regras do fluxo de cartao. Para a lista completa de regras do produto, veja [Regras de Negocio](regras-negocio.md).

## Cartao nao movimenta conta na compra

Uma compra no cartao nao reduz saldo de conta no momento da compra.

Compras no cartao devem ficar assim:

- `accountId = null`
- `paymentMethodId = null`
- `creditCardId = <id do cartao>`
- `budgetMonth = mes da fatura`

O dinheiro sai de uma conta apenas quando a fatura e paga.

## Calculo do mes da fatura

O mes de impacto da compra e calculado pelo fechamento do cartao:

- Se o dia da compra for menor que o dia de fechamento, a compra entra na fatura do proprio mes.
- Se o dia da compra for maior ou igual ao dia de fechamento, a compra entra na fatura do mes seguinte.

Exemplo com fechamento no dia 15:

| Data da compra | Fatura |
| --- | --- |
| 10/06/2026 | 2026-06 |
| 15/06/2026 | 2026-07 |
| 20/06/2026 | 2026-07 |

## Faturas

Uma fatura e unica por cartao e mes (`creditCardId` + `billMonth`).

Ao buscar uma fatura por `GET /credit-cards/:id/bills?month=YYYY-MM`:

- se a fatura ja existe, ela e retornada;
- se nao existe, ela e criada;
- fechamento e vencimento sao calculados com os dias configurados no cartao.

O total da fatura soma apenas compras daquele cartao e daquele mes de fatura. Lancamentos de pagamento da fatura ficam ligados a `creditCardBillId`, mas nao a `creditCardId`, justamente para nao entrarem no total da fatura.

## Status

Status persistidos:

- `open`: fatura aberta/nao paga.
- `paid`: fatura paga.

A UI pode exibir "fechada" quando a data atual passou da data de fechamento e a fatura ainda nao foi paga. Isso e um estado visual derivado, nao um status persistido separado.

## Pagamento de fatura

Ao marcar fatura como paga:

1. A UI pergunta qual conta pagou a fatura.
2. A API valida a conta.
3. A API calcula o total da fatura pelas compras do cartao.
4. A fatura recebe `status = paid` e `paidAt`.
5. A API cria ou atualiza um lancamento de despesa representando a saida da conta.

O lancamento de pagamento:

- usa `accountId` da conta escolhida;
- usa o meio padrao da conta, se existir;
- usa a subcategoria `Movimentacoes Internas > Pagamento de fatura`, se existir;
- usa `eventDate = dueDate` da fatura;
- usa `budgetMonth = mes do vencimento`;
- usa `creditCardBillId = id da fatura`;
- deixa `creditCardId = null`.

Essa modelagem evita duplicar as compras no total da fatura, mas permite que o resumo por conta mostre a saida real do dinheiro.

Se a mesma fatura for marcada como paga novamente, o lancamento de pagamento existente e atualizado; nao e criado outro.

## Controle mensal

No controle mensal:

- faturas abertas com vencimento no mes entram em `Pagamento de fatura` como comprometidas;
- faturas pagas com vencimento no mes entram como realizadas;
- o resumo por conta mostra a saida somente quando ha lancamento de pagamento;
- compras do cartao continuam sendo analisadas por categoria no mes da fatura.

## Parcelamento manual

Quando um lancamento de cartao e criado com `installmentCount > 1`:

- o valor total e dividido pelo numero de parcelas;
- a ultima parcela recebe eventual resto de centavos;
- cada parcela vira um lancamento separado;
- a descricao recebe `(1/N)`, `(2/N)` etc.;
- cada parcela avanca um mes de fatura.

## Importacao de fatura

Na importacao de fatura:

- todas as linhas viram despesas de cartao;
- a fatura aberta na tela define o cartao e o mes inicial;
- compras fora do mes da fatura aberta sao ignoradas na previa;
- colunas `Parcela` e `TotalParcelas` podem gerar parcelas futuras;
- coluna combinada `2/3` ou `2 de 3` tambem e aceita;
- duplicatas sao desmarcadas na previa e ignoradas na confirmacao.

Exemplo: uma linha `2/3` importa a parcela `2/3` na fatura aberta e gera `3/3` na proxima fatura. A parcela `1/3` nao e criada porque pertence a uma fatura anterior.

## Cartoes

Campos principais:

- Nome.
- Instituicao opcional.
- Dia de fechamento.
- Dia de vencimento.
- Conta padrao de pagamento opcional.
- Limite opcional.
- Status ativo/inativo.

Cartoes sao arquivados, nao excluidos. Arquivar remove das listas padrao e preserva historico.
