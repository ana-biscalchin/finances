const ids = {
  checking: "account-checking-main",
  savings: "demo-account-savings",
  flashFood: "account-flash-food",
  flashConvenience: "account-flash-convenience",
  card: "demo-card-main",
  bill: "demo-bill-current",
  transfer: "demo-transfer-reserve",
  rentRecurrence: "demo-recurrence-rent",
  streamingRecurrence: "demo-recurrence-streaming"
} as const;

export function buildDemoSeedData(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
    throw new Error("Demo month must use YYYY-MM format");
  }

  const date = (day: number) => `${month}-${String(day).padStart(2, "0")}`;

  const accounts = [
    {
      id: ids.checking,
      name: "Conta principal",
      type: "checking",
      institution: "Banco Demo",
      initialBalanceCents: 320_000,
      sortOrder: 0,
      isPrimary: true
    },
    {
      id: ids.savings,
      name: "Reserva imediata",
      type: "savings",
      institution: "Banco Demo",
      initialBalanceCents: 800_000,
      sortOrder: 1,
      isPrimary: false
    },
    {
      id: ids.flashFood,
      name: "Flash Alimentação",
      type: "benefit",
      institution: "Flash",
      initialBalanceCents: 0,
      sortOrder: 2,
      isPrimary: false
    },
    {
      id: ids.flashConvenience,
      name: "Flash Conveniência",
      type: "benefit",
      institution: "Flash",
      initialBalanceCents: 0,
      sortOrder: 3,
      isPrimary: false
    }
  ];

  const accountPaymentMethods = [
    accountMethod("account-method-checking-pix", ids.checking, "pm-pix", true),
    accountMethod("account-method-checking-debit", ids.checking, "pm-debit-card", false),
    accountMethod("account-method-flash-food", ids.flashFood, "pm-prepaid-card", true),
    accountMethod("account-method-flash-convenience", ids.flashConvenience, "pm-prepaid-card", true)
  ];

  const creditCards = [
    {
      id: ids.card,
      name: "Cartão principal",
      institution: "Banco Demo",
      closingDay: 20,
      dueDay: 28,
      paymentAccountId: ids.checking,
      limitCents: 500_000,
      isDefault: true
    }
  ];

  const bills = [
    {
      id: ids.bill,
      creditCardId: ids.card,
      billMonth: month,
      closingDate: date(20),
      dueDate: date(28),
      status: "partial",
      minimumDueCents: 30_000
    }
  ];

  const transactions = [
    transaction("salary", "income", "Salário", 850_000, date(5), month, {
      accountId: ids.checking,
      paymentMethodId: "pm-bank-transfer",
      subcategoryId: "cat-trabalho-sub-salario"
    }),
    transaction("rent", "expense", "Aluguel", 220_000, date(8), month, {
      accountId: ids.checking,
      paymentMethodId: "pm-pix",
      subcategoryId: "cat-moradia-sub-aluguel",
      recurrenceRuleId: ids.rentRecurrence,
      recurrenceMonth: month
    }),
    transaction("market", "expense", "Supermercado", 48_750, date(10), month, {
      accountId: ids.checking,
      paymentMethodId: "pm-debit-card",
      subcategoryId: "cat-alimentacao-sub-supermercado"
    }),
    transaction("pharmacy", "expense", "Farmácia", 12_490, date(11), month, {
      accountId: ids.checking,
      paymentMethodId: "pm-pix",
      subcategoryId: "cat-saude-sub-farmacia"
    }),
    transaction(
      "flash-food-credit",
      "income",
      "Benefício Flash Alimentação",
      70_000,
      date(1),
      month,
      {
        accountId: ids.flashFood,
        paymentMethodId: "pm-prepaid-card",
        subcategoryId: "cat-outras-receitas-sub-flash-alimentacao"
      }
    ),
    transaction("flash-food-market", "expense", "Supermercado no Flash", 32_000, date(10), month, {
      accountId: ids.flashFood,
      paymentMethodId: "pm-prepaid-card",
      subcategoryId: "cat-alimentacao-sub-supermercado"
    }),
    transaction(
      "flash-convenience-credit",
      "income",
      "Benefício Flash Conveniência",
      25_000,
      date(1),
      month,
      {
        accountId: ids.flashConvenience,
        paymentMethodId: "pm-prepaid-card",
        subcategoryId: "cat-outras-receitas-sub-flash-convenio"
      }
    ),
    transaction("card-restaurant", "expense", "Restaurante", 13_900, date(7), month, {
      creditCardId: ids.card,
      creditCardBillId: ids.bill,
      paymentMethodId: null,
      subcategoryId: "cat-alimentacao-sub-restaurantes"
    }),
    transaction("card-streaming", "expense", "Streaming", 5_590, date(9), month, {
      creditCardId: ids.card,
      creditCardBillId: ids.bill,
      paymentMethodId: null,
      subcategoryId: "cat-lazer-sub-assinaturas-de-streaming",
      recurrenceRuleId: ids.streamingRecurrence,
      recurrenceMonth: month
    }),
    transaction("card-course", "expense", "Curso de finanças 1/3", 30_000, date(12), month, {
      creditCardId: ids.card,
      creditCardBillId: ids.bill,
      paymentMethodId: null,
      subcategoryId: "cat-educacao-sub-cursos"
    }),
    transaction(
      "bill-payment",
      "expense",
      `Pagamento parcial da fatura ${month}`,
      30_000,
      date(13),
      month,
      {
        accountId: ids.checking,
        paymentMethodId: "pm-bank-transfer",
        creditCardBillId: ids.bill,
        subcategoryId: null
      }
    ),
    transaction("transfer-out", "expense", "Guardar na reserva", 100_000, date(6), month, {
      accountId: ids.checking,
      transferId: ids.transfer,
      subcategoryId: null,
      paymentMethodId: null
    }),
    transaction("transfer-in", "income", "Guardar na reserva", 100_000, date(6), month, {
      accountId: ids.savings,
      transferId: ids.transfer,
      subcategoryId: null,
      paymentMethodId: null
    })
  ];

  return {
    accounts,
    accountPaymentMethods,
    creditCards,
    bills,
    transactions,
    transfers: [
      {
        id: ids.transfer,
        sourceAccountId: ids.checking,
        destinationAccountId: ids.savings,
        amountCents: 100_000,
        eventDate: date(6),
        description: "Guardar na reserva",
        status: "active"
      }
    ],
    billPayments: [
      {
        id: "demo-bill-payment",
        idempotencyKey: `demo-${month}-partial`,
        billId: ids.bill,
        accountId: ids.checking,
        paymentTransactionId: "demo-transaction-bill-payment",
        paymentDate: date(13),
        principalCents: 30_000,
        interestCents: 0,
        penaltyCents: 0,
        notes: "Pagamento parcial para demonstrar saldo em aberto"
      }
    ],
    monthlyBudgetAllocations: [
      allocation("rent", "cat-moradia-sub-aluguel", 220_000, month, {
        accountId: ids.checking,
        paymentMethodId: "pm-pix"
      }),
      allocation("market-debit", "cat-alimentacao-sub-supermercado", 25_000, month, {
        accountId: ids.checking,
        paymentMethodId: "pm-debit-card"
      }),
      allocation("market-flash", "cat-alimentacao-sub-supermercado", 40_000, month, {
        accountId: ids.flashFood,
        paymentMethodId: "pm-prepaid-card"
      }),
      allocation("restaurants", "cat-alimentacao-sub-restaurantes", 12_000, month, {
        creditCardId: ids.card
      }),
      allocation("health", "cat-saude-sub-farmacia", 20_000, month, {
        accountId: ids.checking,
        paymentMethodId: "pm-pix"
      }),
      allocation("streaming", "cat-lazer-sub-assinaturas-de-streaming", 6_000, month, {
        creditCardId: ids.card
      }),
      allocation("courses", "cat-educacao-sub-cursos", 25_000, month, { creditCardId: ids.card })
    ],
    monthlyIncomePlans: [
      incomePlan("salary", "cat-trabalho-sub-salario", ids.checking, 850_000, month),
      incomePlan(
        "flash-food",
        "cat-outras-receitas-sub-flash-alimentacao",
        ids.flashFood,
        70_000,
        month
      ),
      incomePlan(
        "flash-convenience",
        "cat-outras-receitas-sub-flash-convenio",
        ids.flashConvenience,
        25_000,
        month
      )
    ],
    recurrenceRules: [
      {
        id: ids.rentRecurrence,
        kind: "expense",
        description: "Aluguel",
        amountCents: 220_000,
        subcategoryId: "cat-moradia-sub-aluguel",
        accountId: ids.checking,
        creditCardId: null,
        paymentMethodId: "pm-pix",
        frequency: "monthly",
        dayOfMonth: 8,
        startMonth: month,
        endMonth: null,
        status: "active"
      },
      {
        id: ids.streamingRecurrence,
        kind: "expense",
        description: "Streaming",
        amountCents: 5_590,
        subcategoryId: "cat-lazer-sub-assinaturas-de-streaming",
        accountId: null,
        creditCardId: ids.card,
        paymentMethodId: null,
        frequency: "monthly",
        dayOfMonth: 9,
        startMonth: month,
        endMonth: null,
        status: "active"
      }
    ]
  };
}

function accountMethod(id: string, accountId: string, paymentMethodId: string, isDefault: boolean) {
  return { id, accountId, paymentMethodId, isDefault, isActive: true, archivedAt: null };
}

function incomePlan(
  suffix: string,
  subcategoryId: string,
  accountId: string,
  amountCents: number,
  budgetMonth: string
) {
  return {
    id: `demo-income-plan-${suffix}`,
    budgetMonth,
    subcategoryId,
    accountId,
    amountCents
  };
}

function transaction(
  suffix: string,
  type: string,
  description: string,
  amountCents: number,
  eventDate: string,
  budgetMonth: string,
  links: Record<string, string | null>
) {
  return {
    id: `demo-transaction-${suffix}`,
    type,
    description,
    amountCents,
    eventDate,
    budgetMonth,
    status: "confirmed",
    notes: "Dados de demonstração",
    accountId: null,
    paymentMethodId: null,
    subcategoryId: null,
    creditCardId: null,
    creditCardBillId: null,
    transferId: null,
    recurrenceRuleId: null,
    recurrenceMonth: null,
    ...links
  };
}

function allocation(
  suffix: string,
  subcategoryId: string,
  amountCents: number,
  budgetMonth: string,
  source: { accountId?: string; paymentMethodId?: string; creditCardId?: string }
) {
  return {
    id: `demo-budget-allocation-${suffix}`,
    budgetMonth,
    subcategoryId,
    amountCents,
    accountId: source.accountId ?? null,
    paymentMethodId: source.paymentMethodId ?? null,
    creditCardId: source.creditCardId ?? null
  };
}
