import {
  accounts,
  categories as dbCategories,
  creditCards,
  creditCardBills,
  paymentMethods,
  subcategories,
  transactions,
  type createDatabaseConnection
} from "@finances/database";

import { assertYearMonth } from "@finances/domain";
import { and, eq, inArray, like, ne, or, lt } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

export function registerReportRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const { db } = connection;

  // Helper function to calculate time adjustments
  function advanceMonth(yearMonth: string, months: number): string {
    const [year, month] = yearMonth.split("-").map(Number);
    const total = (year * 12 + month - 1) + months;
    const newYear = Math.floor(total / 12);
    const newMonth = (total % 12) + 1;
    return `${newYear}-${String(newMonth).padStart(2, "0")}`;
  }

  function getAccountDelta(t: { type: string; amountCents: number }) {
    if (t.type === "income" || t.type === "refund" || t.type === "chargeback") {
      return t.amountCents;
    }
    if (t.type === "expense") {
      return -t.amountCents;
    }
    return 0;
  }

  // 1. GET /reports/credit-cards-summary?month=YYYY-MM
  app.get("/reports/credit-cards-summary", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const monthStr = typeof query.month === "string" ? query.month : "";

    let month: string;
    try {
      month = assertYearMonth(monthStr);
    } catch {
      return reply.code(400).send({ message: "Mês inválido. Use o formato YYYY-MM." });
    }

    const nextMonth = advanceMonth(month, 1);

    // Get active credit cards
    const activeCards = db
      .select()
      .from(creditCards)
      .where(eq(creditCards.isActive, true))
      .all();

    const cardMap = new Map(activeCards.map((c) => [c.id, c]));
    const cardIds = activeCards.map((c) => c.id);

    if (cardIds.length === 0) {
      return [];
    }

    // Get bills for these cards that are due in the current or next month
    const bills = db
      .select({
        id: creditCardBills.id,
        creditCardId: creditCardBills.creditCardId,
        billMonth: creditCardBills.billMonth,
        dueDate: creditCardBills.dueDate,
        closingDate: creditCardBills.closingDate,
        status: creditCardBills.status
      })
      .from(creditCardBills)
      .where(
        and(
          inArray(creditCardBills.creditCardId, cardIds),
          or(
            like(creditCardBills.dueDate, `${month}-%`),
            like(creditCardBills.dueDate, `${nextMonth}-%`)
          )
        )
      )
      .all();

    const summaryList = [];

    for (const bill of bills) {
      const card = cardMap.get(bill.creditCardId);
      if (!card) continue;

      // Calculate the sum of expenses linked to this bill
      const billTransactions = db
        .select({
          amountCents: transactions.amountCents
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.creditCardBillId, bill.id),
            eq(transactions.type, "expense"),
            ne(transactions.status, "canceled")
          )
        )
        .all();

      const amountCents = billTransactions.reduce((sum, t) => sum + t.amountCents, 0);

      summaryList.push({
        cardId: card.id,
        cardName: card.name,
        institution: card.institution,
        limitCents: card.limitCents,
        billMonth: bill.billMonth,
        dueDate: bill.dueDate,
        closingDate: bill.closingDate || "",
        amountCents,
        status: bill.status as "open" | "paid"
      });
    }

    return summaryList.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  });

  // 2. GET /reports/daily-evolution?month=YYYY-MM
  app.get("/reports/daily-evolution", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const monthStr = typeof query.month === "string" ? query.month : "";
    const accountId = typeof query.accountId === "string" && query.accountId ? query.accountId : undefined;
    const paymentMethodId = typeof query.paymentMethodId === "string" && query.paymentMethodId ? query.paymentMethodId : undefined;
    const categoryId = typeof query.categoryId === "string" && query.categoryId ? query.categoryId : undefined;
    const subcategoryId = typeof query.subcategoryId === "string" && query.subcategoryId ? query.subcategoryId : undefined;

    let month: string;
    try {
      month = assertYearMonth(monthStr);
    } catch {
      return reply.code(400).send({ message: "Mês inválido. Use o formato YYYY-MM." });
    }

    const [year, monthNum] = month.split("-").map(Number);
    const lastDay = new Date(year, monthNum, 0).getDate();

    // 2.1 Calculate opening balance (before the 1st of the month)
    const targetAccounts = accountId
      ? db.select().from(accounts).where(eq(accounts.id, accountId)).all()
      : db.select().from(accounts).where(eq(accounts.isActive, true)).all();

    const targetAccountIds = targetAccounts.map((a) => a.id);
    let openingBalance = targetAccounts.reduce((sum, a) => sum + a.initialBalanceCents, 0);

    if (targetAccountIds.length > 0) {
      const pastTransactions = db
        .select({
          type: transactions.type,
          amountCents: transactions.amountCents,
          status: transactions.status
        })
        .from(transactions)
        .where(
          and(
            inArray(transactions.accountId, targetAccountIds),
            lt(transactions.eventDate, `${month}-01`),
            ne(transactions.status, "canceled")
          )
        )
        .all();

      for (const t of pastTransactions) {
        openingBalance += getAccountDelta(t);
      }
    }

    // 2.2 Retrieve all transactions for the month with filters
    const txFilters = [
      like(transactions.eventDate, `${month}-%`),
      ne(transactions.status, "canceled")
    ];

    if (accountId) {
      txFilters.push(eq(transactions.accountId, accountId));
    }
    if (paymentMethodId) {
      txFilters.push(eq(transactions.paymentMethodId, paymentMethodId));
    }
    if (subcategoryId) {
      txFilters.push(eq(transactions.subcategoryId, subcategoryId));
    } else if (categoryId) {
      const subs = db
        .select({ id: subcategories.id })
        .from(subcategories)
        .where(eq(subcategories.categoryId, categoryId))
        .all();
      const subIds = subs.map((s) => s.id);
      if (subIds.length > 0) {
        txFilters.push(inArray(transactions.subcategoryId, subIds));
      } else {
        txFilters.push(eq(transactions.subcategoryId, "non-existent-id"));
      }
    }

    const monthTransactions = db
      .select({
        eventDate: transactions.eventDate,
        type: transactions.type,
        amountCents: transactions.amountCents,
        status: transactions.status,
        accountId: transactions.accountId
      })
      .from(transactions)
      .where(and(...txFilters))
      .all();

    // Group transactions by day
    const txByDay = new Map<number, typeof monthTransactions>();
    for (const tx of monthTransactions) {
      const day = Number(tx.eventDate.split("-")[2]);
      if (!txByDay.has(day)) {
        txByDay.set(day, []);
      }
      txByDay.get(day)!.push(tx);
    }

    const dailyData = [];
    let currentBalance = openingBalance;
    let cumulativeSpent = 0;

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${month}-${String(day).padStart(2, "0")}`;
      const dayTxs = txByDay.get(day) ?? [];

      let dayIncome = 0;
      let dayExpenseInAccount = 0;

      for (const tx of dayTxs) {
        const isRealized = tx.status === "confirmed" || tx.status === "reconciled";

        // Balance impact: realized account income/expense only
        if (isRealized && tx.accountId && targetAccountIds.includes(tx.accountId)) {
          const delta = getAccountDelta(tx);
          if (delta > 0) {
            dayIncome += delta;
          } else {
            dayExpenseInAccount += Math.abs(delta);
          }
        }

        // Expense accumulation impact (realized + planned)
        if (tx.type === "expense") {
          cumulativeSpent += tx.amountCents;
        }
      }

      currentBalance = currentBalance + dayIncome - dayExpenseInAccount;

      dailyData.push({
        day,
        date: dateStr,
        balance: currentBalance,
        totalSpent: cumulativeSpent,
        dayIncome,
        dayExpenseInAccount
      });
    }

    return dailyData;
  });

  // 3. GET /reports/annual-summary?year=YYYY
  app.get("/reports/annual-summary", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const yearStr = typeof query.year === "string" ? query.year : "";
    const accountId = typeof query.accountId === "string" && query.accountId ? query.accountId : undefined;
    const paymentMethodId = typeof query.paymentMethodId === "string" && query.paymentMethodId ? query.paymentMethodId : undefined;
    const categoryId = typeof query.categoryId === "string" && query.categoryId ? query.categoryId : undefined;
    const subcategoryId = typeof query.subcategoryId === "string" && query.subcategoryId ? query.subcategoryId : undefined;

    if (!/^\d{4}$/.test(yearStr)) {
      return reply.code(400).send({ message: "Ano inválido. Use o formato YYYY." });
    }

    const txFilters = [
      like(transactions.eventDate, `${yearStr}-%`),
      ne(transactions.status, "canceled")
    ];

    if (accountId) {
      txFilters.push(eq(transactions.accountId, accountId));
    }
    if (paymentMethodId) {
      txFilters.push(eq(transactions.paymentMethodId, paymentMethodId));
    }
    if (subcategoryId) {
      txFilters.push(eq(transactions.subcategoryId, subcategoryId));
    } else if (categoryId) {
      const subs = db
        .select({ id: subcategories.id })
        .from(subcategories)
        .where(eq(subcategories.categoryId, categoryId))
        .all();
      const subIds = subs.map((s) => s.id);
      if (subIds.length > 0) {
        txFilters.push(inArray(transactions.subcategoryId, subIds));
      } else {
        txFilters.push(eq(transactions.subcategoryId, "non-existent-id"));
      }
    }

    const yearTransactions = db
      .select({
        eventDate: transactions.eventDate,
        type: transactions.type,
        amountCents: transactions.amountCents,
        status: transactions.status
      })
      .from(transactions)
      .where(and(...txFilters))
      .all();

    const monthlyValues = Array.from({ length: 12 }, (_, i) => {
      const monthNum = String(i + 1).padStart(2, "0");
      const monthStr = `${yearStr}-${monthNum}`;
      const d = new Date(Number(yearStr), i, 1);
      const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "short" })
        .format(d)
        .replace(".", "");

      return {
        month: monthStr,
        monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        incomeCents: 0,
        expenseCents: 0
      };
    });

    for (const tx of yearTransactions) {
      const monthIdx = Number(tx.eventDate.split("-")[1]) - 1;
      if (monthIdx < 0 || monthIdx > 11) continue;

      const isRealized = tx.status === "confirmed" || tx.status === "reconciled";
      if (!isRealized) continue; // Only count realized income/expenses for history

      if (tx.type === "income" || tx.type === "refund" || tx.type === "chargeback") {
        monthlyValues[monthIdx].incomeCents += tx.amountCents;
      } else if (tx.type === "expense") {
        monthlyValues[monthIdx].expenseCents += tx.amountCents;
      }
    }

    return monthlyValues;
  });

  // 4. GET /reports/annual-categories?year=YYYY
  app.get("/reports/annual-categories", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const yearStr = typeof query.year === "string" ? query.year : "";
    const accountId = typeof query.accountId === "string" && query.accountId ? query.accountId : undefined;
    const paymentMethodId = typeof query.paymentMethodId === "string" && query.paymentMethodId ? query.paymentMethodId : undefined;
    const categoryId = typeof query.categoryId === "string" && query.categoryId ? query.categoryId : undefined;

    if (!/^\d{4}$/.test(yearStr)) {
      return reply.code(400).send({ message: "Ano inválido. Use o formato YYYY." });
    }

    const txFilters = [
      like(transactions.eventDate, `${yearStr}-%`),
      eq(transactions.type, "expense"),
      ne(transactions.status, "canceled")
    ];

    if (accountId) {
      txFilters.push(eq(transactions.accountId, accountId));
    }
    if (paymentMethodId) {
      txFilters.push(eq(transactions.paymentMethodId, paymentMethodId));
    }

    // If categoryId is NOT defined, we return sums grouped by Category (Macro)
    if (!categoryId) {
      const yearExpenses = db
        .select({
          amountCents: transactions.amountCents,
          subcategoryId: transactions.subcategoryId
        })
        .from(transactions)
        .where(and(...txFilters))
        .all();

      const allSubs = db
        .select({
          id: subcategories.id,
          categoryId: subcategories.categoryId,
          categoryName: dbCategories.name
        })
        .from(subcategories)
        .leftJoin(dbCategories, eq(subcategories.categoryId, dbCategories.id))
        .all();

      const subToCatMap = new Map(allSubs.map((s) => [s.id, { catId: s.categoryId, catName: s.categoryName ?? "Outros" }]));

      const categorySums = new Map<string, { name: string; sum: number }>();

      for (const tx of yearExpenses) {
        if (!tx.subcategoryId) continue;
        const catInfo = subToCatMap.get(tx.subcategoryId);
        if (!catInfo) continue;

        const catId = catInfo.catId;
        const currentSum = categorySums.get(catId) ?? { name: catInfo.catName, sum: 0 };
        currentSum.sum += tx.amountCents;
        categorySums.set(catId, currentSum);
      }

      const result = Array.from(categorySums.entries()).map(([id, info]) => ({
        categoryId: id,
        categoryName: info.name,
        amountCents: info.sum
      }));

      return result.sort((a, b) => b.amountCents - a.amountCents);
    } else {
      // If categoryId IS defined, we filter transactions of that category and return sums grouped by Subcategory (Micro)
      const subs = db
        .select({ id: subcategories.id, name: subcategories.name })
        .from(subcategories)
        .where(eq(subcategories.categoryId, categoryId))
        .all();

      const subIds = subs.map((s) => s.id);
      const subNameMap = new Map(subs.map((s) => [s.id, s.name]));

      if (subIds.length === 0) {
        return [];
      }

      txFilters.push(inArray(transactions.subcategoryId, subIds));

      const yearExpenses = db
        .select({
          amountCents: transactions.amountCents,
          subcategoryId: transactions.subcategoryId
        })
        .from(transactions)
        .where(and(...txFilters))
        .all();

      const subcategorySums = new Map<string, number>();

      for (const tx of yearExpenses) {
        if (!tx.subcategoryId) continue;
        subcategorySums.set(
          tx.subcategoryId,
          (subcategorySums.get(tx.subcategoryId) ?? 0) + tx.amountCents
        );
      }

      const result = Array.from(subcategorySums.entries()).map(([id, sum]) => ({
        categoryId: id,
        categoryName: subNameMap.get(id) ?? "Outros",
        amountCents: sum
      }));

      return result.sort((a, b) => b.amountCents - a.amountCents);
    }
  });

  // 5. GET /reports/payment-methods-participation
  app.get("/reports/payment-methods-participation", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const monthStr = typeof query.month === "string" ? query.month : undefined;
    const yearStr = typeof query.year === "string" ? query.year : undefined;
    const accountId = typeof query.accountId === "string" && query.accountId ? query.accountId : undefined;
    const categoryId = typeof query.categoryId === "string" && query.categoryId ? query.categoryId : undefined;
    const subcategoryId = typeof query.subcategoryId === "string" && query.subcategoryId ? query.subcategoryId : undefined;

    if (!monthStr && !yearStr) {
      return reply.code(400).send({ message: "Defina o mês (month) ou o ano (year) para consulta." });
    }

    const txFilters = [
      eq(transactions.type, "expense"),
      ne(transactions.status, "canceled")
    ];

    if (monthStr) {
      try {
        const month = assertYearMonth(monthStr);
        txFilters.push(like(transactions.eventDate, `${month}-%`));
      } catch {
        return reply.code(400).send({ message: "Mês inválido. Use o formato YYYY-MM." });
      }
    } else if (yearStr) {
      if (!/^\d{4}$/.test(yearStr)) {
        return reply.code(400).send({ message: "Ano inválido. Use o formato YYYY." });
      }
      txFilters.push(like(transactions.eventDate, `${yearStr}-%`));
    }

    if (accountId) {
      txFilters.push(eq(transactions.accountId, accountId));
    }
    if (subcategoryId) {
      txFilters.push(eq(transactions.subcategoryId, subcategoryId));
    } else if (categoryId) {
      const subs = db
        .select({ id: subcategories.id })
        .from(subcategories)
        .where(eq(subcategories.categoryId, categoryId))
        .all();
      const subIds = subs.map((s) => s.id);
      if (subIds.length > 0) {
        txFilters.push(inArray(transactions.subcategoryId, subIds));
      } else {
        txFilters.push(eq(transactions.subcategoryId, "non-existent-id"));
      }
    }

    const expenses = db
      .select({
        amountCents: transactions.amountCents,
        paymentMethodId: transactions.paymentMethodId
      })
      .from(transactions)
      .where(and(...txFilters))
      .all();

    const allPms = db.select().from(paymentMethods).all();
    const pmMap = new Map(allPms.map((p) => [p.id, p]));

    const pmSums = new Map<string, number>();

    for (const tx of expenses) {
      const pmId = tx.paymentMethodId || "null";
      pmSums.set(pmId, (pmSums.get(pmId) ?? 0) + tx.amountCents);
    }

    const result = Array.from(pmSums.entries()).map(([id, sum]) => {
      const pm = id !== "null" ? pmMap.get(id) : null;
      return {
        paymentMethodId: id !== "null" ? id : "",
        paymentMethodName: pm ? pm.name : "Geral / Sem Meio Específico",
        amountCents: sum
      };
    });

    return result.sort((a, b) => b.amountCents - a.amountCents);
  });
}
