import {
  distributedBudgetInputSchema,
  replaceMonthlyBudgetAllocationsSchema,
  type DistributedBudgetInput,
  type MonthlyBudgetAllocationInput,
  type ReplaceMonthlyBudgetAllocations
} from "./contracts.js";
import {
  getAccountDelta,
  isCreditCardPayment,
  isRealizedTransaction
} from "./financial-classification.js";

export type PaymentSource = { kind: "account"; id: string } | { kind: "credit_card"; id: string };

export type BudgetDistribution = DistributedBudgetInput & {
  distributedCents: number;
  undistributedCents: number;
  planningStatus: "complete" | "incomplete";
};

export type PaymentSourceTransaction = {
  id: string;
  type: string;
  status?: string | null;
  amountCents: number;
  budgetMonth: string;
  subcategoryId?: string | null;
  accountId?: string | null;
  paymentMethodId?: string | null;
  creditCardId?: string | null;
  creditCardBillId?: string | null;
  transferId?: string | null;
};

export type PaymentMethodAttention =
  | "over"
  | "near_limit"
  | "unplanned"
  | "on_track"
  | "unused";

export type PaymentMethodOverviewItem = MonthlyBudgetAllocationInput & {
  plannedCents: number;
  spentCents: number;
  availableCents: number;
  abovePlannedCents: number;
  usagePercent: number | null;
  attention: PaymentMethodAttention;
  isUnplanned: boolean;
};

export type PaymentMethodOverview = ReplaceMonthlyBudgetAllocations & {
  plannedCents: number;
  spentCents: number;
  availableCents: number;
  abovePlannedCents: number;
  usagePercent: number | null;
  attention: PaymentMethodAttention;
  paymentMethods: PaymentMethodOverviewItem[];
};

type PaymentMethodIdentity =
  | { kind: "account_method"; accountId: string; paymentMethodId: string }
  | { kind: "credit_card"; creditCardId: string };

export type PaymentSourceOverviewItem = PaymentSource & {
  plannedCents: number;
  spentCents: number;
  availableCents: number;
  abovePlannedCents: number;
  differenceCents: number;
  isUnplanned: boolean;
};

export type PaymentSourceOverview = BudgetDistribution & {
  spentCents: number;
  availableCents: number;
  abovePlannedCents: number;
  hasSourceDivergence: boolean;
  sources: PaymentSourceOverviewItem[];
};

export type AccountCashProjectionInput = {
  accounts: Array<{ id: string; type: string; initialBalanceCents: number }>;
  transactions: Array<{
    accountId?: string | null;
    type: string;
    status?: string | null;
    amountCents: number;
  }>;
  remainingPlans: Array<{
    kind: "account" | "credit_card";
    sourceId: string;
    subcategoryId: string;
    amountCents: number;
  }>;
  recurrenceForecasts: Array<{
    kind: "income" | "expense";
    sourceKind: "account" | "credit_card";
    sourceId: string;
    subcategoryId: string;
    amountCents: number;
  }>;
  cards: Array<{ id: string; paymentAccountId?: string | null }>;
  outstandingBills: Array<{ accountId: string; cardId: string; amountCents: number }>;
};

export type AccountCashProjection = {
  accountId: string;
  currentBalanceCents: number;
  expectedIncomeCents: number;
  benefitIncomeCents: number;
  directPlanRemainingCents: number;
  expectedCardPurchasesCents: number;
  outstandingBillsCents: number;
  expectedBalanceCents: number;
  atRisk: boolean;
};

function sourceFromAllocation(
  allocation: DistributedBudgetInput["allocations"][number]
): PaymentSource {
  return allocation.accountId
    ? { kind: "account", id: allocation.accountId }
    : { kind: "credit_card", id: allocation.creditCardId! };
}

function sourceFromTransaction(transaction: PaymentSourceTransaction): PaymentSource | null {
  if (transaction.creditCardId) {
    return { kind: "credit_card", id: transaction.creditCardId };
  }
  if (transaction.accountId) {
    return { kind: "account", id: transaction.accountId };
  }
  return null;
}

function sourceKey(source: PaymentSource): string {
  return `${source.kind}:${source.id}`;
}

function allocationKey(allocation: MonthlyBudgetAllocationInput): string {
  return allocation.kind === "account_method"
    ? `account_method:${allocation.accountId}:${allocation.paymentMethodId}`
    : `credit_card:${allocation.creditCardId}`;
}

function allocationFromTransaction(
  transaction: PaymentSourceTransaction
): PaymentMethodIdentity | null {
  if (transaction.creditCardId) {
    return { kind: "credit_card", creditCardId: transaction.creditCardId };
  }
  if (transaction.accountId && transaction.paymentMethodId) {
    return {
      kind: "account_method",
      accountId: transaction.accountId,
      paymentMethodId: transaction.paymentMethodId
    };
  }
  return null;
}

function usagePercent(plannedCents: number, spentCents: number): number | null {
  return plannedCents === 0 ? null : (spentCents / plannedCents) * 100;
}

function attentionFor(
  plannedCents: number,
  spentCents: number,
  percent: number | null
): PaymentMethodAttention {
  if (plannedCents === 0 && spentCents > 0) return "unplanned";
  if (spentCents > plannedCents) return "over";
  if (spentCents === 0) return "unused";
  if (percent !== null && percent >= 80) return "near_limit";
  return "on_track";
}

export function validateMonthlyBudgetAllocations(input: unknown) {
  const parsed = replaceMonthlyBudgetAllocationsSchema.parse(input);
  return {
    ...parsed,
    plannedCents: parsed.allocations.reduce(
      (total, allocation) => total + allocation.amountCents,
      0
    )
  };
}

export function buildPaymentMethodOverview(
  input: ReplaceMonthlyBudgetAllocations & { transactions: PaymentSourceTransaction[] }
): PaymentMethodOverview {
  const validated = validateMonthlyBudgetAllocations(input);
  const methods = new Map<string, PaymentMethodOverviewItem>();

  for (const allocation of validated.allocations) {
    methods.set(allocationKey(allocation), {
      ...allocation,
      plannedCents: allocation.amountCents,
      spentCents: 0,
      availableCents: allocation.amountCents,
      abovePlannedCents: 0,
      usagePercent: 0,
      attention: "unused",
      isUnplanned: false
    });
  }

  for (const transaction of input.transactions) {
    if (
      transaction.budgetMonth !== validated.budgetMonth ||
      transaction.subcategoryId !== validated.subcategoryId ||
      !isRealizedTransaction(transaction) ||
      transaction.transferId ||
      isCreditCardPayment(transaction) ||
      !["expense", "refund", "chargeback"].includes(transaction.type)
    ) {
      continue;
    }
    const identity = allocationFromTransaction(transaction);
    if (!identity) continue;
    const key = allocationKey({ ...identity, amountCents: 1 } as MonthlyBudgetAllocationInput);
    const current = methods.get(key) ?? {
      ...identity,
      amountCents: 0,
      plannedCents: 0,
      spentCents: 0,
      availableCents: 0,
      abovePlannedCents: 0,
      usagePercent: null,
      attention: "unplanned" as const,
      isUnplanned: true
    };
    current.spentCents +=
      transaction.type === "expense" ? transaction.amountCents : -transaction.amountCents;
    methods.set(key, current as PaymentMethodOverviewItem);
  }

  for (const method of methods.values()) {
    method.spentCents = Math.max(0, method.spentCents);
    method.availableCents = Math.max(0, method.plannedCents - method.spentCents);
    method.abovePlannedCents = Math.max(0, method.spentCents - method.plannedCents);
    method.usagePercent = usagePercent(method.plannedCents, method.spentCents);
    method.attention = attentionFor(method.plannedCents, method.spentCents, method.usagePercent);
  }

  const paymentMethods = [...methods.values()];
  const spentCents = paymentMethods.reduce((total, method) => total + method.spentCents, 0);
  const plannedCents = validated.plannedCents;
  const percent = usagePercent(plannedCents, spentCents);
  return {
    ...validated,
    spentCents,
    availableCents: Math.max(0, plannedCents - spentCents),
    abovePlannedCents: Math.max(0, spentCents - plannedCents),
    usagePercent: percent,
    attention: attentionFor(plannedCents, spentCents, percent),
    paymentMethods
  };
}

export function validateBudgetDistribution(input: unknown): BudgetDistribution {
  const parsed = distributedBudgetInputSchema.parse(input);
  const distributedCents = parsed.allocations.reduce(
    (total, allocation) => total + allocation.amountCents,
    0
  );
  const undistributedCents = parsed.amountCents - distributedCents;

  return {
    ...parsed,
    distributedCents,
    undistributedCents,
    planningStatus: undistributedCents === 0 ? "complete" : "incomplete"
  };
}

export function buildPaymentSourceOverview(
  input: DistributedBudgetInput & { transactions: PaymentSourceTransaction[] }
): PaymentSourceOverview {
  const distribution = validateBudgetDistribution(input);
  const sources = new Map<string, PaymentSourceOverviewItem>();

  for (const allocation of distribution.allocations) {
    const source = sourceFromAllocation(allocation);
    sources.set(sourceKey(source), {
      ...source,
      plannedCents: allocation.amountCents,
      spentCents: 0,
      availableCents: allocation.amountCents,
      abovePlannedCents: 0,
      differenceCents: allocation.amountCents,
      isUnplanned: false
    });
  }

  for (const transaction of input.transactions) {
    if (
      transaction.budgetMonth !== distribution.budgetMonth ||
      transaction.subcategoryId !== distribution.subcategoryId ||
      !isRealizedTransaction(transaction) ||
      transaction.transferId ||
      isCreditCardPayment(transaction) ||
      !["expense", "refund", "chargeback"].includes(transaction.type)
    ) {
      continue;
    }

    const source = sourceFromTransaction(transaction);
    if (!source) continue;
    const key = sourceKey(source);
    const current = sources.get(key) ?? {
      ...source,
      plannedCents: 0,
      spentCents: 0,
      availableCents: 0,
      abovePlannedCents: 0,
      differenceCents: 0,
      isUnplanned: true
    };
    current.spentCents +=
      transaction.type === "expense" ? transaction.amountCents : -transaction.amountCents;
    sources.set(key, current);
  }

  for (const source of sources.values()) {
    source.spentCents = Math.max(0, source.spentCents);
    source.availableCents = Math.max(0, source.plannedCents - source.spentCents);
    source.abovePlannedCents = Math.max(0, source.spentCents - source.plannedCents);
    source.differenceCents = source.plannedCents - source.spentCents;
  }

  const sourceItems = [...sources.values()];
  const spentCents = sourceItems.reduce((total, source) => total + source.spentCents, 0);
  return {
    ...distribution,
    spentCents,
    availableCents: Math.max(0, distribution.amountCents - spentCents),
    abovePlannedCents: Math.max(0, spentCents - distribution.amountCents),
    hasSourceDivergence: sourceItems.some((source) => source.isUnplanned && source.spentCents > 0),
    sources: sourceItems
  };
}

function projectedExpenses(
  plans: AccountCashProjectionInput["remainingPlans"],
  forecasts: AccountCashProjectionInput["recurrenceForecasts"]
): number {
  const values = new Map<string, { plannedCents: number; recurrenceCents: number }>();
  for (const plan of plans) {
    const current = values.get(plan.subcategoryId) ?? { plannedCents: 0, recurrenceCents: 0 };
    values.set(plan.subcategoryId, {
      plannedCents: current.plannedCents + plan.amountCents,
      recurrenceCents: current.recurrenceCents
    });
  }
  for (const forecast of forecasts) {
    if (forecast.kind !== "expense") continue;
    const current = values.get(forecast.subcategoryId) ?? { plannedCents: 0, recurrenceCents: 0 };
    current.recurrenceCents += forecast.amountCents;
    values.set(forecast.subcategoryId, current);
  }
  return [...values.values()].reduce(
    (total, value) => total + Math.max(value.plannedCents, value.recurrenceCents),
    0
  );
}

export function buildAccountCashProjection(
  input: AccountCashProjectionInput
): AccountCashProjection[] {
  const cards = new Map(input.cards.map((card) => [card.id, card]));
  return input.accounts.map((account) => {
    const currentBalanceCents = input.transactions.reduce(
      (balance, transaction) =>
        balance + (transaction.accountId === account.id ? getAccountDelta(transaction) : 0),
      account.initialBalanceCents
    );
    const accountForecasts = input.recurrenceForecasts.filter(
      (forecast) => forecast.sourceKind === "account" && forecast.sourceId === account.id
    );
    const expectedIncome = accountForecasts
      .filter((forecast) => forecast.kind === "income")
      .reduce((total, forecast) => total + forecast.amountCents, 0);
    const expectedIncomeCents = account.type === "benefit" ? 0 : expectedIncome;
    const benefitIncomeCents = account.type === "benefit" ? expectedIncome : 0;
    const directPlanRemainingCents = projectedExpenses(
      input.remainingPlans.filter(
        (plan) => plan.kind === "account" && plan.sourceId === account.id
      ),
      accountForecasts
    );
    const accountCardIds = new Set(
      [...cards.values()]
        .filter((card) => card.paymentAccountId === account.id)
        .map((card) => card.id)
    );
    const expectedCardPurchasesCents = projectedExpenses(
      input.remainingPlans.filter(
        (plan) => plan.kind === "credit_card" && accountCardIds.has(plan.sourceId)
      ),
      input.recurrenceForecasts.filter(
        (forecast) => forecast.sourceKind === "credit_card" && accountCardIds.has(forecast.sourceId)
      )
    );
    const outstandingBillsCents = input.outstandingBills
      .filter((bill) => bill.accountId === account.id)
      .reduce((total, bill) => total + bill.amountCents, 0);
    const expectedBalanceCents =
      currentBalanceCents +
      expectedIncomeCents +
      benefitIncomeCents -
      directPlanRemainingCents -
      expectedCardPurchasesCents -
      outstandingBillsCents;

    return {
      accountId: account.id,
      currentBalanceCents,
      expectedIncomeCents,
      benefitIncomeCents,
      directPlanRemainingCents,
      expectedCardPurchasesCents,
      outstandingBillsCents,
      expectedBalanceCents,
      atRisk: expectedBalanceCents < 0
    };
  });
}
