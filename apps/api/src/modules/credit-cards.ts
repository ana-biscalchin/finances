import {
  accounts,
  creditCards,
  creditCardBills,
  subcategories,
  transactions,
  type createDatabaseConnection
} from "@finances/database";
import { and, asc, desc, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";

import {
  isRecord,
  parseOptionalInteger,
  parseOptionalString,
  parseRequiredInteger,
  parseRequiredString,
  sendPayloadError,
  ValidationError
} from "../http.js";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

type CreditCardPayload = {
  name?: unknown;
  institution?: unknown;
  closingDay?: unknown;
  dueDay?: unknown;
  paymentAccountId?: unknown;
  limitCents?: unknown;
};

export function registerCreditCardRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const { db } = connection;

  // ─── Cards ───────────────────────────────────────────────────────────

  app.get("/credit-cards", async (request) => {
    const query = request.query as Record<string, unknown>;
    const includeInactive = query.includeInactive === "true";

    const baseQuery = db.select().from(creditCards);
    const result = includeInactive
      ? baseQuery.all()
      : baseQuery.where(eq(creditCards.isActive, true)).all();

    return result;
  });

  app.get("/credit-cards/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const card = db.select().from(creditCards).where(eq(creditCards.id, id)).get();

    if (!card) {
      return reply.code(404).send({ message: "Cartão não encontrado." });
    }

    return card;
  });

  app.post("/credit-cards", async (request, reply) => {
    const payload = parseCreditCardPayloadOrReply(request.body, reply);
    if (!payload) return reply;

    if (!ensurePaymentAccountOrReply(connection, payload.paymentAccountId, reply)) return reply;

    const card = {
      id: crypto.randomUUID(),
      ...payload
    };

    db.insert(creditCards).values(card).run();
    return reply.code(201).send(card);
  });

  app.put("/credit-cards/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = db.select().from(creditCards).where(eq(creditCards.id, id)).get();

    if (!current) {
      return reply.code(404).send({ message: "Cartão não encontrado." });
    }

    const payload = parseCreditCardPayloadOrReply(request.body, reply);
    if (!payload) return reply;

    if (!ensurePaymentAccountOrReply(connection, payload.paymentAccountId, reply)) return reply;

    db.update(creditCards)
      .set({ ...payload, updatedAt: new Date().toISOString() })
      .where(eq(creditCards.id, id))
      .run();

    return db.select().from(creditCards).where(eq(creditCards.id, id)).get();
  });

  app.patch("/credit-cards/:id/archive", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = db.select().from(creditCards).where(eq(creditCards.id, id)).get();

    if (!current) {
      return reply.code(404).send({ message: "Cartão não encontrado." });
    }

    db.update(creditCards)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(creditCards.id, id))
      .run();

    return reply.code(204).send();
  });

  app.patch("/credit-cards/:id/restore", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = db.select().from(creditCards).where(eq(creditCards.id, id)).get();

    if (!current) {
      return reply.code(404).send({ message: "Cartão não encontrado." });
    }

    db.update(creditCards)
      .set({ isActive: true, updatedAt: new Date().toISOString() })
      .where(eq(creditCards.id, id))
      .run();

    return reply.code(204).send();
  });

  app.patch("/credit-cards/:id/set-default", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = db.select().from(creditCards).where(eq(creditCards.id, id)).get();

    if (!current) {
      return reply.code(404).send({ message: "Cartão não encontrado." });
    }

    // Clear any existing default, then set this one
    db.update(creditCards)
      .set({ isDefault: false, updatedAt: new Date().toISOString() })
      .run();

    db.update(creditCards)
      .set({ isDefault: true, updatedAt: new Date().toISOString() })
      .where(eq(creditCards.id, id))
      .run();

    return db.select().from(creditCards).where(eq(creditCards.id, id)).get();
  });

  // ─── Bills ───────────────────────────────────────────────────────────

  /**
   * GET /credit-cards/:id/bills?month=YYYY-MM
   * Returns or creates the bill for the given month, along with its transactions.
   */
  app.get("/credit-cards/:id/bills", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, unknown>;
    const card = db.select().from(creditCards).where(eq(creditCards.id, id)).get();

    if (!card) {
      return reply.code(404).send({ message: "Cartão não encontrado." });
    }

    const billMonth =
      typeof query.month === "string" && query.month.length === 7
        ? query.month
        : new Date().toISOString().slice(0, 7);

    // Find or create the bill for this month
    let bill = db
      .select()
      .from(creditCardBills)
      .where(
        and(eq(creditCardBills.creditCardId, id), eq(creditCardBills.billMonth, billMonth))
      )
      .get();

    if (!bill) {
      // Compute closing and due dates based on card settings
      const [year, month] = billMonth.split("-").map(Number);
      const closingDate = formatDate(year, month, card.closingDay);

      // Due date is typically in the next month
      const dueYear = month === 12 ? year + 1 : year;
      const dueMonth = month === 12 ? 1 : month + 1;
      const dueDate = formatDate(dueYear, dueMonth, card.dueDay);

      bill = {
        id: crypto.randomUUID(),
        creditCardId: id,
        billMonth,
        closingDate,
        dueDate,
        status: "open",
        paidAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.insert(creditCardBills).values(bill).run();
    }

    // Load transactions for this bill
    const billTransactions = db
      .select()
      .from(transactions)
      .where(and(eq(transactions.creditCardBillId, bill.id), eq(transactions.creditCardId, id)))
      .orderBy(desc(transactions.eventDate), asc(transactions.description))
      .all();

    // Also load transactions associated with the card and this budget month
    // (ones added via creditCardId but potentially before bill assignment)
    const cardTransactions = db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.creditCardId, id),
          eq(transactions.budgetMonth, billMonth)
        )
      )
      .orderBy(desc(transactions.eventDate), asc(transactions.description))
      .all();

    // Merge and deduplicate
    const seen = new Set<string>();
    const allTransactions = [...billTransactions, ...cardTransactions].filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    const totalCents = allTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amountCents, 0);

    return {
      bill,
      transactions: allTransactions,
      totalCents
    };
  });

  /**
   * POST /credit-cards/:id/bills/:billId/pay
   * Marks a bill as paid and records the account outflow without duplicating card purchases.
   */
  app.post("/credit-cards/:id/bills/:billId/pay", async (request, reply) => {
    const { id, billId } = request.params as { id: string; billId: string };
    const card = db.select().from(creditCards).where(eq(creditCards.id, id)).get();

    if (!card) {
      return reply.code(404).send({ message: "Cartão não encontrado." });
    }

    const bill = db.select().from(creditCardBills).where(eq(creditCardBills.id, billId)).get();

    if (!bill || bill.creditCardId !== id) {
      return reply.code(404).send({ message: "Fatura não encontrada." });
    }

    const body = isRecord(request.body) ? request.body : {};
    let paymentAccountId: string | null;
    try {
      paymentAccountId = parseOptionalString(body.accountId, "accountId") ?? card.paymentAccountId;
    } catch (error) {
      return sendPayloadError(error, reply, "Erro ao marcar fatura como paga.");
    }

    if (!paymentAccountId) {
      return reply.code(400).send({ message: "Informe a conta usada para pagar a fatura." });
    }

    const paymentAccount = db.select().from(accounts).where(eq(accounts.id, paymentAccountId)).get();

    if (!paymentAccount) {
      return reply.code(400).send({ message: "Conta de pagamento não encontrada." });
    }

    const billTransactions = db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.creditCardId, id),
          eq(transactions.budgetMonth, bill.billMonth)
        )
      )
      .all();

    const totalBillCents = billTransactions
      .filter((transaction) => transaction.type === "expense" && transaction.status !== "canceled")
      .reduce((sum, transaction) => sum + transaction.amountCents, 0);

    const pagFaturaSub = db
      .select()
      .from(subcategories)
      .where(eq(subcategories.name, "Pagamento de fatura"))
      .all()
      .find((subcategory) => subcategory.categoryId === "cat-transferencias");

    const paidAt = new Date().toISOString();
    const paymentDate = bill.dueDate;
    const paymentBudgetMonth = bill.dueDate.slice(0, 7);

    if (totalBillCents > 0) {
      const existingPayment = db
        .select()
        .from(transactions)
        .where(eq(transactions.creditCardBillId, billId))
        .all()
        .find((transaction) => transaction.type === "expense" && !transaction.creditCardId);

      const paymentTransaction = {
        type: "expense" as const,
        description: `Pagamento fatura ${card.name} ${bill.billMonth}`,
        amountCents: totalBillCents,
        eventDate: paymentDate,
        budgetMonth: paymentBudgetMonth,
        accountId: paymentAccountId,
        paymentMethodId: paymentAccount.defaultPaymentMethodId ?? null,
        subcategoryId: pagFaturaSub?.id ?? null,
        creditCardId: null,
        creditCardBillId: billId,
        status: "confirmed" as const,
        notes: `Pagamento da fatura ${card.name} com vencimento em ${bill.dueDate}.`,
        linkedTransactionId: null,
        updatedAt: paidAt
      };

      if (existingPayment) {
        db.update(transactions)
          .set(paymentTransaction)
          .where(eq(transactions.id, existingPayment.id))
          .run();
      } else {
        db.insert(transactions)
          .values({
            id: crypto.randomUUID(),
            ...paymentTransaction,
            createdAt: paidAt
          })
          .run();
      }
    }

    db.update(creditCardBills)
      .set({ status: "paid", paidAt, updatedAt: paidAt })
      .where(eq(creditCardBills.id, billId))
      .run();

    return reply.code(204).send();
  });

  /**
   * POST /credit-cards/:id/bills/:billId/transactions
   * Adds a card purchase transaction linked to a bill.
   */
  app.post("/credit-cards/:id/bills/:billId/transactions", async (request, reply) => {
    const { id, billId } = request.params as { id: string; billId: string };
    const card = db.select().from(creditCards).where(eq(creditCards.id, id)).get();

    if (!card) {
      return reply.code(404).send({ message: "Cartão não encontrado." });
    }

    const bill = db.select().from(creditCardBills).where(eq(creditCardBills.id, billId)).get();

    if (!bill || bill.creditCardId !== id) {
      return reply.code(404).send({ message: "Fatura não encontrada." });
    }

    const body = request.body;
    if (!isRecord(body)) {
      return reply.code(400).send({ message: "Payload inválido." });
    }

    try {
      const description = parseRequiredString(body.description, "description");
      const amountCents = parseRequiredInteger(body.amountCents, "amountCents");
      const eventDate = parseRequiredString(body.eventDate, "eventDate");
      const subcategoryId = parseOptionalString(body.subcategoryId, "subcategoryId");
      const notes = parseOptionalString(body.notes, "notes");
      const status =
        typeof body.status === "string" && body.status.length > 0 ? body.status : "planned";

      if (amountCents <= 0) {
        throw new ValidationError("amountCents deve ser maior que zero.");
      }

      const transaction = {
        id: crypto.randomUUID(),
        type: "expense" as const,
        description,
        amountCents,
        eventDate,
        budgetMonth: bill.billMonth,
        accountId: card.paymentAccountId ?? null,
        paymentMethodId: null,
        subcategoryId: subcategoryId ?? null,
        creditCardId: id,
        creditCardBillId: billId,
        status,
        notes: notes ?? null,
        linkedTransactionId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.insert(transactions).values(transaction).run();
      return reply.code(201).send(transaction);
    } catch (error) {
      return sendPayloadError(error, reply, "Erro ao salvar lançamento de cartão.");
    }
  });

  /**
   * PUT /credit-cards/:id/bills/:billId/transactions/:transactionId
   * Updates a card purchase transaction.
   */
  app.put("/credit-cards/:id/bills/:billId/transactions/:transactionId", async (request, reply) => {
    const { id, billId, transactionId } = request.params as {
      id: string;
      billId: string;
      transactionId: string;
    };

    const card = db.select().from(creditCards).where(eq(creditCards.id, id)).get();
    if (!card) return reply.code(404).send({ message: "Cartão não encontrado." });

    const bill = db.select().from(creditCardBills).where(eq(creditCardBills.id, billId)).get();
    if (!bill || bill.creditCardId !== id) return reply.code(404).send({ message: "Fatura não encontrada." });

    const current = db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
    const belongsToBill =
      current?.creditCardBillId === billId ||
      (current?.creditCardId === id && current.budgetMonth === bill.billMonth);

    if (!current || !belongsToBill) {
      return reply.code(404).send({ message: "Lançamento não encontrado nesta fatura." });
    }

    const body = request.body;
    if (!isRecord(body)) return reply.code(400).send({ message: "Payload inválido." });

    try {
      const description = parseRequiredString(body.description, "description");
      const amountCents = parseRequiredInteger(body.amountCents, "amountCents");
      const eventDate = parseRequiredString(body.eventDate, "eventDate");
      const subcategoryId = parseOptionalString(body.subcategoryId, "subcategoryId");
      const notes = parseOptionalString(body.notes, "notes");
      const status = typeof body.status === "string" && body.status.length > 0 ? body.status : current.status;

      if (amountCents <= 0) throw new ValidationError("amountCents deve ser maior que zero.");

      db.update(transactions)
        .set({
          description,
          amountCents,
          eventDate,
          subcategoryId: subcategoryId ?? null,
          creditCardBillId: current.creditCardBillId ?? billId,
          notes: notes ?? null,
          status,
          updatedAt: new Date().toISOString()
        })
        .where(eq(transactions.id, transactionId))
        .run();

      return db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
    } catch (error) {
      return sendPayloadError(error, reply, "Erro ao atualizar lançamento.");
    }
  });

  /**
   * DELETE /credit-cards/:id/bills/:billId/transactions/:transactionId
   */
  app.delete("/credit-cards/:id/bills/:billId/transactions/:transactionId", async (request, reply) => {
    const { id, billId, transactionId } = request.params as {
      id: string;
      billId: string;
      transactionId: string;
    };

    const card = db.select().from(creditCards).where(eq(creditCards.id, id)).get();
    if (!card) return reply.code(404).send({ message: "Cartão não encontrado." });

    const bill = db.select().from(creditCardBills).where(eq(creditCardBills.id, billId)).get();
    if (!bill || bill.creditCardId !== id) return reply.code(404).send({ message: "Fatura não encontrada." });

    const current = db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
    const belongsToBill =
      current?.creditCardBillId === billId ||
      (current?.creditCardId === id && current.budgetMonth === bill.billMonth);

    if (!current || !belongsToBill) {
      return reply.code(404).send({ message: "Lançamento não encontrado nesta fatura." });
    }

    db.delete(transactions).where(eq(transactions.id, transactionId)).run();
    return reply.code(204).send();
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseCreditCardPayload(body: unknown) {
  if (!isRecord(body)) {
    throw new ValidationError("Payload do cartão deve ser um objeto.");
  }

  const payload = body as CreditCardPayload;
  const closingDay = parseRequiredInteger(payload.closingDay, "closingDay");
  const dueDay = parseRequiredInteger(payload.dueDay, "dueDay");

  if (closingDay < 1 || closingDay > 31) {
    throw new ValidationError("closingDay deve estar entre 1 e 31.");
  }

  if (dueDay < 1 || dueDay > 31) {
    throw new ValidationError("dueDay deve estar entre 1 e 31.");
  }

  const limitCents = parseOptionalInteger(payload.limitCents, "limitCents");

  return {
    name: parseRequiredString(payload.name, "name"),
    institution: parseOptionalString(payload.institution, "institution"),
    closingDay,
    dueDay,
    paymentAccountId: parseOptionalString(payload.paymentAccountId, "paymentAccountId"),
    limitCents: limitCents ?? null,
    isActive: true
  };
}

function parseCreditCardPayloadOrReply(body: unknown, reply: FastifyReply) {
  try {
    return parseCreditCardPayload(body);
  } catch (error) {
    return sendPayloadError(error, reply, "Payload do cartão inválido.");
  }
}

function ensurePaymentAccountOrReply(
  connection: DatabaseConnection,
  paymentAccountId: string | null,
  reply: FastifyReply
) {
  if (!paymentAccountId) return true;

  const account = connection.db
    .select()
    .from(accounts)
    .where(eq(accounts.id, paymentAccountId))
    .get();

  if (!account) {
    reply.code(400).send({ message: "Conta de pagamento não encontrada." });
    return false;
  }

  return true;
}

function formatDate(year: number, month: number, day: number) {
  // Clamp day to last valid day of the month
  const lastDay = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(day, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}
