# Categorias Financeiras

Este documento registra a taxonomia de receitas, despesas e movimentações usada no app. A taxonomia baseia-se em princípios de Fluxo de Caixa (Cash Flow), separando entradas, saídas e movimentações neutras.

## Estrutura

As categorias são organizadas em dois níveis principais:

```text
Natureza (Receita, Despesa, Transferência)
└─ Categoria Pai
   └─ Subcategoria (Tag: Fixo/Variável/Extra)
```

## Naturezas do Fluxo de Caixa

### 1. Receita (Income)
Dinheiro novo entrando nas suas contas. Impacta positivamente o saldo e aumenta o patrimônio.
- Salário, bônus, resgates de investimentos, dividendos, reembolsos.

### 2. Despesa (Expense)
Dinheiro saindo das suas contas para o "mundo exterior" ou para poupanças futuras. Impacta negativamente o saldo.
- Moradia, alimentação, compras, boletos e **aportes em investimentos**. (Nota de engenharia financeira: aportes são vistos como "saída" do caixa do dia a dia para construir patrimônio em outra conta não-caixa).

### 3. Transferência (Transfer)
Dinheiro mudando de bolso. Não deixa mais rico nem mais pobre.
- Pagamento de fatura de cartão (pagar o cartão já gasto não é despesa nova), transferência entre bancos próprios.

---

## Árvore de Categorias Oficiais

### RECEITAS (Entradas)

- **Trabalho**
  - Salário `(Fixo)`
  - Bônus `(Variável)`
  - Hora extra `(Variável)`
  - 13º salário `(Extra)`
- **Rendimentos e Resgates**
  - Resgate de investimento `(Extra)`
  - Dividendos e Juros `(Variável)`
- **Outras Receitas**
  - Flash alimentação `(Fixo)`
  - Flash convênio `(Fixo)`
  - Reembolso `(Extra)`
  - Estorno `(Extra)`
  - Cashback `(Variável)`
  - Saldo anterior `(Extra)`

### TRANSFERÊNCIAS (Neutro)

- **Movimentações Internas**
  - Entre minhas contas `(Variável)`
  - Pagamento de fatura `(Fixo)`

### DESPESAS (Saídas)

- **Moradia & Casa**
  - Aluguel `(Fixo)`
  - Condomínio `(Fixo)`
  - Luz `(Fixo)`
  - Gás `(Fixo)`
  - Internet e celular `(Fixo)`
  - Compras para casa `(Variável)`
  - Material de limpeza `(Variável)`
  - Manutenção e reformas `(Extra)`
- **Alimentação**
  - Supermercado `(Variável)`
  - Feira e hortifruti `(Variável)`
  - Restaurantes `(Variável)`
  - Delivery `(Variável)`
  - Cafeteria e lanches `(Variável)`
  - Bares e festas `(Variável)`
- **Transporte**
  - Metrô e ônibus `(Variável)`
  - Uber e táxi `(Variável)`
  - Combustível e estacionamento `(Variável)`
- **Saúde e Bem-estar**
  - Academia `(Fixo)`
  - Personal `(Fixo)`
  - Terapia `(Fixo)`
  - Nutricionista `(Fixo)`
  - Farmácia `(Variável)`
  - Cosméticos `(Variável)`
  - Estética `(Variável)`
  - Médico e dentista `(Extra)`
  - Hospital e exames `(Extra)`
- **Lazer e Estilo de Vida**
  - Viagens `(Variável)`
  - Cinema, teatro e shows `(Variável)`
  - Livros e cultura `(Variável)`
  - Assinaturas de streaming `(Fixo)`
  - Roupas e calçados `(Variável)`
  - Presentes `(Variável)`
  - Outros passeios `(Variável)`
- **Educação e Desenvolvimento**
  - Faculdade `(Fixo)`
  - Cursos `(Variável)`
- **Gastos Shuri**
  - Ração `(Variável)`
  - Petiscos `(Variável)`
  - Higiene `(Variável)`
  - Brinquedos `(Variável)`
  - Saúde e veterinário `(Variável)`
- **Impostos e Serviços Financeiros**
  - Contabilidade `(Fixo)`
  - Impostos (IRPF) `(Fixo)`
  - Empréstimos Caixa `(Fixo)`
  - Seguro Nu `(Fixo)`
  - Apoio Uel `(Fixo)`
  - Doação `(Variável)`
  - Tarifas e juros `(Variável)`
  - Anuidade cartão `(Fixo)`
- **Investimentos (Aportes)**
  - Aporte em corretora `(Variável)`
  - Reserva de emergência `(Fixo)`
  - Poupança da Shuri `(Fixo)`
  - Poupança da casa `(Fixo)`

## Observações De Modelagem

- As tags "Fixo/Variável/Extra" ajudam nos relatórios de despesas para mostrar o que é "Custo de Vida" vs "Estilo de Vida".
- "Aporte" é registrado como Despesa para sair do fluxo de caixa diário. Em relatórios de "Quanto eu gastei de fato", a categoria "Investimentos" é simplesmente subtraída.
- "Resgate" é registrado como Receita para entrar no fluxo de caixa disponível do mês.
- Pagamento da fatura não é uma nova despesa (as despesas já foram lançadas ao longo do mês usando os Cartões). Pagamento é uma Transferência da Conta Corrente para a Conta Cartão.
