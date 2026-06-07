export const paymentMethodSeeds = [
  { id: "pm-pix", name: "Pix", kind: "instant_transfer" },
  { id: "pm-cash", name: "Dinheiro", kind: "cash" },
  { id: "pm-debit-card", name: "Cartão de débito", kind: "debit_card" },
  { id: "pm-credit-card", name: "Cartão de crédito", kind: "credit_card" },
  { id: "pm-prepaid-card", name: "Cartão pré-pago", kind: "prepaid_card" },
  { id: "pm-bank-slip", name: "Boleto", kind: "bank_slip" },
  { id: "pm-auto-debit", name: "Débito automático", kind: "auto_debit" },
  { id: "pm-bank-transfer", name: "Transferência bancária/TED", kind: "bank_transfer" }
] as const;

export const categorySeeds = [
  {
    id: "cg-income",
    nature: "income",
    name: "Entradas",
    macros: [
      { name: "Trabalho", micros: ["Salário", "Bônus", "Hora extra", "13º salário"] },
      { name: "Benefícios", micros: ["Flash alimentação", "Flash convênio"] },
      { name: "Ajustes", micros: ["Saldo anterior", "Reembolso", "Estorno"] },
      { name: "Investimentos", micros: ["Resgate"] }
    ]
  },
  {
    id: "cg-reserves",
    nature: "reserve",
    name: "Objetivos e caixinhas",
    macros: [
      {
        name: "Objetivos",
        micros: ["Reserva de emergência", "Poupança da Shuri", "Poupança da casa"]
      }
    ]
  },
  {
    id: "cg-fixed-checking",
    nature: "expense",
    name: "Obrigações mensais - Conta corrente",
    macros: [
      {
        name: "Moradia",
        micros: ["Aluguel", "Condomínio", "Luz", "Internet e celular", "Gás"]
      },
      { name: "Cuidados", micros: ["Terapia", "Personal", "Nutricionista"] },
      { name: "Outros", micros: ["Contabilidade", "Empréstimos Caixa", "Apoio Uel", "Seguro Nu"] },
      { name: "Impostos", micros: ["IRPF"] }
    ]
  },
  {
    id: "cg-fixed-credit-card",
    nature: "expense",
    name: "Obrigações mensais - Cartão de crédito",
    macros: [{ name: "Outros recorrentes", micros: ["Assinaturas", "Academia", "Anuidade cartão"] }]
  },
  {
    id: "cg-variable",
    nature: "expense",
    name: "Variáveis",
    macros: [
      {
        name: "Alimentação",
        micros: ["Supermercado", "Feira/frutas", "Restaurantes", "Bares", "Delivery", "Cafeteria"]
      },
      { name: "Manutenção da casa", micros: ["Compras para casa", "Material de limpeza"] },
      { name: "Transporte", micros: ["Metrô/ônibus", "Uber e táxi"] },
      { name: "Cuidados pessoais", micros: ["Farmácia", "Estética", "Cosméticos"] },
      {
        name: "Lazer",
        micros: ["Viagens", "Cinema/teatro/show", "Livros", "Artesanato/papelaria", "Outros lazer"]
      },
      {
        name: "Compras gerais",
        micros: ["Roupas", "Calçados/acessórios", "Presentes", "Outros compras"]
      },
      {
        name: "Gastos Shuri",
        micros: [
          { id: "cg-variable-macro-gastos-shuri-micro-shuri-racao", name: "Ração" },
          { id: "cg-variable-macro-gastos-shuri-micro-shuri-petiscos", name: "Petiscos" },
          { id: "cg-variable-macro-gastos-shuri-micro-shuri-higiene", name: "Higiene" },
          { id: "cg-variable-macro-gastos-shuri-micro-shuri-brinquedos", name: "Brinquedos" },
          { id: "cg-variable-macro-gastos-shuri-micro-shuri-saude", name: "Saúde" }
        ]
      },
      { name: "Educação", micros: ["Faculdade", "Curso"] },
      { name: "Outros gastos variáveis", micros: ["Doação", "Impostos/taxas", "Tarifas e juros"] }
    ]
  },
  {
    id: "cg-extra",
    nature: "expense",
    name: "Extras",
    macros: [
      { name: "Saúde", micros: ["Médico/dentista", "Hospital"] },
      { name: "Outras emergências", micros: ["Manutenção casa", "Outros extras"] }
    ]
  }
] as const;
