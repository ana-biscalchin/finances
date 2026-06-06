export const paymentMethodSeeds = [
  { id: "pm-pix", name: "Pix", kind: "instant_transfer" },
  { id: "pm-cash", name: "Dinheiro", kind: "cash" },
  { id: "pm-debit-card", name: "Cartao de debito", kind: "debit_card" },
  { id: "pm-credit-card", name: "Cartao de credito", kind: "credit_card" },
  { id: "pm-bank-slip", name: "Boleto", kind: "bank_slip" },
  { id: "pm-auto-debit", name: "Debito automatico", kind: "auto_debit" },
  { id: "pm-bank-transfer", name: "TED/transferencia bancaria", kind: "bank_transfer" },
  { id: "pm-digital-wallet", name: "Carteira digital", kind: "digital_wallet" },
  { id: "pm-food-benefit", name: "Vale alimentacao", kind: "benefit" },
  { id: "pm-meal-benefit", name: "Vale refeicao", kind: "benefit" },
  { id: "pm-check", name: "Cheque", kind: "check" },
  { id: "pm-financing", name: "Financiamento/crediario", kind: "financing" },
  { id: "pm-other", name: "Outro", kind: "other" }
] as const;

export const categorySeeds = [
  {
    id: "cg-income",
    nature: "income",
    name: "Entradas",
    macros: [
      { name: "Trabalho", micros: ["Salario", "Bonus", "Hora extra", "13o salario"] },
      { name: "Beneficios", micros: ["Flash alimentacao", "Flash convenio"] },
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
        micros: ["Reserva de emergencia", "Poupanca da Shuri", "Poupanca da casa"]
      }
    ]
  },
  {
    id: "cg-fixed-checking",
    nature: "expense",
    name: "Obrigacoes mensais - Conta corrente",
    macros: [
      {
        name: "Moradia",
        micros: ["Aluguel", "Condominio", "Luz", "Internet e celular", "Gas"]
      },
      { name: "Cuidados", micros: ["Terapia", "Personal", "Nutricionista"] },
      { name: "Outros", micros: ["Contabilidade", "Emprestimos Caixa", "Apoio Uel", "Seguro Nu"] },
      { name: "Impostos", micros: ["IRPF"] }
    ]
  },
  {
    id: "cg-fixed-credit-card",
    nature: "expense",
    name: "Obrigacoes mensais - Cartao de credito",
    macros: [{ name: "Outros recorrentes", micros: ["Assinaturas", "Academia", "Anuidade cartao"] }]
  },
  {
    id: "cg-variable",
    nature: "expense",
    name: "Variaveis",
    macros: [
      {
        name: "Alimentacao",
        micros: ["Supermercado", "Feira/frutas", "Restaurantes", "Bares", "Delivery", "Cafeteria"]
      },
      { name: "Manutencao da casa", micros: ["Compras para casa", "Material de limpeza"] },
      { name: "Transporte", micros: ["Metro/onibus", "Uber e taxi"] },
      { name: "Cuidados pessoais", micros: ["Farmacia", "Estetica", "Cosmeticos"] },
      {
        name: "Lazer",
        micros: ["Viagens", "Cinema/teatro/show", "Livros", "Artesanato/papelaria", "Outros lazer"]
      },
      {
        name: "Compras gerais",
        micros: ["Roupas", "Calcados/acessorios", "Presentes", "Outros compras"]
      },
      {
        name: "Gastos Shuri",
        micros: [
          "Shuri - racao",
          "Shuri - petiscos",
          "Shuri - higiene",
          "Shuri - brinquedos",
          "Shuri - saude"
        ]
      },
      { name: "Educacao", micros: ["Faculdade", "Curso"] },
      { name: "Outros gastos variaveis", micros: ["Doacao", "Impostos/taxas", "Tarifas e juros"] }
    ]
  },
  {
    id: "cg-extra",
    nature: "expense",
    name: "Extras",
    macros: [
      { name: "Saude", micros: ["Medico/dentista", "Hospital"] },
      { name: "Outras emergencias", micros: ["Manutencao casa", "Outros extras"] }
    ]
  }
] as const;
