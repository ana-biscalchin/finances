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
import { assertYearMonth } from "@finances/domain";
import { and, eq, isNull } from "drizzle-orm";
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
}

interface TreeNode {
  id: string;
  name: string;
  nature: "income" | "expense" | "mixed";
  budgeted: number;
  realized: number;
  committed: number;
  available: number;
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
  committedInflow: number;
  committedOutflow: number;
  realizedBalance: number;
  projectedBalance: number;
}

export function registerBudgetRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const { db } = connection;

  app.get("/controle-mensal", async (req, reply) => {
    const query = req.query as Record<string, unknown>;
    const monthStr = typeof query.month === "string" ? query.month : "";
    const groupBy = typeof query.groupBy === "string" ? query.groupBy : "category";

    let month: string;
    try {
      month = assertYearMonth(monthStr);
    } catch {
      reply.code(400).send({ message: "Mês inválido. Use o formato YYYY-MM." });
      return;
    }

    const allCategories = db.select().from(dbCategories).all();
    const allSubcategories = db.select().from(dbSubcategories).all();
    const allPaymentMethods = db.select().from(dbPaymentMethods).all();
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

    const allTransactions = db.select().from(dbTransactions).all();

    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
    const subcategoryMap = new Map(allSubcategories.map((s) => [s.id, s]));
    const paymentMethodMap = new Map(allPaymentMethods.map((p) => [p.id, p]));
    const cardMap = new Map(allCards.map((c) => [c.id, c]));
    const accountMap = new Map(allAccounts.map((a) => [a.id, a]));

    const pagFaturaSub = allSubcategories.find(
      (s) => s.name === "Pagamento de fatura" && s.categoryId === "cat-transferencias"
    );

    // Calculate total bills due in the month
    const billsDueInMonth = db
      .select()
      .from(dbCreditCardBills)
      .all()
      .filter((b) => b.dueDate.startsWith(month));

    const billPmSums = new Map<string, { realized: number; committed: number }>();
    let billRealizedSum = 0;
    let billCommittedSum = 0;

    function getBillPaymentMethodId(cardId: string): string | null {
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
        .filter((t) => t.type === "expense" && t.status !== "canceled")
        .reduce((sum, t) => sum + t.amountCents, 0);

      const pmId = getBillPaymentMethodId(bill.creditCardId) || "null";
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

    function getSubcategoryDetails(subId: string, defaultNature: "income" | "expense") {
      if (subId === UNCATEGORIZED_SUB_INCOME_ID) {
        return {
          subName: "Sem subcategoria",
          catName: "Outros",
          behavior: "variable",
          nature: "income"
        };
      }
      if (subId === UNCATEGORIZED_SUB_EXPENSE_ID) {
        return {
          subName: "Sem subcategoria",
          catName: "Outros",
          behavior: "variable",
          nature: "expense"
        };
      }

      const sub = subcategoryMap.get(subId);
      if (!sub) {
        return {
          subName: "Sem subcategoria",
          catName: "Outros",
          behavior: "variable",
          nature: defaultNature
        };
      }

      const cat = categoryMap.get(sub.categoryId);
      return {
        subName: sub.name,
        catName: cat?.name ?? "Outros",
        behavior: sub.behavior,
        nature: (cat?.nature === "income" ? "income" : "expense") as "income" | "expense"
      };
    }

    function getPaymentMethodName(pmId: string | null) {
      if (!pmId) return "Geral / Sem Meio Específico";
      return paymentMethodMap.get(pmId)?.name ?? "Outros";
    }

    function getFirstSubIdForCategory(catId: string): string | null {
      const sub = allSubcategories.find((s) => s.categoryId === catId && s.isActive);
      return sub?.id ?? null;
    }

    function calculateAvailable(
      nature: "income" | "expense" | "mixed",
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

    const monthStart = `${month}-01`;
    const accountSummaries: AccountMonthlySummary[] = allAccounts
      .map((account) => {
        const accountTransactions = allTransactions.filter(
          (transaction) => transaction.accountId === account.id && transaction.status !== "canceled"
        );

        let openingBalance = account.initialBalanceCents;
        let realizedInflow = 0;
        let realizedOutflow = 0;
        let committedInflow = 0;
        let committedOutflow = 0;

        for (const transaction of accountTransactions) {
          const delta = getAccountDelta(transaction);

          if (transaction.eventDate < monthStart) {
            openingBalance += delta;
            continue;
          }

          if (!transaction.eventDate.startsWith(month)) {
            continue;
          }

          const isRealized = transaction.status === "confirmed" || transaction.status === "reconciled";
          const isCommitted = transaction.status === "planned";

          if (isRealized && delta > 0) {
            realizedInflow += delta;
          } else if (isRealized && delta < 0) {
            realizedOutflow += Math.abs(delta);
          } else if (isCommitted && delta > 0) {
            committedInflow += delta;
          } else if (isCommitted && delta < 0) {
            committedOutflow += Math.abs(delta);
          }
        }

        const realizedBalance = openingBalance + realizedInflow - realizedOutflow;
        const projectedBalance = realizedBalance + committedInflow - committedOutflow;

        return {
          id: account.id,
          name: account.name,
          type: account.type,
          institution: account.institution,
          isActive: account.isActive,
          openingBalance,
          realizedInflow,
          realizedOutflow,
          committedInflow,
          committedOutflow,
          realizedBalance,
          projectedBalance
        };
      })
      .filter((account) => {
        const hasMovement =
          account.realizedInflow > 0 ||
          account.realizedOutflow > 0 ||
          account.committedInflow > 0 ||
          account.committedOutflow > 0;
        return account.isActive || hasMovement || account.openingBalance !== 0;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const summary = {
      income: { budgeted: 0, realized: 0, committed: 0 },
      expense: { budgeted: 0, realized: 0, committed: 0 }
    };

    if (groupBy === "payment-method") {
      const pmAccumulator = new Map<string, Accumulator>();
      const generalBudgetBySubcategory = new Map<string, number>();
      const specificBudgetKeys = new Set<string>();

      function getPmAccumulatorKey(pmId: string | null, subId: string, defaultNature: "income" | "expense") {
        const details = getSubcategoryDetails(subId, defaultNature);
        const normalizedPmId = pmId || "null";
        const key = `${normalizedPmId}|${details.nature}|${details.catName}|${subId}`;
        if (!pmAccumulator.has(key)) {
          pmAccumulator.set(key, { budgeted: 0, realized: 0, committed: 0 });
        }
        return key;
      }

      for (const b of monthBudgets) {
        const subId = b.subcategoryId || (b.categoryId ? getFirstSubIdForCategory(b.categoryId) : null);
        if (!subId) continue;
        const key = getPmAccumulatorKey(b.paymentMethodId, subId, "expense");
        if (b.paymentMethodId) {
          specificBudgetKeys.add(key);
          const acc = pmAccumulator.get(key)!;
          acc.budgeted += b.amountCents;
        } else {
          generalBudgetBySubcategory.set(
            subId,
            (generalBudgetBySubcategory.get(subId) ?? 0) + b.amountCents
          );
        }
      }

      for (const t of monthTransactions) {
        if (t.status === "canceled") continue;
        const subId = t.subcategoryId ?? (t.type === "income" ? UNCATEGORIZED_SUB_INCOME_ID : UNCATEGORIZED_SUB_EXPENSE_ID);
        const defaultNature = t.type === "income" ? "income" : "expense";

        // Map card transactions to the credit card payment method
        const pmId = t.creditCardId ? "pm-credit-card" : t.paymentMethodId;
        const key = getPmAccumulatorKey(pmId, subId, defaultNature);
        const acc = pmAccumulator.get(key)!;

        const isRealized = t.status === "confirmed" || t.status === "reconciled";
        const isCommitted = t.status === "planned";

        if (isRealized) {
          acc.realized += t.amountCents;
        } else if (isCommitted) {
          acc.committed += t.amountCents;
        }
      }

      if (pagFaturaSub) {
        // Clear manual transaction sums for Pagamento de fatura under all PMs, replacing with bill sums
        for (const [pmId, sumObj] of billPmSums.entries()) {
          const key = getPmAccumulatorKey(pmId === "null" ? null : pmId, pagFaturaSub.id, "expense");
          const acc = pmAccumulator.get(key);
          if (acc) {
            acc.realized = sumObj.realized;
            acc.committed = sumObj.committed;
          } else {
            pmAccumulator.set(key, {
              budgeted: 0,
              realized: sumObj.realized,
              committed: sumObj.committed
            });
          }
        }

        // Set to 0 any other payment method's Pagamento de fatura that doesn't have card bills
        for (const [key, acc] of pmAccumulator.entries()) {
          const [, , , subId] = key.split("|");
          if (subId === pagFaturaSub.id) {
            const pmId = key.split("|")[0];
            if (!billPmSums.has(pmId)) {
              acc.realized = 0;
              acc.committed = 0;
            }
          }
        }
      }

      for (const [key, acc] of pmAccumulator.entries()) {
        if (specificBudgetKeys.has(key)) continue;
        const [, , , subId] = key.split("|");
        acc.budgeted = generalBudgetBySubcategory.get(subId) ?? 0;
      }

      for (const [subId, amountCents] of generalBudgetBySubcategory.entries()) {
        const hasRowForSubcategory = Array.from(pmAccumulator.keys()).some((key) => {
          const [, , , keySubId] = key.split("|");
          return keySubId === subId;
        });
        if (!hasRowForSubcategory) {
          const key = getPmAccumulatorKey(null, subId, "expense");
          const acc = pmAccumulator.get(key)!;
          acc.budgeted = amountCents;
        }
      }

      // Calculate summary
      summary.income.budgeted = monthBudgets
        .filter((b) => {
          const subId = b.subcategoryId || (b.categoryId ? getFirstSubIdForCategory(b.categoryId) : null);
          if (!subId) return false;
          return getSubcategoryDetails(subId, "expense").nature === "income";
        })
        .reduce((sum, b) => sum + b.amountCents, 0);
      summary.expense.budgeted = monthBudgets
        .filter((b) => {
          const subId = b.subcategoryId || (b.categoryId ? getFirstSubIdForCategory(b.categoryId) : null);
          if (!subId) return false;
          return getSubcategoryDetails(subId, "expense").nature !== "income";
        })
        .reduce((sum, b) => sum + b.amountCents, 0);

      for (const [key, acc] of pmAccumulator.entries()) {
        const nature = key.split("|")[1];
        if (nature === "income") {
          summary.income.realized += acc.realized;
          summary.income.committed += acc.committed;
        } else {
          summary.expense.realized += acc.realized;
          summary.expense.committed += acc.committed;
        }
      }

      const pmTree: TreeNode[] = [];
      const pmGroups = new Map<string, string[]>();
      for (const key of pmAccumulator.keys()) {
        const pmId = key.split("|")[0];
        if (!pmGroups.has(pmId)) {
          pmGroups.set(pmId, []);
        }
        pmGroups.get(pmId)!.push(key);
      }

      const natureLabels: Record<string, string> = {
        income: "Receitas",
        expense: "Despesas"
      };

      for (const [pmId, keys] of pmGroups.entries()) {
        const pmName = getPaymentMethodName(pmId === "null" ? null : pmId);
        const pmNatureChildren: TreeNode[] = [];

        const natures = ["income", "expense"];
        for (const nature of natures) {
          const catChildren: TreeNode[] = [];

          const catGroups = new Map<string, { subId: string; acc: Accumulator }[]>();
          for (const key of keys) {
            const [, kNature, kCatName, kSubId] = key.split("|");
            if (kNature === nature) {
              if (!catGroups.has(kCatName)) {
                catGroups.set(kCatName, []);
              }
              const acc = pmAccumulator.get(key)!;
              catGroups.get(kCatName)!.push({ subId: kSubId, acc });
            }
          }

          for (const [catName, subItems] of catGroups.entries()) {
            const subChildren: TreeNode[] = subItems.map(({ subId, acc }) => {
              const details = getSubcategoryDetails(subId, nature as "income" | "expense");
              return {
                id: `pm-${pmId}-sub-${subId}`,
                name: details.subName,
                nature: nature as "income" | "expense",
                budgeted: acc.budgeted,
                realized: acc.realized,
                committed: acc.committed,
                available: calculateAvailable(
                  nature as "income" | "expense",
                  acc.budgeted,
                  acc.realized,
                  acc.committed
                )
              };
            });

            const catBudgeted = subChildren.reduce((sum, c) => sum + c.budgeted, 0);
            const catRealized = subChildren.reduce((sum, c) => sum + c.realized, 0);
            const catCommitted = subChildren.reduce((sum, c) => sum + c.committed, 0);

            catChildren.push({
              id: `pm-${pmId}-cat-${nature}-${catName}`,
              name: catName,
              nature: nature as "income" | "expense",
              budgeted: catBudgeted,
              realized: catRealized,
              committed: catCommitted,
              available: calculateAvailable(
                nature as "income" | "expense",
                catBudgeted,
                catRealized,
                catCommitted
              ),
              children: subChildren.sort((a, b) => a.name.localeCompare(b.name))
            });
          }

          if (catChildren.length > 0) {
            const natureBudgeted = catChildren.reduce((sum, c) => sum + c.budgeted, 0);
            const natureRealized = catChildren.reduce((sum, c) => sum + c.realized, 0);
            const natureCommitted = catChildren.reduce((sum, c) => sum + c.committed, 0);

            pmNatureChildren.push({
              id: `pm-${pmId}-nature-${nature}`,
              name: natureLabels[nature] ?? nature,
              nature: nature as "income" | "expense",
              budgeted: natureBudgeted,
              realized: natureRealized,
              committed: natureCommitted,
              available: calculateAvailable(
                nature as "income" | "expense",
                natureBudgeted,
                natureRealized,
                natureCommitted
              ),
              children: catChildren.sort((a, b) => a.name.localeCompare(b.name))
            });
          }
        }

        if (pmNatureChildren.length > 0) {
          const pmBudgeted = pmNatureChildren.reduce((sum, c) => sum + c.budgeted, 0);
          const pmRealized = pmNatureChildren.reduce((sum, c) => sum + c.realized, 0);
          const pmCommitted = pmNatureChildren.reduce((sum, c) => sum + c.committed, 0);

          pmTree.push({
            id: `pm-${pmId}`,
            name: pmName,
            nature: "mixed",
            budgeted: pmBudgeted,
            realized: pmRealized,
            committed: pmCommitted,
            available: pmBudgeted - (pmRealized + pmCommitted),
            children: pmNatureChildren
          });
        }
      }

      reply.send({
        summary,
        tree: pmTree.sort((a, b) => a.name.localeCompare(b.name)),
        accountSummaries
      });
    } else {
      // groupBy === "category"
      const categoryAccumulator = new Map<string, Accumulator>();

      for (const sub of allSubcategories) {
        if (!sub.isActive) continue;
        const cat = categoryMap.get(sub.categoryId);
        if (!cat || !cat.isActive) continue;
        const nature = cat.nature === "income" ? "income" : "expense";
        const catName = cat.name;
        const key = `${nature}|${sub.behavior}|${catName}|${sub.id}`;
        categoryAccumulator.set(key, { budgeted: 0, realized: 0, committed: 0 });
      }

      function getAccumulatorKey(subId: string, defaultNature: "income" | "expense") {
        const details = getSubcategoryDetails(subId, defaultNature);
        const key = `${details.nature}|${details.behavior}|${details.catName}|${subId}`;
        if (!categoryAccumulator.has(key)) {
          categoryAccumulator.set(key, { budgeted: 0, realized: 0, committed: 0 });
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

      for (const t of monthTransactions) {
        if (t.status === "canceled") continue;
        const subId = t.subcategoryId ?? (t.type === "income" ? UNCATEGORIZED_SUB_INCOME_ID : UNCATEGORIZED_SUB_EXPENSE_ID);
        const defaultNature = t.type === "income" ? "income" : "expense";
        const key = getAccumulatorKey(subId, defaultNature);
        const acc = categoryAccumulator.get(key)!;

        const isRealized = t.status === "confirmed" || t.status === "reconciled";
        const isCommitted = t.status === "planned";

        if (isRealized) {
          acc.realized += t.amountCents;
        } else if (isCommitted) {
          acc.committed += t.amountCents;
        }
      }

      if (pagFaturaSub) {
        const key = getAccumulatorKey(pagFaturaSub.id, "expense");
        const acc = categoryAccumulator.get(key);
        if (acc) {
          acc.realized = billRealizedSum;
          acc.committed = billCommittedSum;
        } else {
          categoryAccumulator.set(key, {
            budgeted: 0,
            realized: billRealizedSum,
            committed: billCommittedSum
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
        } else {
          summary.expense.budgeted += acc.budgeted;
          summary.expense.realized += acc.realized;
          summary.expense.committed += acc.committed;
        }
      }

      const tree: TreeNode[] = [];
      const natureLabels: Record<string, string> = {
        income: "Receitas",
        expense: "Despesas"
      };

      const natures = ["income", "expense"];
      for (const nature of natures) {
        const natureChildren: TreeNode[] = [];
        const behaviorLabels: Record<string, string> = nature === "income" ? {
          fixed: "Receitas Fixas",
          variable: "Receitas Variáveis",
          extra: "Receitas Extras"
        } : {
          fixed: "Custos Fixos",
          variable: "Custos Variáveis",
          extra: "Despesas Extras"
        };

        const behaviors = ["fixed", "variable", "extra"];
        for (const behavior of behaviors) {
          const behaviorChildren: TreeNode[] = [];

          const catGroups = new Map<string, { subId: string; acc: Accumulator }[]>();
          for (const [key, acc] of categoryAccumulator.entries()) {
            const [kNature, kBehavior, kCatName, kSubId] = key.split("|");
            if (kNature === nature && kBehavior === behavior) {
              if (!catGroups.has(kCatName)) {
                catGroups.set(kCatName, []);
              }
              catGroups.get(kCatName)!.push({ subId: kSubId, acc });
            }
          }

          for (const [catName, subItems] of catGroups.entries()) {
            const subChildren: TreeNode[] = subItems.map(({ subId, acc }) => {
              const details = getSubcategoryDetails(subId, nature as "income" | "expense");
              return {
                id: `sub-${subId}`,
                name: details.subName,
                nature: nature as "income" | "expense",
                budgeted: acc.budgeted,
                realized: acc.realized,
                committed: acc.committed,
                available: calculateAvailable(
                  nature as "income" | "expense",
                  acc.budgeted,
                  acc.realized,
                  acc.committed
                )
              };
            });

            const catBudgeted = subChildren.reduce((sum, c) => sum + c.budgeted, 0);
            const catRealized = subChildren.reduce((sum, c) => sum + c.realized, 0);
            const catCommitted = subChildren.reduce((sum, c) => sum + c.committed, 0);

            behaviorChildren.push({
              id: `cat-${nature}-${behavior}-${catName}`,
              name: catName,
              nature: nature as "income" | "expense",
              budgeted: catBudgeted,
              realized: catRealized,
              committed: catCommitted,
              available: calculateAvailable(
                nature as "income" | "expense",
                catBudgeted,
                catRealized,
                catCommitted
              ),
              children: subChildren.sort((a, b) => a.name.localeCompare(b.name))
            });
          }

          if (behaviorChildren.length > 0) {
            const behaviorBudgeted = behaviorChildren.reduce((sum, c) => sum + c.budgeted, 0);
            const behaviorRealized = behaviorChildren.reduce((sum, c) => sum + c.realized, 0);
            const behaviorCommitted = behaviorChildren.reduce((sum, c) => sum + c.committed, 0);

            natureChildren.push({
              id: `behavior-${nature}-${behavior}`,
              name: behaviorLabels[behavior] ?? behavior,
              nature: nature as "income" | "expense",
              budgeted: behaviorBudgeted,
              realized: behaviorRealized,
              committed: behaviorCommitted,
              available: calculateAvailable(
                nature as "income" | "expense",
                behaviorBudgeted,
                behaviorRealized,
                behaviorCommitted
              ),
              children: behaviorChildren.sort((a, b) => a.name.localeCompare(b.name))
            });
          }
        }

        if (natureChildren.length > 0) {
          const natureBudgeted = natureChildren.reduce((sum, c) => sum + c.budgeted, 0);
          const natureRealized = natureChildren.reduce((sum, c) => sum + c.realized, 0);
          const natureCommitted = natureChildren.reduce((sum, c) => sum + c.committed, 0);

          tree.push({
            id: `nature-${nature}`,
            name: natureLabels[nature] ?? nature,
            nature: nature as "income" | "expense",
            budgeted: natureBudgeted,
            realized: natureRealized,
            committed: natureCommitted,
            available: calculateAvailable(
              nature as "income" | "expense",
              natureBudgeted,
              natureRealized,
              natureCommitted
            ),
            children: natureChildren
          });
        }
      }

      reply.send({
        summary,
        tree,
        accountSummaries
      });
    }
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
      const paymentMethodId = parseOptionalString(body.paymentMethodId, "paymentMethodId");

      // Verify subcategory exists
      const sub = db.select().from(dbSubcategories).where(eq(dbSubcategories.id, subcategoryId)).get();
      if (!sub) {
        reply.code(400).send({ message: "Subcategoria não encontrada." });
        return;
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
