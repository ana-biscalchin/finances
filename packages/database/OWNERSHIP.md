# Matriz de propriedade financeira

Esta matriz define o escopo de `ownerId` para T6–T8. `users.id` é simultaneamente a identidade e a raiz proprietária do primeiro release; não existe proprietário anônimo ou default global.

| Tabela                      | Propriedade                                       | Motivo                                                           |
| --------------------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| `users`                     | identidade                                        | raiz da propriedade                                              |
| `sessions`                  | herdada por `user_id`                             | nunca contém dados financeiros                                   |
| `payment_methods`           | global                                            | taxonomia fixa/semeada, sem CRUD por usuária                     |
| `accounts`                  | direta                                            | raiz financeira e consulta independente                          |
| `account_payment_methods`   | herdada por `account_id`                          | associação sempre autorizada pela conta                          |
| `categories`                | direta                                            | raiz gerenciável                                                 |
| `subcategories`             | herdada por `category_id`                         | sempre pertence à categoria                                      |
| `credit_cards`              | direta                                            | raiz financeira                                                  |
| `credit_card_bills`         | herdada por `credit_card_id`                      | pertence ao cartão                                               |
| `account_transfers`         | direta                                            | agregado consultado independentemente                            |
| `recurrence_rules`          | direta                                            | raiz de planejamento                                             |
| `transactions`              | direta                                            | consultada e agregada diretamente                                |
| `credit_card_bill_payments` | herdada por `bill_id`                             | pertence à fatura                                                |
| `installment_purchases`     | herdada por `credit_card_id`                      | pertence ao cartão                                               |
| `installments`              | herdada por `installment_purchase_id` e transação | não é raiz                                                       |
| `reserve_goals`             | direta                                            | raiz financeira futura                                           |
| `reserve_movements`         | herdada por `reserve_goal_id`                     | pertence à reserva                                               |
| `planned_expenses`          | direta                                            | raiz mensal de planejamento                                      |
| `settings`                  | direta                                            | configuração por proprietária; chave única por `(owner_id, key)` |

## Regras de migration

- Colunas diretas são `NOT NULL` e referenciam `users.id`.
- Não existe valor default de `ownerId` no banco ou na aplicação.
- Um banco vazio pode receber o schema diretamente.
- Um SQLite com dados somente pode ser atualizado com uma usuária bootstrap explicitamente selecionada por nome; ausência, ambiguidade ou falha de FK aborta toda a operação.
- A atribuição ao owner ocorre em transação e é validada antes de tornar as colunas obrigatórias.
- Filhos sem `ownerId` são autorizados por join obrigatório até sua raiz proprietária.
- Unicidades gerenciáveis deixam de ser globais e começam pelo proprietário.
