# Categorias Financeiras

Este documento registra a taxonomia inicial de receitas, investimentos e despesas usada no app.

A taxonomia abaixo e uma sugestao inicial. O app deve permitir criar, editar, arquivar e gerenciar grupos, macro tipos e micro tipos.

## Estrutura

As categorias devem ser organizadas em quatro niveis conceituais:

```text
Natureza
└─ Grupo
   └─ Macro tipo
      └─ Micro tipo
```

Essa estrutura deve ser configuravel pela usuaria. A lista deste documento serve como ponto de partida, nao como uma lista fixa.

Exemplo:

```text
Despesa
└─ Variavel
   └─ Alimentacao
      └─ Supermercado
```

## Naturezas

### Receita

Entradas de dinheiro ou credito financeiro.

### Investimento

Valores separados para objetivos, caixinhas, poupancas ou reservas.

### Despesa

Saidas de dinheiro, compras, obrigacoes, gastos variaveis e extras.

### Transferencia

Movimentos entre contas. Nao devem ser classificados como receita ou despesa.

Exemplos:

- Conta corrente para investimento.
- Conta corrente para carteira.
- Pagamento de fatura de cartao.
- Resgate de investimento para conta corrente.

## Receitas

Grupo: Entradas.

| Macro tipo    | Micro tipo        |
| ------------- | ----------------- |
| Trabalho      | Salario           |
| Trabalho      | Bonus             |
| Trabalho      | Hora extra        |
| Trabalho      | 13o salario       |
| Beneficios    | Flash alimentacao |
| Beneficios    | Flash convenio    |
| Ajustes       | Saldo anterior    |
| Ajustes       | Reembolso         |
| Ajustes       | Estorno           |
| Investimentos | Resgate           |

Observacao: resgate tambem pode aparecer como transferencia quando for apenas movimento entre uma conta de investimento e uma conta corrente. Deve entrar como receita apenas se o objetivo da tela for recompor disponibilidade mensal.

## Investimentos

Grupo: Objetivos e caixinhas.

| Macro tipo | Micro tipo            |
| ---------- | --------------------- |
| Objetivos  | Reserva de emergencia |
| Objetivos  | Poupanca da Shuri     |
| Objetivos  | Poupanca da casa      |

O modulo de investimentos simples deve detalhar os objetivos em aportes, resgates, rendimentos e ajustes.

## Despesas Fixas

Despesas recorrentes ou obrigacoes mensais. Mesmo quando variam um pouco, tendem a existir todo mes.

### Obrigacoes Mensais - Conta Corrente

Uso esperado: valores pagos por debito em conta, Pix, boleto ou transferencia.

| Macro tipo | Micro tipo         |
| ---------- | ------------------ |
| Moradia    | Aluguel            |
| Moradia    | Condominio         |
| Moradia    | Luz                |
| Moradia    | Internet e celular |
| Moradia    | Gas                |
| Cuidados   | Terapia            |
| Cuidados   | Personal           |
| Cuidados   | Nutricionista      |
| Outros     | Contabilidade      |
| Outros     | Emprestimos Caixa  |
| Outros     | Apoio Uel          |
| Outros     | Seguro Nu          |
| Impostos   | IRPF               |

### Obrigacoes Mensais - Cartao De Credito

Uso esperado: valores recorrentes que entram pela fatura do cartao.

| Macro tipo         | Micro tipo      |
| ------------------ | --------------- |
| Outros recorrentes | Assinaturas     |
| Outros recorrentes | Academia        |
| Outros recorrentes | Anuidade cartao |

## Despesas Variaveis

Despesas que mudam conforme comportamento, consumo e escolhas do mes.

| Macro tipo              | Micro tipo           |
| ----------------------- | -------------------- |
| Alimentacao             | Supermercado         |
| Alimentacao             | Feira/frutas         |
| Alimentacao             | Restaurantes         |
| Alimentacao             | Bares                |
| Alimentacao             | Delivery             |
| Alimentacao             | Cafeteria            |
| Manutencao da casa      | Compras para casa    |
| Manutencao da casa      | Material de limpeza  |
| Transporte              | Metro/onibus         |
| Transporte              | Uber e taxi          |
| Cuidados pessoais       | Farmacia             |
| Cuidados pessoais       | Estetica             |
| Cuidados pessoais       | Cosmeticos           |
| Lazer                   | Viagens              |
| Lazer                   | Cinema/teatro/show   |
| Lazer                   | Livros               |
| Lazer                   | Artesanato/papelaria |
| Lazer                   | Outros lazer         |
| Compras gerais          | Roupas               |
| Compras gerais          | Calcados/acessorios  |
| Compras gerais          | Presentes            |
| Compras gerais          | Outros compras       |
| Gastos Shuri            | Shuri - racao        |
| Gastos Shuri            | Shuri - petiscos     |
| Gastos Shuri            | Shuri - higiene      |
| Gastos Shuri            | Shuri - brinquedos   |
| Gastos Shuri            | Shuri - saude        |
| Educacao                | Faculdade            |
| Educacao                | Curso                |
| Outros gastos variaveis | Doacao               |
| Outros gastos variaveis | Impostos/taxas       |
| Outros gastos variaveis | Tarifas e juros      |

## Despesas Extras

Despesas emergenciais, excepcionais ou de baixa previsibilidade.

| Macro tipo         | Micro tipo      |
| ------------------ | --------------- |
| Saude              | Medico/dentista |
| Saude              | Hospital        |
| Outras emergencias | Manutencao casa |
| Outras emergencias | Outros extras   |

## Observacoes De Modelagem

- Grupos, macro tipos e micro tipos devem ser cadastros gerenciaveis.
- Renomear grupos, macro tipos e micro tipos deve ser uma operacao normal do app.
- O historico dos lancamentos deve guardar referencia por ID interno, nao depender do nome textual.
- Ao renomear uma categoria, lancamentos antigos devem refletir o novo nome sem perder consistencia.
- Categorias ja usadas em lancamentos devem ser arquivadas/inativadas em vez de apagadas fisicamente.
- Deve existir fusao de categorias para unir duplicidades, movendo os lancamentos da categoria antiga para a categoria mantida.
- Deve existir protecao contra exclusao acidental de categorias em uso.
- Categorias arquivadas devem continuar aparecendo em historico, filtros antigos e relatorios, quando houver dados associados.
- Deve ser possivel criar novos macro tipos e novos micro tipos sem mudanca de codigo.
- Fixo ou variavel deve ser uma classificacao do orcamento, nao necessariamente da categoria em si para sempre.
- Meio de pagamento deve ser independente da categoria.
- Uma mesma categoria pode ser paga por Pix, debito, credito, boleto ou dinheiro.
- Compras no cartao devem manter data da compra e data de impacto no orcamento.
- Despesas de cartao impactam o controle mensal pelo mes de vencimento da fatura.
- Pagamento da fatura deve ser transferencia/quitacao, nao uma nova despesa.
- Tarifas, juros e IOF devem ser despesas proprias.
- Emergencias devem ficar separadas das variaveis para nao distorcer o comportamento mensal comum.

## Estrutura Para Controle Mensal

A visualizacao mensal deve conseguir agrupar por:

```text
Mes
└─ Grupo: Fixa, Variavel, Extra, Investimento
   └─ Meio de pagamento
      └─ Macro tipo
         └─ Micro tipo
```

Tambem deve permitir alternar para:

```text
Mes
└─ Meio de pagamento
   └─ Grupo
      └─ Macro tipo
         └─ Micro tipo
```

Essa segunda forma ajuda a responder quanto ainda esta disponivel por forma de pagamento ao longo do mes.
