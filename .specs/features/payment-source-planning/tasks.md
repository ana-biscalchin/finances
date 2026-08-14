# Tasks — Planejamento mensal por categoria e meio de pagamento

**Design:** `.specs/features/payment-source-planning/design.md` · **Spec:** `.specs/features/payment-source-planning/spec.md`
**Status:** implementação e gates automatizados concluídos; T10 e a validação visual de T15 aguardam UAT

## Extensão aprovada — acompanhamento de entradas

**Evidência de execução — 2026-08-14:** T11–T14 e gates automatizados de T15 concluídos em RED →
GREEN. Migration SQLite aplicada com backup e integridade válida; smoke autenticado confirmou três
entradas conciliadas. Resta somente a revisão visual da usuária antes de marcar `INCOME-01` como
verificado.

### T11: Persistir previsões mensais de receita

- **O quê:** criar domínio, tabela e migrations equivalentes para previsões por mês, categoria de receita e conta.
- **Requisito:** INCOME-01.
- **Pronto quando:** constraints rejeitam valor não positivo e chave duplicada; testes SQLite e domínio passam; constituição `testing.md` e `coding-style.md`.
- **Gate:** `pnpm --filter @finances/database test && pnpm --filter @finances/domain test`.

### T12: Criar escrita atômica das previsões

- **O quê:** implementar `PUT /monthly-income-plans` com validação de owner, natureza e atividade.
- **Depende de:** T11.
- **Requisito:** INCOME-01.
- **Pronto quando:** substituição e remoção são atômicas, erro preserva dados e testes HTTP passam; constituição `error-handling.md` e `web-standards.md`.
- **Gate:** `pnpm --filter @finances/api test`.

### T13: Conciliar entradas no dashboard e no saldo esperado

- **O quê:** ampliar o snapshot mensal e a projeção por conta sem duplicar outras previsões.
- **Depende de:** T11, T12.
- **Requisito:** INCOME-01, CASH-02.
- **Pronto quando:** previsto, recebido, a receber, excedente e não planejado são exatos; transferências ficam fora; testes de domínio/API passam; constituição `testing.md`.
- **Gate:** `pnpm --filter @finances/domain test && pnpm --filter @finances/api test`.

### T14: Adicionar acompanhamento e edição de entradas na visão mensal

- **O quê:** criar resumo, tabela e editor de entradas reutilizando cliente, dinheiro e padrões do orçamento.
- **Depende de:** T12, T13.
- **Requisito:** INCOME-01, DASH-01.
- **Pronto quando:** painel mostra estados integral, parcial, excedente e não planejado; salvar preserva erro/rascunho; contratos e testes web passam; constituição `web-standards.md`.
- **Gate:** `pnpm --filter @finances/web test && pnpm --filter @finances/web build`.

### T15: Migrar, documentar e validar a extensão

- **O quê:** aplicar migration local com backup, atualizar regras/arquitetura, executar regressão e UAT.
- **Depende de:** T11–T14.
- **Requisito:** INCOME-01.
- **Pronto quando:** banco íntegro, `pnpm check` verde, smoke autenticado e app em 5173; constituição `pr-conventions.md`.
- **Gate:** `pnpm check` + smoke HTTP + UAT visual.

## Evidência de execução — 2026-08-14

- T1–T9: implementadas na branch `feat/monthly-budget-dashboard` em ciclos RED → GREEN.
- Gate automatizado: `pnpm check` verde; 59 testes de domínio, 8 de database, 29 de API e 48 de web executados.
- PostgreSQL: 63 testes de integração ficaram pulados porque o harness externo não está configurado nesta sessão.
- Migration SQLite: base temporária íntegra, sem violações de FK, com `monthly_budget_allocations` e sem `planned_expenses`.
- Migration PostgreSQL: SQL e snapshot gerados; aplicação real aguarda um banco temporário PostgreSQL.
- T10: documentação sincronizada e app preparado; critérios visuais permanecem não verificados até revisão da usuária.

> Execução obrigatoriamente em TDD: RED → GREEN → REFACTOR por task. Cada task começa somente depois
> de suas dependências estarem verificadas e commitadas via `ana-commit`.

---

## Pré-condições de execução

- Criar uma branch dedicada a partir de `develop`; não executar a feature diretamente na branch principal.
- Preservar as mudanças preexistentes em `apps/api/src/credit-card-payments.test.ts` e
  `apps/api/src/modules/credit-cards.ts`; nenhuma task pode absorvê-las sem confirmação.
- Usar Node e pnpm nas versões de `.specs/codebase/STACK.md`.
- Executar migrations e resets apenas em banco temporário de desenvolvimento/UAT explicitamente validado.
- Usar `ana-tdd` em toda task com código de produção e registrar o RED antes do GREEN.
- Submeter cada commit proposto à análise e aprovação da skill `ana-commit`.

---

## Plano de execução

```text
Fase 1 — modelo:
T1 [P] ───────────────┐
T2 [P] ───────────────┤
                      ▼
Fase 2 — aplicação:   T3 ──────┐
                      │         │
                      └────► T4 ├────► T5
                                │
Fase 3 — interface:             ├────► T6 [P]
                                ├────► T7 [P]
                                └────► T8 [P]
                                      │
Fase 4 — fechamento:        T6,T7,T8 ─► T9 ─► T10
```

- `[P]` indica execução paralelizável somente quando as dependências estiverem concluídas.
- T6, T7 e T8 não compartilham arquivos de componente; alterações necessárias em
  `MonthlyOverviewPage.tsx` ficam exclusivamente em T7.
- Nenhuma task paralela compartilha o mesmo banco de teste.

---

## Detalhamento das tasks

### T1: Evoluir o domínio para alocações por meio [P]

- **O quê:** definir a união discriminada das alocações e calcular planejado/realizado por
  conta+forma ou cartão, incluindo classificação de atenção.
- **Onde:** `packages/domain/src/contracts.ts`,
  `packages/domain/src/payment-source-planning.ts` e testes co-locados.
- **Depende de:** nenhuma.
- **Reusa:** `financial-classification.ts`, schemas de mês/centavos e cálculos atuais de disponível.
- **Requisito:** PLAN-01, EXEC-01, DASH-01, TRANS-02.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] Conta exige `accountId + paymentMethodId`; cartão exige somente `creditCardId`; variantes
        inválidas e chaves duplicadas são rejeitadas.
  - [ ] Realizado é agregado pela combinação efetiva, gasto sem plano aparece com planejado zero e
        estorno/reembolso não produz realizado negativo.
  - [ ] Transferências próprias e pagamentos de fatura não realizam nenhuma alocação.
  - [ ] Atenção resulta em `over`, `near_limit` a partir de 80%, `unplanned`, `on_track` ou
        `unused`, com percentual nulo quando o planejado é zero.
  - [ ] Teste: `payment-source-planning.test.ts` cobre todas as variantes e regressões; gate do
        pacote passa com cobertura do código novo ≥ 80%.
  - [ ] Constituição: respeita `testing.md`, `coding-style.md` e
        `verify-before-claiming.md`.
- **Testes:** unit.
- **Gate:** `pnpm --filter @finances/domain test && pnpm --filter @finances/domain typecheck`.
- **Commit:** `feat(domain): plan budgets by payment method`.

### T2: Criar o schema canônico de alocações [P]

- **O quê:** adicionar `monthly_budget_allocations` com as mesmas invariantes em SQLite e
  PostgreSQL e preparar migrations reversíveis para o ambiente hospedado.
- **Onde:** `packages/database/src/schema.sqlite.ts`, `schema.pg.ts`, `schema.ts`, migrations
  Drizzle dos dois dialetos e testes do pacote.
- **Depende de:** nenhuma.
- **Reusa:** ownership, timestamps, FKs de conta/forma/cartão e padrões de índices existentes.
- **Requisito:** PLAN-01, CLEAN-01.
- **Ferramentas:** Skill `ana-tdd`; Drizzle Kit.
- **Pronto quando:**
  - [ ] Cada linha aceita conta+forma XOR cartão, valor positivo e owner obrigatório.
  - [ ] Duplicidades por mês, subcategoria e meio são rejeitadas em SQLite e PostgreSQL.
  - [ ] Migration não converte silenciosamente `planned_expenses`; rollback/recuperação e impacto da
        remoção posterior estão documentados.
  - [ ] Base temporária vazia migra nos dois dialetos suportados e passa checks de FK/integridade.
  - [ ] Teste: pacote database cobre constraints e equivalência; gate passa sem acessar banco pessoal.
  - [ ] Constituição: respeita `testing.md`, `surgical-edits.md` e rigor de migration/storage em
        `pr-conventions.md`.
- **Testes:** integração SQLite isolada + integração PostgreSQL quando o harness local estiver disponível.
- **Gate:** `pnpm --filter @finances/database test && pnpm --filter @finances/database typecheck`.
- **Commit:** `feat(database): store monthly budget allocations`.

### T3: Implementar escrita e cópia atômica de alocações

- **O quê:** substituir alocações de uma subcategoria e copiar um mês usando os contratos canônicos.
- **Onde:** `apps/api/src/modules/payment-source-planning/application/service.ts`, módulo de rotas,
  schemas compartilhados e testes HTTP/serviço.
- **Depende de:** T1, T2.
- **Reusa:** associação conta–forma, owner da request, conexão transacional e `apiClient` contract.
- **Requisito:** PLAN-01, PMT-01, CLEAN-01.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] `PUT /monthly-budget-allocations` substitui o conjunto inteiro ou remove com lista vazia.
  - [ ] Todas as referências pertencem ao owner e combinações novas precisam estar ativas e associadas.
  - [ ] Falha em qualquer linha reverte a substituição inteira e preserva o estado anterior.
  - [ ] Cópia exige destino vazio, cria IDs novos e informa combinações arquivadas ignoradas.
  - [ ] Erros de validação, ausência e conflito retornam 400, 404 e 409 coerentes sem valores em logs.
  - [ ] Teste: API cobre sucesso, lista vazia, duplicidade, owner cruzado, arquivamento, destino
        preenchido e rollback; cobertura nova ≥ 80%.
  - [ ] Constituição: respeita `error-handling.md`, `web-standards.md` e contratos Zod na borda.
- **Testes:** unit de serviço + integração HTTP/SQLite isolada.
- **Gate:** `pnpm --filter @finances/api test && pnpm --filter @finances/api typecheck`.
- **Commit:** `feat(api): manage monthly budget allocations`.

### T4: Compor o snapshot do dashboard mensal

- **O quê:** ampliar `GET /monthly-overview` com categorias por meio, classificação de atenção,
  opções válidas e transferências realizadas.
- **Onde:** `apps/api/src/application/monthly-overview-service.ts`,
  `apps/api/src/modules/payment-source-planning/application/service.ts`, rota mensal e testes.
- **Depende de:** T1, T2, T3.
- **Reusa:** consultas mensais existentes, `account_transfers`, associações, nomes das contas e cartões.
- **Requisito:** EXEC-01, DASH-01, TRANS-02, CASH-02.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] Totais da categoria e do mês são derivados das alocações e lançamentos confirmados.
  - [ ] Despesas em conta agrupam por conta+forma; cartão agrupa pelo mês da fatura.
  - [ ] Transferências realizadas do mês retornam uma vez, com origem/destino, e não alteram
        `summary`, itens ou atenção.
  - [ ] Pagamento de fatura e pernas de transferência permanecem excluídos do gasto.
  - [ ] A consulta não executa uma busca adicional por categoria ou transferência.
  - [ ] Agregado de transferência inconsistente falha com contexto e correlação; não é reconstruído
        silenciosamente pelas pernas.
  - [ ] Teste: API cobre Flash, Nubank com duas formas, cartão, parcela, gasto não planejado,
        transferência dentro/fora do mês e owner scope.
  - [ ] Constituição: respeita `testing.md`, `error-handling.md` e observabilidade sem dados financeiros.
- **Testes:** unit de domínio + integração HTTP/SQLite isolada.
- **Gate:** `pnpm --filter @finances/api test && pnpm --filter @finances/domain test`.
- **Commit:** `feat(api): expose monthly dashboard snapshot`.

### T5: Atualizar contratos e helpers compartilhados da web

- **O quê:** validar o novo snapshot, centralizar rótulos de meios e extrair o formatador BRL repetido.
- **Onde:** `apps/web/src/app/shared/api-contracts.ts`,
  `payment-source-options.ts`, novo `money.ts` e testes co-locados.
- **Depende de:** T4.
- **Reusa:** Zod, `apiClient`, `buildAccountPaymentMethodOptions` e locale atual.
- **Requisito:** PMT-01, PLAN-01, DASH-01, TRANS-02.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] Schemas discriminam conta+forma de cartão e validam categorias, atenção e transferências.
  - [ ] Opções disponíveis produzem rótulos `Conta · Forma` sem duplicar o mapper existente.
  - [ ] Um helper único formata centavos em BRL e substitui duplicação apenas nos componentes tocados.
  - [ ] Resposta incompatível continua gerando `ApiClientError`, sem casts ou defaults falsos.
  - [ ] Teste: schemas, opções e dinheiro cobrem variantes válidas, inválidas e arquivadas.
  - [ ] Constituição: respeita `coding-style.md`, `testing.md` e validação de fronteira.
- **Testes:** unit.
- **Gate:** `pnpm --filter @finances/web test && pnpm --filter @finances/web typecheck`.
- **Commit:** `refactor(web): share monthly dashboard contracts`.

### T6: Criar o editor de alocações [P]

- **O quê:** substituir o editor de despesas nomeadas por edição de meio+valor dentro da categoria.
- **Onde:** novo `BudgetAllocationEditor.tsx`, estado puro/testes e remoção posterior coordenada de
  `PlannedExpenseEditor.tsx`.
- **Depende de:** T3, T5.
- **Reusa:** opções `Conta · Forma`, cartões disponíveis, `apiClient` e componentes Mantine existentes.
- **Requisito:** PLAN-01, UX-02.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] Usuária adiciona, edita e remove combinações sem informar nome de despesa.
  - [ ] Combinação repetida é impedida antes do envio e lista vazia remove o planejamento.
  - [ ] Apenas a categoria salva fica desabilitada; erro preserva o rascunho e permanece junto ao editor.
  - [ ] Sucesso recarrega o snapshot e mantém a categoria aberta.
  - [ ] Operação é utilizável por teclado e controles possuem rótulos acessíveis.
  - [ ] Teste: estado/componente cobre fluxo feliz, duplicidade, remoção, erro 409 e rascunho preservado.
  - [ ] Constituição: respeita `testing.md`, `web-standards.md` e erro visível.
- **Testes:** unit de estado + componente.
- **Gate:** `pnpm --filter @finances/web test && pnpm --filter @finances/web typecheck`.
- **Commit:** `feat(web): edit budget allocations by payment method`.

### T7: Redesenhar categorias e área de atenção [P]

- **O quê:** organizar o painel em resumo, exceções e categorias expansíveis por meio.
- **Onde:** `MonthlyOverviewPage.tsx`, `MonthAtGlance.tsx`, `MonthlyHealthSummary.tsx`,
  `BudgetCategoryTable.tsx`, novos `MonthlyAttentionPanel.tsx` e
  `BudgetPaymentMethodBreakdown.tsx`, com testes.
- **Depende de:** T4, T5.
- **Reusa:** seletor mensal, accordion existente e indicadores planejado/gasto/disponível.
- **Requisito:** EXEC-01, DASH-01, UX-02.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] Resumo mostra planejado, gasto e disponível ou acima sem promover `comprometido`.
  - [ ] Exceções priorizam `over`, `unplanned` e `near_limit`; categorias restantes preservam
        ordem cadastrada.
  - [ ] Categoria recolhida mostra totais; expandida mostra cada meio e sua situação.
  - [ ] Estado sem plano oferece começar do zero ou copiar outro mês.
  - [ ] Layout empilha valores em tela estreita e situação possui texto/valor além de cor.
  - [ ] Falha de GET mostra retry e nunca converte ausência de dados em zeros.
  - [ ] Teste: helpers/componentes cobrem as cinco classificações, ordenação, vazio, responsividade
        estrutural e acessibilidade.
  - [ ] Constituição: respeita `testing.md`, `web-standards.md` e `surgical-edits.md`.
- **Testes:** unit + componente.
- **Gate:** `pnpm --filter @finances/web test && pnpm --filter @finances/web build`.
- **Commit:** `feat(web): build monthly budget dashboard`.

### T8: Adicionar o painel de transferências realizadas [P]

- **O quê:** exibir transferências do mês em uma seção recolhível e secundária.
- **Onde:** novo `MonthlyTransfersPanel.tsx` e testes co-locados.
- **Depende de:** T4, T5.
- **Reusa:** dados do snapshot, formatador BRL compartilhado e padrões de estado vazio Mantine.
- **Requisito:** TRANS-02, DASH-01.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] Cada linha mostra data, descrição, origem, destino e valor exatamente uma vez.
  - [ ] A seção deixa explícito que movimenta caixa e não é gasto.
  - [ ] Sem transferências resulta em estado compacto que não compete com alertas de orçamento.
  - [ ] O componente não recalcula nem injeta transferências nos indicadores econômicos.
  - [ ] Teste: componente cobre lista, estado vazio, nomes arquivados fornecidos pela API e acessibilidade.
  - [ ] Constituição: respeita `testing.md`, `web-standards.md` e linguagem sem ambiguidade.
- **Testes:** unit + componente.
- **Gate:** `pnpm --filter @finances/web test && pnpm --filter @finances/web typecheck`.
- **Commit:** `feat(web): show monthly account transfers`.

### T9: Remover o fluxo substituído de despesas planejadas

- **O quê:** apagar somente consumidores comprovadamente substituídos de `planned_expenses` e
  consolidar schema/rotas/contratos no modelo de alocações.
- **Onde:** schema e migrations finais, módulo `planned-expenses`, registro do servidor,
  componentes web, contratos, seeds e testes diretamente relacionados.
- **Depende de:** T6, T7, T8.
- **Reusa:** inventário por `rg`, build, registro de rotas e cobertura das tasks substitutas.
- **Requisito:** CLEAN-01, PLAN-01.
- **Ferramentas:** `rg`, TypeScript, ESLint; Skill `ana-tdd` se qualquer comportamento for alterado.
- **Pronto quando:**
  - [ ] Busca e grafo de imports confirmam ausência de consumidor runtime antes de cada remoção.
  - [ ] Tabela, rotas, serviço, schemas e componentes de `planned_expenses` deixam de existir.
  - [ ] Nenhum teste é removido sem cobertura equivalente nas tasks T1–T8.
  - [ ] Seeds demonstram Supermercado dividido entre Flash Pré-pago e Nubank Débito e transferência
        própria separada.
  - [ ] Migrations finais dos dois dialetos e reset UAT temporário preservam integridade.
  - [ ] Constituição: respeita `surgical-edits.md`, `verify-before-claiming.md` e proibição de
        deleção especulativa.
- **Testes:** regressão completa dos pacotes afetados + integração isolada de migration/seed.
- **Gate:** `pnpm check`.
- **Commit:** `refactor(finances): remove planned expense budgeting`.

### T10: Validar UAT e sincronizar documentação

- **O quê:** demonstrar os critérios da spec, atualizar documentação canônica e registrar evidências.
- **Onde:** `docs/regras-negocio.md`, `.specs/codebase/ARCHITECTURE.md`, registros da feature e
  documentação diretamente afetada.
- **Depende de:** T9.
- **Reusa:** base demo/UAT, critérios de aceite e comandos do stack.
- **Requisito:** ACC-01, PMT-01, PLAN-01, EXEC-01, CASH-02, UX-02, CLEAN-01, DASH-01, TRANS-02.
- **Ferramentas:** `ana-update-readme` quando aplicável; `ana-code-review`; navegador/UAT local.
- **Pronto quando:**
  - [ ] UAT visual planeja Supermercado em `Flash Alimentação · Pré-pago` e `Nubank · Débito`,
        registra gasto abaixo e acima e confere os saldos.
  - [ ] UAT mostra gasto não planejado, próximo do limite em 80%, cartão no mês da fatura e erro com
        rascunho preservado.
  - [ ] Transferência entre contas aparece no painel, movimenta os saldos e não altera orçamento,
        gasto ou receita.
  - [ ] `pnpm check` passa; testes não diminuem sem justificativa; SQLite e PostgreSQL possuem
        evidência compatível de migration.
  - [ ] Documentação não descreve total paralelo, `planned_expenses` ou transferência própria como gasto.
  - [ ] Spec marca requisito como `Verificado` somente após evidência e revisão visual da usuária.
  - [ ] `pnpm dev` permanece rodando em segundo plano para a revisão visual.
  - [ ] Constituição: respeita `testing.md`, `pr-conventions.md` e rigor proporcional à migration.
- **Testes:** suíte completa + UAT visual.
- **Gate:** `pnpm check`, migration checks dos dois dialetos e smoke HTTP local.
- **Commit:** `docs(finances): document monthly budget dashboard`.

---

## Validações antes de aprovar

### Granularidade

| Task | Entrega única                           | Status |
| ---- | --------------------------------------- | ------ |
| T1   | Domínio puro e classificação            | ✅     |
| T2   | Schema e migrations da mesma entidade   | ✅     |
| T3   | API de escrita/cópia                    | ✅     |
| T4   | Snapshot de leitura do dashboard        | ✅     |
| T5   | Contratos e helpers web                 | ✅     |
| T6   | Editor de alocações                     | ✅     |
| T7   | Resumo, atenção e categorias            | ✅     |
| T8   | Painel de transferências                | ✅     |
| T9   | Remoção comprovada do fluxo substituído | ✅     |
| T10  | UAT e documentação                      | ✅     |

### Diagrama × dependências

| Task | Depende de | Plano mostra  | Status |
| ---- | ---------- | ------------- | ------ |
| T1   | nenhuma    | raiz paralela | ✅     |
| T2   | nenhuma    | raiz paralela | ✅     |
| T3   | T1, T2     | T1,T2 → T3    | ✅     |
| T4   | T1, T2, T3 | T3 → T4       | ✅     |
| T5   | T4         | T4 → T5       | ✅     |
| T6   | T3, T5     | T3,T5 → T6    | ✅     |
| T7   | T4, T5     | T4,T5 → T7    | ✅     |
| T8   | T4, T5     | T4,T5 → T8    | ✅     |
| T9   | T6, T7, T8 | T6,T7,T8 → T9 | ✅     |
| T10  | T9         | T9 → T10      | ✅     |

### Co-locação de testes

| Tasks | Camada                 | Constituição exige        | Planejado              | Status |
| ----- | ---------------------- | ------------------------- | ---------------------- | ------ |
| T1    | domínio puro           | unit                      | unit co-locado         | ✅     |
| T2    | schema/migration       | integração isolada        | testes na própria task | ✅     |
| T3–T4 | serviço/API            | unit + HTTP/banco isolado | testes em cada task    | ✅     |
| T5    | contratos/helpers      | unit                      | unit co-locado         | ✅     |
| T6–T8 | frontend               | unit/componente           | testes em cada task    | ✅     |
| T9    | remoção comportamental | regressão + equivalência  | gate completo          | ✅     |
| T10   | entrega                | suíte + UAT               | evidência completa     | ✅     |

### Rastreabilidade

| Requisito | Tasks                       |
| --------- | --------------------------- |
| ACC-01    | T3, T10                     |
| PMT-01    | T1, T3, T5, T10             |
| PLAN-01   | T1, T2, T3, T5, T6, T9, T10 |
| EXEC-01   | T1, T4, T7, T10             |
| CASH-02   | T4, T10                     |
| UX-02     | T5, T6, T7, T10             |
| CLEAN-01  | T2, T3, T9, T10             |
| DASH-01   | T1, T4, T5, T7, T8, T10     |
| TRANS-02  | T1, T4, T5, T8, T10         |

**Cobertura:** 9 requisitos · 9 mapeados · 0 sem task.

---

## Risco e divisão de PR

A feature toca schema, API e UI e não deve virar um único PR difícil de revisar. Divisão recomendada:

1. **PR de fundação:** T1–T4, incluindo migration e contratos HTTP.
2. **PR de interface:** T5–T8, apontando para a branch da fundação enquanto ela não estiver integrada.
3. **PR de limpeza e validação:** T9–T10, após os fluxos substitutos estarem verificados.

Cada PR declara impacto, rollback da migration, comandos executados e lacunas honestas, conforme
`ana-standards/references/pr-conventions.md`.

---

_Próxima fase após aprovação: Execute. Começar pelas pré-condições e por T1/T2; não remover
`planned_expenses` antes de T6–T8 estarem verificadas._
