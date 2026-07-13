# Tasks — Fundação mensal da Carteira da Ana

**Design:** `.specs/features/monthly-foundation/design.md`  ·  **Spec:** `.specs/features/monthly-foundation/spec.md`
**Status:** in progress

> Cada task de produção usa `ana-tdd` no Execute: RED → GREEN → REFACTOR. Cada task é salva por
> `ana-commit`; nenhuma implementação ocorre diretamente na branch principal.

---

## Plano de execução

```text
Fase 1 — Fundação destrutiva:
T1 → T2

Fase 2 — Domínio e persistência sequenciais:
T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9

Fase 3 — Contratos e frontend:
T9 → T10 → T11 ─┬─ T12 [P]
                ├─ T13 [P]
                ├─ T14 [P]
                ├─ T15 [P]
                └─ T16 [P]

Fase 4 — Integração:
T12,T13,T14,T15,T16 → T17 → T18 → T19
```

`[P]` indica entrega frontend independente depois da estabilização dos contratos compartilhados.

---

## Fase 1 — Fundação destrutiva

### T1: Criar contratos financeiros canônicos

- **O quê:** criar tipos e schemas Zod compartilhados para mês, dinheiro, orçamento, transferência, pagamento de fatura, recorrência e importação.
- **Onde:** `packages/domain/src/contracts.ts`, `packages/domain/src/contracts.test.ts`, `packages/domain/src/index.ts`
- **Depende de:** nenhuma
- **Reusa:** `money.ts`, `dates.ts`, `transactions.ts`, `financial-classification.ts`
- **Requisito:** MON-01, CASH-01, TRF-01, BILL-01, REC-01, IMP-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [x] Schemas rejeitam centavos fracionários/não positivos, datas e meses inválidos e destinos incompatíveis.
  - [x] Tipos públicos são derivados dos schemas e exportados sem `any` ou cast de validação.
  - [x] Teste: `contracts.test.ts` cobre contratos válidos e inválidos; gate passa com 100% de cobertura no código novo.
  - [x] Constituição: respeita `ana-standards/references/coding-style.md#4-contratos-de-dados-via-schema-na-fronteira`.
- **Testes:** unit
- **Gate:** rápido
- **Commit:** `feat(domain): define canonical financial contracts`

### T2: Recriar o schema financeiro do protótipo

- **O quê:** implementar a migration destrutiva com `budgets` simplificado, `account_transfers`, `credit_card_bill_payments`, `recurrence_rules` e novas referências em transações/faturas.
- **Onde:** `packages/database/src/schema.ts`, `packages/database/drizzle/`, `packages/database/src/migration-integrity.ts`, testes do pacote database
- **Depende de:** T1
- **Reusa:** conexão SQLite, backup online e padrões de índices/constraints existentes.
- **Requisito:** MON-01, TRF-01, BILL-01, REC-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [x] Migration cria backup e valida integridade antes de recriar tabelas.
  - [x] Constraints garantem chaves únicas, valores válidos e referências necessárias.
  - [x] Dados determinísticos são preservados; dados ambíguos descartados aparecem em relatório explícito.
  - [x] Falha em qualquer validação interrompe a migração e mantém caminho de restauração.
  - [x] Teste: migration em banco temporário cobre sucesso, descarte relatado e rollback; gate `pnpm --filter @finances/database test` passa com cobertura ≥ 80% do código novo.
  - [x] Constituição: respeita `ana-standards/references/testing.md` e `ana-standards/references/error-handling.md`.
- **Testes:** integração SQLite isolada
- **Gate:** completo do pacote
- **Commit:** `feat(database): rebuild financial schema`

---

## Fase 2 — Domínio e API

### T3: Implementar o domínio de transferências

- **O quê:** criar funções puras que validam, constroem e atualizam o agregado de transferência e suas duas pernas.
- **Onde:** `packages/domain/src/transfers.ts`, `packages/domain/src/transfers.test.ts`, `packages/domain/src/index.ts`
- **Depende de:** T2
- **Reusa:** contratos T1, datas e classificação financeira.
- **Requisito:** TRF-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [x] Origem igual ao destino, valor inválido ou par divergente são rejeitados.
  - [x] O agregado produz exatamente uma saída e uma entrada economicamente neutras.
  - [x] Teste: `transfers.test.ts` cobre criação, edição e invariantes; gate do domínio passa com cobertura ≥ 80%.
  - [x] Constituição: respeita `ana-standards/references/coding-style.md#2-arquitetura-em-camadas`.
- **Testes:** unit
- **Gate:** rápido
- **Commit:** `feat(domain): model account transfers`

### T4: Expor transferências atômicas na API

- **O quê:** implementar service e endpoints de criar, editar, atualizar metadados e excluir transferências em uma única transação SQLite.
- **Onde:** `apps/api/src/application/transfer-service.ts`, `apps/api/src/modules/transfers.ts`, `apps/api/src/transfers.test.ts`, `apps/api/src/server.ts`
- **Depende de:** T3
- **Reusa:** `db.transaction`, `ValidationError`, `sendPayloadError` e contratos T1.
- **Requisito:** TRF-01, CASH-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [x] Falha simulada na segunda perna não persiste agregado nem primeira perna.
  - [x] Criar, editar e excluir atualizam os dois saldos sem gerar consumo.
  - [x] API retorna 400/404/409 para validação, ausência e conflito; erros inesperados propagam com contexto.
  - [x] Teste: `transfers.test.ts` cobre atomicidade, saldos e erros; gate da API passa com cobertura ≥ 80% do código novo.
  - [x] Constituição: respeita `ana-standards/references/error-handling.md`.
- **Testes:** integração API + SQLite isolado
- **Gate:** completo do pacote
- **Commit:** `feat(api): add atomic account transfers`

### T5: Implementar o domínio de pagamentos de fatura

- **O quê:** calcular total, principal pago, encargos, saldo restante, mínimo atendido e situação derivada da fatura.
- **Onde:** `packages/domain/src/bill-payments.ts`, `packages/domain/src/bill-payments.test.ts`, `packages/domain/src/index.ts`
- **Depende de:** T4
- **Reusa:** regras atuais de fatura, dinheiro e datas.
- **Requisito:** BILL-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [x] Estados `open`, `partial`, `paid` e `overdue` são derivados sem sobreposição.
  - [x] Principal, juros e multa são separados e pagamento acima do saldo é rejeitado.
  - [x] Reversão deixa de considerar o pagamento sem apagar seu histórico.
  - [x] Teste: `bill-payments.test.ts` cobre parcial, mínimo, final, atraso, encargos, excesso e reversão; gate do domínio passa com cobertura ≥ 80%.
  - [x] Constituição: respeita `ana-standards/references/testing.md`.
- **Testes:** unit
- **Gate:** rápido
- **Commit:** `feat(domain): model credit card bill payments`

### T6: Expor pagamentos de fatura atômicos na API

- **O quê:** substituir o pagamento único inferido por endpoints de múltiplos pagamentos e reversão, usando data real e movimentos separados de encargos.
- **Onde:** `apps/api/src/application/bill-payment-service.ts`, `apps/api/src/modules/credit-cards.ts`, `apps/api/src/credit-card-payments.test.ts`
- **Depende de:** T5
- **Reusa:** transações SQLite, contas, categorias internas e contratos T1.
- **Requisito:** BILL-01, CASH-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [ ] Pagamento parcial, mínimo e final atualizam fatura e conta atomicamente pela data informada.
  - [ ] Juros e multa geram despesas explícitas sem alterar compras originais.
  - [ ] Retry com a mesma chave de idempotência não duplica pagamento.
  - [ ] Reversão preserva histórico e restaura saldo/situação na mesma transação.
  - [ ] Teste: `credit-card-payments.test.ts` cobre falhas intermediárias, idempotência e cálculos; gate da API passa com cobertura ≥ 80%.
  - [ ] Constituição: respeita `ana-standards/references/error-handling.md` e `testing.md`.
- **Testes:** integração API + SQLite isolado
- **Gate:** completo do pacote
- **Commit:** `feat(api): support partial bill payments`

### T7: Bloquear mutações financeiras após pagamento

- **O quê:** separar endpoint de metadados e rejeitar mudanças financeiras em compras de fatura fechada ou com pagamento ativo.
- **Onde:** `apps/api/src/modules/credit-cards.ts`, `apps/api/src/transactions.test.ts`, `apps/api/src/credit-card-payments.test.ts`
- **Depende de:** T6
- **Reusa:** serviço de pagamento e validação de referências.
- **Requisito:** BILL-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [ ] Descrição, subcategoria e observações continuam editáveis.
  - [ ] Valor, data, tipo, cartão, fatura, competência e parcela retornam 409.
  - [ ] Após reversão de todos os pagamentos, correção financeira volta a ser permitida conforme estado da fatura.
  - [ ] Teste: testes atuais que permitiam alteração financeira são substituídos pelos novos contratos; gate da API passa sem queda na contagem de testes.
  - [ ] Constituição: respeita `ana-standards/references/surgical-edits.md` e `error-handling.md`.
- **Testes:** integração API
- **Gate:** completo do pacote
- **Commit:** `fix(api): lock paid bill financial fields`

### T8: Implementar previsões recorrentes

- **O quê:** criar domínio e API de regras mensais, previsão em leitura e confirmação idempotente de ocorrências em conta ou cartão.
- **Onde:** `packages/domain/src/recurrences.ts`, testes de domínio, `apps/api/src/application/recurrence-service.ts`, `apps/api/src/modules/recurrences.ts`, testes da API
- **Depende de:** T7
- **Reusa:** datas, cálculo do mês da fatura, contratos T1 e transações reais.
- **Requisito:** REC-01, CASH-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [ ] Previsão futura não cria transação nem gasto.
  - [ ] Confirmação cria uma única ocorrência real por regra/mês e cartão associa à fatura correta.
  - [ ] Dia 29–31 ajusta para o último dia sem conversão UTC.
  - [ ] Pausa, retomada, encerramento e `esta e as próximas` preservam fatos passados.
  - [ ] Parcelamentos não são tratados como recorrências.
  - [ ] Teste: domínio e API cobrem conta, cartão, idempotência e estados da série; gates dos pacotes passam com cobertura ≥ 80% do código novo.
  - [ ] Constituição: respeita `ana-standards/references/coding-style.md` e `testing.md`.
- **Testes:** unit + integração API isolada
- **Gate:** completo dos pacotes
- **Commit:** `feat(finances): add recurring forecasts`

### T9: Criar APIs mensais canônicas

- **O quê:** separar `GET /monthly-overview` e `GET /cash-position`, simplificar orçamento por subcategoria e centralizar cálculos no domínio.
- **Onde:** `packages/domain/src/monthly-overview.ts`, testes de domínio, `apps/api/src/application/monthly-overview-service.ts`, `apps/api/src/modules/budgets.ts`, `apps/api/src/budgets.test.ts`
- **Depende de:** T8
- **Reusa:** classificação financeira, transferências, pagamentos, recorrências e parcelas.
- **Requisito:** MON-01, CASH-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [ ] Visão mensal retorna planejado, gasto, disponível e valor acima do planejado por subcategoria/categoria.
  - [ ] Parcela consome o mês da fatura; pagamento e transferência não duplicam gasto.
  - [ ] Caixa retorna saldo atual, previsões recorrentes, faturas e saldo esperado por conta.
  - [ ] Edição de orçamento usa chave única mês + subcategoria e zero remove com contrato explícito.
  - [ ] Teste: domínio e `budgets.test.ts` cobrem consumo, caixa, parcelas, recorrências e ausência de duplicidade; gates passam com cobertura ≥ 80%.
  - [ ] Constituição: respeita `ana-standards/references/coding-style.md#2-arquitetura-em-camadas`.
- **Testes:** unit + integração API
- **Gate:** completo dos pacotes
- **Commit:** `feat(api): expose monthly financial views`

### T10: Simplificar e validar a importação

- **O quê:** reutilizar o contrato de criação na confirmação, manter prévia e duplicidade simples e remover matching do fluxo canônico.
- **Onde:** `apps/api/src/application/transaction-import-service.ts`, `apps/api/src/modules/transactions.ts`, `apps/api/src/transactions.test.ts`, `packages/domain/src/reconciliation.ts` quando removido
- **Depende de:** T9
- **Reusa:** parser CSV, contratos T1, criação normal e metadados de parcelas.
- **Requisito:** IMP-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [ ] Confirm direto rejeita os mesmos dados inválidos da criação manual.
  - [ ] Prévia não exige categoria e identifica duplicidade por regra determinística documentada.
  - [ ] Resposta informa criados, duplicados ignorados e inválidos.
  - [ ] Confirmação é atômica e uma falha não importa subconjunto silenciosamente.
  - [ ] Teste: importação geral e de fatura cobre validação, parcelas e duplicidade; gate da API passa com cobertura ≥ 80%.
  - [ ] Constituição: respeita `ana-standards/references/coding-style.md#4-contratos-de-dados-via-schema-na-fronteira`.
- **Testes:** integração API
- **Gate:** completo do pacote
- **Commit:** `refactor(api): simplify transaction imports`

---

## Fase 3 — Frontend

### T11: Criar cliente e contratos compartilhados do frontend

- **O quê:** centralizar URL, timeout, parsing Zod, erros HTTP e tipos usados pelas novas telas.
- **Onde:** `apps/web/src/app/shared/api-client.ts`, `apps/web/src/app/shared/api-contracts.ts`, testes compartilhados
- **Depende de:** T10
- **Reusa:** `errors.ts`, contratos T1 e tipos hoje duplicados.
- **Requisito:** MON-01, CASH-01, TRF-01, BILL-01, REC-01, IMP-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [ ] Resposta inválida falha explicitamente e nunca vira zero/lista vazia.
  - [ ] GET tem timeout e retry transitório limitado; mutações não repetem automaticamente.
  - [ ] Teste: cliente cobre sucesso, payload inválido, timeout, retry GET e ausência de retry POST; gate web passa com cobertura ≥ 80% do código novo.
  - [ ] Constituição: respeita `ana-standards/references/error-handling.md`.
- **Testes:** unit
- **Gate:** rápido
- **Commit:** `refactor(web): centralize API contracts`

### T12: Construir a Visão do mês [P]

- **O quê:** substituir a visão de competência por resumo simples, tabela de categorias e orçamento inline.
- **Onde:** `apps/web/src/app/monthly-control/MonthlyOverviewPage.tsx`, `MonthAtGlance.tsx`, `MonthlyHealthSummary.tsx`, `BudgetCategoryTable.tsx`, `InlineBudgetAmount.tsx`, testes
- **Depende de:** T11
- **Reusa:** `MonthSelector`, campos rápidos, formatação de dinheiro e endpoint T9.
- **Requisito:** MON-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [ ] Tela mostra planejado, gasto e disponível, com `Acima do planejado` como situação visual.
  - [ ] Edição inline salva de forma pessimista; erro mantém valor anterior; zero pede confirmação.
  - [ ] Estado vazio diferencia ausência de dados de falha e oferece ações contextuais.
  - [ ] Teste: componentes cobrem edição, erro, remoção e estados visuais; gate web passa com cobertura ≥ 80% do código novo.
  - [ ] Constituição: respeita `ana-standards/references/testing.md` e `surgical-edits.md`.
- **Testes:** unit/component
- **Gate:** completo do pacote
- **Commit:** `feat(web): simplify monthly overview`

### T13: Construir Dinheiro nas contas [P]

- **O quê:** unificar saldo, previsões, faturas e risco de saldo negativo em componentes reutilizáveis.
- **Onde:** `apps/web/src/app/monthly-control/AccountsCashView.tsx`, `CashPositionSummary.tsx`, `AccountBalanceTable.tsx`, `UpcomingCashCommitments.tsx`, testes
- **Depende de:** T11
- **Reusa:** `CashMonthlyView`, tabela/projeção atual, `MonthSelector` e endpoint T9.
- **Requisito:** CASH-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [ ] Cada conta mostra saldo atual, entradas/saídas previstas, faturas e saldo esperado.
  - [ ] Recorrências futuras aparecem como previsão; compras e pagamentos não são duplicados.
  - [ ] Detalhes são acessíveis por clique/teclado e não dependem apenas de hover.
  - [ ] Teste: componentes cobrem projeção, saldo negativo, carregamento, vazio e erro; gate web passa com cobertura ≥ 80%.
  - [ ] Constituição: respeita `ana-standards/references/testing.md`.
- **Testes:** unit/component
- **Gate:** completo do pacote
- **Commit:** `feat(web): add accounts cash view`

### T14: Atualizar faturas na interface [P]

- **O quê:** adaptar a tela de fatura para múltiplos pagamentos, encargos, histórico e metadados bloqueados.
- **Onde:** `apps/web/src/app/cards/BillsPage.tsx`, novos componentes de pagamento, testes
- **Depende de:** T11
- **Reusa:** `BusinessDateInput`, `CategorySelect`, formulários e listagens existentes.
- **Requisito:** BILL-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [ ] Fatura mostra saldo, mínimo, encargos, situação e histórico de pagamentos.
  - [ ] Formulário exige conta, data e componentes do pagamento; campos financeiros bloqueados não são editáveis.
  - [ ] Teste: componentes cobrem parcial, reversão, bloqueio e erros; gate web passa com cobertura ≥ 80%.
  - [ ] Constituição: respeita `ana-standards/references/coding-style.md` e `testing.md`.
- **Testes:** unit/component
- **Gate:** completo do pacote
- **Commit:** `feat(web): manage credit card payments`

### T15: Construir a gestão de recorrências [P]

- **O quê:** criar interface mensal para regras, previsões e confirmação de ocorrências recorrentes.
- **Onde:** `apps/web/src/app/recurrences/`, testes de componentes
- **Depende de:** T11
- **Reusa:** `BusinessDateInput`, `CategorySelect`, `MonthSelector` e API T8.
- **Requisito:** REC-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [ ] Regra de conta ou cartão pode ser criada, pausada, retomada e encerrada.
  - [ ] Previsões são visualmente distintas de gastos e parcelas.
  - [ ] Confirmação de ocorrência mostra seu impacto na conta ou fatura correta.
  - [ ] Teste: componentes cobrem previsão, confirmação, pausa e distinção de parcela; gate web passa com cobertura ≥ 80%.
  - [ ] Constituição: respeita `ana-standards/references/coding-style.md` e `testing.md`.
- **Testes:** unit/component
- **Gate:** completo do pacote
- **Commit:** `feat(web): manage recurring forecasts`

### T16: Construir a importação simples [P]

- **O quê:** substituir o fluxo padrão por diálogo de dois passos com revisão e edição em lote.
- **Onde:** `apps/web/src/app/transactions/SimpleCsvImportDialog.tsx`, `CsvFileStep.tsx`, `ImportReviewTable.tsx`, hook de importação, testes
- **Depende de:** T11
- **Reusa:** `csv-utils.ts`, `applyImportPreviewBulkEdits`, `CategorySelect` e API T10.
- **Requisito:** IMP-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [ ] Arquivo com mapeamento detectável vai diretamente à revisão.
  - [ ] Linhas podem ser corrigidas, selecionadas e ajustadas em lote; categoria é opcional.
  - [ ] Duplicatas começam desmarcadas e resultado exibe contagens verificáveis.
  - [ ] Falha de confirmação mantém a revisão e não reenvia automaticamente.
  - [ ] Teste: componentes cobrem autodetecção, revisão, duplicidade, sucesso e falha; gate web passa com cobertura ≥ 80%.
  - [ ] Constituição: respeita `ana-standards/references/error-handling.md` e `testing.md`.
- **Testes:** unit/component
- **Gate:** completo do pacote
- **Commit:** `refactor(web): simplify CSV import`

---

## Fase 4 — Integração e remoção do legado

### T17: Integrar navegação e identidade

- **O quê:** conectar as novas telas no shell, usar `Carteira da Ana` e organizar Visão do mês, Dinheiro nas contas e Patrimônio futuro.
- **Onde:** `apps/web/src/app/App.tsx`, navegação e testes do shell
- **Depende de:** T12, T13, T14, T15, T16
- **Reusa:** estado de mês e layout atuais.
- **Requisito:** UX-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [ ] Cabeçalho usa `Carteira da Ana`.
  - [ ] Visão do mês e Dinheiro nas contas são acessíveis por nomes orientados à tarefa.
  - [ ] Patrimônio aparece explicitamente como futuro, sem tela falsa de capacidade pronta.
  - [ ] Teste: shell cobre navegação, mês compartilhado e módulos futuros; gate web passa com cobertura ≥ 80%.
  - [ ] Constituição: respeita `ana-standards/references/surgical-edits.md`.
- **Testes:** unit/component
- **Gate:** completo do pacote
- **Commit:** `feat(web): align product navigation`

### T18: Remover contratos e código legados

- **O quê:** apagar conciliação obrigatória, orçamento por fonte/meio, pagamento inferido, rotas antigas e duplicações substituídas.
- **Onde:** módulos API/web legados, exports, testes e schema já substituídos
- **Depende de:** T17
- **Reusa:** implementações canônicas T2–T17.
- **Requisito:** MON-01, TRF-01, BILL-01, IMP-01, UX-01
- **Ferramentas:** Skill `ana-tdd`
- **Pronto quando:**
  - [ ] Busca no repo não encontra rotas/tipos/componentes legados declarados no Design.
  - [ ] Nenhum teste foi silenciosamente apagado; comportamentos substituídos têm cobertura equivalente.
  - [ ] Gate `pnpm check` passa e cobertura do código alterado permanece ≥ 80%.
  - [ ] Constituição: respeita `ana-standards/references/surgical-edits.md` e `testing.md`.
- **Testes:** regressão completa
- **Gate:** completo
- **Commit:** `refactor(finances): remove legacy financial flows`

### T19: Validar migração e fluxos críticos

- **O quê:** executar migração em cópia do banco, conferir invariantes e realizar UAT dos fluxos centrais com o app local.
- **Onde:** scripts/testes de migração, `spec.md`, documentação canônica afetada
- **Depende de:** T18
- **Reusa:** backup/restauração, critérios da spec e gates do monorepo.
- **Requisito:** todos
- **Ferramentas:** Skills `ana-tdd`, `ana-code-review`; UAT interativo
- **Pronto quando:**
  - [ ] Backup pré-migração é criado e restaurável.
  - [ ] Saldos, faturas, transferências, parcelas e contagens passam nas verificações pós-migração.
  - [ ] `pnpm check` passa sem redução silenciosa da suíte.
  - [ ] UAT confirma planejamento inline, gasto no cartão, pagamento parcial, transferência, recorrência, importação e caixa.
  - [ ] `pnpm dev` permanece rodando para validação visual da usuária.
  - [ ] Spec marca todos os requisitos verificados ou registra bloqueios explícitos.
  - [ ] Constituição: respeita `ana-standards/references/testing.md` e `pr-conventions.md`.
- **Testes:** regressão completa + UAT
- **Gate:** completo + visual
- **Commit:** `test(finances): validate monthly foundation`

---

## Validações antes de aprovar

### Granularidade

| Grupo | Tasks | Entrega por task | Status |
| --- | --- | --- | --- |
| Fundação | T1–T2 | contratos; schema/migration | ✅ |
| Transferências | T3–T4 | domínio; API | ✅ |
| Faturas | T5–T7 | domínio; pagamentos API; bloqueio | ✅ |
| Recorrências | T8 | vertical coesa domínio + API | ✅ |
| Mensal/importação | T9–T10 | APIs mensais; importação | ✅ |
| Frontend | T11–T17 | fundação e uma experiência por task | ✅ |
| Encerramento | T18–T19 | remoção; validação | ✅ |

T8 permanece uma vertical única porque domínio e persistência precisam compartilhar a garantia de
idempotência; separá-los deixaria uma task intermediária sem entrega utilizável.

### Diagrama × dependências

| Relação | Declarada no corpo | Presente no plano | Status |
| --- | --- | --- | --- |
| T1 → T2 | sim | sim | ✅ |
| T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 | sim | sim | ✅ |
| T10 → T11 | sim | sim | ✅ |
| T11 → T12,T13,T14,T15,T16 | sim | sim | ✅ |
| T12,T13,T14,T15,T16 → T17 → T18 → T19 | sim | sim | ✅ |

### Co-locação de testes

| Camada | Tasks | Constituição exige | Declarado | Status |
| --- | --- | --- | --- | --- |
| Schemas/domínio | T1, T3, T5, T8, T9 | unit | unit | ✅ |
| Database/API | T2, T4, T6, T7, T8, T9, T10 | integração isolada | integração | ✅ |
| Frontend | T11–T17 | unit/component | unit/component | ✅ |
| Remoção/migração | T18–T19 | regressão + UAT | regressão + UAT | ✅ |

**Cobertura de requisitos:** 7 requisitos · 7 mapeados · 0 sem task.

---

_Próxima fase: Execute, começando por T1 em branch dedicada e com `ana-tdd`._
