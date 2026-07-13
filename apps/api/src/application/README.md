# Serviços financeiros canônicos

Esta pasta contém casos de uso que coordenam persistência e regras puras de `@finances/domain`. Os handlers HTTP em `modules/` validam a fronteira com Zod antes de chamar estes serviços.

| Serviço | Invariantes principais |
| --- | --- |
| `transfer-service` | agregado e duas pernas mudam atomicamente; contas devem estar ativas; integridade é verificada na leitura |
| `bill-payment-service` | pagamentos são idempotentes por payload, aceitam principal/juros/multa e reversão preserva histórico |
| `recurrence-service` | previsões não persistem fatos; confirmação é única por regra/mês |
| `monthly-overview-service` | separa consumo econômico de caixa e não duplica transferências, pagamentos ou recorrências confirmadas |
| `transaction-import-service` | prévia e confirmação usam o mesmo contrato; confirmação é atômica e referências são validadas |

Regras de cálculo reutilizáveis permanecem em `packages/domain`; acesso ao Drizzle não deve sair desta camada para o domínio.
