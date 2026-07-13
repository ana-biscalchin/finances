# PROJECT.md

## Identidade

- **Cliente/produto:** Carteira da Ana
- **Responsável:** Ana
- **Equipe:** projeto pessoal de uma pessoa
- **Stage:** protótipo
- **Execução atual:** aplicação web local
- **Distribuição futura:** web ou desktop, ainda a decidir

## Objetivo de negócio

Permitir que Ana gerencie suas finanças pessoais localmente, reunindo planejamento mensal, lançamentos, contas, cartões, faturas, categorias, importação, relatórios e proteção dos dados em uma única aplicação.

## Usuária principal

Ana é a proprietária, usuária principal e responsável pelas decisões do produto.

## Prioridade do produto

A Visão do mês é o fluxo central. Ela apresenta planejado, gasto, disponível e acima do planejado sem exigir interpretação de `comprometido`. Dinheiro nas contas permite conferir saldos, previsões, faturas e risco de saldo negativo.

A construção inicial é mensal, mas o produto deve comportar patrimônio e evolução financeira de longo prazo.

## Restrições

- O funcionamento financeiro principal deve continuar disponível localmente.
- Dados financeiros ficam em SQLite local no estágio atual.
- Valores monetários usam centavos inteiros.
- O histórico financeiro não deve depender de nomes mutáveis.
- Transferências não podem ser tratadas como consumo.
- Pagamentos de fatura não podem duplicar despesas.
- Serviços remotos, como Google Drive, devem permanecer opcionais.
- Banco local, backups e credenciais nunca devem ser versionados.
- A escolha entre distribuição web e desktop permanece aberta.

## Definição de sucesso

- A usuária consegue iniciar um mês criando ou copiando seu planejamento sem precisar entender termos contábeis.
- A visão mensal mostra claramente quanto foi planejado, gasto, disponibilizado ou ficou acima do planejado.
- A visão de dinheiro nas contas permite conferir os saldos contra lançamentos, transferências e pagamentos de fatura.
- O produto começa pelo controle mensal, mas sua organização comporta evolução patrimonial e financeira de longo prazo.
