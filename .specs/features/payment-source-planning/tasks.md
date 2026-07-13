# Tasks — Planejamento por conta e forma de pagamento

**Design:** `.specs/features/payment-source-planning/design.md`  ·  **Spec:** `.specs/features/payment-source-planning/spec.md`
**Status:** in progress — revisão UX por despesas planejadas

> Execução obrigatoriamente em TDD: RED → GREEN → REFACTOR por task. Uma task só começa depois que
> suas dependências estiverem verificadas e commitadas via `ana-commit`.

---

## Pré-condições de execução

- O worktree contém mudanças não commitadas do seed de demonstração e da documentação anterior.
  Antes de T1, usar `ana-commit` para separá-las por intenção; nenhuma task abaixo pode absorvê-las.
- Confirmar branch dedicada `feat/monthly-foundation` e registrar a branch-pai antes de qualquer push.
- Manter bancos pessoais e backups fora dos comandos de teste e reset.
- Toda task com código de produção usa `ana-tdd` e confirma a falha RED antes do GREEN.
- Cada commit listado é uma intenção proposta; a execução real passa pela análise e aprovação do `ana-commit`.

## Plano de execução

```text
Fase 1 — fundação:
T1 ───────────────┬───────────────┐
                  │               │
T2 [P] → T3 → T4  │               │
  └────────→ T5 [P]               │
                  │               │
Fase 2 — API:     │               │
T1,T2 → T6 [P]    │               │
T1,T2,T6 → T7     │               │
T1,T2 → T8 [P] ───┘               │
T1,T6,T8 → T9                     │
                                  │
Fase 3 — Web:                     │
T6,T8,T9 → T10                    │
T10 → T11 [P]                     │
T7,T10 → T12 [P]                  │
T8,T9,T10 → T13                   │
                                  │
Fase 4 — saneamento e entrega:    │
T3,T5,T7,T8,T9,T11,T12,T13 → T14
T4,T5,T14 → T15
```

`[P]` indica task paralelizável quando suas dependências estiverem concluídas. Tasks paralelas não
podem editar os mesmos arquivos nem compartilhar banco de teste.

---

## Detalhamento das tasks

### T1: Criar o domínio de planejamento por origem

- **O quê:** implementar contratos, invariantes e cálculos puros de distribuição, realização e valor não distribuído.
- **Onde:** `packages/domain/src/payment-source-planning.ts`, `packages/domain/src/payment-source-planning.test.ts`, `packages/domain/src/contracts.ts`, `packages/domain/src/index.ts`.
- **Depende de:** nenhuma.
- **Reusa:** `monthly-overview.ts`, `financial-classification.ts`, schemas de centavos e mês em `contracts.ts`.
- **Requisito:** PLAN-01, EXEC-01, CASH-02.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] Distribuição aceita conta XOR cartão, rejeita origem duplicada e soma acima do total.
  - [ ] Valor não distribuído, realização por origem e divergência são derivados sem alterar o orçamento.
  - [ ] Transferência e pagamento de fatura não realizam alocações.
  - [ ] Teste: `payment-source-planning.test.ts` cobre total, incompleto, origem não planejada, estorno e invariantes; gate `pnpm --filter @finances/domain test:coverage` passa com cobertura ≥ 80% do código novo.
  - [ ] Constituição: respeita `testing.md`, `coding-style.md` e contratos validados na fronteira.
- **Testes:** unit.
- **Gate:** `pnpm --filter @finances/domain typecheck && pnpm --filter @finances/domain lint && pnpm --filter @finances/domain test`.
- **Commit:** `feat(domain): add payment source planning rules`.

### T2: Revisar o schema financeiro canônico [P]

- **O quê:** adicionar associações conta–forma e alocações de orçamento, removendo campos estruturais substituídos.
- **Onde:** `packages/database/src/schema.ts`, `packages/database/src/schema.test.ts` ou teste de integridade equivalente.
- **Depende de:** nenhuma.
- **Reusa:** tabelas `accounts`, `paymentMethods`, `budgets`, `creditCards` e padrões de constraints existentes.
- **Requisito:** ACC-01, PMT-01, PLAN-01, CLEAN-01.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] `account_payment_methods` possui unicidade conta+forma, estado, padrão e arquivamento.
  - [ ] `budget_allocations` possui orçamento, conta XOR cartão, valor positivo, unicidades e índices.
  - [ ] `accounts.defaultPaymentMethodId` deixa de existir no schema canônico.
  - [ ] Teste: reflexão do schema cobre colunas, FKs, índices, checks e ausência do campo removido; gate do pacote passa com cobertura ≥ 80% do código novo.
  - [ ] Constituição: respeita `testing.md` e edição cirúrgica; nenhuma coluna é mantida apenas por compatibilidade não requerida.
- **Testes:** unit + integração SQLite isolada.
- **Gate:** `pnpm --filter @finances/database typecheck && pnpm --filter @finances/database test`.
- **Commit:** `feat(database): add payment source schema`.

### T3: Consolidar migrations em uma baseline

- **O quê:** substituir migrations e snapshots do protótipo por uma baseline Drizzle gerada do schema revisado.
- **Onde:** `packages/database/drizzle/`, `packages/database/src/migration-integrity.test.ts`, configuração Drizzle.
- **Depende de:** T2.
- **Reusa:** runner atual de migration e testes temporários de integridade.
- **Requisito:** CLEAN-01.
- **Ferramentas:** `drizzle-kit` existente · Skill `ana-tdd` para o gate de comportamento.
- **Pronto quando:**
  - [ ] Uma base vazia recebe a baseline completa em uma única cadeia canônica.
  - [ ] Snapshots antigos não permanecem referenciados e nenhuma tabela legada reaparece.
  - [ ] `PRAGMA foreign_key_check` não retorna linhas após a migration.
  - [ ] Teste: migration em arquivo temporário cobre schema esperado e ausência de legado; gate do banco passa sem reduzir a contagem de testes.
  - [ ] Constituição: respeita `testing.md`, `verify-before-claiming.md` e risco proporcional para mudança de storage.
- **Testes:** integração SQLite isolada.
- **Gate:** `pnpm --filter @finances/database test && pnpm --filter @finances/database build`.
- **Commit:** `refactor(database): consolidate financial schema baseline`.

### T4: Criar reset destrutivo protegido

- **O quê:** implementar comando explícito que valida ambiente e caminho antes de apagar e reconstruir somente uma base de desenvolvimento/UAT.
- **Onde:** `packages/database/src/reset-development.ts`, teste co-locado, scripts em `packages/database/package.json` e `package.json`.
- **Depende de:** T3.
- **Reusa:** `resolveDatabasePath`, migration runner, seed runner e `validateDatabaseIntegrity`.
- **Requisito:** CLEAN-01.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] Comando exige marcador de desenvolvimento/UAT, `DATABASE_PATH` explícito e confirmação destrutiva.
  - [ ] Caminho fora das raízes aprovadas ou dentro de backup é recusado antes de abrir o arquivo.
  - [ ] Caminho resolvido é mostrado antes da exclusão e falhas encerram com saída não-zero.
  - [ ] Teste: diretórios temporários cobrem caminho permitido, ausente, pessoal, backup e segunda execução; gate do banco passa com cobertura ≥ 80% do código novo.
  - [ ] Constituição: respeita `error-handling.md` e nunca engole falha destrutiva.
- **Testes:** unit + integração filesystem temporário.
- **Gate:** `pnpm --filter @finances/database test && pnpm --filter @finances/database typecheck`.
- **Commit:** `feat(database): add guarded development reset`.

### T5: Atualizar seeds para o modelo revisado [P]

- **O quê:** criar dados padrão e demonstrativos com contas bancárias, dois benefícios Flash, formas associadas e orçamento distribuído.
- **Onde:** `packages/database/src/seed-data.ts`, `seed.ts`, `seed-demo.ts`, `demo-seed-data.ts` e testes co-locados.
- **Depende de:** T2.
- **Reusa:** seed de demonstração iniciado anteriormente e IDs determinísticos.
- **Requisito:** ACC-01, PMT-01, PLAN-01, CASH-02, CLEAN-01.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] Seed não contém `pm-credit-card`, categoria de movimentação interna ou compra no cartão com `paymentMethodId`.
  - [ ] Flash Alimentação e Flash Conveniência são contas `benefit` independentes com pré-pago associado.
  - [ ] Cenário demonstra benefício recebido, gasto pré-pago, conta bancária, crédito, fatura e valores não distribuídos/completos.
  - [ ] Teste: duas execuções dos seeds em base temporária produzem o mesmo estado e integridade válida.
  - [ ] Constituição: respeita `testing.md`; seed nunca aponta implicitamente para a base pessoal.
- **Testes:** unit + integração SQLite isolada.
- **Gate:** `pnpm --filter @finances/database test && pnpm --filter @finances/database typecheck`.
- **Commit:** `feat(database): seed payment source scenarios`.

### T6: Implementar associações de formas na API [P]

- **O quê:** tornar criação, edição, leitura e arquivamento de conta atômicos com suas formas permitidas.
- **Onde:** `apps/api/src/modules/accounts.ts`, `apps/api/src/modules/accounts/application/payment-method-associations.ts`, contratos compartilhados e testes de contas.
- **Depende de:** T1, T2.
- **Reusa:** CRUD, arquivamento e cálculo de saldo existentes; `paymentMethods` global.
- **Requisito:** ACC-01, PMT-01, UX-02.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] POST/PUT de conta validam `paymentMethods[]`, no máximo um padrão e referências ativas.
  - [ ] GET de contas devolve associações ativas e históricas conforme `includeInactive`.
  - [ ] Arquivar conta impede novas alocações sem apagar associações ou histórico.
  - [ ] Teste: API cobre várias contas com Pix/débito, benefícios pré-pagos, padrão duplicado, arquivamento e rollback atômico.
  - [ ] Constituição: respeita `error-handling.md`, `web-standards.md` e validação Zod na borda.
- **Testes:** unit + integração HTTP/SQLite isolada.
- **Gate:** `pnpm --filter @finances/api test && pnpm --filter @finances/api typecheck`.
- **Commit:** `feat(api): manage account payment methods`.

### T7: Validar origem dos lançamentos

- **O quê:** aplicar uma única regra de conta+forma ou cartão aos fluxos manual, recorrente e importado.
- **Onde:** módulo/serviço de transações, recorrências, importação simples e testes correspondentes.
- **Depende de:** T1, T2, T6.
- **Reusa:** normalização de cartão e validações existentes de conta/cartão.
- **Requisito:** PMT-01, EXEC-01.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] Compra em conta exige forma ativa associada; cartão exige conta/forma nulas.
  - [ ] Confirmação de recorrência revalida conta, cartão e associação ativos.
  - [ ] Importação pode revisar linha incompleta, mas confirmação rejeita combinação inválida atomicamente.
  - [ ] Entradas e movimentos estruturais preservam suas regras sem exigir forma de consumo.
  - [ ] Teste: manual, recorrência e importação cobrem sucesso, associação arquivada e rollback; cobertura ≥ 80% do código novo.
  - [ ] Constituição: respeita `error-handling.md`, contratos de fronteira e ausência de validação somente na UI.
- **Testes:** unit + integração HTTP/SQLite isolada.
- **Gate:** `pnpm --filter @finances/api test && pnpm --filter @finances/domain test`.
- **Commit:** `feat(api): validate transaction payment sources`.

### T8: Implementar orçamento distribuído na API [P]

- **O quê:** substituir atomicamente total e alocações, copiar mês e devolver visão realizada por origem.
- **Onde:** `apps/api/src/modules/payment-source-planning/`, rota mensal atual, contratos e testes mensais.
- **Depende de:** T1, T2.
- **Reusa:** `monthly-overview-service`, consultas de categorias e API `/monthly-budgets`.
- **Requisito:** PLAN-01, EXEC-01.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] PUT aceita distribuição completa ou incompleta, rejeita excesso e persiste tudo atomicamente.
  - [ ] Valor zero remove orçamento e alocações na mesma transação.
  - [ ] Cópia preserva total, ignora origens arquivadas e devolve `skippedAllocations`.
  - [ ] GET mantém totais atuais e acrescenta `sources`, `undistributedCents`, estado e resumo por origem.
  - [ ] Teste: API cobre conta, cartão, origem não planejada, cópia, arquivamento e falha intermediária.
  - [ ] Constituição: respeita `testing.md`, `error-handling.md` e edição transacional.
- **Testes:** unit + integração HTTP/SQLite isolada.
- **Gate:** `pnpm --filter @finances/api test && pnpm --filter @finances/api typecheck`.
- **Commit:** `feat(api): add distributed monthly budgets`.

### T9: Projetar caixa sem duplicidade

- **O quê:** incorporar orçamento restante, benefícios, recorrências e cartões à posição por conta sem contar o mesmo evento duas vezes.
- **Onde:** `packages/domain/src/payment-source-planning.ts`, serviço mensal da API e testes de caixa.
- **Depende de:** T1, T6, T8.
- **Reusa:** `buildCashPosition`, pagamentos de fatura, recorrências e `creditCards.paymentAccountId`.
- **Requisito:** CASH-02, EXEC-01.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] Saldo previsto separa entradas livres, benefícios, consumo direto restante, faturas e compras esperadas no cartão.
  - [ ] Recorrência já coberta pelo plano usa o maior valor, não a soma; recorrência sem plano continua prevista.
  - [ ] Compra confirmada, pagamento de fatura, juros e multa afetam consumo/caixa exatamente uma vez.
  - [ ] Recorrência de cartão é atribuída pelo mês real da fatura e sua conta pagadora.
  - [ ] Teste: cenários multi-conta, Flash, parcial, encargos, cartão após fechamento e risco negativo cobrem o cálculo.
  - [ ] Constituição: respeita `testing.md` e classificação financeira explícita.
- **Testes:** unit + integração HTTP/SQLite isolada.
- **Gate:** `pnpm --filter @finances/domain test && pnpm --filter @finances/api test`.
- **Commit:** `fix(finances): project account cash without duplication`.

### T10: Criar contratos e opções compartilhadas no frontend

- **O quê:** validar contas, associações, cartões, planejamento e caixa e centralizar opções `Conta · Forma`.
- **Onde:** `apps/web/src/app/shared/api-contracts.ts`, novo helper de opções e testes co-locados.
- **Depende de:** T6, T8, T9.
- **Reusa:** `apiClient`, schemas Zod e `emptySelectValue`.
- **Requisito:** PMT-01, PLAN-01, UX-02.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] Respostas fora do contrato lançam erro visível; não há casts manuais para os novos payloads.
  - [ ] Helper filtra associações ativas, escolhe única/padrão e formata rótulo sem duplicação.
  - [ ] Tipos locais equivalentes deixam de ser necessários nas páginas tocadas.
  - [ ] Teste: schemas e helper cobrem única, múltiplas, arquivada, padrão e resposta inválida.
  - [ ] Constituição: respeita validação de fronteira e `testing.md`.
- **Testes:** unit.
- **Gate:** `pnpm --filter @finances/web test && pnpm --filter @finances/web typecheck`.
- **Commit:** `refactor(web): share payment source contracts`.

### T11: Atualizar cadastro de contas [P]

- **O quê:** permitir configurar várias formas, sugestão por tipo e padrão no modal de conta.
- **Onde:** `apps/web/src/app/accounts/AccountsPage.tsx`, componentes extraídos e testes co-locados.
- **Depende de:** T10.
- **Reusa:** modal atual, `accountTypes` e helper de associações.
- **Requisito:** ACC-01, PMT-01, UX-02.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] Conta corrente sugere Pix/débito e benefício sugere pré-pago, com edição antes de salvar.
  - [ ] Somente uma forma pode ser padrão e a tabela lista todas as ativas.
  - [ ] Flash Alimentação e Conveniência podem ser criadas como contas independentes.
  - [ ] Teste: estado/formulário cobre sugestão, edição, padrão, erro da API e preservação do rascunho.
  - [ ] Constituição: respeita `web-standards.md`, acessibilidade e erro visível.
- **Testes:** unit de estado + componente quando infraestrutura existente permitir.
- **Gate:** `pnpm --filter @finances/web test && pnpm --filter @finances/web build`.
- **Commit:** `feat(web): configure account payment methods`.

### T12: Atualizar lançamentos e importação [P]

- **O quê:** filtrar formas pela conta e preservar a escolha válida nos fluxos manual, inline e importado.
- **Onde:** `TransactionsPage.tsx`, `import-preview.ts`, componentes/helper compartilhado e testes.
- **Depende de:** T7, T10.
- **Reusa:** seletor Conta/Cartão atual e edição em lote da prévia.
- **Requisito:** PMT-01, EXEC-01, UX-02.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] Selecionar conta mostra somente formas associadas e autoescolhe única/padrão.
  - [ ] Trocar conta invalida apenas a forma incompatível, preservando os demais campos.
  - [ ] Cartão mantém conta e forma vazias; importação exige correção antes de confirmar.
  - [ ] Teste: criação, troca de conta, edição inline e lote de importação cobrem estados válidos e erros.
  - [ ] Constituição: respeita `testing.md`, acessibilidade e validação também no servidor.
- **Testes:** unit de estado + integração de componente disponível.
- **Gate:** `pnpm --filter @finances/web test && pnpm --filter @finances/web typecheck`.
- **Commit:** `feat(web): select valid transaction payment sources`.

### T13: Construir a visão mensal por origem

- **O quê:** exibir resumo por conta/cartão, distribuição progressiva e estado não distribuído sem perder os totais atuais.
- **Onde:** `apps/web/src/app/monthly-control/` e testes co-locados.
- **Depende de:** T8, T9, T10.
- **Reusa:** `BudgetCategoryTable`, `InlineBudgetAmount`, `MonthAtGlance` e componentes de caixa.
- **Requisito:** PLAN-01, EXEC-01, CASH-02, UX-02.
- **Ferramentas:** Skill `ana-tdd`.
- **Pronto quando:**
  - [ ] Resumo apresenta planejado/realizado por origem e diferenças sem meta de cartão.
  - [ ] Linha da categoria mantém totais e abre drawer com alocações editáveis.
  - [ ] Valor não distribuído pode ser salvo, permanece visível e marca o plano incompleto.
  - [ ] Dinheiro nas contas mostra componentes do saldo previsto e risco individual.
  - [ ] Teste: reducers/helpers e componentes cobrem distribuição, excesso rejeitado, origem divergente, Flash e erro de persistência.
  - [ ] Constituição: respeita `web-standards.md`, estados de erro/vazio e informação não dependente de hover.
- **Testes:** unit + componente.
- **Gate:** `pnpm --filter @finances/web test && pnpm --filter @finances/web build`.
- **Commit:** `feat(web): show monthly planning by payment source`.

### T14: Remover contratos financeiros mortos

- **O quê:** concluir o inventário e apagar somente código comprovadamente substituído em runtime, relatórios, filtros, testes e docs.
- **Onde:** arquivos apontados pela varredura `rg`, especialmente relatórios, transações, seeds, contratos e documentação canônica.
- **Depende de:** T3, T5, T7, T8, T9, T11, T12, T13.
- **Reusa:** checklist de limpeza do Design e gates completos.
- **Requisito:** CLEAN-01.
- **Ferramentas:** `rg`, TypeScript, ESLint · Skill `ana-tdd` para qualquer comportamento alterado.
- **Pronto quando:**
  - [ ] Não há referência runtime a `pm-credit-card`, `defaultPaymentMethodId`, orçamento sem alocações ou categoria interna de transferência/fatura.
  - [ ] Cada arquivo removido possui evidência de ausência em imports, registros dinâmicos e scripts.
  - [ ] Testes antigos são removidos apenas junto do contrato e substituídos pela cobertura canônica correspondente.
  - [ ] `rg`, typecheck, lint, testes e build não revelam referência órfã ou código inalcançável conhecido.
  - [ ] Constituição: respeita `surgical-edits.md`, `verify-before-claiming.md` e proibição de deleção especulativa.
- **Testes:** regressão completa; TDD co-locado se a limpeza alterar comportamento.
- **Gate:** `pnpm check`.
- **Commit:** `refactor(finances): remove superseded payment source flows`.

### T15: Validar reset, UAT e documentação

- **O quê:** reconstruir uma base UAT temporária, executar os fluxos da spec e sincronizar documentação operacional.
- **Onde:** base em `/tmp`, README, regras de negócio, arquitetura/capacidades e registros da feature.
- **Depende de:** T4, T5, T14.
- **Reusa:** seed de demonstração, aplicação local e critérios de aceite da spec.
- **Requisito:** ACC-01, PMT-01, PLAN-01, EXEC-01, CASH-02, UX-02, CLEAN-01.
- **Ferramentas:** `ana-update-readme` quando houver commit de código elegível; navegador/UAT local; `ana-code-review` ao encerrar.
- **Pronto quando:**
  - [ ] Reset recusa caminho inseguro e reconstrói duas vezes a base UAT permitida com o mesmo resultado.
  - [ ] `integrity_check=ok`, `foreign_key_check` vazio, seeds idempotentes e smoke HTTP passam.
  - [ ] UAT visual cobre cadastro de duas contas bancárias, dois Flash, associações, planejamento completo/incompleto, execução divergente e caixa.
  - [ ] Spec marca os 7 requisitos como verificados somente após evidência; documentação não descreve contratos removidos.
  - [ ] Teste: `pnpm check` passa e a contagem total não diminui sem justificativa registrada.
  - [ ] Constituição: respeita `testing.md`, `pr-conventions.md` e rigor proporcional a storage destrutivo.
- **Testes:** suíte completa + UAT visual em base temporária.
- **Gate:** `pnpm check`, pragmas SQLite e smoke HTTP local.
- **Commit:** `docs(finances): document payment source planning`.

---

## Validações antes de aprovar

### Granularidade

| Task | Entrega única | Status |
| --- | --- | --- |
| T1 | Domínio puro de distribuição | ✅ |
| T2 | Schema canônico | ✅ |
| T3 | Baseline de migrations | ✅ |
| T4 | Comando de reset | ✅ |
| T5 | Seeds revisados | ✅ |
| T6 | API de associações | ✅ |
| T7 | Validador de origem dos lançamentos | ✅ |
| T8 | API de orçamento distribuído | ✅ |
| T9 | Projeção de caixa | ✅ |
| T10 | Contratos/helpers web | ✅ |
| T11 | UI de contas | ✅ |
| T12 | UI de lançamentos/importação | ✅ |
| T13 | UI mensal | ✅ |
| T14 | Remoção do legado substituído | ✅ |
| T15 | UAT e documentação | ✅ |

### Dependências

| Task | Depende de | Representada no plano | Status |
| --- | --- | --- | --- |
| T1 | nenhuma | raiz | ✅ |
| T2 | nenhuma | raiz paralela | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T2 | T2 → T5 | ✅ |
| T6 | T1, T2 | T1,T2 → T6 | ✅ |
| T7 | T1, T2, T6 | T1,T2,T6 → T7 | ✅ |
| T8 | T1, T2 | T1,T2 → T8 | ✅ |
| T9 | T1, T6, T8 | T1,T6,T8 → T9 | ✅ |
| T10 | T6, T8, T9 | T6,T8,T9 → T10 | ✅ |
| T11 | T10 | T10 → T11 | ✅ |
| T12 | T7, T10 | T7,T10 → T12 | ✅ |
| T13 | T8, T9, T10 | T8,T9,T10 → T13 | ✅ |
| T14 | T3, T5, T7, T8, T9, T11, T12, T13 | predecessoras → T14 | ✅ |
| T15 | T4, T5, T14 | T4,T5,T14 → T15 | ✅ |

### Co-locação de testes

| Tasks | Camada | Exigência | Planejado | Status |
| --- | --- | --- | --- | --- |
| T1 | domínio puro | unit | unit co-locado | ✅ |
| T2–T5 | schema/filesystem/seed | unit + integração isolada | testes em cada task | ✅ |
| T6–T9 | API e domínio | unit + HTTP/SQLite isolado | testes em cada task | ✅ |
| T10–T13 | frontend | unit/componente | testes em cada task | ✅ |
| T14 | refactor comportamental | regressão + TDD quando necessário | gate completo | ✅ |
| T15 | entrega | suíte + UAT | gate completo e evidência | ✅ |

### Rastreabilidade

| Requisito | Tasks |
| --- | --- |
| ACC-01 | T2, T5, T6, T11, T15 |
| PMT-01 | T2, T5, T6, T7, T10, T11, T12, T15 |
| PLAN-01 | T1, T2, T5, T8, T10, T13, T15 |
| EXEC-01 | T1, T7, T8, T9, T12, T13, T15 |
| CASH-02 | T1, T5, T9, T10, T13, T15 |
| UX-02 | T6, T10, T11, T12, T13, T15 |
| CLEAN-01 | T2, T3, T4, T5, T14, T15 |

**Cobertura:** 7 requisitos · 7 mapeados · 0 sem task.

---

_Próxima fase: Execute. Começar pelas pré-condições e por T1/T2; não executar T3 destrutiva antes do gate de T2._

---

## Revisão UX — despesas planejadas dentro da categoria

As tasks T1–T15 permanecem como fundação concluída. As tasks abaixo substituem a edição agregada do
orçamento sem desfazer contas, formas, cartões, realização ou caixa já implementados.

### T16: Criar domínio de despesas planejadas

- **O quê:** modelar linha planejada, totais derivados, agrupamento por origem e cópia mensal.
- **Onde:** `packages/domain/src/planned-expenses.ts` e testes co-locados.
- **Requisito:** PLAN-02.
- **Pronto quando:** várias linhas formam o total da categoria; vários lançamentos realizam a categoria sem vínculo obrigatório; origem e recorrência são validadas.
- **Gate:** domínio com typecheck, lint, testes e cobertura do código novo ≥ 80%.
- **Commit:** `feat(domain): add planned expense lines`.

### T17: Substituir orçamento agregado no banco e seed

- **O quê:** adicionar `planned_expenses`, migrar a baseline destrutivamente e remover estruturas substituídas após atualizar consumidores.
- **Onde:** schema, baseline Drizzle, seeds e testes de integridade.
- **Depende de:** T16.
- **Requisito:** PLAN-02, CLEAN-01.
- **Pronto quando:** linha possui mês, subcategoria, nome, valor, conta XOR cartão, ordem e recorrência opcional; seed demonstra várias despesas na mesma categoria; reset UAT permanece idempotente.
- **Gate:** testes do banco, baseline vazia, `integrity_check=ok` e `foreign_key_check` vazio.
- **Commit:** `refactor(database): store planned expense lines`.

### T18: Implementar API de despesas planejadas

- **O quê:** CRUD atômico de linhas, cópia mensal e visão mensal derivada.
- **Onde:** módulo `planned-expenses`, serviço mensal e contratos.
- **Depende de:** T16, T17.
- **Requisito:** PLAN-02, CASH-02.
- **Pronto quando:** criar/editar/remover recalcula resumos; cópia preserva linhas e avisa origens arquivadas; caixa usa as linhas restantes sem duplicar recorrências.
- **Gate:** testes HTTP/SQLite, typecheck e lint da API.
- **Commit:** `feat(api): manage monthly planned expenses`.

### T19: Redesenhar a visão mensal por categoria

- **O quê:** trocar o editor de total/distribuição por categorias expansíveis com lista de despesas planejadas.
- **Onde:** `apps/web/src/app/monthly-control/` e testes.
- **Depende de:** T18.
- **Requisito:** PLAN-02, UX-02.
- **Pronto quando:** adicionar, editar e remover linhas é rápido; nome, valor e origem ficam na linha; categoria mostra totais derivados; erro preserva rascunho; fluxo funciona por teclado.
- **Gate:** testes de estado/componente, acessibilidade, typecheck e build web.
- **Commit:** `feat(web): plan expenses within categories`.

### T20: Limpar compatibilidade e validar UAT

- **O quê:** remover edição agregada, `budget_allocations` e contratos mortos; atualizar documentação e base demonstrativa.
- **Depende de:** T17, T18, T19.
- **Requisito:** PLAN-02, CLEAN-01.
- **Pronto quando:** nenhuma tela ou API grava total agregado; buscas não encontram consumidores do contrato removido; múltiplos lançamentos realizam corretamente uma categoria com várias linhas; `pnpm check` e UAT passam.
- **Gate:** suíte completa, review Ana, reset UAT e revisão visual.
- **Commit:** `refactor(finances): remove aggregate budget editing`.

### Ordem

```text
T16 → T17 → T18 → T19 → T20
```

### Rastreabilidade adicional

| Requisito | Descrição | Tasks |
| --- | --- | --- |
| PLAN-02 | Despesas planejadas individuais dentro da categoria, com totais derivados e realização agregada | T16–T20 |
