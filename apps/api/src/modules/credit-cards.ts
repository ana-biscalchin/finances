import {
  accounts,
  creditCards,
  creditCardBills,
  transactions,
  installments,
  type createDatabaseConnection
} from "@finances/database";
import {
  assertTransactionStatus,
  assertTransactionType,
  assertBusinessDate,
  getCreditCardBillDates,
  assertYearMonth,
  getCreditCardBillMonth
} from "@finances/domain";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import crypto from "node:crypto";

import { requestContextFrom } from "../application/request-context.js";

import {
  isRecord,
  parseOptionalInteger,
  parseOptionalString,
  parseRequiredInteger,
  parseRequiredString,
  sendPayloadError,
  ValidationError
} from "../http.js";
import { createBillPaymentService } from "../application/bill-payment-service.js";
import {
  buildCreditCardInstallmentTransactions,
  createInstallmentMetadataForTransactions,
  type TransactionData,
  isBillPaid,
  isBillFinanciallyLocked
} from "./transactions.js";

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
  const billPaymentServiceFor = (request: FastifyRequest) =>
    createBillPaymentService(connection, requestContextFrom(request).ownerId);

  // ─── Cards ───────────────────────────────────────────────────────────

  app.post("/credit-cards/:id/bills/:billId/payments", async (request, reply) => {
    const { id, billId } = request.params as { id: string; billId: string };
    const bill = await findOwnedCreditCardBill(
      connection,
      requestContextFrom(request).ownerId,
      id,
      billId
    );
    if (!bill || bill.creditCardId !== id)
      return reply.code(404).send({ message: "Fatura não encontrada." });
    const key = request.headers["idempotency-key"];
    const idempotencyKey = Array.isArray(key) ? (key[0] ?? "") : (key ?? "");
    return reply
      .code(201)
      .send(await billPaymentServiceFor(request).pay(billId, idempotencyKey, request.body));
  });

  app.post(
    "/credit-cards/:id/bills/:billId/payments/:paymentId/reverse",
    async (request, reply) => {
      const { id, billId, paymentId } = request.params as {
        id: string;
        billId: string;
        paymentId: string;
      };
      const bill = await findOwnedCreditCardBill(
        connection,
        requestContextFrom(request).ownerId,
        id,
        billId
      );
      if (!bill || bill.creditCardId !== id)
        return reply.code(404).send({ message: "Fatura não encontrada." });
      return await billPaymentServiceFor(request).reverse(billId, paymentId);
    }
  );

  app.patch("/credit-cards/:id/bills/:billId/minimum", async (request, reply) => {
    const { id, billId } = request.params as { id: string; billId: string };
    const bill = await findOwnedCreditCardBill(
      connection,
      requestContextFrom(request).ownerId,
      id,
      billId
    );
    if (!bill || bill.creditCardId !== id)
      return reply.code(404).send({ message: "Fatura não encontrada." });
    if (await isBillFinanciallyLocked(db, billId))
      return reply
        .code(409)
        .send({ message: "O mínimo não pode mudar após fechamento ou pagamento." });
    const body = isRecord(request.body) ? request.body : {};
    try {
      const minimumDueCents = parseRequiredInteger(body.minimumDueCents, "minimumDueCents");
      if (minimumDueCents < 0) throw new ValidationError("minimumDueCents não pode ser negativo.");
      const totalCents = (
        await db
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.ownerId, requestContextFrom(request).ownerId),
              eq(transactions.creditCardBillId, billId)
            )
          )
      )
        .filter((item) => item.creditCardId && ["confirmed", "reconciled"].includes(item.status))
        .reduce(
          (sum, item) => sum + (item.type === "expense" ? item.amountCents : -item.amountCents),
          0
        );
      if (minimumDueCents > totalCents)
        throw new ValidationError("Pagamento mínimo não pode superar o total da fatura.");
      await db
        .update(creditCardBills)
        .set({ minimumDueCents, updatedAt: new Date().toISOString() })
        .where(eq(creditCardBills.id, billId));
      return (
        await db.select().from(creditCardBills).where(eq(creditCardBills.id, billId)).limit(1)
      )[0];
    } catch (error) {
      return sendPayloadError(error, reply, "Mínimo inválido.");
    }
  });

  app.get("/credit-cards", async (request) => {
    const { ownerId } = requestContextFrom(request);
    const query = request.query as Record<string, unknown>;
    const includeInactive = query.includeInactive === "true";

    const result = includeInactive
      ? await db.select().from(creditCards).where(eq(creditCards.ownerId, ownerId))
      : await db
          .select()
          .from(creditCards)
          .where(and(eq(creditCards.ownerId, ownerId), eq(creditCards.isActive, true)));

    return result;
  });

  app.get("/credit-cards/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const card = await findOwnedCreditCard(connection, requestContextFrom(request).ownerId, id);

    if (!card) {
      return reply.code(404).send({ message: "Cartão não encontrado." });
    }

    return card;
  });

  app.post("/credit-cards", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const payload = parseCreditCardPayloadOrReply(request.body, reply);
    if (!payload) return reply;

    if (!(await ensurePaymentAccountOrReply(connection, ownerId, payload.paymentAccountId, reply)))
      return reply;

    const card = {
      id: crypto.randomUUID(),
      ownerId,
      ...payload
    };

    await db.insert(creditCards).values(card);
    return reply.code(201).send(await findOwnedCreditCard(connection, ownerId, card.id));
  });

  app.put("/credit-cards/:id", async (request, reply) => {
    const { ownerId } = requestContextFrom(request);
    const { id } = request.params as { id: string };
    const current = await findOwnedCreditCard(connection, requestContextFrom(request).ownerId, id);

    if (!current) {
      return reply.code(404).send({ message: "Cartão não encontrado." });
    }

    const payload = parseCreditCardPayloadOrReply(request.body, reply);
    if (!payload) return reply;

    if (!(await ensurePaymentAccountOrReply(connection, ownerId, payload.paymentAccountId, reply)))
      return reply;

    await db
      .update(creditCards)
      .set({ ...payload, updatedAt: new Date().toISOString() })
      .where(
        and(eq(creditCards.ownerId, requestContextFrom(request).ownerId), eq(creditCards.id, id))
      );

    return await findOwnedCreditCard(connection, requestContextFrom(request).ownerId, id);
  });

  app.patch("/credit-cards/:id/archive", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = await findOwnedCreditCard(connection, requestContextFrom(request).ownerId, id);

    if (!current) {
      return reply.code(404).send({ message: "Cartão não encontrado." });
    }

    await db
      .update(creditCards)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(
        and(eq(creditCards.ownerId, requestContextFrom(request).ownerId), eq(creditCards.id, id))
      );

    return reply.code(204).send();
  });

  app.patch("/credit-cards/:id/restore", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = await findOwnedCreditCard(connection, requestContextFrom(request).ownerId, id);

    if (!current) {
      return reply.code(404).send({ message: "Cartão não encontrado." });
    }

    await db
      .update(creditCards)
      .set({ isActive: true, updatedAt: new Date().toISOString() })
      .where(
        and(eq(creditCards.ownerId, requestContextFrom(request).ownerId), eq(creditCards.id, id))
      );

    return reply.code(204).send();
  });

  app.patch("/credit-cards/:id/set-default", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = await findOwnedCreditCard(connection, requestContextFrom(request).ownerId, id);

    if (!current) {
      return reply.code(404).send({ message: "Cartão não encontrado." });
    }

    await db
      .update(creditCards)
      .set({ isDefault: false, updatedAt: new Date().toISOString() })
      .where(eq(creditCards.ownerId, requestContextFrom(request).ownerId));

    await db
      .update(creditCards)
      .set({ isDefault: true, updatedAt: new Date().toISOString() })
      .where(
        and(eq(creditCards.ownerId, requestContextFrom(request).ownerId), eq(creditCards.id, id))
      );

    return await findOwnedCreditCard(connection, requestContextFrom(request).ownerId, id);
  });

  // ─── Bills ───────────────────────────────────────────────────────────

  /**
   * GET /credit-cards/:id/bills?month=YYYY-MM
   * Returns or creates the bill for the given month, along with its transactions.
   */
  app.get("/credit-cards/:id/bills", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, unknown>;
    const card = await findOwnedCreditCard(connection, requestContextFrom(request).ownerId, id);

    if (!card) {
      return reply.code(404).send({ message: "Cartão não encontrado." });
    }

    const billMonth =
      typeof query.month === "string" && query.month.length === 7
        ? query.month
        : new Date().toISOString().slice(0, 7);

    // Find or create the bill for this month
    let bill = (
      await db
        .select()
        .from(creditCardBills)
        .where(and(eq(creditCardBills.creditCardId, id), eq(creditCardBills.billMonth, billMonth)))
        .limit(1)
    )[0];

    if (!bill) {
      const { closingDate, dueDate } = getCreditCardBillDates(
        billMonth,
        card.closingDay,
        card.dueDay
      );

      bill = {
        id: crypto.randomUUID(),
        creditCardId: id,
        billMonth,
        closingDate,
        dueDate,
        status: "open",
        paidAt: null,
        minimumDueCents: null,
        closedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.insert(creditCardBills).values(bill);
    }

    // Load transactions for this bill
    const billTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.ownerId, requestContextFrom(request).ownerId),
          eq(transactions.creditCardBillId, bill.id),
          eq(transactions.creditCardId, id)
        )
      )
      .orderBy(desc(transactions.eventDate), asc(transactions.description));

    // Also load transactions associated with the card and this budget month
    // (ones added via creditCardId but potentially before bill assignment)
    const cardTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.ownerId, requestContextFrom(request).ownerId),
          eq(transactions.creditCardId, id),
          eq(transactions.budgetMonth, billMonth)
        )
      )
      .orderBy(desc(transactions.eventDate), asc(transactions.description));

    // Merge and deduplicate
    const seen = new Set<string>();
    const allTransactions = [...billTransactions, ...cardTransactions].filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    const transactionIds = allTransactions.map((transaction) => transaction.id);
    const installmentRows =
      transactionIds.length > 0
        ? await db
            .select()
            .from(installments)
            .where(inArray(installments.purchaseTransactionId, transactionIds))
        : [];
    const installmentsByTransactionId = new Map(
      installmentRows.map((installment) => [installment.purchaseTransactionId, installment])
    );
    const transactionsWithInstallments = allTransactions.map((transaction) => {
      const installment = installmentsByTransactionId.get(transaction.id);
      const parsedInstallment = installment
        ? null
        : parseInstallmentMarker(transaction.description);

      return {
        ...transaction,
        installmentPurchaseId: installment?.installmentPurchaseId ?? null,
        installmentNumber:
          installment?.installmentNumber ?? parsedInstallment?.installmentNumber ?? null,
        installmentCount:
          installment?.installmentCount ?? parsedInstallment?.installmentCount ?? null,
        installmentAmountCents: installment?.amountCents ?? null,
        installmentDueMonth: installment?.dueMonth ?? null
      };
    });

    const totalCents = transactionsWithInstallments
      .filter((t) => t.status !== "canceled")
      .reduce((sum, t) => {
        if (t.type === "expense") return sum + t.amountCents;
        if (t.type === "refund" || t.type === "chargeback") return sum - t.amountCents;
        return sum;
      }, 0);

    return {
      bill,
      transactions: transactionsWithInstallments,
      totalCents,
      ...(await billPaymentServiceFor(request).details(bill.id))
    };
  });

  /**
   * POST /credit-cards/:id/bills/:billId/transactions
   * Adds a card purchase transaction linked to a bill.
   */
  app.post("/credit-cards/:id/bills/:billId/transactions", async (request, reply) => {
    const { id, billId } = request.params as { id: string; billId: string };
    const card = await findOwnedCreditCard(connection, requestContextFrom(request).ownerId, id);

    if (!card) {
      return reply.code(404).send({ message: "Cartão não encontrado." });
    }

    const bill = await findOwnedCreditCardBill(
      connection,
      requestContextFrom(request).ownerId,
      id,
      billId
    );

    if (!bill || bill.creditCardId !== id) {
      return reply.code(404).send({ message: "Fatura não encontrada." });
    }

    if (await isBillFinanciallyLocked(db, billId)) {
      return reply.code(400).send({
        message: "Não é possível alterar financeiramente uma fatura com pagamento ativo."
      });
    }

    const body = request.body;
    if (!isRecord(body)) {
      return reply.code(400).send({ message: "Payload inválido." });
    }

    try {
      const description = parseRequiredString(body.description, "description");
      const amountCents = parseRequiredInteger(body.amountCents, "amountCents");
      const eventDate = assertBusinessDate(parseRequiredString(body.eventDate, "eventDate"));
      const subcategoryId = parseOptionalString(body.subcategoryId, "subcategoryId");
      const notes = parseOptionalString(body.notes, "notes");
      const status =
        typeof body.status === "string" && body.status.length > 0
          ? assertTransactionStatus(body.status)
          : "confirmed";

      const installmentCount = (() => {
        const raw = parseOptionalInteger(body.installmentCount, "installmentCount");
        if (raw === undefined || raw === null) return 1;
        if (raw < 1 || raw > 48)
          throw new ValidationError("installmentCount deve estar entre 1 e 48.");
        return raw;
      })();

      const type =
        typeof body.type === "string" && body.type.length > 0
          ? assertTransactionType(body.type)
          : "expense";

      if (type !== "expense" && type !== "refund" && type !== "chargeback") {
        throw new ValidationError(
          "Lançamento de cartão de crédito deve ser despesa, reembolso ou estorno."
        );
      }

      if (amountCents <= 0) {
        throw new ValidationError("amountCents deve ser maior que zero.");
      }

      const budgetMonth = getCreditCardBillMonth(eventDate, card.closingDay);
      const targetBill = await getOrCreateCreditCardBill(connection, card, budgetMonth);

      const transactionData: TransactionData = {
        type,
        description,
        amountCents,
        eventDate,
        budgetMonth,
        accountId: null,
        paymentMethodId: null,
        subcategoryId: subcategoryId ?? null,
        creditCardId: id,
        creditCardBillId: targetBill.id,
        status,
        notes: notes ?? null
      };

      if (installmentCount > 1) {
        const created = await buildCreditCardInstallmentTransactions(
          connection,
          requestContextFrom(request).ownerId,
          transactionData,
          installmentCount
        );

        for (const t of created) {
          if (t.creditCardBillId && (await isBillFinanciallyLocked(db, t.creditCardBillId))) {
            return reply.code(400).send({
              message: "Não é possível alterar financeiramente uma fatura com pagamento ativo."
            });
          }
        }

        for (const t of created) {
          await db
            .insert(transactions)
            .values({ ...t, ownerId: requestContextFrom(request).ownerId });
        }

        await createInstallmentMetadataForTransactions(connection, {
          creditCardId: id,
          originalDescription: description,
          originalEventDate: eventDate,
          installmentCount,
          totalAmountCents: amountCents,
          source: "manual",
          transactions: created.map((transaction, index) => ({
            transaction,
            installmentNumber: index + 1
          }))
        });

        return reply.code(201).send(created);
      }

      if (await isBillFinanciallyLocked(db, targetBill.id)) {
        return reply.code(400).send({
          message: "Não é possível alterar financeiramente uma fatura com pagamento ativo."
        });
      }

      const transaction = {
        id: crypto.randomUUID(),
        ...transactionData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db
        .insert(transactions)
        .values({ ...transaction, ownerId: requestContextFrom(request).ownerId });
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

    const card = await findOwnedCreditCard(connection, requestContextFrom(request).ownerId, id);
    if (!card) return reply.code(404).send({ message: "Cartão não encontrado." });

    const bill = await findOwnedCreditCardBill(
      connection,
      requestContextFrom(request).ownerId,
      id,
      billId
    );
    if (!bill || bill.creditCardId !== id)
      return reply.code(404).send({ message: "Fatura não encontrada." });

    const current = (
      await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.ownerId, requestContextFrom(request).ownerId),
            eq(transactions.id, transactionId)
          )
        )
        .limit(1)
    )[0];
    const belongsToBill =
      current?.creditCardBillId === billId ||
      (current?.creditCardId === id && current.budgetMonth === bill.billMonth);

    if (!current || !belongsToBill) {
      return reply.code(404).send({ message: "Lançamento não encontrado nesta fatura." });
    }
    if (await isBillFinanciallyLocked(db, billId))
      return reply
        .code(400)
        .send({ message: "Fatura com pagamento ativo permite apenas renomear ou recategorizar." });

    const body = request.body;
    if (!isRecord(body)) return reply.code(400).send({ message: "Payload inválido." });

    try {
      const description = parseRequiredString(body.description, "description");
      const amountCents = parseRequiredInteger(body.amountCents, "amountCents");
      const eventDate = assertBusinessDate(parseRequiredString(body.eventDate, "eventDate"));
      const subcategoryId = parseOptionalString(body.subcategoryId, "subcategoryId");
      const notes = parseOptionalString(body.notes, "notes");
      const preserveBillMonth = body.preserveBillMonth === true;
      const status =
        typeof body.status === "string" && body.status.length > 0
          ? assertTransactionStatus(body.status)
          : assertTransactionStatus(current.status);

      const installmentCount = (() => {
        const raw = parseOptionalInteger(body.installmentCount, "installmentCount");
        if (raw === undefined || raw === null) return 1;
        if (raw < 1 || raw > 48)
          throw new ValidationError("installmentCount deve estar entre 1 e 48.");
        return raw;
      })();
      const type =
        typeof body.type === "string" && body.type.length > 0
          ? assertTransactionType(body.type)
          : current.type;

      if (type !== "expense" && type !== "refund" && type !== "chargeback") {
        throw new ValidationError(
          "Lançamento de cartão de crédito deve ser despesa, reembolso ou estorno."
        );
      }

      if (amountCents <= 0) throw new ValidationError("amountCents deve ser maior que zero.");

      const budgetMonth = preserveBillMonth
        ? assertYearMonth(current.budgetMonth)
        : getCreditCardBillMonth(eventDate, card.closingDay);
      const targetBill = await getOrCreateCreditCardBill(connection, card, budgetMonth);

      const transactionData: TransactionData = {
        type,
        description,
        amountCents,
        eventDate,
        budgetMonth,
        accountId: null,
        paymentMethodId: null,
        subcategoryId: subcategoryId ?? null,
        creditCardId: id,
        creditCardBillId: targetBill.id,
        status,
        notes: notes ?? null
      };

      if (installmentCount > 1 && !preserveBillMonth) {
        const created = await buildCreditCardInstallmentTransactions(
          connection,
          requestContextFrom(request).ownerId,
          transactionData,
          installmentCount
        );
        if (
          (
            await Promise.all(
              created.map(
                async (item) =>
                  item.creditCardBillId &&
                  (await isBillFinanciallyLocked(db, item.creditCardBillId))
              )
            )
          ).some(Boolean)
        )
          return reply.code(400).send({
            message: "Uma das faturas das parcelas está fechada ou possui pagamento ativo."
          });

        const [first, ...rest] = created;
        await connection.transaction(async () => {
          await db
            .update(transactions)
            .set({
              description: first.description,
              amountCents: first.amountCents,
              eventDate: first.eventDate,
              budgetMonth: first.budgetMonth,
              subcategoryId: first.subcategoryId,
              creditCardId: first.creditCardId,
              creditCardBillId: first.creditCardBillId,
              status: first.status,
              notes: first.notes,
              updatedAt: new Date().toISOString()
            })
            .where(
              and(
                eq(transactions.ownerId, requestContextFrom(request).ownerId),
                eq(transactions.id, transactionId)
              )
            );

          for (const t of rest)
            await db
              .insert(transactions)
              .values({ ...t, ownerId: requestContextFrom(request).ownerId });

          await createInstallmentMetadataForTransactions(connection, {
            creditCardId: id,
            originalDescription: description,
            originalEventDate: eventDate,
            installmentCount,
            totalAmountCents: amountCents,
            source: "manual",
            transactions: created.map((transaction, index) => ({
              transaction: index === 0 ? { ...transaction, id: transactionId } : transaction,
              installmentNumber: index + 1
            }))
          });
        });

        return (
          await db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.ownerId, requestContextFrom(request).ownerId),
                eq(transactions.id, transactionId)
              )
            )
            .limit(1)
        )[0];
      }

      await db
        .update(transactions)
        .set({
          ...transactionData,
          updatedAt: new Date().toISOString()
        })
        .where(
          and(
            eq(transactions.ownerId, requestContextFrom(request).ownerId),
            eq(transactions.id, transactionId)
          )
        );

      return (
        await db
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.ownerId, requestContextFrom(request).ownerId),
              eq(transactions.id, transactionId)
            )
          )
          .limit(1)
      )[0];
    } catch (error) {
      return sendPayloadError(error, reply, "Erro ao atualizar lançamento.");
    }
  });

  /**
   * DELETE /credit-cards/:id/bills/:billId/transactions/:transactionId
   */
  app.delete(
    "/credit-cards/:id/bills/:billId/transactions/:transactionId",
    async (request, reply) => {
      const { id, billId, transactionId } = request.params as {
        id: string;
        billId: string;
        transactionId: string;
      };

      const card = await findOwnedCreditCard(connection, requestContextFrom(request).ownerId, id);
      if (!card) return reply.code(404).send({ message: "Cartão não encontrado." });

      const bill = await findOwnedCreditCardBill(
        connection,
        requestContextFrom(request).ownerId,
        id,
        billId
      );
      if (!bill || bill.creditCardId !== id)
        return reply.code(404).send({ message: "Fatura não encontrada." });

      if (await isBillFinanciallyLocked(db, billId)) {
        return reply.code(400).send({
          message: "Não é possível excluir lançamentos de uma fatura com pagamento ativo."
        });
      }

      const current = (
        await db
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.ownerId, requestContextFrom(request).ownerId),
              eq(transactions.id, transactionId)
            )
          )
          .limit(1)
      )[0];
      const belongsToBill =
        current?.creditCardBillId === billId ||
        (current?.creditCardId === id && current.budgetMonth === bill.billMonth);

      if (!current || !belongsToBill) {
        return reply.code(404).send({ message: "Lançamento não encontrado nesta fatura." });
      }

      if (current.creditCardBillId && (await isBillPaid(db, current.creditCardBillId))) {
        return reply
          .code(400)
          .send({ message: "Não é possível excluir lançamentos de uma fatura paga." });
      }

      await connection.transaction(async (tx) => {
        await tx.delete(installments).where(eq(installments.purchaseTransactionId, transactionId));
        await tx
          .delete(transactions)
          .where(
            and(
              eq(transactions.ownerId, requestContextFrom(request).ownerId),
              eq(transactions.id, transactionId)
            )
          );
      });
      return reply.code(204).send();
    }
  );
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

async function findOwnedCreditCard(connection: DatabaseConnection, ownerId: string, id: string) {
  return (
    await connection.db
      .select()
      .from(creditCards)
      .where(and(eq(creditCards.ownerId, ownerId), eq(creditCards.id, id)))
      .limit(1)
  )[0];
}

async function findOwnedCreditCardBill(
  connection: DatabaseConnection,
  ownerId: string,
  cardId: string,
  billId: string
) {
  if (!(await findOwnedCreditCard(connection, ownerId, cardId))) return undefined;
  return (
    await connection.db
      .select()
      .from(creditCardBills)
      .where(and(eq(creditCardBills.id, billId), eq(creditCardBills.creditCardId, cardId)))
      .limit(1)
  )[0];
}

async function ensurePaymentAccountOrReply(
  connection: DatabaseConnection,
  ownerId: string,
  paymentAccountId: string | null,
  reply: FastifyReply
) {
  if (!paymentAccountId) return true;

  const account = (
    await connection.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, paymentAccountId)))
      .limit(1)
  )[0];

  if (!account) {
    reply.code(400).send({ message: "Conta de pagamento não encontrada." });
    return false;
  }

  return true;
}

function parseInstallmentMarker(description: string) {
  const match = description.match(/(?:^|\D)(\d{1,2})\s*\/\s*(\d{1,2})(?:\D|$)/);
  if (!match) {
    return null;
  }

  const installmentNumber = Number(match[1]);
  const installmentCount = Number(match[2]);

  if (
    installmentNumber < 1 ||
    installmentCount < 2 ||
    installmentNumber > installmentCount ||
    installmentCount > 48
  ) {
    return null;
  }

  return { installmentNumber, installmentCount };
}

export async function getOrCreateCreditCardBill(
  connection: DatabaseConnection,
  card: typeof creditCards.$inferSelect,
  billMonth: string
) {
  const existingBill = (
    await connection.db
      .select()
      .from(creditCardBills)
      .where(
        and(
          eq(creditCardBills.creditCardId, card.id),
          eq(creditCardBills.billMonth, assertYearMonth(billMonth))
        )
      )
      .limit(1)
  )[0];

  if (existingBill) {
    return existingBill;
  }

  const { closingDate, dueDate } = getCreditCardBillDates(billMonth, card.closingDay, card.dueDay);
  const now = new Date().toISOString();
  const bill = {
    id: crypto.randomUUID(),
    creditCardId: card.id,
    billMonth,
    closingDate,
    dueDate,
    status: "open" as const,
    paidAt: null,
    createdAt: now,
    updatedAt: now
  };

  await connection.db.insert(creditCardBills).values(bill);

  return bill;
}
