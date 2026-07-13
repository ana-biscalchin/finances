export const paymentMethodSeeds = [
  { id: "pm-pix", name: "Pix", kind: "instant_transfer" },
  { id: "pm-cash", name: "Dinheiro", kind: "cash" },
  { id: "pm-debit-card", name: "Cartão de débito", kind: "debit_card" },
  { id: "pm-prepaid-card", name: "Cartão pré-pago", kind: "prepaid_card" },
  { id: "pm-bank-slip", name: "Boleto", kind: "bank_slip" },
  { id: "pm-auto-debit", name: "Débito automático", kind: "auto_debit" },
  { id: "pm-bank-transfer", name: "Transferência bancária/TED", kind: "bank_transfer" }
] as const;

export const accountSeeds = [
  { id: "account-checking-main", name: "Conta principal", type: "checking", sortOrder: 0, isPrimary: true },
  { id: "account-flash-food", name: "Flash Alimentação", type: "benefit", institution: "Flash", sortOrder: 1, isPrimary: false },
  { id: "account-flash-convenience", name: "Flash Conveniência", type: "benefit", institution: "Flash", sortOrder: 2, isPrimary: false }
] as const;

export const accountPaymentMethodSeeds = [
  { id: "account-method-checking-pix", accountId: "account-checking-main", paymentMethodId: "pm-pix", isDefault: true },
  { id: "account-method-checking-debit", accountId: "account-checking-main", paymentMethodId: "pm-debit-card", isDefault: false },
  { id: "account-method-flash-food", accountId: "account-flash-food", paymentMethodId: "pm-prepaid-card", isDefault: true },
  { id: "account-method-flash-convenience", accountId: "account-flash-convenience", paymentMethodId: "pm-prepaid-card", isDefault: true }
] as const;

export const categorySeeds = [
  // ==========================================
  // RECEITAS (CASH INFLOW)
  // ==========================================
  {
    id: "cat-trabalho",
    nature: "income",
    name: "Trabalho",
    subcategories: [
      { name: "Salário", behavior: "fixed" },
      { name: "Bônus", behavior: "variable" },
      { name: "Hora extra", behavior: "variable" },
      { name: "13º salário", behavior: "extra" }
    ]
  },
  {
    id: "cat-rendimentos",
    nature: "income",
    name: "Rendimentos e Resgates",
    subcategories: [
      { name: "Resgate de investimento", behavior: "extra" },
      { name: "Dividendos e Juros", behavior: "variable" }
    ]
  },
  {
    id: "cat-outras-receitas",
    nature: "income",
    name: "Outras Receitas",
    subcategories: [
      { name: "Flash alimentação", behavior: "fixed" },
      { name: "Flash convênio", behavior: "fixed" },
      { name: "Reembolso", behavior: "extra" },
      { name: "Estorno", behavior: "extra" },
      { name: "Cashback", behavior: "variable" },
      { name: "Saldo anterior", behavior: "extra" }
    ]
  },

  // ==========================================
  // DESPESAS (CASH OUTFLOW)
  // ==========================================
  {
    id: "cat-moradia",
    nature: "expense",
    name: "Moradia & Casa",
    subcategories: [
      { name: "Aluguel", behavior: "fixed" },
      { name: "Condomínio", behavior: "fixed" },
      { name: "Luz", behavior: "fixed" },
      { name: "Gás", behavior: "fixed" },
      { name: "Internet e celular", behavior: "fixed" },
      { name: "Compras para casa", behavior: "variable" },
      { name: "Material de limpeza", behavior: "variable" },
      { name: "Manutenção e reformas", behavior: "extra" }
    ]
  },
  {
    id: "cat-alimentacao",
    nature: "expense",
    name: "Alimentação",
    subcategories: [
      { name: "Supermercado", behavior: "variable" },
      { name: "Feira e hortifruti", behavior: "variable" },
      { name: "Restaurantes", behavior: "variable" },
      { name: "Delivery", behavior: "variable" },
      { name: "Cafeteria e lanches", behavior: "variable" },
      { name: "Bares e festas", behavior: "variable" }
    ]
  },
  {
    id: "cat-transporte",
    nature: "expense",
    name: "Transporte",
    subcategories: [
      { name: "Metrô e ônibus", behavior: "variable" },
      { name: "Uber e táxi", behavior: "variable" },
      { name: "Combustível e estacionamento", behavior: "variable" }
    ]
  },
  {
    id: "cat-saude",
    nature: "expense",
    name: "Saúde e Bem-estar",
    subcategories: [
      { name: "Academia", behavior: "fixed" },
      { name: "Personal", behavior: "fixed" },
      { name: "Terapia", behavior: "fixed" },
      { name: "Nutricionista", behavior: "fixed" },
      { name: "Farmácia", behavior: "variable" },
      { name: "Cosméticos", behavior: "variable" },
      { name: "Estética", behavior: "variable" },
      { name: "Médico e dentista", behavior: "extra" },
      { name: "Hospital e exames", behavior: "extra" }
    ]
  },
  {
    id: "cat-lazer",
    nature: "expense",
    name: "Lazer e Estilo de Vida",
    subcategories: [
      { name: "Viagens", behavior: "variable" },
      { name: "Cinema, teatro e shows", behavior: "variable" },
      { name: "Livros e cultura", behavior: "variable" },
      { name: "Assinaturas de streaming", behavior: "fixed" },
      { name: "Roupas e calçados", behavior: "variable" },
      { name: "Presentes", behavior: "variable" },
      { name: "Outros passeios", behavior: "variable" }
    ]
  },
  {
    id: "cat-gastos-shuri",
    nature: "expense",
    name: "Gastos Shuri",
    subcategories: [
      { id: "subcat-shuri-racao", name: "Ração", behavior: "variable" },
      { id: "subcat-shuri-petiscos", name: "Petiscos", behavior: "variable" },
      { id: "subcat-shuri-higiene", name: "Higiene", behavior: "variable" },
      { id: "subcat-shuri-brinquedos", name: "Brinquedos", behavior: "variable" },
      { id: "subcat-shuri-saude", name: "Saúde e veterinário", behavior: "variable" }
    ]
  },
  {
    id: "cat-educacao",
    nature: "expense",
    name: "Educação e Desenvolvimento",
    subcategories: [
      { name: "Faculdade", behavior: "fixed" },
      { name: "Cursos", behavior: "variable" }
    ]
  },
  {
    id: "cat-servicos",
    nature: "expense",
    name: "Impostos e Serviços Financeiros",
    subcategories: [
      { name: "Contabilidade", behavior: "fixed" },
      { name: "Impostos (IRPF)", behavior: "fixed" },
      { name: "Empréstimos Caixa", behavior: "fixed" },
      { name: "Seguro Nu", behavior: "fixed" },
      { name: "Apoio Uel", behavior: "fixed" },
      { name: "Doação", behavior: "variable" },
      { name: "Tarifas e juros", behavior: "variable" },
      { name: "Anuidade cartão", behavior: "fixed" }
    ]
  },
  {
    id: "cat-aportes",
    nature: "expense",
    name: "Investimentos (Aportes)",
    subcategories: [
      { name: "Aporte em corretora", behavior: "variable" },
      { name: "Reserva de emergência", behavior: "fixed" },
      { name: "Poupança da Shuri", behavior: "fixed" },
      { name: "Poupança da casa", behavior: "fixed" }
    ]
  }
] as const;
