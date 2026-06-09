# Plano de Refatoracao Financeira

Data: 2026-06-09

Este plano transforma a auditoria de regras financeiras em uma sequencia de entregas pequenas. A ordem e deliberada: primeiro corrigir significado dos dados, depois reorganizar API, depois mexer na visualizacao mensal. Assim a UI nova nao nasce em cima de numeros ambiguos.

## Objetivo

Separar claramente quatro visoes financeiras:

1. **Competencia**: o que pertence ao mes do orcamento.
2. **Caixa**: quando dinheiro entra ou sai das contas.
3. **Compromissos**: faturas, parcelas e pagamentos previstos.
4. **Patrimonio/reservas**: alocacoes, caixinhas, investimentos e objetivos.

O resultado esperado e uma aplicacao mais facil de usar porque cada tela responde uma pergunta especifica, sem chamar movimento interno de despesa comum.

## Status De Implementacao

- [x] **Bloco 1 - Fundacao financeira da API**: classificacao financeira centralizada no dominio, datas de fatura reaproveitaveis, compras no cartao normalizadas sem impacto direto em conta, saldo ignorando cancelados, relatorios protegidos contra duplicidade de pagamento de fatura e transferencias fora de consumo.
- [ ] **Bloco 2 - Controle mensal por visao**: separar respostas de competencia e caixa.
- [ ] **Bloco 3 - UI mensal em abas**: apresentar competencia e caixa de forma clara, sem misturar conceitos.
- [ ] **Bloco 4 - Relatorios finais e reconciliacao**: ajustar linguagem, filtros e apoio a conciliacao.

## Decisoes De Produto

### Controle Mensal

Manter uma unica area de Controle Mensal, mas dividir em duas abas:

- **Competencia**: visao principal de orcamento.
- **Caixa**: visao de liquidez e saldo em conta.

Como o app hoje troca paginas por estado em `apps/web/src/app/App.tsx`, a primeira implementacao deve ser com abas internas em `ControleMensalPage`. Rotas como `/controle-mensal/competencia` e `/controle-mensal/caixa` podem vir depois, quando houver roteador real.

### Regra De Linguagem

Usar nomes que descrevem o calculo:

- "Gastos de consumo" em vez de "despesas" quando transferencias, faturas e reservas ficarem fora.
- "Fluxo de caixa" quando o criterio for entrada/saida de conta.
- "Compromissos do mes" para faturas e contas previstas.
- "Aportes/reservas" para dinheiro guardado, sem misturar com consumo.

## Varredura De Reaproveitamento

Antes de codar cada etapa, reaproveitar sem criar abstracao decorativa.

### Reaproveitar No Dominio

Extrair para `packages/domain`:

- `advanceMonth`, hoje repetido em modulos da API.
- Calculo de mes de fatura e datas de fechamento/vencimento.
- Calculo de delta de conta.
- Classificacao financeira de transacoes.
- Parse/formatacao de valores e datas de importacao quando for usado por mais de uma rota.

### Reaproveitar No Frontend

Extrair para `apps/web/src/app/shared`:

- Opcoes de mes e navegacao mes anterior/proximo.
- Formatadores de moeda para tabela, card e grafico.
- Badges de status de lancamento/fatura.
- Cards pequenos de indicador, se repetirem entre Controle Mensal e Relatorios.
- Select agrupado de categoria/subcategoria, se a duplicacao continuar aparecendo.

### Nao Extrair Agora

- Layout completo de paginas.
- Cards muito especificos de uma tela.
- Componentes de tabela antes da nova estrutura estabilizar.

## Fase 0 - Baseline E Contratos

**Objetivo:** congelar o comportamento esperado antes da refatoracao.

Entregas:

- Criar testes que reproduzam os bugs financeiros conhecidos.
- Documentar invariantes em `docs/regras-negocio.md` e `docs/regras-cartao.md`, se algum ponto ainda estiver implicito.
- Definir matriz simples de inclusao:
  - entra em competencia?
  - entra em caixa?
  - entra em consumo?
  - entra em poupanca/reserva?
  - entra em compromisso?

Testes minimos:

- Compra no cartao nao altera saldo de conta.
- Pagamento de fatura altera caixa, mas nao aumenta consumo nem compras do cartao.
- Lancamento cancelado nao entra em saldo, controle mensal ou relatorio.
- Transferencia entre contas nao entra em gastos de consumo.

Arquivos provaveis:

- `apps/api/src/budgets.test.ts`
- `apps/api/src/reports.test.ts`
- Testes novos ou existentes de contas/cartoes/transacoes.

Critério de aceite:

- Testes falham antes da correcao ou protegem explicitamente comportamento ja correto.
- Nao ha mudanca visual nesta fase.

## Fase 1 - Nucleo De Classificacao Financeira

**Objetivo:** parar de depender de `type === "expense"` para tudo.

Entregas:

- Criar modulo de classificacao em `packages/domain`.
- Criar helpers de perguntas financeiras:
  - `isConsumptionForBudget`
  - `affectsCashBalance`
  - `isInternalMovement`
  - `isCreditCardPurchase`
  - `isCreditCardPayment`
  - `isReserveAllocation`
- Mover helpers de data de fatura para o dominio.
- Mover ou padronizar `getAccountDelta`.

Modelo sugerido:

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

Arquivos provaveis:

- `packages/domain/src/transactions.ts`
- `packages/domain/src/credit-card-bills.ts`
- `packages/domain/src/financial-classification.ts`
- `packages/domain/src/*.test.ts`

Critério de aceite:

- API consegue importar esses helpers sem regra duplicada.
- Testes de dominio cobrem pelo menos cartao, transferencia, cancelado e reserva.

## Fase 2 - Correcao Dos Invariantes Da API

**Objetivo:** corrigir os dados que geram totais errados.

Entregas:

- Em compras de cartao:
  - sempre gravar `accountId = null`;
  - sempre gravar `paymentMethodId = null`;
  - sempre vincular `creditCardId` e `creditCardBillId` quando aplicavel.
- No endpoint geral de transacoes:
  - rejeitar ou normalizar payload que mistura cartao com conta/metodo de pagamento.
- Em pagamento de fatura:
  - manter impacto no caixa;
  - impedir que seja contado como compra de cartao ou consumo.
- Em contas:
  - saldo deve ignorar `status = "canceled"` sempre.
- Em relatorios de cartao:
  - somar compras por `creditCardId`, nao apenas por `creditCardBillId`.

Arquivos provaveis:

- `apps/api/src/modules/credit-cards.ts`
- `apps/api/src/modules/transactions.ts`
- `apps/api/src/modules/accounts.ts`
- `apps/api/src/modules/reports.ts`
- `apps/api/src/modules/budgets.ts`

Critério de aceite:

- Testes da Fase 0 passam.
- Nenhum pagamento de fatura aparece como compra do cartao.
- Nenhuma compra de cartao altera saldo de conta antes da fatura.

## Fase 3 - API Do Controle Mensal Separada Por Visao

**Objetivo:** dar para a UI respostas prontas para cada lente financeira.

Entregas:

- Criar contrato de competencia.
- Criar contrato de caixa.
- Manter o endpoint antigo temporariamente, se necessario, como adaptador para reduzir risco.

Endpoint sugerido:

```text
GET /controle-mensal?month=YYYY-MM&view=competence
GET /controle-mensal?month=YYYY-MM&view=cash
```

Tambem e aceitavel manter `/controle-mensal` para competencia e criar `/controle-mensal/cash`, mas o parametro `view` facilita a UI com abas.

### Resposta De Competencia

Deve conter:

- receitas do mes;
- gastos de consumo por categoria;
- planejado, realizado, comprometido e restante;
- faturas que vencem no mes como compromissos;
- parcelas futuras que pertencem ao mes;
- alertas de categoria estourada.

Nao deve conter como gasto de consumo:

- pagamento de fatura;
- transferencia entre contas;
- aporte para reserva/investimento;
- resgate de reserva.

### Resposta De Caixa

Deve conter:

- saldo inicial do mes por conta;
- entradas reais;
- saidas reais;
- pagamento de fatura como saida de caixa;
- transferencias entre contas no detalhamento por conta;
- saldo final previsto;
- menor saldo previsto no mes;
- timeline diaria de saldo.

Compras no cartao nao entram no caixa no dia da compra.

Critério de aceite:

- Nao existe campo de resumo que some consumo e pagamento de fatura no mesmo total sem rotulo explicito.
- Os nomes dos campos indicam a base: `competence`, `cash`, `commitment`, `allocation`.

## Fase 4 - Nova Visualizacao Mensal

**Objetivo:** transformar Controle Mensal em painel com duas lentes claras.

Entregas:

- Refatorar `ControleMensalPage` em container de mes + abas.
- Criar subcomponentes:
  - `CompetenceMonthlyView`
  - `CashMonthlyView`
  - componentes compartilhados pequenos apenas quando houver repeticao real.
- Manter mesma selecao de mes para as duas abas.
- Preservar filtros relevantes, mas evitar filtros que mudem o significado dos KPIs sem aviso.

### Aba Competencia

Blocos:

- Resumo do mes:
  - receitas;
  - gastos de consumo;
  - compromissos de fatura;
  - sobra prevista.
- Orcamento por categoria:
  - planejado;
  - realizado;
  - comprometido;
  - restante.
- Faturas do mes:
  - aberta;
  - fechada;
  - paga;
  - vencida.
- Alertas:
  - categorias estouradas;
  - faturas proximas;
  - receitas planejadas ainda nao confirmadas.

### Aba Caixa

Blocos:

- Saldo consolidado:
  - saldo inicial;
  - entradas;
  - saidas;
  - saldo final.
- Evolucao diaria de saldo.
- Por conta:
  - saldo inicial;
  - entradas;
  - saidas;
  - saldo final.
- Compromissos de caixa:
  - faturas a pagar;
  - contas previstas;
  - vencimentos proximos.
- Risco de caixa:
  - menor saldo projetado;
  - dias com saldo negativo ou muito baixo.

Critério de aceite visual:

- A usuaria consegue dizer, olhando o titulo da aba, se esta vendo orcamento ou dinheiro em conta.
- Pagamento de fatura nao aparece misturado com supermercado, moradia ou lazer.
- Compra no cartao aparece no orcamento de competencia, mas nao na linha de caixa ate o pagamento.

## Fase 5 - Relatorios Com Base Explicita

**Objetivo:** alinhar relatorios com as mesmas lentes da tela mensal.

Entregas:

- Adicionar filtro/base:
  - competencia;
  - caixa.
- Ajustar graficos de categoria para usarem consumo por competencia.
- Ajustar evolucao diaria para deixar claro quando e saldo de caixa.
- Corrigir taxa de poupanca:
  - nao tratar aporte/reserva/investimento como gasto de consumo;
  - exibir taxa de aporte/poupanca separada da sobra operacional.
- Revisar resumo de cartoes para excluir pagamento de fatura do total de compras.

Critério de aceite:

- Todo card e grafico responde uma pergunta clara.
- O mesmo mes nao mostra totais conflitantes sem explicar a base.

## Fase 6 - Conciliacao

**Objetivo:** transformar importacao CSV em controle de confianca.

Entregas:

- Criar conceito de item importado nao conciliado, mesmo que inicialmente seja uma estrutura simples.
- Sugerir match por:
  - valor;
  - data proxima;
  - conta/cartao;
  - descricao parecida.
- Permitir acoes:
  - confirmar match;
  - criar novo lancamento;
  - ignorar;
  - marcar como duplicado.
- Atualizar status para `reconciled` quando confirmado.
- Exibir diferenca entre saldo esperado do app e saldo do extrato quando a origem tiver saldo.

Critério de aceite:

- Importar CSV nao significa automaticamente "esta conferido".
- Existe uma fila clara do que ainda precisa de revisao.

## Fase 7 - Reservas E Patrimonio

**Objetivo:** tratar caixinhas como alocacao patrimonial, nao despesa comum.

Entregas:

- Confirmar schema de reservas.
- Vincular aporte/resgate a conta quando houver movimento real de dinheiro.
- Garantir que aporte nao entre em gasto de consumo.
- Mostrar reservas na visao de patrimonio/objetivos.
- Exibir aporte do mes como taxa de poupanca/alocacao.

Critério de aceite:

- Saldo de reserva bate com movimentos.
- Conta de origem/destino reflete aporte ou resgate.
- Relatorios de consumo nao pioram quando a usuaria guarda dinheiro.

## Fase 8 - Banco, Constraints E Limpeza Final

**Objetivo:** reduzir chance de regressao silenciosa.

Entregas:

- Adicionar constraints ou validacoes centralizadas para enums financeiros.
- Adicionar chave unica logica para budgets por:
  - mes;
  - subcategoria;
  - meio de pagamento quando aplicavel.
- Corrigir merge de subcategorias para consolidar budgets duplicados.
- Remover adaptadores antigos da API quando a UI ja estiver migrada.
- Remover duplicacoes pequenas que sobraram.

Critério de aceite:

- Dados invalidos nao entram facilmente.
- Merge de categoria nao infla planejado.
- Codigo antigo de calculo mensal nao fica coexistindo com o novo sem uso.

## Blocos De Implementacao E Teste

As fases acima nao precisam ser implementadas uma a uma. O melhor fluxo e juntar fases que tenham o mesmo tipo de risco e possam ser validadas com o mesmo cenario de teste.

### Bloco 1 - Fundacao Financeira Da API

Agrega:

- Fase 0: baseline e contratos.
- Fase 1: nucleo de classificacao financeira.
- Parte principal da Fase 2: invariantes de cartao, fatura, cancelados e saldos.

Por que juntar:

- Tudo mexe no significado dos lancamentos.
- O teste e essencialmente o mesmo: dado um conjunto pequeno de transacoes, conferir saldo, consumo, fatura e transferencia.
- Ainda nao envolve UI, entao a depuracao fica objetiva.

Nao incluir neste bloco:

- Redesenho do Controle Mensal.
- Relatorios visuais.
- Reservas completas.

Teste do bloco:

- `pnpm test`
- `pnpm typecheck`
- Teste manual via API ou banco seedado com:
  - compra no debito;
  - compra no cartao;
  - fatura paga;
  - transferencia;
  - cancelado.

Entrega esperada:

- Numeros corretos no backend, mesmo que a tela mensal ainda esteja visualmente antiga.

### Bloco 2 - Contratos Mensais Por Visao

Agrega:

- Fase 3: API mensal por visao.
- Parte restante da Fase 2 que afeta agregacoes do controle mensal.
- Pequena limpeza de nomes de campos para deixar `competence`, `cash`, `commitment` e `allocation` explicitos.

Por que juntar:

- A UI nova precisa de um contrato estavel.
- Se a API antiga e a API nova coexistirem por muito tempo, o risco de divergencia aumenta.
- Ainda pode ser testado sem julgar layout.

Nao incluir neste bloco:

- Refatoracao visual grande.
- Componentes compartilhados de frontend que nao sejam necessarios.

Teste do bloco:

- `pnpm test`
- `pnpm typecheck`
- Conferencia manual de payloads:
  - `view=competence` deve mostrar consumo e compromissos;
  - `view=cash` deve mostrar entradas, saidas e saldo;
  - pagamento de fatura aparece em caixa, mas nao como consumo.

Entrega esperada:

- Backend pronto para alimentar as duas abas da tela mensal.

### Bloco 3 - Nova Tela Mensal Em Abas

Agrega:

- Fase 4: UI mensal com abas Competencia e Caixa.
- Extracoes pequenas em `apps/web/src/app/shared` que forem diretamente usadas pela tela.
- Ajuste de textos, indicadores e nomes para refletir os novos conceitos.

Por que juntar:

- A tela mensal deve ser revisada como experiencia completa.
- Testar card por card separadamente nao garante que a pagina ficou compreensivel.
- A selecao de mes, abas, KPIs e tabelas precisam funcionar juntos.

Nao incluir neste bloco:

- Relatorios anuais.
- Conciliacao.
- Reservas completas, exceto se aparecerem como placeholder ou resumo neutro.

Teste do bloco:

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- Revisao visual no app em desktop e mobile.
- Cenario manual com os mesmos dados do Bloco 1.

Entrega esperada:

- Controle Mensal compreensivel com duas lentes:
  - Competencia para orcamento.
  - Caixa para liquidez.

### Bloco 4 - Relatorios Alinhados Ao Novo Modelo

Agrega:

- Fase 5: relatorios com base explicita.
- Ajuste da taxa de poupanca/aporte.
- Reuso dos helpers de classificacao financeira criados no Bloco 1.
- Ajustes de formatacao/graficos compartilhados se reduzirem duplicacao real.

Por que juntar:

- Relatorios precisam seguir a mesma linguagem da tela mensal.
- Nao vale revisar graficos antes da base conceitual estar pronta.
- A validacao visual e analitica acontece com o mesmo conjunto de dados.

Nao incluir neste bloco:

- Conciliacao.
- Backups.
- Grandes mudancas de schema de reservas.

Teste do bloco:

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- Conferir graficos com base de competencia e caixa.
- Conferir que taxa de poupanca nao piora quando ha aporte/reserva.

Entrega esperada:

- Relatorios sem mistura silenciosa entre consumo, caixa e patrimonio.

### Bloco 5 - Conciliacao

Agrega:

- Fase 6 completa.
- Ajustes pequenos no importador CSV que forem necessarios.
- Uso do status `reconciled` nos fluxos existentes.

Por que manter separado:

- Conciliacao e um fluxo proprio, com estado proprio e UX propria.
- Misturar com tela mensal ou relatorios dificultaria testar importacao, matching e revisao.

Teste do bloco:

- `pnpm test`
- `pnpm typecheck`
- Teste manual com CSV contendo:
  - lancamento novo;
  - possivel duplicado;
  - pagamento de fatura;
  - transferencia;
  - descricao parecida com lancamento existente.

Entrega esperada:

- Importacao deixa claro o que foi conciliado e o que ainda precisa de revisao.

### Bloco 6 - Reservas E Patrimonio

Agrega:

- Fase 7 completa.
- Ajustes em relatorios de patrimonio/aporte se ainda nao tiverem sido finalizados.
- Integracao de aporte/resgate com conta.

Por que manter separado:

- Reserva cria uma nova area funcional.
- A regra de consumo ja deve estar estabilizada antes, para aporte nao virar despesa por acidente.

Teste do bloco:

- `pnpm test`
- `pnpm typecheck`
- Teste manual com:
  - criar reserva;
  - aportar de uma conta;
  - resgatar para uma conta;
  - registrar rendimento;
  - conferir saldo de reserva e conta.

Entrega esperada:

- Caixinhas funcionam como alocacao patrimonial, nao como despesa comum.

### Bloco 7 - Constraints, Merge E Limpeza

Agrega:

- Fase 8 completa.
- Consolidacao de budgets duplicados no merge de subcategoria.
- Remocao de adaptadores antigos.
- Constraints ou validacoes centralizadas que dependam do modelo ja estabilizado.

Por que deixar por ultimo:

- Constraints antes da semantica estabilizar podem travar migracoes futuras.
- Remover codigo antigo cedo demais dificulta comparar resultados.

Teste do bloco:

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- Teste manual de merge de subcategoria com budgets no mesmo mes.

Entrega esperada:

- Codigo mais limpo, dados mais protegidos e menos caminhos duplicados de calculo.

## Ordem Recomendada De Implementacao

1. Bloco 1: Fundacao Financeira Da API.
2. Bloco 2: Contratos Mensais Por Visao.
3. Bloco 3: Nova Tela Mensal Em Abas.
4. Bloco 4: Relatorios Alinhados Ao Novo Modelo.
5. Bloco 5: Conciliacao.
6. Bloco 6: Reservas E Patrimonio.
7. Bloco 7: Constraints, Merge E Limpeza.

Os blocos 5 e 6 podem trocar de ordem se a prioridade for caixinhas antes de conciliacao. Eu manteria conciliacao primeiro se o objetivo for confiar nos numeros importados.

## Checkpoints De Verificacao

Rodar ao fim de cada fase:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Quando houver mudanca visual:

- Revisar Controle Mensal em desktop e mobile.
- Testar mes com:
  - compra no debito;
  - compra no cartao;
  - fatura paga;
  - transferencia entre contas;
  - lancamento cancelado;
  - categoria com limite estourado.
- Conferir se os totais batem manualmente em pelo menos um cenario pequeno.

## Primeiro Recorte Pratico

Para comecar sem abrir um refactor enorme, a primeira entrega implementavel deve ser:

1. Testes de compra no cartao sem saldo de conta.
2. Testes de pagamento de fatura sem duplicar compra.
3. Testes de cancelados fora de saldo.
4. Helper de classificacao financeira no dominio.
5. Correcao dos endpoints de cartao, transacoes, contas e relatorios afetados.

Depois disso, a tela mensal nova fica bem menos arriscada.
