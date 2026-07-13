# Spec — Planejamento por conta e forma de pagamento

**Owner:** Ana
**Cliente / produto:** Carteira da Ana
**Sponsor:** Ana
**Status:** approved — revisão UX pendente de execução
**PRD:** não existe
**Criado em:** 2026-07-13  ·  **Última atualização:** 2026-07-13

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

Esta feature substitui a premissa de que o orçamento não varia por fonte de pagamento. O total por
subcategoria continua sendo a referência de consumo, mas passa a possuir uma distribuição explícita
entre contas e cartões de crédito.

## Visão

A usuária planeja cada categoria por conta ou cartão, acompanha como o gasto foi efetivamente pago
e enxerga o efeito restante em cada saldo. A interface preserva Pix, débito e pré-pago como formas de
pagamento associadas às contas, sem confundi-las com contas ou criar uma meta artificial de crédito.

## Goals

- [x] Distribuir 100% do planejamento mensal entre contas com saldo e cartões de crédito.
- [x] Comparar planejado e realizado por subcategoria e por origem de pagamento.
- [x] Mostrar se a execução permite pagar diretamente pelas contas sem ocultar faturas pendentes.
- [x] Representar separadamente contas bancárias, saldos pré-pagos e cartões de crédito.
- [x] Associar formas de pagamento permitidas às contas com baixo atrito no cadastro e lançamento.
- [x] Remover código e contratos substituídos, reconstruindo o banco de desenvolvimento sobre uma baseline revisada.
- [ ] Planejar despesas individualmente dentro de cada categoria, mantendo os totais como resumos derivados.

## Revisão de premissa — despesas planejadas

A unidade de edição do planejamento deixa de ser o total agregado da subcategoria. A usuária cria
linhas de despesa planejada dentro da categoria, por exemplo `Aluguel`, `Energia` e `Internet` em
`Moradia`. Cada linha possui nome, valor e conta ou cartão pretendido. O total da categoria é a soma
derivada dessas linhas e continua sendo a unidade principal de comparação com o realizado.

Os lançamentos realizados não precisam apontar manualmente para uma linha planejada. Uma categoria
pode receber qualquer quantidade de lançamentos, e todos consomem seu total planejado. A associação
individual poderá ser opcional ou assistida no futuro, mas não faz parte deste escopo.

### P1: Detalhar despesas dentro da categoria ⭐ MVP

**Story:** Como usuária, quero listar as despesas que formam o planejamento de uma categoria para
planejar do modo como penso o mês, sem editar apenas um valor agregado.

**Critérios de aceite:**

1. QUANDO uma categoria for planejada ENTÃO o sistema DEVE permitir criar várias linhas com nome, valor e origem prevista.
2. QUANDO linhas forem criadas, editadas ou removidas ENTÃO o total planejado da categoria DEVE ser recalculado automaticamente.
3. QUANDO uma linha usar conta ou cartão ENTÃO essa origem DEVE alimentar os resumos e a projeção de caixa existentes.
4. QUANDO vários lançamentos realizados pertencerem à categoria ENTÃO todos DEVEM compor o realizado da categoria, sem vínculo obrigatório com uma linha planejada.
5. QUANDO o realizado superar a soma das linhas ENTÃO o sistema DEVE mostrar o valor acima do planejado na categoria.
6. QUANDO o mês for copiado ENTÃO o sistema DEVE copiar as linhas planejadas e suas origens, ignorando origens arquivadas com aviso.
7. QUANDO uma linha for recorrente ENTÃO ela DEVE poder ser sugerida no mês seguinte sem materializar um lançamento realizado.

**Teste independente:** Criar três despesas planejadas em Moradia, registrar vários lançamentos na
categoria e confirmar que total, realizado, disponível e caixa são derivados corretamente.

## Fora de escopo

| Item | Por que está fora |
| --- | --- |
| Meta máxima de uso do cartão | A sponsor quer controle transparente, sem meta imposta pelo sistema. |
| Cadastro de cartão físico pré-pago | `Flash Alimentação` e `Flash Conveniência` são contas; `cartão pré-pago` é a forma de pagamento. |
| Separar Pix e débito no valor planejado | A fonte de saldo é decisiva no planejamento; a forma exata fica na realização. |
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
3. QUANDO uma forma for associada a várias contas ENTÃO cada associação DEVE permanecer independente, pois a forma não possui saldo próprio.
4. QUANDO uma compra em conta for criada ou editada ENTÃO o sistema DEVE exigir uma forma ativa associada à conta escolhida.
5. QUANDO uma associação for arquivada ENTÃO o sistema DEVE impedir seu uso futuro e preservar os lançamentos históricos.
6. QUANDO uma conta possuir apenas uma forma ativa ENTÃO o sistema DEVE selecioná-la automaticamente no lançamento.

**Teste independente:** Associar Pix e débito a duas contas bancárias e pré-pago às contas Flash,
registrar compras válidas e comprovar que combinações não associadas são rejeitadas explicitamente.

### P1: Distribuir o planejamento entre contas e cartões ⭐ MVP

**Story:** Como usuária, quero informar de qual conta ou cartão pretendo pagar cada parte do
orçamento para decidir conscientemente quando usar saldo disponível ou crédito.
**Por que P1:** Esta distribuição é a capacidade central solicitada pela sponsor.

**Critérios de aceite:**

1. QUANDO uma subcategoria receber planejamento ENTÃO o sistema DEVE permitir distribuí-lo entre uma ou mais contas ativas e cartões de crédito ativos.
2. QUANDO uma alocação apontar para uma conta ENTÃO ela DEVE representar consumo futuro daquele saldo, sem exigir antecipadamente Pix ou débito.
3. QUANDO uma alocação apontar para um cartão ENTÃO ela DEVE representar consumo na fatura do mês correspondente.
4. QUANDO as alocações forem exibidas ENTÃO o sistema DEVE mostrar o total planejado, o valor por origem e qualquer parcela ainda não distribuída.
5. QUANDO ainda existir valor não distribuído ENTÃO o sistema DEVE permitir salvar o planejamento, marcá-lo como incompleto e manter esse valor explicitamente visível.
6. QUANDO o planejamento for copiado para outro mês ENTÃO o sistema DEVE copiar tanto os totais quanto sua distribuição, ignorando origens arquivadas com aviso explícito.
7. QUANDO uma compra parcelada for planejada ou realizada ENTÃO cada parcela DEVE usar o cartão e o mês da respectiva fatura.

**Teste independente:** Planejar Supermercado entre Flash Alimentação, conta bancária e cartão de
crédito, copiar o mês e verificar os totais e distribuições em ambos os meses.

### P1: Comparar execução por origem ⭐ MVP

**Story:** Como usuária, quero ver quanto planejei e realizei em cada conta ou cartão para entender
como o mês está sendo financiado.
**Por que P1:** O total por categoria sozinho não revela a dependência real do cartão.

**Critérios de aceite:**

1. QUANDO uma compra sair de uma conta ENTÃO o sistema DEVE realizar a alocação dessa conta e registrar a forma utilizada.
2. QUANDO uma compra for feita no cartão de crédito ENTÃO o sistema DEVE realizar a alocação do cartão no mês da fatura.
3. QUANDO a origem realizada diferir da planejada ENTÃO o sistema DEVE preservar o gasto total da categoria e evidenciar a diferença entre origens.
4. QUANDO o gasto superar a alocação de uma origem ENTÃO o sistema DEVE mostrar quanto ficou acima do planejado nessa origem.
5. QUANDO uma transferência ou pagamento de fatura ocorrer ENTÃO o sistema NÃO DEVE realizá-lo como consumo de nenhuma alocação.
6. QUANDO a usuária consultar o mês ENTÃO o sistema DEVE permitir comparar conta, cartão, planejado e realizado sem exigir leitura lançamento a lançamento.

**Teste independente:** Planejar uma compra na conta, realizá-la no cartão e confirmar que o total da
categoria permanece correto enquanto a divergência de origem fica visível.

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
- QUANDO a soma distribuída for menor que o total ENTÃO o sistema DEVE mostrar o valor não distribuído de forma explícita.
- QUANDO a soma distribuída superar o total ENTÃO o sistema DEVE rejeitar a alteração e preservar o último estado válido.
- QUANDO uma compra não possuir conta nem cartão ENTÃO o sistema DEVE rejeitar a entrada na fronteira.
- QUANDO uma compra em conta possuir forma não associada ENTÃO o sistema DEVE rejeitar a entrada na fronteira.
- QUANDO uma compra no cartão de crédito for registrada ENTÃO o sistema NÃO DEVE exigir nem gravar forma de pagamento ou conta de saída.
- QUANDO uma fatura não possuir conta pagadora padrão ENTÃO o sistema DEVE exigir a conta no momento do pagamento e sinalizar a ausência na previsão.
- QUANDO uma carga de benefício vier da empresa ENTÃO o sistema DEVE tratá-la como entrada restrita na conta beneficiária, não como transferência entre contas próprias.
- QUANDO a própria usuária carregar uma conta pré-paga ENTÃO o sistema DEVE tratar a operação como transferência entre suas contas, sem criar consumo.
- QUANDO uma operação falhar ENTÃO o sistema DEVE preservar o estado anterior e expor erro reproduzível.
- QUANDO a varredura encontrar código aparentemente morto mas alcançável por registro dinâmico ENTÃO o sistema de trabalho DEVE preservá-lo até que a ausência de uso seja comprovada.
- QUANDO o caminho de um banco destrutivo não puder ser classificado com segurança ENTÃO o comando DEVE falhar sem alterar arquivos.

## Requisitos não-funcionais

- **Integridade:** totais por subcategoria, distribuições e realização por origem devem permanecer reconciliáveis em centavos inteiros.
- **Validação:** conta, cartão, associação e valores devem ser validados na fronteira HTTP e no domínio.
- **Usabilidade:** a interface deve usar `Conta`, `Forma de pagamento` e `Cartão de crédito`; não deve expor `fonte`, `carteira` ou `instrumento` como sinônimos concorrentes.
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

**Cobertura:** 7 total · 7 mapeados em tasks · 0 sem mapeamento.

## Delta sobre as capacidades

O `CAPABILITIES.md` ainda é uma semente vazia. Os requisitos entram como `ADDED`, embora `PLAN-01`
substitua a regra de orçamento sem origem documentada na feature `monthly-foundation`.

| ID | Tipo | Capacidade | Nota |
| --- | --- | --- | --- |
| ACC-01 | ADDED | Contas | Contas bancárias e pré-pagas representam saldos independentes e acumulativos. |
| PMT-01 | ADDED | Formas de pagamento | Formas predefinidas são associadas às contas e preservadas na realização. |
| PLAN-01 | ADDED | Controle mensal | Planejamento por subcategoria distribuído entre contas e cartões. |
| EXEC-01 | ADDED | Controle mensal | Comparação do planejado e realizado por origem de pagamento. |
| CASH-02 | ADDED | Dinheiro nas contas | Saldo previsto considera consumo direto restante e faturas sem duplicidade. |
| UX-02 | ADDED | Configuração financeira | Cadastro sugere associações compatíveis e apresenta escolhas em linguagem simples. |
| CLEAN-01 | ADDED | Manutenção e armazenamento | Código substituído é removido e o banco de desenvolvimento parte de baseline revisada. |

## Critérios de sucesso

- [ ] Um mês demonstra 100% do planejamento distribuído entre contas e cartões, sem diferença de centavos.
- [ ] Toda compra realizada identifica exatamente uma conta ou um cartão de crédito.
- [ ] Toda compra realizada em conta preserva uma forma associada válida.
- [ ] A usuária identifica, sem abrir lançamentos individuais, quanto planejou e realizou em cada conta e cartão.
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
