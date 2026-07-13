# Spec — Fundação mensal da Carteira da Ana

**Owner:** Ana
**Cliente / produto:** Carteira da Ana
**Sponsor:** Ana
**Status:** approved
**PRD:** não existe
**Criado em:** 2026-07-13  ·  **Última atualização:** 2026-07-13

---

## Contexto

A Carteira da Ana já registra contas, lançamentos, cartões, faturas e planejamentos, mas sua tela
central ainda exige interpretar planejado, comprometido, realizado e disponível ao mesmo tempo. A
primeira construção do produto deve ser mensal e reduzir esse atrito: planejar o mês, acompanhar o
que foi gasto e conferir se o resultado é compatível com o dinheiro nas contas.

A auditoria também encontrou riscos de integridade nos pares de transferência e no ciclo de
pagamento de fatura. Esses fluxos precisam ser robustecidos antes da expansão para patrimônio e
gestão financeira de longo prazo.

## Visão

A usuária inicia o mês criando seu planejamento e acompanha uma leitura direta de planejado, gasto
e disponível, com indicação visual quando estiver acima do planejado. Uma visão complementar mostra saldos, pagamentos e risco de saldo negativo,
enquanto transferências e faturas preservam a integridade entre consumo e caixa.

## Goals

- [x] Permitir iniciar e acompanhar o planejamento mensal sem expor `comprometido` como indicador principal.
- [x] Fazer transferências e pagamentos de fatura manterem saldos consistentes mesmo diante de falhas.
- [x] Simplificar a importação para prévia, conferência e confirmação, preservando proteções básicas.
- [x] Antecipar movimentações recorrentes de conta e cartão sem confundi-las com parcelamentos.
- [x] Preparar a navegação para mês, dinheiro nas contas e patrimônio, construindo primeiro o núcleo mensal.

## Fora de escopo

| Item | Por que está fora |
| --- | --- |
| Investimentos e rentabilidade | Evolução posterior do eixo patrimonial. |
| Dívidas e financiamentos fora do cartão | Backlog após a fundação mensal. |
| Reservas, metas e evolução patrimonial completa | O produto será de longo prazo, mas a primeira construção é mensal. |
| IA na importação | Evolução futura; não justifica manter conciliação sofisticada agora. |
| Relatórios comparativos avançados | Prioridade posterior à correção dos fluxos centrais. |
| Backups automáticos, retenção e cópia externa | Backup manual e restauração já existem. |
| Múltiplas moedas | O escopo confirmado é exclusivamente BRL. |

---

## User stories

### P1: Planejar e acompanhar o mês ⭐ MVP

**Story:** Como usuária, quero planejar meus gastos e acompanhar a realização para saber facilmente
quanto ainda posso gastar ou quanto estou acima do plano.
**Por que P1:** Esta é a finalidade central da primeira construção do produto.

**Critérios de aceite:**

1. QUANDO a usuária iniciar um mês ENTÃO o sistema DEVE permitir criar ou copiar o planejamento desse mês.
2. QUANDO houver planejamento e consumo ENTÃO o sistema DEVE destacar `Planejado`, `Gasto` e `Disponível`.
3. QUANDO o gasto estiver dentro do plano ENTÃO o sistema DEVE calcular `Disponível = Planejado - Gasto`.
4. QUANDO o gasto ultrapassar o plano ENTÃO o sistema DEVE mostrar quanto ficou `Acima do planejado`, como situação visual e não como indicador financeiro separado.
5. QUANDO uma compra parcelada existir ENTÃO cada parcela DEVE consumir o planejamento no mês da respectiva fatura.
6. QUANDO uma fatura importada repetir a data original da compra em parcelas diferentes ENTÃO o sistema DEVE preservar essa data sem mover as parcelas para o mesmo mês.
7. QUANDO uma análise por data da compra for exibida ENTÃO ela DEVE permanecer distinta do consumo do planejamento por mês da fatura.
8. QUANDO existir uma obrigação ainda não paga ENTÃO o sistema DEVE mostrá-la em `Dinheiro nas contas`, sem promover `Comprometido` a indicador principal.
9. QUANDO a usuária criar ou ajustar o orçamento ENTÃO o sistema DEVE permitir edição direta na visão mensal e atualizar imediatamente o disponível.
10. QUANDO o mês ainda não tiver orçamento ENTÃO o sistema DEVE permitir começar do zero ou copiar outro mês sem exigir um formulário extenso.
11. QUANDO detalhes por conta ou meio de pagamento forem necessários ENTÃO o sistema DEVE apresentá-los progressivamente e de forma opcional.

**Teste independente:** Criar um planejamento, registrar gastos em conta e cartão, verificar o
disponível e ultrapassar uma categoria para verificar a situação `Acima do planejado`.

### P1: Conferir o dinheiro nas contas ⭐ MVP

**Story:** Como usuária, quero ver saldos, pagamentos esperados e risco de saldo negativo para
conferir se a execução do mês bate com minhas contas.

**Critérios de aceite:**

1. QUANDO a usuária abrir `Dinheiro nas contas` ENTÃO o sistema DEVE mostrar saldo por conta e pagamentos relevantes.
2. QUANDO pagamentos projetados levarem uma conta abaixo de zero ENTÃO o sistema DEVE destacar o risco e a conta afetada.
3. QUANDO uma compra de cartão for registrada ENTÃO o sistema NÃO DEVE reduzir uma conta antes do pagamento da fatura.
4. QUANDO uma fatura for paga ENTÃO o sistema DEVE refletir a saída pela data real do pagamento.

**Teste independente:** Comparar os saldos com saldo inicial, lançamentos, transferência e pagamento de fatura.

### P1: Transferências consistentes ⭐ MVP

**Story:** Como usuária, quero transferir dinheiro entre minhas contas sem criar gasto ou deixar saldos inconsistentes.

**Critérios de aceite:**

1. QUANDO uma transferência for criada, editada ou excluída ENTÃO o sistema DEVE persistir as duas pernas atomicamente.
2. QUANDO uma transferência for informada ENTÃO o sistema DEVE exigir contas diferentes e valores equivalentes.
3. QUANDO uma transferência for agregada ENTÃO o sistema NÃO DEVE tratá-la como consumo ou renda.
4. QUANDO houver vínculo incompleto ENTÃO o sistema DEVE expor a inconsistência e não tratá-la silenciosamente como transferência válida.

**Teste independente:** Criar, editar e excluir uma transferência, verificando saldos e neutralidade econômica.

### P1: Ciclo robusto de fatura ⭐ MVP

**Story:** Como usuária, quero pagar total ou parcialmente uma fatura sem divergência entre fatura e conta.

**Critérios de aceite:**

1. QUANDO um pagamento for registrado ENTÃO o sistema DEVE exigir conta, data real e valor pago.
2. QUANDO fatura e pagamento forem atualizados ENTÃO o sistema DEVE persistir as mudanças atomicamente.
3. QUANDO uma fatura estiver integralmente paga ENTÃO o sistema DEVE bloquear alterações financeiras nas compras e permitir apenas renomear e recategorizar.
4. QUANDO houver pagamento parcial ou mínimo ENTÃO o sistema DEVE preservar o saldo remanescente.
5. QUANDO houver atraso, juros ou multa ENTÃO o sistema DEVE representar esses valores explicitamente.

**Teste independente:** Pagar parcialmente e depois integralmente uma fatura, conferir a conta e testar os campos bloqueados.

### P2: Importação com conferência simples

**Story:** Como usuária, quero importar um arquivo, conferir os dados essenciais e confirmar os lançamentos sem operar um conciliador complexo.

**Critérios de aceite:**

1. QUANDO um arquivo for selecionado ENTÃO o sistema DEVE mostrar uma prévia simples antes de persistir dados.
2. QUANDO houver dados essenciais inválidos ENTÃO o sistema DEVE permitir corrigi-los ou impedir a confirmação.
3. QUANDO a importação for confirmada ENTÃO a API DEVE validar o mesmo contrato financeiro da criação normal.
4. QUANDO houver provável duplicidade ENTÃO o sistema DEVE oferecer proteção básica, sem pontuação ou resolução de matches.
5. QUANDO a importação terminar ENTÃO o sistema DEVE facilitar a revisão dos lançamentos importados.

**Teste independente:** Importar um CSV pequeno, corrigir uma linha, confirmar e revisar os lançamentos.

### P1: Movimentações recorrentes ⭐ MVP

**Story:** Como usuária, quero registrar movimentações que se repetem em contas e cartões para
antecipar o mês sem recriar manualmente cada lançamento.

**Critérios de aceite:**

1. QUANDO uma recorrência for criada ENTÃO o sistema DEVE registrar frequência, início, próxima ocorrência e término opcional.
2. QUANDO a recorrência usar conta corrente ENTÃO o sistema DEVE suportar receitas, débito, Pix e boleto recorrentes.
3. QUANDO a recorrência usar cartão ENTÃO o sistema DEVE projetar cada cobrança na respectiva fatura.
4. QUANDO uma ocorrência futura ainda não tiver acontecido ENTÃO o sistema DEVE tratá-la como previsão, sem registrá-la como gasto realizado.
5. QUANDO uma ocorrência variar de valor ENTÃO o sistema DEVE permitir ajustá-la sem alterar silenciosamente toda a série.
6. QUANDO uma ocorrência for editada ENTÃO o sistema DEVE permitir escolher entre somente esta e esta e as próximas.
7. QUANDO uma série for pausada, retomada ou encerrada ENTÃO o sistema NÃO DEVE gerar ocorrências fora do período ativo.
8. QUANDO uma geração for repetida ENTÃO o sistema NÃO DEVE duplicar ocorrências já criadas.
9. QUANDO uma compra for parcelada ENTÃO o sistema DEVE tratá-la como obrigação finita distinta de uma recorrência.

**Teste independente:** Criar recorrências em conta e cartão, gerar dois meses, ajustar uma
ocorrência, pausar a série e comprovar ausência de duplicação.

### P2: Identidade e estrutura do produto

**Story:** Como usuária, quero reconhecer a Carteira da Ana e navegar por perguntas financeiras claras.

**Critérios de aceite:**

1. QUANDO o aplicativo for exibido ENTÃO o sistema DEVE usar o nome `Carteira da Ana`.
2. QUANDO a navegação for organizada ENTÃO o sistema DEVE separar `Visão do mês`, `Dinheiro nas contas` e `Patrimônio`.
3. QUANDO uma capacidade ainda não existir ENTÃO o sistema DEVE apresentá-la como futura.

**Teste independente:** Abrir o aplicativo e verificar identidade, navegação e indicação de módulos futuros.

---

## Edge cases

- QUANDO não houver planejamento ENTÃO o sistema DEVE oferecer uma ação clara para iniciar ou copiar.
- QUANDO não houver gastos ENTÃO o sistema DEVE mostrar o planejado integralmente disponível.
- QUANDO houver gasto sem planejamento ENTÃO o sistema DEVE mostrá-lo como valor acima do planejado.
- QUANDO um banco repetir a data original em todas as parcelas ENTÃO o sistema DEVE manter cada parcela na fatura correta.
- QUANDO uma recorrência e um parcelamento tiverem descrições semelhantes ENTÃO o sistema DEVE preservar a natureza de cada série.
- QUANDO uma transferência ou fatura falhar no meio ENTÃO o sistema DEVE reverter toda a operação e expor o erro.
- QUANDO a confirmação da importação contornar a prévia ENTÃO a API DEVE rejeitar dados inválidos.
- QUANDO uma fatura paga receber tentativa de alteração financeira ENTÃO o sistema DEVE rejeitar a operação.

## Requisitos não-funcionais

- **Segurança dos dados:** operações parciais não podem deixar saldos, transferências ou faturas divergentes.
- **Validação:** toda entrada financeira deve ser validada na fronteira HTTP e no domínio.
- **Moeda:** todos os valores usam BRL e centavos inteiros.
- **Usabilidade:** indicadores principais devem ser compreensíveis sem conhecimento contábil.
- **Observabilidade:** falhas financeiras devem ser registradas sem expor dados sensíveis.

## Restrições

- Aplicação local em React, Fastify, SQLite e Drizzle.
- Construção inicial orientada ao mês; evolução de longo prazo permanece na arquitetura.
- Exclusão de lançamento permanece definitiva e exige confirmação explícita.
- Serviços de IA não fazem parte desta entrega.

---

## Rastreabilidade de requisitos

| ID | Story | Origem | Fase | Status |
| --- | --- | --- | --- | --- |
| MON-01 | P1: Planejar e acompanhar o mês | decisão da sponsor | Tasks | Em tasks |
| CASH-01 | P1: Conferir o dinheiro nas contas | decisão da sponsor | Tasks | Em tasks |
| TRF-01 | P1: Transferências consistentes | auditoria + sponsor | Tasks | Em tasks |
| BILL-01 | P1: Ciclo robusto de fatura | auditoria + sponsor | Tasks | Em tasks |
| REC-01 | P1: Movimentações recorrentes | decisão da sponsor | Tasks | Em tasks |
| IMP-01 | P2: Importação com conferência simples | decisão da sponsor | Tasks | Em tasks |
| UX-01 | P2: Identidade e estrutura do produto | decisão da sponsor | Tasks | Em tasks |

**Cobertura:** 7 total · 7 mapeados em tasks · 0 sem mapeamento.

## Delta sobre as capacidades

O `CAPABILITIES.md` ainda é uma semente vazia; por isso os requisitos entram como `ADDED`, mesmo
quando substituem comportamentos existentes ainda não convertidos em IDs vivos.

| ID | Tipo | Capacidade | Nota |
| --- | --- | --- | --- |
| MON-01 | ADDED | Controle mensal | Planejado, gasto e disponível, com situação acima do planejado. |
| CASH-01 | ADDED | Dinheiro nas contas | Saldos, pagamentos e risco de saldo negativo. |
| TRF-01 | ADDED | Transferências | Par atômico, validado e economicamente neutro. |
| BILL-01 | ADDED | Faturas | Pagamento real, parcial ou integral, com fechamento consistente. |
| REC-01 | ADDED | Recorrências | Séries em conta e cartão, distintas de parcelamentos. |
| IMP-01 | ADDED | Importação CSV | Prévia e conferência simples com validação integral. |
| UX-01 | ADDED | Estrutura do produto | Identidade Carteira da Ana e três perspectivas financeiras. |

## Critérios de sucesso

- [x] A usuária inicia o planejamento e entende o resultado sem interpretar `comprometido`.
- [x] Cada categoria evidencia planejado, gasto, disponível ou valor acima do planejado.
- [x] Criar e ajustar o orçamento acontece diretamente na visão mensal, com retorno imediato.
- [x] Cada parcela consome o planejamento no mês da respectiva fatura, mesmo quando o banco repete a data original.
- [x] Os saldos batem com saldo inicial, lançamentos, transferências e pagamentos de fatura.
- [x] Nenhuma falha simulada deixa apenas parte de transferência ou pagamento persistida.
- [x] A importação termina com prévia e conferência simples, sem matching obrigatório.
- [x] Recorrências de conta e cartão são geradas sem duplicidade e sem serem confundidas com parcelamentos.

## Decisões e prontidão de contexto

### Decisões confirmadas

| # | Decisão |
| --- | --- |
| D1 | A leitura principal usa planejado, gasto e disponível; quando exceder, mostra `Acima do planejado` como situação visual. |
| D2 | Obrigações ainda não pagas aparecem em `Dinheiro nas contas`, não como indicador principal do planejamento. |
| D3 | A importação terá prévia, conferência e confirmação simples; IA e matching avançado ficam para depois. |
| D4 | O produto é de longo prazo, com primeira construção concentrada no mês. |
| D5 | A única moeda suportada é BRL. |
| D6 | Depois do pagamento integral da fatura, compras só podem ser renomeadas ou recategorizadas. |
| D7 | A exclusão de lançamento permanece definitiva, com confirmação explícita. |
| D8 | Pagamentos parcial e mínimo de fatura entram no escopo; outras dívidas ficam no backlog. |
| D9 | Investimentos e rentabilidade ficam no backlog. |
| D10 | O Controle mensal deve ser fácil de iniciar e permitir conferir a execução contra as contas. |
| D11 | Cada parcela consome o planejamento no mês da respectiva fatura; a data original fica disponível para análises separadas. |
| D12 | Não haverá onboarding; estados vazios devem oferecer ações contextuais simples. |
| D13 | Recorrências de conta e cartão entram no escopo e são distintas de parcelamentos. |
| D14 | Recorrências futuras são previsões; somente ocorrências realizadas viram gasto. Parcelas futuras permanecem obrigações já assumidas. |

### Gate de contexto

| Eixo | Status |
| --- | --- |
| Problema / para quem | ok |
| Sucesso mensurável | ok |
| Restrições de prazo | lacuna não bloqueante |
| Integrações e modos de falha | ok |
| Conhecido vs. assumido | ok |

| # | Pergunta aberta | Dono | Suposição de trabalho |
| --- | --- | --- | --- |
| Q1 | Existe prazo desejado para a primeira entrega? | sponsor | Priorizar integridade e fluxo mensal sem data nesta fase. |
| Q2 | Como juros e multa serão obtidos e classificados? | sponsor + engenheiro | O Design propõe entrada manual explícita antes de automação. |
| Q3 | Qual proteção mínima contra duplicidade permanece? | engenheiro | Checagem determinística simples, sem score ou resolução de matches. |
| Q4 | Quais estados representarão pagamento parcial? | engenheiro | Resolver no Design com migração compatível. |

Nenhuma pergunta aberta bloqueia a entrada no Design.

## Riscos conhecidos

- Simplificar a linguagem sem separar competência e caixa pode voltar a duplicar faturas.
- Pagamentos parciais mudam o modelo atual `open/paid` e exigem migração cuidadosa.
- Bloquear fatura paga exige distinguir campos financeiros de campos classificatórios.
- Simplificar a importação deve preservar validação e proteção básica contra duplicidade.

---

_Próxima fase: `design.md`. O trabalho é grande e envolve contratos, dados e migração._
