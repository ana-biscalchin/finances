import {
  budgets,
  categories as dbCategories,
  subcategories as dbSubcategories,
  paymentMethods as dbPaymentMethods,
  transactions as dbTransactions,
  creditCards as dbCreditCards,
  creditCardBills as dbCreditCardBills,
  accounts as dbAccounts,
  type createDatabaseConnection
} from "@finances/database";
import { advanceMonth, assertYearMonth } from "@finances/domain";
import { and, asc, eq, gte, isNull, inArray, lt, ne } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import {
  isRecord,
  parseOptionalString,
  parseRequiredInteger,
  parseRequiredString,
  sendPayloadError
} from "../http.js";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

interface Accumulator {
  budgeted: number;
  realized: number;
  committed: number;
  realizedCash: number;
  realizedCredit: number;
  committedCash: number;
  committedCredit: number;
}

interface TreeNode {
  id: string;
  name: string;
  nature: "income" | "expense" | "mixed" | "transfer";
  behavior?: "fixed" | "variable" | "extra";
  budgeted: number;
  realized: number;
  committed: number;
  available: number;
  realizedCash?: number;
  realizedCredit?: number;
  committedCash?: number;
  committedCredit?: number;
  subcategoryId?: string;
  accountId?: string | null;
  paymentMethodId?: string | null;
  byPaymentMethod?: {
    accountId: string | null;
    creditCardId: string | null;
    paymentMethodId: string | null;
    budgeted: number;
    realized: number;
    committed: number;
  }[];
  children?: TreeNode[];
}

interface AccountMonthlySummary {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  isActive: boolean;
  openingBalance: number;
  realizedInflow: number;
  realizedOutflow: number;
  realizedBalance: number;
  projectedBalance: number;
  plannedInflow: number;
  plannedOutflow: number;
  openCardBills: number;
  linkedCards: string[];
  linkedBillsDetail: {
    cardName: string;
    billMonth: string;
    amountCents: number;
    dueDate: string;
  }[];
}

export function registerBudgetRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const { db } = connection;

  app.get("/controle-mensal/month-range", async () => {
    const firstTransaction = db
      .select({
        eventDate: dbTransactions.eventDate,
        budgetMonth: dbTransactions.budgetMonth
      })
      .from(dbTransactions)
      .orderBy(asc(dbTransactions.eventDate))
      .limit(1)
      .get();

    const firstBudget = db
      .select({ budgetMonth: budgets.budgetMonth })
      .from(budgets)
      .orderBy(asc(budgets.budgetMonth))
      .limit(1)
      .get();

    const firstBillByDueDate = db
      .select({
        dueDate: dbCreditCardBills.dueDate,
        billMonth: dbCreditCardBills.billMonth
      })
      .from(dbCreditCardBills)
      .orderBy(asc(dbCreditCardBills.dueDate))
      .limit(1)
      .get();

    const months = [
      firstTransaction?.eventDate.slice(0, 7),
      firstTransaction?.budgetMonth,
      firstBudget?.budgetMonth,
      firstBillByDueDate?.dueDate.slice(0, 7),
      firstBillByDueDate?.billMonth
    ].filter((month): month is string => typeof month === "string");

    return {
      oldestMonth: months.length > 0 ? months.sort()[0] : null
    };
  });

  app.get("/controle-mensal", async (req, reply) => {
    const query = req.query as Record<string, unknown>;
    const monthStr = typeof query.month === "string" ? query.month : "";
    const view = typeof query.view === "string" ? query.view : "competence";

    let month: string;
    try {
      month = assertYearMonth(monthStr);
    } catch {
      reply.code(400).send({ message: "Mês inválido. Use o formato YYYY-MM." });
      return;
    }

    const allCategories = db.select().from(dbCategories).all();
    const allSubcategories = db.select().from(dbSubcategories).all();
    const allCards = db.select().from(dbCreditCards).all();
    const allAccounts = db.select().from(dbAccounts).all();

    const monthBudgets = db
      .select()
      .from(budgets)
      .where(eq(budgets.budgetMonth, month))
      .all();

    const monthTransactions = db
      .select()
      .from(dbTransactions)
      .where(eq(dbTransactions.budgetMonth, month))
      .all();



    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
    const subcategoryMap = new Map(allSubcategories.map((s) => [s.id, s]));
    const cardMap = new Map(allCards.map((c) => [c.id, c]));
    const accountMap = new Map(allAccounts.map((a) => [a.id, a]));

    // Lookup de sortOrder por nome de categoria e por id de subcategoria
    const catSortOrderByName = new Map(allCategories.map((c) => [c.name, c.sortOrder]));
    const subSortOrderById = new Map(allSubcategories.map((s) => [s.id, s.sortOrder]));

    const pagFaturaSub = allSubcategories.find(
      (s) => s.name === "Pagamento de fatura" && s.categoryId === "cat-transferencias"
    );

    // Calculate total bills due in the month
    const nextMonthStart = `${advanceMonth(month, 1)}-01`;
    const billsDueInMonth = db
      .select()
      .from(dbCreditCardBills)
      .where(and(gte(dbCreditCardBills.dueDate, `${month}-01`), lt(dbCreditCardBills.dueDate, nextMonthStart)))
      .all();

    const billIds = billsDueInMonth.map((b) => b.id);
    const billPayments = billIds.length > 0
      ? db
          .select({
            creditCardBillId: dbTransactions.creditCardBillId,
            paymentMethodId: dbTransactions.paymentMethodId,
          })
          .from(dbTransactions)
          .where(
            and(
              inArray(dbTransactions.creditCardBillId, billIds),
              eq(dbTransactions.type, "expense"),
              isNull(dbTransactions.creditCardId),
              ne(dbTransactions.status, "canceled")
            )
          )
          .all()
      : [];

    const billPmSums = new Map<string, { realized: number; committed: number }>();
    const billTotalCentsMap = new Map<string, number>();
    let billRealizedSum = 0;
    let billCommittedSum = 0;

    function getBillPaymentMethodId(bill: typeof dbCreditCardBills.$inferSelect): string | null {
      if (bill.status === "paid") {
        const paymentTransaction = billPayments.find(
          (t) => t.creditCardBillId === bill.id
        );
        if (paymentTransaction?.paymentMethodId) return paymentTransaction.paymentMethodId;
      }

      const cardId = bill.creditCardId;
      const card = cardMap.get(cardId);
      if (!card || !card.paymentAccountId) return null;
      const account = accountMap.get(card.paymentAccountId);
      return account?.defaultPaymentMethodId ?? null;
    }

    for (const bill of billsDueInMonth) {
      // Find all transactions for this credit card and billMonth (month of the bill)
      const billTx = db
        .select()
        .from(dbTransactions)
        .where(
          and(
            eq(dbTransactions.creditCardId, bill.creditCardId),
            eq(dbTransactions.budgetMonth, bill.billMonth)
          )
        )
        .all();

      const totalBillCents = billTx
        .filter((t) => t.status !== "canceled")
        .reduce((sum, t) => {
          if (t.type === "expense") return sum + t.amountCents;
          if (t.type === "refund" || t.type === "chargeback") return sum - t.amountCents;
          return sum;
        }, 0);

      billTotalCentsMap.set(bill.id, totalBillCents);

      const pmId = getBillPaymentMethodId(bill) || "null";
      if (!billPmSums.has(pmId)) {
        billPmSums.set(pmId, { realized: 0, committed: 0 });
      }
      const sumObj = billPmSums.get(pmId)!;

      if (bill.status === "paid") {
        sumObj.realized += totalBillCents;
        billRealizedSum += totalBillCents;
      } else {
        sumObj.committed += totalBillCents;
        billCommittedSum += totalBillCents;
      }
    }

    const UNCATEGORIZED_SUB_INCOME_ID = "virtual-sub-uncategorized-income";
    const UNCATEGORIZED_SUB_EXPENSE_ID = "virtual-sub-uncategorized-expense";

    function getSubcategoryDetails(subId: string, defaultNature: "income" | "expense" | "transfer") {
      if (subId === UNCATEGORIZED_SUB_INCOME_ID) {
        return {
          subName: "Sem subcategoria",
          catName: "Outros",
          behavior: "variable" as const,
          nature: "income" as const
        };
      }
      if (subId === UNCATEGORIZED_SUB_EXPENSE_ID) {
        return {
          subName: "Sem subcategoria",
          catName: "Outros",
          behavior: "variable" as const,
          nature: "expense" as const
        };
      }

      const sub = subcategoryMap.get(subId);
      if (!sub) {
        return {
          subName: "Sem subcategoria",
          catName: "Outros",
          behavior: "variable" as const,
          nature: defaultNature
        };
      }

      const cat = categoryMap.get(sub.categoryId);
      return {
        subName: sub.name,
        catName: cat?.name ?? "Outros",
        behavior: sub.behavior,
        nature: (cat?.nature ?? defaultNature) as "income" | "expense" | "transfer"
      };
    }



    function getFirstSubIdForCategory(catId: string): string | null {
      const sub = allSubcategories.find((s) => s.categoryId === catId && s.isActive);
      return sub?.id ?? null;
    }


    function calculateAvailable(
      nature: "income" | "expense" | "mixed" | "transfer",
      budgeted: number,
      realized: number,
      committed: number
    ) {
      const used = realized + committed;
      return nature === "income" ? used - budgeted : budgeted - used;
    }

    function getAccountDelta(transaction: { type: string; amountCents: number }) {
      if (
        transaction.type === "income" ||
        transaction.type === "refund" ||
        transaction.type === "chargeback"
      ) {
        return transaction.amountCents;
      }

      if (transaction.type === "expense") {
        return -transaction.amountCents;
      }

      return 0;
    }

    function getTransactionPaymentMethodId(transaction: typeof dbTransactions.$inferSelect) {
      return transaction.creditCardId ? "pm-credit-card" : transaction.paymentMethodId;
    }

    const monthStart = `${month}-01`;

    const pastTx = db
      .select({
        accountId: dbTransactions.accountId,
        type: dbTransactions.type,
        amountCents: dbTransactions.amountCents,
      })
      .from(dbTransactions)
      .where(
        and(
          lt(dbTransactions.eventDate, monthStart),
          ne(dbTransactions.status, "canceled")
        )
      )
      .all();

    const currentMonthTransactions = db
      .select()
      .from(dbTransactions)
      .where(
        and(
          gte(dbTransactions.eventDate, `${month}-01`),
          lt(dbTransactions.eventDate, nextMonthStart),
          ne(dbTransactions.status, "canceled")
        )
      )
      .all();

    const accountSummaries: AccountMonthlySummary[] = allAccounts
      .map((account) => {
        const accountPastTransactions = pastTx.filter(
          (t) => t.accountId === account.id
        );
        const accountCurrentTransactions = currentMonthTransactions.filter(
          (t) => t.accountId === account.id
        );

        let openingBalance = account.initialBalanceCents;
        let realizedInflow = 0;
        let realizedOutflow = 0;
        let plannedInflow = 0;
        let plannedOutflow = 0;

        for (const transaction of accountPastTransactions) {
          openingBalance += getAccountDelta(transaction);
        }

        for (const transaction of accountCurrentTransactions) {
          const delta = getAccountDelta(transaction);

          const isRealized = transaction.status === "confirmed" || transaction.status === "reconciled";
          const isPlanned = transaction.status === "planned";

          if (isRealized && delta > 0) {
            realizedInflow += delta;
          } else if (isRealized && delta < 0) {
            realizedOutflow += Math.abs(delta);
          } else if (isPlanned && delta > 0) {
            plannedInflow += delta;
          } else if (isPlanned && delta < 0) {
            plannedOutflow += Math.abs(delta);
          }
        }

        let openCardBills = 0;
        const linkedBillsDetail: { cardName: string; billMonth: string; amountCents: number; dueDate: string }[] = [];
        const linkedCards: string[] = [];

        // Find active cards linked to this account
        const accountCards = allCards.filter(
          (c) => c.paymentAccountId === account.id && c.isActive
        );
        for (const card of accountCards) {
          linkedCards.push(card.name);
        }

        for (const bill of billsDueInMonth) {
          const card = cardMap.get(bill.creditCardId);
          if (card && card.paymentAccountId === account.id) {
            const amountCents = billTotalCentsMap.get(bill.id) ?? 0;
            if (bill.status === "open") {
              openCardBills += amountCents;
              linkedBillsDetail.push({
                cardName: card.name,
                billMonth: bill.billMonth,
                amountCents,
                dueDate: bill.dueDate
              });
            }
          }
        }

        const realizedBalance = openingBalance + realizedInflow - realizedOutflow;
        const projectedBalance = realizedBalance + plannedInflow - plannedOutflow - openCardBills;

        return {
          id: account.id,
          name: account.name,
          type: account.type,
          institution: account.institution,
          isActive: account.isActive,
          openingBalance,
          realizedInflow,
          realizedOutflow,
          realizedBalance,
          projectedBalance,
          plannedInflow,
          plannedOutflow,
          openCardBills,
          linkedCards,
          linkedBillsDetail
        };
      })
      .filter((account) => {
        const hasMovement =
          account.realizedInflow > 0 ||
          account.realizedOutflow > 0 ||
          account.plannedInflow > 0 ||
          account.plannedOutflow > 0 ||
          account.openCardBills > 0;
        return account.isActive || hasMovement || account.openingBalance !== 0;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // ── VISÃO DE CAIXA ────────────────────────────────────────────────────────
    if (view === "cash") {
      const totalOpeningBalance = accountSummaries.reduce((s, a) => s + a.openingBalance, 0);
      const totalRealizedInflow = accountSummaries.reduce((s, a) => s + a.realizedInflow, 0);
      const totalRealizedOutflow = accountSummaries.reduce((s, a) => s + a.realizedOutflow, 0);
      const totalRealizedBalance = accountSummaries.reduce((s, a) => s + a.realizedBalance, 0);
      const totalProjectedBalance = accountSummaries.reduce((s, a) => s + a.projectedBalance, 0);

      // Faturas com vencimento no mês (compromissos de caixa)
      const billCommitments = billsDueInMonth.map((bill) => {
        const card = cardMap.get(bill.creditCardId);
        const totalCents = billTotalCentsMap.get(bill.id) ?? 0;
        return {
          billId: bill.id,
          cardId: bill.creditCardId,
          cardName: card?.name ?? "Cartão",
          billMonth: bill.billMonth,
          dueDate: bill.dueDate,
          status: bill.status,
          totalCents,
        };
      });

      // --- CÁLCULO DE SIMULAÇÃO DE ORÇAMENTO ---
      const primaryAccount = allAccounts.find((a) => a.isPrimary && a.isActive) ||
        allAccounts.find((a) => a.type === "checking" && a.isActive) ||
        allAccounts[0];

      const benefitAccount = allAccounts.find((a) => a.type === "benefit" && a.isActive);

      const defaultCard = allCards.find((c) => c.isDefault && c.isActive) ||
        allCards.find((c) => c.isActive) ||
        allCards[0];

      const accountSimulatedOutflowMap = new Map<string, number>();
      const accountSimulatedInflowMap = new Map<string, number>();
      let simulatedCardRemaining = 0;

      for (const b of monthBudgets) {
        const subId = b.subcategoryId || (b.categoryId ? getFirstSubIdForCategory(b.categoryId) : null);
        if (!subId) continue;

        const details = getSubcategoryDetails(subId, "expense");
        const budgetedAmount = b.amountCents;

        // Filtrar transações reais deste subcategory no mês com esta forma de pagamento
        const realizedTxs = monthTransactions.filter((t) => {
          if (t.status === "canceled") return false;
          if (t.subcategoryId !== subId) return false;

          const isCardTx = t.creditCardId !== null || t.paymentMethodId === "pm-credit-card";
          const isBudgetCard = b.paymentMethodId === "pm-credit-card";

          if (isBudgetCard) return isCardTx;
          if (!b.paymentMethodId) return true;

          return !isCardTx && t.paymentMethodId === b.paymentMethodId;
        });

        const realizedSum = realizedTxs.reduce((sum, t) => {
          const sign = (t.type === "refund" || t.type === "chargeback") ? -1 : 1;
          return sum + t.amountCents * sign;
        }, 0);
        const remainingAmount = Math.max(0, budgetedAmount - realizedSum);

        if (remainingAmount > 0) {
          if (details.nature === "expense") {
            if (b.paymentMethodId === "pm-credit-card") {
              simulatedCardRemaining += remainingAmount;
            } else if (b.paymentMethodId === "pm-prepaid-card") {
              const acc = benefitAccount || primaryAccount;
              if (acc) {
                accountSimulatedOutflowMap.set(acc.id, (accountSimulatedOutflowMap.get(acc.id) ?? 0) + remainingAmount);
              }
            } else {
              if (primaryAccount) {
                accountSimulatedOutflowMap.set(primaryAccount.id, (accountSimulatedOutflowMap.get(primaryAccount.id) ?? 0) + remainingAmount);
              }
            }
          } else if (details.nature === "income") {
            if (primaryAccount) {
              accountSimulatedInflowMap.set(primaryAccount.id, (accountSimulatedInflowMap.get(primaryAccount.id) ?? 0) + remainingAmount);
            }
          }
        }
      }

      const simulatedAccountSummaries = accountSummaries.map((acc) => {
        const simulatedOutflow = accountSimulatedOutflowMap.get(acc.id) ?? 0;
        const simulatedInflow = accountSimulatedInflowMap.get(acc.id) ?? 0;
        return {
          ...acc,
          simulatedOutflow,
          simulatedInflow,
          simulatedProjectedBalance: acc.projectedBalance - simulatedOutflow + simulatedInflow
        };
      });

      const totalSimulatedOutflow = Array.from(accountSimulatedOutflowMap.values()).reduce((a, b) => a + b, 0);
      const totalSimulatedInflow = Array.from(accountSimulatedInflowMap.values()).reduce((a, b) => a + b, 0);
      const simulatedProjectedBalance = totalProjectedBalance - totalSimulatedOutflow + totalSimulatedInflow;

      const projectedBillMonth = advanceMonth(month, 1);
      const projectedBillTransactions = db
        .select()
        .from(dbTransactions)
        .where(eq(dbTransactions.budgetMonth, projectedBillMonth))
        .all();

      const simulatedCardBills = allCards.map((card) => {
        const projectedCardTxs = projectedBillTransactions.filter(
          (t) => t.creditCardId === card.id && t.status !== "canceled"
        );
        const currentRealizedCents = projectedCardTxs.reduce((sum, t) => {
          if (t.type === "expense") return sum + t.amountCents;
          if (t.type === "refund" || t.type === "chargeback") return sum - t.amountCents;
          return sum;
        }, 0);
        const isDefault = defaultCard && card.id === defaultCard.id;
        const simulatedRemaining = isDefault ? simulatedCardRemaining : 0;

        return {
          cardId: card.id,
          cardName: card.name,
          billMonth: projectedBillMonth,
          currentOpenBillCents: currentRealizedCents,
          simulatedRemainingBudgetCents: simulatedRemaining,
          projectedTotalBillCents: currentRealizedCents + simulatedRemaining
        };
      });

      reply.send({
        view: "cash",
        cashSummary: {
          openingBalance: totalOpeningBalance,
          realizedInflow: totalRealizedInflow,
          realizedOutflow: totalRealizedOutflow,
          realizedBalance: totalRealizedBalance,
          projectedBalance: totalProjectedBalance,
        },
        accountSummaries,
        billCommitments,
        budgetSimulation: {
          cashSummary: {
            openingBalance: totalOpeningBalance,
            realizedInflow: totalRealizedInflow,
            realizedOutflow: totalRealizedOutflow,
            realizedBalance: totalRealizedBalance,
            projectedBalance: totalProjectedBalance,
            simulatedProjectedBalance
          },
          accountSummaries: simulatedAccountSummaries,
          simulatedCardBills
        }
      });
      return;
    }
    // ── FIM VISÃO DE CAIXA ────────────────────────────────────────────────────

    const summary = {
      income: { budgeted: 0, realized: 0, committed: 0 },
      expense: {
        budgeted: 0,
        realized: 0,
        committed: 0,
        realizedCash: 0,
        realizedCredit: 0,
        committedCash: 0,
        committedCredit: 0
      }
    };

    // groupBy === "category"
    const categoryAccumulator = new Map<string, Accumulator>();

    for (const sub of allSubcategories) {
      if (!sub.isActive) continue;
      const cat = categoryMap.get(sub.categoryId);
      if (!cat || !cat.isActive) continue;
      const nature = cat.nature === "income" ? "income" : cat.nature === "transfer" ? "transfer" : "expense";
      const catName = cat.name;
      const key = `${nature}|${sub.behavior}|${catName}|${sub.id}`;
      categoryAccumulator.set(key, {
        budgeted: 0,
        realized: 0,
        committed: 0,
        realizedCash: 0,
        realizedCredit: 0,
        committedCash: 0,
        committedCredit: 0
      });
    }

    function getAccumulatorKey(subId: string, defaultNature: "income" | "expense" | "transfer") {
      const details = getSubcategoryDetails(subId, defaultNature);
      const key = `${details.nature}|${details.behavior}|${details.catName}|${subId}`;
      if (!categoryAccumulator.has(key)) {
        categoryAccumulator.set(key, {
          budgeted: 0,
          realized: 0,
          committed: 0,
          realizedCash: 0,
          realizedCredit: 0,
          committedCash: 0,
          committedCredit: 0
        });
      }
      return key;
    }

    for (const b of monthBudgets) {
      const subId = b.subcategoryId || (b.categoryId ? getFirstSubIdForCategory(b.categoryId) : null);
      if (!subId) continue;
      const key = getAccumulatorKey(subId, "expense");
      const acc = categoryAccumulator.get(key)!;
      acc.budgeted += b.amountCents;
    }

    const makeBreakdownKey = (accId: string | null, cardId: string | null, pmId: string | null) => {
      return `${accId || "null"}|${cardId || "null"}|${pmId || "null"}`;
    };

    // Per-subcategory breakdown by source & payment method (budgets)
    const subBudgetByMethod = new Map<string, Map<string, number>>();
    for (const b of monthBudgets) {
      const subId = b.subcategoryId || (b.categoryId ? getFirstSubIdForCategory(b.categoryId) : null);
      if (!subId) continue;
      if (!subBudgetByMethod.has(subId)) subBudgetByMethod.set(subId, new Map());

      let linkedCardId: string | null = null;
      if (b.accountId && b.paymentMethodId === "pm-credit-card") {
        const linkedCard = allCards.find((c) => c.paymentAccountId === b.accountId);
        if (linkedCard) {
          linkedCardId = linkedCard.id;
        }
      }

      const key = makeBreakdownKey(b.accountId, linkedCardId, b.paymentMethodId);
      const pmMap = subBudgetByMethod.get(subId)!;
      pmMap.set(key, (pmMap.get(key) ?? 0) + b.amountCents);
    }

    // Per-subcategory breakdown by source & payment method (realized/committed transactions)
    const subRealizedByMethod = new Map<string, Map<string, number>>();
    const subCommittedByMethod = new Map<string, Map<string, number>>();

    for (const t of monthTransactions) {
      if (t.status === "canceled") continue;
      const subId = t.subcategoryId ?? (t.type === "income" ? UNCATEGORIZED_SUB_INCOME_ID : UNCATEGORIZED_SUB_EXPENSE_ID);
      const defaultNature = t.type === "income" ? "income" : t.type === "transfer" ? "transfer" : "expense";
      const keyAcc = getAccumulatorKey(subId, defaultNature);
      const acc = categoryAccumulator.get(keyAcc)!;

      const isRealized = t.status === "confirmed" || t.status === "reconciled";
      const isCommitted = t.status === "planned";
      const isCredit = t.creditCardId !== null || t.paymentMethodId === "pm-credit-card";

      const amountCents = (t.type === "refund" || t.type === "chargeback") ? -t.amountCents : t.amountCents;

      if (isRealized) {
        acc.realized += amountCents;
        if (isCredit) {
          acc.realizedCredit += amountCents;
        } else {
          acc.realizedCash += amountCents;
        }
      } else if (isCommitted) {
        acc.committed += amountCents;
        if (isCredit) {
          acc.committedCredit += amountCents;
        } else {
          acc.committedCash += amountCents;
        }
      }

      // Also track per-method breakdown
      const txPmId: string | null = getTransactionPaymentMethodId(t) || null;
      let resolvedAccountId = t.accountId;
      if (t.creditCardId) {
        const card = cardMap.get(t.creditCardId);
        if (card && card.paymentAccountId) {
          resolvedAccountId = card.paymentAccountId;
        }
      }
      const key = makeBreakdownKey(resolvedAccountId, t.creditCardId, txPmId);
      if (isRealized) {
        if (!subRealizedByMethod.has(subId)) subRealizedByMethod.set(subId, new Map());
        const m = subRealizedByMethod.get(subId)!;
        m.set(key, (m.get(key) ?? 0) + amountCents);
      } else if (isCommitted) {
        if (!subCommittedByMethod.has(subId)) subCommittedByMethod.set(subId, new Map());
        const m = subCommittedByMethod.get(subId)!;
        m.set(key, (m.get(key) ?? 0) + amountCents);
      }
    }

    if (pagFaturaSub) {
      const key = getAccumulatorKey(pagFaturaSub.id, "transfer");
      const acc = categoryAccumulator.get(key);
      if (acc) {
        acc.realized = billRealizedSum;
        acc.committed = billCommittedSum;
        acc.realizedCash = billRealizedSum;
        acc.committedCash = billCommittedSum;
        acc.realizedCredit = 0;
        acc.committedCredit = 0;
      } else {
        categoryAccumulator.set(key, {
          budgeted: 0,
          realized: billRealizedSum,
          committed: billCommittedSum,
          realizedCash: billRealizedSum,
          realizedCredit: 0,
          committedCash: billCommittedSum,
          committedCredit: 0
        });
      }
    }

    // Calculate summary
    for (const [key, acc] of categoryAccumulator.entries()) {
      const nature = key.split("|")[0];
      if (nature === "income") {
        summary.income.budgeted += acc.budgeted;
        summary.income.realized += acc.realized;
        summary.income.committed += acc.committed;
      } else if (nature === "expense") {
        summary.expense.budgeted += acc.budgeted;
        summary.expense.realized += acc.realized;
        summary.expense.committed += acc.committed;
        summary.expense.realizedCash += acc.realizedCash;
        summary.expense.realizedCredit += acc.realizedCredit;
        summary.expense.committedCash += acc.committedCash;
        summary.expense.committedCredit += acc.committedCredit;
      }
    }

    const tree: TreeNode[] = [];
    const natureLabels: Record<string, string> = {
      income: "Receitas",
      expense: "Despesas",
      transfer: "Movimentações Internas"
    };

    const natures = ["income", "expense", "transfer"];
    for (const nature of natures) {
      const natureChildren: TreeNode[] = [];

      // Agrupar diretamente por categoria (sem nível intermediário de behavior)
      const catGroups = new Map<string, { subId: string; behavior: string; acc: Accumulator }[]>();
      for (const [key, acc] of categoryAccumulator.entries()) {
        const [kNature, kBehavior, kCatName, kSubId] = key.split("|");
        if (kNature === nature) {
          if (!catGroups.has(kCatName)) {
            catGroups.set(kCatName, []);
          }
          catGroups.get(kCatName)!.push({ subId: kSubId, behavior: kBehavior, acc });
        }
      }

      // Ordenar categorias por sortOrder
      const sortedCatEntries = [...catGroups.entries()].sort(([nameA], [nameB]) => {
        const orderA = catSortOrderByName.get(nameA) ?? 9999;
        const orderB = catSortOrderByName.get(nameB) ?? 9999;
        return orderA !== orderB ? orderA - orderB : nameA.localeCompare(nameB);
      });

      for (const [catName, subItems] of sortedCatEntries) {
        const subChildren: TreeNode[] = subItems
          .map(({ subId, behavior, acc }) => {
            const details = getSubcategoryDetails(subId, nature as "income" | "expense" | "transfer");

            // Build per-payment-method breakdown for this subcategory
            const budgetMap = subBudgetByMethod.get(subId);
            const realizedMap = subRealizedByMethod.get(subId);
            const committedMap = subCommittedByMethod.get(subId);
            const allKeys = new Set<string>([
              ...(budgetMap?.keys() ?? []),
              ...(realizedMap?.keys() ?? []),
              ...(committedMap?.keys() ?? [])
            ]);
            const byPaymentMethod = allKeys.size > 0
              ? [...allKeys].map((key) => {
                  const [accId, cardId, pmId] = key.split("|");
                  return {
                    accountId: accId === "null" ? null : accId,
                    creditCardId: cardId === "null" ? null : cardId,
                    paymentMethodId: pmId === "null" ? null : pmId,
                    budgeted: budgetMap?.get(key) ?? 0,
                    realized: realizedMap?.get(key) ?? 0,
                    committed: committedMap?.get(key) ?? 0
                  };
                })
              : undefined;

            return {
              id: `sub-${subId}`,
              name: details.subName,
              behavior: behavior as "fixed" | "variable" | "extra",
              nature: nature as "income" | "expense" | "transfer",
              budgeted: acc.budgeted,
              realized: acc.realized,
              committed: acc.committed,
              realizedCash: acc.realizedCash,
              realizedCredit: acc.realizedCredit,
              committedCash: acc.committedCash,
              committedCredit: acc.committedCredit,
              available: calculateAvailable(
                nature as "income" | "expense" | "transfer",
                acc.budgeted,
                acc.realized,
                acc.committed
              ),
              byPaymentMethod,
              _subSortOrder: subSortOrderById.get(subId) ?? 9999
            };
          })
          .sort((a, b) =>
            a._subSortOrder !== b._subSortOrder
              ? a._subSortOrder - b._subSortOrder
              : a.name.localeCompare(b.name)
          )
          .map((item) => {
            const { _subSortOrder, ...rest } = item;
            void _subSortOrder;
            return rest as TreeNode;
          });

        const catBudgeted = subChildren.reduce((sum, c) => sum + c.budgeted, 0);
        const catRealized = subChildren.reduce((sum, c) => sum + c.realized, 0);
        const catCommitted = subChildren.reduce((sum, c) => sum + c.committed, 0);
        const catRealizedCash = subChildren.reduce((sum, c) => sum + (c.realizedCash ?? 0), 0);
        const catRealizedCredit = subChildren.reduce((sum, c) => sum + (c.realizedCredit ?? 0), 0);
        const catCommittedCash = subChildren.reduce((sum, c) => sum + (c.committedCash ?? 0), 0);
        const catCommittedCredit = subChildren.reduce((sum, c) => sum + (c.committedCredit ?? 0), 0);

        natureChildren.push({
          id: `cat-${nature}-${catName}`,
          name: catName,
          nature: nature as "income" | "expense" | "transfer",
          budgeted: catBudgeted,
          realized: catRealized,
          committed: catCommitted,
          available: calculateAvailable(
            nature as "income" | "expense" | "transfer",
            catBudgeted,
            catRealized,
            catCommitted
          ),
          realizedCash: catRealizedCash,
          realizedCredit: catRealizedCredit,
          committedCash: catCommittedCash,
          committedCredit: catCommittedCredit,
          children: subChildren
        });
      }

      if (natureChildren.length > 0) {
        const natureBudgeted = natureChildren.reduce((sum, c) => sum + c.budgeted, 0);
        const natureRealized = natureChildren.reduce((sum, c) => sum + c.realized, 0);
        const natureCommitted = natureChildren.reduce((sum, c) => sum + c.committed, 0);
        const natureRealizedCash = natureChildren.reduce((sum, c) => sum + (c.realizedCash ?? 0), 0);
        const natureRealizedCredit = natureChildren.reduce((sum, c) => sum + (c.realizedCredit ?? 0), 0);
        const natureCommittedCash = natureChildren.reduce((sum, c) => sum + (c.committedCash ?? 0), 0);
        const natureCommittedCredit = natureChildren.reduce((sum, c) => sum + (c.committedCredit ?? 0), 0);

        tree.push({
          id: `nature-${nature}`,
          name: natureLabels[nature] ?? nature,
          nature: nature as "income" | "expense" | "transfer",
          budgeted: natureBudgeted,
          realized: natureRealized,
          committed: natureCommitted,
          available: calculateAvailable(
            nature as "income" | "expense" | "transfer",
            natureBudgeted,
            natureRealized,
            natureCommitted
          ),
          realizedCash: natureRealizedCash,
          realizedCredit: natureRealizedCredit,
          committedCash: natureCommittedCash,
          committedCredit: natureCommittedCredit,
          children: natureChildren
        });
      }
    }

    reply.send({
      view: "competence",
      summary,
      tree,
      accountSummaries
    });
  });

  app.get("/budgets", async (req, reply) => {
    const query = req.query as Record<string, unknown>;
    const monthStr = typeof query.month === "string" ? query.month : "";

    let month: string;
    try {
      month = assertYearMonth(monthStr);
    } catch {
      reply.code(400).send({ message: "Mês inválido." });
      return;
    }

    const items = db
      .select()
      .from(budgets)
      .where(eq(budgets.budgetMonth, month))
      .all();

    reply.send(items);
  });

  app.put("/budgets", async (req, reply) => {
    const body = req.body;
    if (!isRecord(body)) {
      reply.code(400).send({ message: "Payload inválido." });
      return;
    }

    try {
      const budgetMonth = assertYearMonth(parseRequiredString(body.budgetMonth, "budgetMonth"));
      const subcategoryId = parseRequiredString(body.subcategoryId, "subcategoryId");
      const amountCents = parseRequiredInteger(body.amountCents, "amountCents");
      const accountId = parseOptionalString(body.accountId, "accountId");
      const paymentMethodId = parseOptionalString(body.paymentMethodId, "paymentMethodId");

      // Verify subcategory exists
      const sub = db.select().from(dbSubcategories).where(eq(dbSubcategories.id, subcategoryId)).get();
      if (!sub) {
        reply.code(400).send({ message: "Subcategoria não encontrada." });
        return;
      }

      // Verify account exists if provided
      if (accountId) {
        const account = db.select().from(dbAccounts).where(eq(dbAccounts.id, accountId)).get();
        if (!account) {
          reply.code(400).send({ message: "Conta não encontrada." });
          return;
        }
      }

      // Verify payment method exists if provided
      if (paymentMethodId) {
        const pm = db.select().from(dbPaymentMethods).where(eq(dbPaymentMethods.id, paymentMethodId)).get();
        if (!pm) {
          reply.code(400).send({ message: "Meio de pagamento não encontrado." });
          return;
        }
      }

      // Check if existing budget exists
      let query = and(
        eq(budgets.budgetMonth, budgetMonth),
        eq(budgets.subcategoryId, subcategoryId)
      );
      if (accountId) {
        query = and(query, eq(budgets.accountId, accountId));
      } else {
        query = and(query, isNull(budgets.accountId));
      }
      if (paymentMethodId) {
        query = and(query, eq(budgets.paymentMethodId, paymentMethodId));
      } else {
        query = and(query, isNull(budgets.paymentMethodId));
      }

      const existing = db.select().from(budgets).where(query).get();

      if (existing) {
        if (amountCents === 0) {
          db.delete(budgets).where(eq(budgets.id, existing.id)).run();
        } else {
          db.update(budgets)
            .set({
              amountCents,
              updatedAt: new Date().toISOString()
            })
            .where(eq(budgets.id, existing.id))
            .run();
        }
      } else if (amountCents > 0) {
        const newId = crypto.randomUUID();
        db.insert(budgets)
          .values({
            id: newId,
            budgetMonth,
            subcategoryId,
            accountId: accountId || null,
            paymentMethodId: paymentMethodId || null,
            amountCents,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          .run();
      }

      reply.send({ success: true });
    } catch (e) {
      sendPayloadError(e, reply, "Não foi possível salvar o orçamento.");
    }
  });

  app.post("/budgets/copy", async (req, reply) => {
    const body = req.body;
    if (!isRecord(body)) {
      reply.code(400).send({ message: "Payload inválido." });
      return;
    }

    try {
      const fromMonth = assertYearMonth(parseRequiredString(body.fromMonth, "fromMonth"));
      const toMonth = assertYearMonth(parseRequiredString(body.toMonth, "toMonth"));

      if (fromMonth === toMonth) {
        reply.code(400).send({ message: "Mês de origem e destino devem ser diferentes." });
        return;
      }

      const sourceBudgets = db.select().from(budgets).where(eq(budgets.budgetMonth, fromMonth)).all();

      db.delete(budgets).where(eq(budgets.budgetMonth, toMonth)).run();

      for (const b of sourceBudgets) {
        db.insert(budgets)
          .values({
            id: crypto.randomUUID(),
            budgetMonth: toMonth,
            categoryId: b.categoryId,
            subcategoryId: b.subcategoryId,
            accountId: b.accountId,
            paymentMethodId: b.paymentMethodId,
            amountCents: b.amountCents,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          .run();
      }

      reply.send({ success: true, count: sourceBudgets.length });
    } catch (e) {
      sendPayloadError(e, reply, "Não foi possível copiar o orçamento.");
    }
  });
}
