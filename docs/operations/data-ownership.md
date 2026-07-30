# Matriz de propriedade dos dados

Toda autorização financeira parte de `RequestContext.ownerId`, resolvido pela sessão. IDs enviados pelo cliente nunca definem a proprietária. Recursos fora do escopo recebem a mesma resposta de recursos inexistentes.

| Tabela                      | Estratégia                               | Raiz usada na autorização                                           |
| --------------------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| `users`                     | identidade                               | própria usuária                                                     |
| `sessions`                  | herdada                                  | `sessions.user_id -> users.id`                                      |
| `accounts`                  | direta, `owner_id NOT NULL`              | `accounts.owner_id`                                                 |
| `payment_methods`           | catálogo global sem dados pessoais       | não aplicável                                                       |
| `account_payment_methods`   | herdada                                  | `account_id -> accounts.owner_id`                                   |
| `categories`                | direta, `owner_id NOT NULL`              | `categories.owner_id`                                               |
| `subcategories`             | herdada                                  | `category_id -> categories.owner_id`                                |
| `credit_cards`              | direta, `owner_id NOT NULL`              | `credit_cards.owner_id`                                             |
| `credit_card_bills`         | herdada                                  | `credit_card_id -> credit_cards.owner_id`                           |
| `account_transfers`         | direta, `owner_id NOT NULL`              | `account_transfers.owner_id`                                        |
| `recurrence_rules`          | direta, `owner_id NOT NULL`              | `recurrence_rules.owner_id`                                         |
| `transactions`              | direta, `owner_id NOT NULL`              | `transactions.owner_id`                                             |
| `credit_card_bill_payments` | direta, `owner_id NOT NULL`              | `credit_card_bill_payments.owner_id`                                |
| `installment_purchases`     | herdada                                  | `credit_card_id -> credit_cards.owner_id`                           |
| `installments`              | herdada                                  | compra, lançamento e fatura já autorizados pelas respectivas raízes |
| `reserve_goals`             | direta, `owner_id NOT NULL`              | `reserve_goals.owner_id`                                            |
| `reserve_movements`         | herdada                                  | `reserve_goal_id -> reserve_goals.owner_id`                         |
| `planned_expenses`          | direta, `owner_id NOT NULL`              | `planned_expenses.owner_id`                                         |
| `settings`                  | direta, chave primária `(owner_id, key)` | `settings.owner_id`                                                 |

## Invariantes de acesso

- Listagens, agregações e mutações das raízes incluem `ownerId` obrigatório.
- Filhos são lidos ou alterados somente após join ou resolução de uma raiz da mesma proprietária.
- Referências cruzadas — conta, cartão, fatura, categoria/subcategoria, recorrência e origem de pagamento — são validadas no mesmo escopo antes da escrita.
- Nomes de categoria e chaves de idempotência usam unicidade composta por proprietária; o mesmo valor pode existir para duas identidades.
- Importações criam lançamentos com a proprietária do contexto e não aceitam `ownerId` do arquivo.
- `payment_methods` é um catálogo sem CRUD de usuária e sem conteúdo financeiro; associações com contas herdam a propriedade da conta.

A matriz IDOR automatizada cobre contas, categorias e subcategorias, cartões e faturas, lançamentos, transferências, recorrências, planejamentos, relatórios, configurações e idempotência de pagamentos usando duas identidades. O gate PostgreSQL repete a verificação de referência filha não enumerável no banco-alvo.
