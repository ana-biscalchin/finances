# Auditoria de Regras Financeiras e Produto

Data: 2026-06-09

Esta auditoria cruza as regras documentadas, o comportamento implementado e referencias externas de apoio sobre orcamento pessoal, visualizacao de dados e planejamento financeiro.

## Diagnostico Central

O app esta bem encaminhado, mas hoje ainda mistura conceitos que precisam ficar separados para a usuaria confiar nos numeros:

1. **Competencia economica**: quando uma compra/receita pertence ao orcamento.
2. **Fluxo de caixa**: quando dinheiro entra ou sai de uma conta.
3. **Compromissos**: faturas, parcelas futuras e contas previstas.
4. **Patrimonio/reservas**: dinheiro realocado para objetivos, investimentos ou caixinhas.

A regra mais importante para simplificar a aplicacao e evitar confusao: pagamento de fatura, transferencia entre contas, aporte em reserva e compra no cartao nao podem ser tratados como o mesmo tipo de "despesa". Eles aparecem em telas diferentes ou com etiquetas diferentes.

## Falhas De Logica Encontradas

### Alta Prioridade

1. **Compra manual no cartao pode movimentar conta bancaria**
   - Em `apps/api/src/modules/credit-cards.ts`, a criacao manual de compra na fatura usa `accountId: card.paymentAccountId ?? null`.
   - Isso conflita com `docs/regras-cartao.md`, que define que compra no cartao deve ter `accountId = null` e nao deve alterar saldo de conta.
   - Risco: saldo de conta e relatorios podem cair no momento da compra e cair de novo no pagamento da fatura.
   - Direcao: forcar `accountId = null` e `paymentMethodId = null` para qualquer compra com `creditCardId`. Repetir a validacao no endpoint geral de transacoes.

2. **Resumo de cartoes pode contar pagamento da fatura como se fosse compra**
   - Em `apps/api/src/modules/reports.ts`, o resumo de cartoes busca despesas por `creditCardBillId`.
   - O pagamento da fatura tambem recebe `creditCardBillId`, mas `creditCardId = null`.
   - Risco: depois que a fatura e paga, o relatorio pode somar compras + pagamento, duplicando o valor.
   - Direcao: relatorios de compras do cartao devem filtrar `creditCardId = card.id`. Pagamento de fatura pertence ao fluxo de caixa, nao ao consumo do cartao.

3. **Saldos de conta incluem lancamentos cancelados**
   - Em `apps/api/src/modules/accounts.ts`, os saldos calculados para listagem e detalhe nao filtram `status !== "canceled"`.
   - Isso conflita com `docs/regras-negocio.md`, que determina que cancelados nao entram em saldo nem agregacoes.
   - Direcao: criar um helper unico de saldo de conta que ignore cancelados e usar em todos os lugares.

4. **Controle mensal mistura gasto, compromisso de cartao e pagamento de fatura**
   - Em `apps/api/src/modules/budgets.ts`, categorias de natureza `transfer` acabam tratadas como despesa em varios pontos.
   - A linha de "Pagamento de fatura" e sobrescrita com totais de faturas do mes, e o resumo soma isso junto com outras despesas.
   - Risco: "Despesas vs limite" pode parecer consumo mensal, mas inclui quitacao de fatura, que e movimento de caixa.
   - Direcao: separar a tela em blocos explicitos:
     - **Gastos do mes**: compras/consumo por competencia.
     - **Faturas a pagar/pagas**: compromissos e liquidacao.
     - **Fluxo de caixa**: entradas e saidas reais de contas.

5. **Transferencias internas ainda dependem demais de categoria**
   - Transferencia entre contas e pagamento de fatura aparecem como lancamentos `income`/`expense` ou categoria `transfer`.
   - Risco: qualquer relatorio que soma `type = expense` pode capturar movimentacao interna como gasto.
   - Direcao: criar uma classificacao de dominio derivada, por exemplo `financialRole`, para diferenciar consumo, receita, transferencia interna, pagamento de fatura, reserva e ajuste.

### Media Prioridade

6. **Relatorios usam data de evento sem explicitar base de analise**
   - Relatorios anuais e evolucao diaria usam `eventDate`.
   - Controle mensal e regras de cartao usam `budgetMonth`.
   - Risco: uma compra no cartao feita em janeiro, com fatura vencendo em fevereiro, pode aparecer em meses diferentes dependendo da tela.
   - Direcao: todo relatorio deve indicar e permitir escolher a base:
     - **Competencia** para consumo e orcamento.
     - **Caixa** para saldo de contas e liquidez.

7. **Taxa de poupanca pode estar conceitualmente errada**
   - Hoje aportes/investimentos estao modelados em categorias de despesa.
   - Se a taxa de poupanca for `receita - despesa`, aporte em investimento reduz a propria poupanca.
   - Direcao: separar "gasto de consumo" de "alocacao patrimonial". Mostrar:
     - Taxa de poupanca/aporte: reservas + investimentos / renda.
     - Sobra operacional: renda - consumo - dividas - obrigacoes.

8. **Reservas existem no banco, mas nao fecham com contas**
   - `reserve_goals` e `reserve_movements` existem, mas os movimentos nao parecem vinculados a movimentacao real de conta.
   - Risco: caixinha pode dizer que recebeu aporte sem o dinheiro sair de uma conta.
   - Direcao: cada aporte/resgate de reserva deve poder gerar ou se vincular a um movimento de conta, sem contar como consumo.

9. **Orcamentos podem duplicar depois de merge de subcategoria**
   - O merge move budgets para a subcategoria destino, mas nao resolve possiveis duplicatas com mesmo mes/metodo/subcategoria.
   - Risco: limite planejado pode inflar apos organizacao de categorias.
   - Direcao: adicionar chave unica logica para orcamento e consolidar valores no merge.

10. **Enums financeiros estao pouco protegidos**
    - `type`, `status`, `nature` e `behavior` dependem de validacao de aplicacao e textos soltos.
    - Risco: um valor invalido quebra agrupamentos ou fica invisivel nos relatorios.
    - Direcao: centralizar enums no dominio e, quando possivel, adicionar constraints/migracoes no banco.

## Melhor Modelo Conceitual

Sem reescrever tudo agora, o melhor caminho e introduzir uma camada de classificacao financeira compartilhada em `packages/domain/`.

Exemplo de papeis financeiros:

```ts
type FinancialRole =
  | "income"
  | "consumption"
  | "credit_card_purchase"
  | "credit_card_payment"
  | "internal_transfer"
  | "reserve_allocation"
  | "investment_allocation"
  | "adjustment";
```

Essa classificacao deve responder perguntas praticas:

- Entra no orcamento de consumo?
- Entra no saldo de conta?
- Entra no fluxo de caixa?
- Entra na taxa de poupanca?
- Deve aparecer como compromisso futuro?
- Deve ser excluido de relatorios de despesa?

Isso reduz a dependencia de inferencias frageis como `type === "expense"` ou nome de categoria.

## Direcionamento De Produto E UX

### Controle Mensal

A tela central deve funcionar como um painel de decisao, nao como um extrato.

Blocos recomendados:

1. **Resultado do mes**
   - Receitas realizadas.
   - Gastos de consumo realizados.
   - Compromissos pendentes.
   - Sobra prevista.

2. **Gastos por categoria**
   - Apenas consumo por competencia.
   - Cartao entra pelo mes da fatura.
   - Transferencia, pagamento de fatura e reserva ficam fora desse bloco.

3. **Faturas**
   - Aberta, fechada, paga, vencida.
   - Total da fatura.
   - Total ja conciliado/importado.
   - Botao claro para pagar fatura.

4. **Fluxo de caixa**
   - Entradas e saidas reais das contas.
   - Pagamento de fatura aparece aqui.
   - Compra no cartao nao aparece aqui ate a fatura ser paga.

5. **Reservas e objetivos**
   - Aportes do mes.
   - Resgates.
   - Saldo por objetivo.
   - Progresso ate a meta.

### Relatorios

Cada grafico deve deixar claro qual pergunta responde:

- "Para onde meu dinheiro foi?" -> consumo por competencia.
- "Quando meu caixa apertou?" -> fluxo de caixa por data.
- "Quanto estou comprometida nos proximos meses?" -> parcelas e faturas futuras.
- "Estou aumentando patrimonio?" -> reservas/investimentos e saldo liquido.

Evitar graficos que misturem essas perguntas no mesmo total. Quando houver alternancia entre caixa e competencia, usar um controle visivel e manter os nomes dos indicadores coerentes.

### Conciliacao

O arquivo `tarefas` cita conciliacao. Esse deve ser um modulo de confianca, nao apenas importacao.

Fluxo sugerido:

1. Importar extrato.
2. Mostrar linhas importadas nao conciliadas.
3. Sugerir matches por data, valor, conta/cartao e descricao.
4. Permitir confirmar match, criar novo lancamento ou ignorar.
5. Marcar lancamentos como `reconciled`.
6. Mostrar diferenca entre saldo esperado e saldo do extrato.

## Reaproveitamento Recomendado

Extrair apenas o que reduz bug financeiro ou duplicacao recorrente.

### `packages/domain`

- Calculo de mes de fatura e datas de fechamento/vencimento.
- Avanco de mes (`advanceMonth`).
- Classificacao financeira (`FinancialRole`).
- Regras de inclusao em orcamento, caixa, relatorios e poupanca.
- Parse/formatacao de dinheiro e datas de importacao.
- Calculo de delta em conta.

### `apps/web/src/app/shared`

- Opcoes e navegacao de mes.
- Formatadores de moeda para cards, tabelas e graficos.
- Componentes de status de lancamento/fatura.
- Select agrupado de categorias/subcategorias.
- Pequenos cards de KPI usados em controle mensal e relatorios.

Nao vale extrair todo card visual agora. O ganho real esta nas regras compartilhadas que hoje podem gerar numero errado.

## Plano Prioritario

1. **Corrigir invariantes de cartao e cancelados**
   - Compra no cartao nunca movimenta conta.
   - Pagamento de fatura nunca entra como compra do cartao.
   - Cancelados nunca entram em saldo/agregacao.
   - Adicionar testes de API para esses casos.

2. **Criar classificacao financeira no dominio**
   - Centralizar papeis financeiros.
   - Substituir somas baseadas so em `type`.
   - Tratar `transfer` como neutro por padrao.

3. **Reorganizar Controle Mensal**
   - Separar consumo, faturas, fluxo de caixa e reservas.
   - Renomear indicadores que hoje podem induzir erro.

4. **Revisar relatorios**
   - Adicionar base `competencia` vs `caixa`.
   - Ajustar taxa de poupanca.
   - Separar consumo de alocacao patrimonial.

5. **Implementar conciliacao**
   - Comecar por matching simples de importacao CSV.
   - Evoluir para reconciliacao por conta/cartao e saldo.

6. **Fortalecer banco e merges**
   - Chaves unicas para budgets por escopo.
   - Consolidacao segura no merge de subcategorias.
   - Constraints ou validacoes centralizadas para enums.

## Testes Que Devem Existir

- Compra no cartao cria transacao sem `accountId` e sem impacto no saldo da conta.
- Pagamento de fatura reduz caixa, mas nao aumenta despesa de consumo nem total comprado no cartao.
- Lancamento cancelado nao altera saldo, orcamento nem relatorios.
- Transferencia entre contas nao entra em despesas.
- Fatura com compra antes do fechamento cai no mes correto.
- Compra parcelada distribui parcelas nos meses corretos.
- Merge de subcategoria consolida budgets duplicados.
- Taxa de poupanca nao diminui por causa de aporte classificado como investimento/reserva.

## Checklist Visual Para Revisao

- A tela mensal nao deve mostrar pagamento de fatura misturado com consumo.
- Relatorios devem indicar se estao em caixa ou competencia.
- Faturas devem deixar claro o que foi comprado, o que vence e o que foi pago.
- Transferencias e reservas devem aparecer como movimentos internos/alocacoes, nao como gasto comum.
- Indicadores devem ter nomes que expressem exatamente o calculo.

## Referencias Consultadas

- Banco Central do Brasil, portal de cidadania financeira: https://www.bcb.gov.br/cidadaniafinanceira
- CFPB, materiais de orcamento e poupanca: https://www.consumerfinance.gov/consumer-tools/
- Investor.gov, planejamento e orcamento: https://www.investor.gov/financial-tools-calculators/financial-planning/budgeting
- ISO 22222 como referencia de processo de planejamento financeiro pessoal, resumida em: https://pt.wikipedia.org/wiki/Planejador_financeiro_pessoal
- Conceitos gerais de orcamento pessoal: https://en.wikipedia.org/wiki/Personal_budget
- Boas praticas gerais de visualizacao: https://en.wikipedia.org/wiki/Data_and_information_visualization
- Boas praticas gerais de dashboards: https://en.wikipedia.org/wiki/Dashboard_(computing)

As fontes externas foram usadas como apoio conceitual. As recomendacoes finais priorizam a consistencia das regras ja documentadas no projeto e a separacao classica entre competencia, caixa e patrimonio.
