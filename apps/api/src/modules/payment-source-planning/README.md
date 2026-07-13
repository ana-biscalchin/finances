# Planejamento por origem

Este módulo persiste e consulta o planejamento mensal distribuído entre contas e cartões. O total continua pertencendo à subcategoria; as alocações apenas indicam a origem pretendida.

Invariantes: conta ou cartão, nunca ambos; soma distribuída menor ou igual ao total; origens novas precisam estar ativas; transferências e pagamentos de fatura não realizam orçamento. As regras puras e contratos ficam em `@finances/domain`; esta camada coordena SQLite e expõe resultados à borda HTTP.
