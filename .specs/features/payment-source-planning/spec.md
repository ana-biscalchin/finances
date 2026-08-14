# Spec — Planejamento mensal por categoria e meio de pagamento

**Owner:** Ana
**Cliente / produto:** Carteira da Ana
**Sponsor:** Ana
**Status:** implemented — aguardando UAT visual
**PRD:** não existe
**Criado em:** 2026-07-13  ·  **Última atualização:** 2026-08-14

---

## Contexto

A fundação mensal planeja um único valor por mês e subcategoria e compara esse total com o consumo
realizado. Esse modelo responde quanto foi gasto, mas não permite decidir de qual saldo o consumo
deverá sair. Sem essa distribuição, a usuária não consegue avaliar com transparência se pode trocar
compras no crédito por pagamentos imediatos sem comprometer suas contas.

A usuária possui mais de uma conta bancária e dois saldos de benefício pré-pago, `Flash Alimentação`
e `Flash Conveniência`, que acumulam entre meses. Contas possuem saldo; Pix, débito e cartão pré-pago
são formas de movimentar esse saldo. Cartão de crédito permanece uma obrigação separada, cuja fatura
é liquidada por uma conta bancária associada.

Esta feature substitui a premissa de que o orçamento não varia por meio de pagamento. O total por
subcategoria continua sendo a referência de consumo, mas passa a possuir uma distribuição explícita
entre combinações de conta e forma de pagamento, além de cartões de crédito. Assim, uma mesma conta
pode ter planejamentos distintos para Pix, boleto, transferência de pagamento e cartão de débito.

Transferências entre contas próprias continuam fora do orçamento por serem economicamente neutras.
Ainda assim, precisam aparecer no painel do mês em uma área própria, para que a usuária entenda as
movimentações de caixa sem confundi-las com consumo.

Nesta spec, `Transferência` como forma de pagamento significa pagar uma despesa para terceiros por
transferência bancária. `Transferência entre contas` significa mover dinheiro entre contas da própria
usuária. Apenas a primeira pode realizar uma alocação de orçamento.

## Visão

A usuária planeja cada categoria por meio de pagamento, acompanha planejado, gasto e saldo por
combinação e enxerga o total consolidado da categoria. O painel mensal prioriza exceções e permite
expandir categorias para comparar, por exemplo, `Flash Alimentação · Pré-pago` e
`Nubank · Débito`, sem confundir consumo, cartão de crédito e transferência entre contas.

## Goals

- [ ] Distribuir o planejamento mensal entre combinações de conta e forma de pagamento e cartões de crédito.
- [ ] Comparar planejado e realizado por subcategoria e por meio de pagamento.
- [x] Mostrar se a execução permite pagar diretamente pelas contas sem ocultar faturas pendentes.
- [x] Representar separadamente contas bancárias, saldos pré-pagos e cartões de crédito.
- [x] Associar formas de pagamento permitidas às contas com baixo atrito no cadastro e lançamento.
- [x] Remover código e contratos substituídos, reconstruindo o banco de desenvolvimento sobre uma baseline revisada.
- [ ] Transformar a Visão do mês em um painel de controle orientado a acompanhamento e exceções.
- [ ] Exibir transferências entre contas em uma área própria, sem fazê-las consumir orçamento.

## Revisão de premissa — unidade do planejamento

A unidade de edição passa a ser a alocação mensal formada por `mês + subcategoria + conta + forma de
pagamento`, ou por `mês + subcategoria + cartão de crédito`. Não é necessário nomear uma despesa
planejada para definir o orçamento. O total da categoria é derivado da soma de suas alocações.

Despesas nomeadas, obrigações recorrentes e parcelas permanecem conceitos próprios. Elas podem
ajudar a antecipar o mês, mas não são a unidade obrigatória de edição do orçamento.

### P1: Planejar diretamente por meio de pagamento ⭐ MVP

**Story:** Como usuária, quero distribuir o orçamento de uma categoria entre meios de pagamento
específicos para controlar quanto pretendo gastar em cada combinação.

**Critérios de aceite:**

1. QUANDO uma categoria for planejada ENTÃO o sistema DEVE permitir criar várias alocações com meio de pagamento e valor, sem exigir um nome de despesa.
2. QUANDO uma alocação usar uma conta ENTÃO o sistema DEVE exigir uma forma ativa associada àquela conta.
3. QUANDO uma alocação usar cartão de crédito ENTÃO o sistema DEVE identificar o cartão sem exigir conta ou forma de pagamento.
4. QUANDO alocações forem criadas, editadas ou removidas ENTÃO o total planejado da categoria DEVE ser recalculado imediatamente.
5. QUANDO vários lançamentos realizados pertencerem à categoria ENTÃO o sistema DEVE agregá-los pela combinação efetivamente utilizada.
6. QUANDO o realizado superar uma alocação ENTÃO o sistema DEVE mostrar quanto ficou acima do planejado naquela combinação e no total da categoria.
7. QUANDO o mês for copiado ENTÃO o sistema DEVE copiar as alocações válidas e avisar sobre conta, forma ou cartão arquivado.

**Teste independente:** Planejar Supermercado com `Flash Alimentação · Pré-pago` e
`Nubank · Débito`, registrar gastos nas duas combinações e confirmar planejado, gasto, disponível e
valor acima do planejado por combinação e no total da categoria.

## Fora de escopo

| Item | Por que está fora |
| --- | --- |
| Meta máxima de uso do cartão | A sponsor quer controle transparente, sem meta imposta pelo sistema. |
| Cadastro de cartão físico pré-pago | `Flash Alimentação` e `Flash Conveniência` são contas; `cartão pré-pago` é a forma de pagamento. |
| Transferências entre contas consumirem orçamento | Movimentam caixa, mas não representam consumo, receita ou despesa. |
| Bloqueio rígido de categorias por benefício | A aceitação depende do estabelecimento; uma orientação poderá ser evoluída depois. |
| Data-base explícita do saldo inicial | Permanece no backlog conforme decisão anterior. |
| Conciliação ou importação automática dos saldos Flash | Evolução futura do fluxo de importação. |
| Múltiplas moedas | O produto permanece exclusivamente em BRL. |
| Exclusão automática de backups pessoais | A reconstrução destrutiva vale para bancos de desenvolvimento explicitamente selecionados, não para cópias de segurança. |

---

## User stories

### P1: Cadastrar contas que representam saldos ⭐ MVP

**Story:** Como usuária, quero cadastrar cada conta bancária ou pré-paga separadamente para saber
onde o dinheiro está disponível.
**Por que P1:** O planejamento por fonte só é confiável quando cada saldo possui identidade própria.

**Critérios de aceite:**

1. QUANDO uma conta for criada ENTÃO o sistema DEVE exigir nome, tipo e saldo inicial em BRL.
2. QUANDO a usuária possuir várias contas bancárias ENTÃO o sistema DEVE manter saldo e histórico independentes para cada uma.
3. QUANDO `Flash Alimentação` e `Flash Conveniência` forem cadastradas ENTÃO o sistema DEVE tratá-las como duas contas pré-pagas com saldos independentes.
4. QUANDO um saldo pré-pago não for consumido no mês ENTÃO o sistema DEVE preservá-lo nos meses seguintes.
5. QUANDO uma conta for arquivada ENTÃO o sistema DEVE preservar sua identificação no histórico e impedir novas alocações.

**Teste independente:** Cadastrar duas contas bancárias e duas contas Flash, movimentar apenas uma
de cada tipo e confirmar que os quatro saldos permanecem independentes.

### P1: Associar formas de pagamento às contas ⭐ MVP

**Story:** Como usuária, quero associar as formas que posso usar em cada conta para registrar uma
compra sem confundir conta, forma de pagamento e cartão de crédito.
**Por que P1:** A associação reduz escolhas inválidas e preserva como cada gasto foi executado.

**Critérios de aceite:**

1. QUANDO uma conta bancária for configurada ENTÃO o sistema DEVE permitir associar Pix, débito, débito automático, boleto e transferência conforme aplicável.
2. QUANDO uma conta pré-paga for configurada ENTÃO o sistema DEVE permitir associar cartão pré-pago.
3. QUANDO uma forma for associada a várias contas ENTÃO cada combinação DEVE permanecer independente no planejamento e na realização, pois a forma não possui saldo próprio.
4. QUANDO uma compra em conta for criada ou editada ENTÃO o sistema DEVE exigir uma forma ativa associada à conta escolhida.
5. QUANDO uma associação for arquivada ENTÃO o sistema DEVE impedir seu uso futuro e preservar os lançamentos históricos.
6. QUANDO uma conta possuir apenas uma forma ativa ENTÃO o sistema DEVE selecioná-la automaticamente no lançamento.

**Teste independente:** Associar Pix e débito a duas contas bancárias e pré-pago às contas Flash,
registrar compras válidas e comprovar que combinações não associadas são rejeitadas explicitamente.

### P1: Distribuir o planejamento entre meios de pagamento ⭐ MVP

**Story:** Como usuária, quero informar qual combinação de conta e forma, ou qual cartão de crédito,
pretendo usar em cada parte do orçamento para controlar separadamente meus meios de pagamento.
**Por que P1:** Esta distribuição é a capacidade central solicitada pela sponsor.

**Critérios de aceite:**

1. QUANDO uma subcategoria receber planejamento ENTÃO o sistema DEVE permitir distribuí-lo entre combinações ativas de conta e forma de pagamento e cartões de crédito ativos.
2. QUANDO uma alocação apontar para uma conta ENTÃO ela DEVE identificar antecipadamente a forma de pagamento associada que será monitorada.
3. QUANDO uma alocação apontar para um cartão ENTÃO ela DEVE representar consumo na fatura do mês correspondente.
4. QUANDO as alocações forem exibidas ENTÃO o sistema DEVE mostrar o valor por meio e o total da categoria derivado da soma dessas alocações.
5. QUANDO o planejamento for copiado para outro mês ENTÃO o sistema DEVE copiar suas alocações válidas e avisar sobre combinações arquivadas.
6. QUANDO uma compra parcelada for planejada ou realizada ENTÃO cada parcela DEVE usar o cartão e o mês da respectiva fatura.

**Teste independente:** Planejar Supermercado entre Flash Alimentação, conta bancária e cartão de
crédito, copiar o mês e verificar os totais e distribuições em ambos os meses.

### P1: Comparar execução por meio de pagamento ⭐ MVP

**Story:** Como usuária, quero ver quanto planejei e realizei em cada meio de pagamento para entender
como cada categoria e o mês estão sendo executados.
**Por que P1:** O total por categoria sozinho não revela a dependência real do cartão.

**Critérios de aceite:**

1. QUANDO uma compra sair de uma conta ENTÃO o sistema DEVE realizar a alocação da combinação entre essa conta e a forma utilizada.
2. QUANDO uma compra for feita no cartão de crédito ENTÃO o sistema DEVE realizar a alocação do cartão no mês da fatura.
3. QUANDO a origem realizada diferir da planejada ENTÃO o sistema DEVE preservar o gasto total da categoria e evidenciar a diferença entre origens.
4. QUANDO o gasto superar a alocação de uma origem ENTÃO o sistema DEVE mostrar quanto ficou acima do planejado nessa origem.
5. QUANDO uma transferência ou pagamento de fatura ocorrer ENTÃO o sistema NÃO DEVE realizá-lo como consumo de nenhuma alocação.
6. QUANDO a usuária consultar o mês ENTÃO o sistema DEVE permitir comparar categoria, conta, forma, cartão, planejado e realizado sem exigir leitura lançamento a lançamento.

**Teste independente:** Planejar uma compra na conta, realizá-la no cartão e confirmar que o total da
categoria permanece correto enquanto a divergência de origem fica visível.

### P1: Operar o painel de controle do mês ⭐ MVP

**Story:** Como usuária, quero abrir o mês e identificar rapidamente onde estou dentro ou acima do
planejado, além de conferir as transferências que movimentaram meu caixa.
**Por que P1:** A Visão do mês é a tela central do produto e deve orientar decisão sem exigir leitura
de lançamentos individuais.

**Critérios de aceite:**

1. QUANDO o painel mensal carregar ENTÃO o sistema DEVE destacar os totais de planejado, gasto e disponível ou acima do planejado.
2. QUANDO uma categoria for exibida recolhida ENTÃO o sistema DEVE mostrar seu total planejado, gasto e situação consolidada.
3. QUANDO a categoria for expandida ENTÃO o sistema DEVE mostrar cada meio de pagamento com planejado, gasto, disponível ou acima do planejado.
4. QUANDO houver categorias acima do planejado, próximas do limite ou com gasto não planejado ENTÃO o sistema DEVE priorizá-las visualmente na área de atenção.
5. QUANDO não houver orçamento no mês ENTÃO o sistema DEVE oferecer começar do zero ou copiar outro mês sem formulário extenso.
6. QUANDO a usuária editar uma alocação no painel ENTÃO o sistema DEVE atualizar imediatamente os totais da combinação e da categoria após a confirmação da API.
7. QUANDO houver transferências entre contas no mês ENTÃO o sistema DEVE mostrá-las em uma seção própria com origem, destino, data e valor.
8. QUANDO uma transferência for exibida ENTÃO o sistema NÃO DEVE incluí-la em planejado, gasto, receita, disponível ou acima do planejado.
9. QUANDO cores indicarem situação ENTÃO o sistema DEVE apresentar também texto e valor, sem depender exclusivamente da cor.

**Teste independente:** Planejar e realizar gastos abaixo e acima do limite em duas combinações,
registrar uma transferência e comprovar que o painel destaca as exceções enquanto a transferência
aparece separadamente e não altera os totais de orçamento.

### P1: Conferir impacto nos saldos ⭐ MVP

**Story:** Como usuária, quero confrontar o uso planejado das contas com saldos, entradas, despesas
restantes e faturas para decidir se consigo pagar diretamente sem ficar negativa.
**Por que P1:** Esta é a decisão prática que permitirá reduzir o uso do crédito.

**Critérios de aceite:**

1. QUANDO uma conta for exibida ENTÃO o sistema DEVE mostrar saldo atual, entradas previstas, consumo direto restante, faturas pendentes associadas e saldo previsto.
2. QUANDO um cartão possuir conta pagadora ENTÃO suas faturas pendentes DEVEM reduzir o saldo previsto dessa conta, sem duplicar o consumo mensal.
3. QUANDO uma conta pré-paga receber uma carga ENTÃO o sistema DEVE aumentar apenas esse saldo e não o dinheiro livre das contas bancárias.
4. QUANDO uma carga empresarial de benefício for resumida no mês ENTÃO o sistema DEVE apresentá-la como `Benefício recebido`, separada de `Receita livre`.
5. QUANDO o planejamento direto levar uma conta abaixo de zero ENTÃO o sistema DEVE evidenciar o risco e o valor faltante.
6. QUANDO houver mais de uma conta bancária ENTÃO o sistema DEVE calcular o risco individualmente, sem compensação implícita entre contas.
7. QUANDO a situação do cartão for apresentada ENTÃO o sistema DEVE mostrar fatos planejados, realizados e faturados, sem criar meta de redução.

**Teste independente:** Planejar gastos diretos em duas contas, registrar compras no cartão e uma
carga Flash, e conferir o saldo previsto de cada conta sem duplicidade.

### P2: Configuração simples das origens

**Story:** Como usuária, quero configurar conta, formas permitidas e conta pagadora de cartão em um
fluxo curto para começar a planejar sem um cadastro técnico.

**Critérios de aceite:**

1. QUANDO uma conta comum for criada ENTÃO o sistema DEVE sugerir formas compatíveis com seu tipo e permitir ajuste antes de salvar.
2. QUANDO um cartão de crédito for criado ENTÃO o sistema DEVE permitir escolher sua conta pagadora padrão.
3. QUANDO o lançamento for iniciado ENTÃO o sistema DEVE apresentar combinações compreensíveis, como `Nubank · Pix` e `Flash Alimentação · Pré-pago`.
4. QUANDO uma forma não estiver disponível para a conta escolhida ENTÃO o sistema NÃO DEVE apresentá-la como opção válida.

**Teste independente:** Configurar uma conta corrente, uma Flash e um cartão de crédito, depois
registrar um lançamento usando somente escolhas sugeridas pelo sistema.

### P1: Remover legado e reconstruir o armazenamento ⭐ MVP

**Story:** Como mantenedora, quero eliminar código morto e reconstruir o banco sobre um schema
revisado para que o modelo implementado não conviva com fluxos financeiros substituídos.
**Por que P1:** A sponsor autorizou mudanças destrutivas e o protótipo não está em produção; manter
compatibilidade com contratos descartados aumentaria o risco e o custo da nova fundação.

**Critérios de aceite:**

1. QUANDO um fluxo, rota, contrato, componente ou helper for substituído ENTÃO sua ausência de uso no runtime DEVE ser comprovada antes da remoção.
2. QUANDO o schema novo for fechado ENTÃO o histórico de migrações de desenvolvimento DEVE ser consolidado em uma baseline coerente com o modelo atual.
3. QUANDO um banco de desenvolvimento explicitamente selecionado for reconstruído ENTÃO o sistema DEVE remover os dados antigos, aplicar a baseline e executar os seeds canônicos.
4. QUANDO a reconstrução terminar ENTÃO o banco DEVE passar por verificação de integridade, chaves estrangeiras e ausência de referências órfãs.
5. QUANDO testes de comportamentos removidos deixarem de fazer sentido ENTÃO eles DEVEM ser substituídos por testes dos contratos canônicos, sem redução silenciosa da cobertura relevante.
6. QUANDO artefatos sintéticos como `pm-credit-card`, orçamento sem origem ou forma padrão direta na conta forem removidos ENTÃO código, schemas, filtros, relatórios, seeds e documentação DEVEM ser atualizados em conjunto.
7. QUANDO o comando destrutivo receber um caminho não explicitamente marcado como desenvolvimento ou UAT ENTÃO ele DEVE recusar a operação.
8. QUANDO existirem backups pessoais ENTÃO a reconstrução NÃO DEVE excluí-los ou sobrescrevê-los automaticamente.

**Teste independente:** Recriar uma base temporária vazia, executar baseline e seeds, validar
integridade e confirmar por busca, build e testes que nenhum contrato removido continua referenciado.

---

## Edge cases

- QUANDO uma conta usada no planejamento for arquivada ENTÃO o sistema DEVE preservar meses passados e exigir redistribuição nos meses futuros editados ou copiados.
- QUANDO uma categoria não possuir alocações ENTÃO seu total planejado DEVE ser zero, sem persistir um total paralelo.
- QUANDO uma compra não possuir conta nem cartão ENTÃO o sistema DEVE rejeitar a entrada na fronteira.
- QUANDO uma compra ou alocação em conta possuir forma não associada ENTÃO o sistema DEVE rejeitar a entrada na fronteira.
- QUANDO uma compra no cartão de crédito for registrada ENTÃO o sistema NÃO DEVE exigir nem gravar forma de pagamento ou conta de saída.
- QUANDO uma fatura não possuir conta pagadora padrão ENTÃO o sistema DEVE exigir a conta no momento do pagamento e sinalizar a ausência na previsão.
- QUANDO uma carga de benefício vier da empresa ENTÃO o sistema DEVE tratá-la como entrada restrita na conta beneficiária, não como transferência entre contas próprias.
- QUANDO a própria usuária carregar uma conta pré-paga ENTÃO o sistema DEVE tratar a operação como transferência entre suas contas, sem criar consumo.
- QUANDO uma transferência ocorrer no mesmo mês de uma despesa com valor semelhante ENTÃO o sistema DEVE mantê-las distintas e nunca inferir consumo pela semelhança.
- QUANDO a forma `Transferência` for usada para pagar uma despesa a terceiro ENTÃO o sistema DEVE tratá-la como consumo da combinação escolhida, sem confundi-la com transferência entre contas próprias.
- QUANDO não houver transferências no mês ENTÃO a seção correspondente DEVE apresentar estado vazio compacto, sem competir com os alertas de orçamento.
- QUANDO uma operação falhar ENTÃO o sistema DEVE preservar o estado anterior e expor erro reproduzível.
- QUANDO a varredura encontrar código aparentemente morto mas alcançável por registro dinâmico ENTÃO o sistema de trabalho DEVE preservá-lo até que a ausência de uso seja comprovada.
- QUANDO o caminho de um banco destrutivo não puder ser classificado com segurança ENTÃO o comando DEVE falhar sem alterar arquivos.

## Requisitos não-funcionais

- **Integridade:** totais por subcategoria, distribuições e realização por origem devem permanecer reconciliáveis em centavos inteiros.
- **Validação:** conta, cartão, associação e valores devem ser validados na fronteira HTTP e no domínio.
- **Usabilidade:** a interface deve apresentar combinações como `Nubank · Débito` e `Flash Alimentação · Pré-pago`; deve usar `Conta`, `Forma de pagamento`, `Cartão de crédito` e `Transferências`, sem expor `fonte`, `carteira` ou `instrumento` como sinônimos concorrentes.
- **Acessibilidade:** estados de orçamento devem possuir texto, valor e semântica acessível, sem depender apenas de cor ou barra de progresso.
- **Performance:** a visão mensal deve carregar planejamento, realização e saldos sem consultas por linha.
- **Observabilidade:** falhas de associação ou distribuição devem ser registradas com IDs técnicos, sem expor descrições financeiras sensíveis.
- **Segurança de dados:** nenhuma mudança destrutiva pode apagar associações ou origens referenciadas pelo histórico.

## Restrições

- Aplicação local em React, Fastify, SQLite e Drizzle.
- BRL e centavos inteiros em todos os cálculos.
- Formas de pagamento continuam predefinidas; a usuária configura associações, não cria novos tipos.
- Transferências e pagamentos de fatura continuam economicamente neutros.
- Compras no cartão continuam consumindo o orçamento pelo mês da fatura.
- O saldo das contas pré-pagas acumula entre meses.

---

## Rastreabilidade de requisitos

| ID | Story | Origem | Fase | Status |
| --- | --- | --- | --- | --- |
| ACC-01 | P1: Cadastrar contas que representam saldos | decisão da sponsor | Tasks | Em tasks |
| PMT-01 | P1: Associar formas de pagamento às contas | decisão da sponsor | Tasks | Em tasks |
| PLAN-01 | P1: Distribuir o planejamento | decisão da sponsor | Tasks | Em tasks |
| EXEC-01 | P1: Comparar execução por origem | decisão da sponsor | Tasks | Em tasks |
| CASH-02 | P1: Conferir impacto nos saldos | decisão da sponsor | Tasks | Em tasks |
| UX-02 | P2: Configuração simples das origens | decisão da sponsor | Tasks | Em tasks |
| CLEAN-01 | P1: Remover legado e reconstruir o armazenamento | decisão da sponsor | Tasks | Em tasks |
| DASH-01 | P1: Operar o painel de controle do mês | decisão da sponsor | Tasks | Em tasks |
| TRANS-02 | P1: Exibir transferências sem impacto no orçamento | decisão da sponsor | Tasks | Em tasks |

**Cobertura:** 9 total · 9 mapeados em tasks · 0 sem mapeamento.

## Delta sobre as capacidades

O `CAPABILITIES.md` ainda é uma semente vazia. Os requisitos entram como `ADDED`, embora `PLAN-01`
substitua a regra de orçamento sem origem documentada na feature `monthly-foundation`.

| ID | Tipo | Capacidade | Nota |
| --- | --- | --- | --- |
| ACC-01 | ADDED | Contas | Contas bancárias e pré-pagas representam saldos independentes e acumulativos. |
| PMT-01 | ADDED | Formas de pagamento | Formas predefinidas são associadas às contas e preservadas na realização. |
| PLAN-01 | ADDED | Controle mensal | Planejamento por subcategoria distribuído entre combinações de conta e forma de pagamento e cartões de crédito. |
| EXEC-01 | ADDED | Controle mensal | Comparação do planejado e realizado por meio de pagamento. |
| CASH-02 | ADDED | Dinheiro nas contas | Saldo previsto considera consumo direto restante e faturas sem duplicidade. |
| UX-02 | ADDED | Configuração financeira | Cadastro sugere associações compatíveis e apresenta escolhas em linguagem simples. |
| CLEAN-01 | ADDED | Manutenção e armazenamento | Código substituído é removido e o banco de desenvolvimento parte de baseline revisada. |
| DASH-01 | ADDED | Controle mensal | Painel do mês prioriza totais, exceções e detalhamento progressivo por meio de pagamento. |
| TRANS-02 | ADDED | Controle mensal | Transferências aparecem separadas no painel e não alteram o orçamento. |

## Critérios de sucesso

- [ ] Um mês demonstra o planejamento distribuído entre combinações de conta e forma e cartões, com o total de cada categoria igual à soma das alocações.
- [ ] Toda compra realizada identifica exatamente uma conta ou um cartão de crédito.
- [ ] Toda compra realizada em conta preserva uma forma associada válida.
- [ ] A usuária identifica, sem abrir lançamentos individuais, quanto planejou e realizou em cada combinação de conta e forma e em cada cartão.
- [ ] A usuária identifica as categorias que exigem atenção e confere suas transferências a partir do painel do mês.
- [ ] Transferências exibidas no painel não alteram os totais de planejamento e consumo.
- [ ] O saldo previsto de cada conta considera pagamentos imediatos e faturas exatamente uma vez.
- [ ] Flash Alimentação e Flash Conveniência mantêm saldos independentes entre meses.
- [ ] Nenhum fluxo apresenta o cartão físico Flash como conta ou fonte adicional.
- [ ] Uma base temporária pode ser destruída e reconstruída integralmente com baseline, seeds e integridade válidos.
- [ ] Nenhuma referência aos contratos removidos permanece no runtime, build, testes ou documentação canônica.

## Riscos conhecidos

- Distribuir cada categoria pode aumentar o atrito; o Design precisa privilegiar preenchimento rápido e cópia mensal.
- Misturar total por categoria e distribuição pode gerar divergência se as invariantes não forem centralizadas no domínio.
- Recriar a base de desenvolvimento apaga dados locais; o comando deve exibir e restringir explicitamente o caminho antes da migração destrutiva.
- A previsão pode duplicar consumo e fatura se competência e caixa voltarem a ser agregados pelo mesmo evento.
- Formas associadas a contas arquivadas precisam continuar legíveis no histórico.
- Uma remoção baseada apenas em busca textual pode apagar registro dinâmico; a limpeza exige confirmação por imports, registro de rotas, build e testes.
- Consolidar migrações invalida bancos antigos; o comando destrutivo deve restringir claramente o alvo e nunca alcançar backups.

---

_Próxima fase: `design.md`. O trabalho é grande e envolve modelo de dados, migração e UX mensal._
