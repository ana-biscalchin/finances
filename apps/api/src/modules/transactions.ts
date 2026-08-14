import {
  accounts,
  categories as dbCategories,
  creditCards,
  creditCardBills,
  creditCardBillPayments,
  installmentPurchases,
  subcategories,
  paymentMethods,
  transactions,
  installments,
  type createDatabaseConnection
} from "@finances/database";
import {
  advanceMonth,
  assertBusinessDate,
  assertTransactionStatus,
  assertTransactionType,
  categoryNatureForTransactionType,
  assertYearMonth,
  getCreditCardBillDates,
  getCreditCardBillMonth,
  yearMonthFromDate
} from "@finances/domain";
import { and, asc, desc, eq, gte, inArray, isNull, lte, type SQL } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";

import { requestContextFrom } from "../application/request-context.js";

import {
  isRecord,
  parseOptionalString,
  parseRequiredInteger,
  parseRequiredString,
  sendPayloadError,
  ValidationError,
  parseOptionalInteger
} from "../http.js";
import { validateActiveAccountPaymentMethod } from "./accounts/payment-method-associations.js";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;
type ParsedTransactionPayload = ReturnType<typeof parseTransactionPayload>;
export type TransactionData = Omit<
  ParsedTransactionPayload,
  "destinationAccountId" | "installmentCount"
>;

type TransactionPayload = {
  type?: unknown;
  description?: unknown;
  amountCents?: unknown;
  eventDate?: unknown;
  budgetMonth?: unknown;
  accountId?: unknown;
  paymentMethodId?: unknown;
  subcategoryId?: unknown;
  creditCardId?: unknown;
  status?: unknown;
  notes?: unknown;
  destinationAccountId?: unknown;
  installmentCount?: unknown;
};

const missingFilterValue = "__missing__";

export function registerTransactionRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const { db } = connection;

  app.get("/transactions", async (request) => {
    const query = request.query as Record<string, unknown>;
    const filters = buildTransactionFilters(requestContextFrom(request).ownerId, query);

    const baseQuery = db.select().from(transactions);
    const queryWithFilters = filters.length > 0 ? baseQuery.where(and(...filters)) : baseQuery;

    return await queryWithFilters.orderBy(
      desc(transactions.eventDate),
      asc(transactions.description)
    );
  });

  app.get("/transactions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const transaction = await findOwnedTransaction(
      connection,
      requestContextFrom(request).ownerId,
      id
    );

    if (!transaction) {
      return reply.code(404).send({ message: "Lançamento não encontrado." });
    }

    return transaction;
  });

  app.post("/transactions", async (request, reply) => {
    const payload = parseTransactionPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !(await ensureReferencesOrReply(
        connection,
        requestContextFrom(request).ownerId,
        payload,
        reply
      ))
    ) {
      return reply;
    }

    const { destinationAccountId, installmentCount, ...rawTransactionData } = payload;
    const transferValidation = await validateTransferPayload(
      connection,
      requestContextFrom(request).ownerId,
      payload
    );
    if (transferValidation) {
      return reply.code(400).send({ message: transferValidation });
    }
    const transactionId = crypto.randomUUID();

    // ── Installments (card purchases split into N months) ──────────────
    if (installmentCount > 1 && rawTransactionData.creditCardId) {
      const created = await buildCreditCardInstallmentTransactions(
        connection,
        requestContextFrom(request).ownerId,
        rawTransactionData,
        installmentCount
      );

      for (const t of created) {
        if (t.creditCardBillId && (await isBillPaid(db, t.creditCardBillId))) {
          return reply
            .code(400)
            .send({ message: "Não é possível adicionar lançamentos a uma fatura paga." });
        }
      }

      for (const t of created) {
        await db
          .insert(transactions)
          .values({ ...t, ownerId: requestContextFrom(request).ownerId });
      }

      await createInstallmentMetadataForTransactions(connection, {
        creditCardId: rawTransactionData.creditCardId,
        originalDescription: rawTransactionData.description,
        originalEventDate: rawTransactionData.eventDate,
        installmentCount,
        totalAmountCents: rawTransactionData.amountCents,
        source: "manual",
        transactions: created.map((transaction, index) => ({
          transaction,
          installmentNumber: index + 1
        }))
      });

      return reply.code(201).send(created);
    }

    if (destinationAccountId)
      return reply.code(400).send({ message: "Use o endpoint /transfers para transferências." });

    // ── Single transaction ─────────────────────────────────────────────
    const transactionData = await normalizeTransactionForStorage(
      connection,
      requestContextFrom(request).ownerId,
      rawTransactionData
    );
    if (
      transactionData.creditCardId &&
      transactionData.creditCardBillId &&
      (await isBillPaid(db, transactionData.creditCardBillId))
    ) {
      return reply
        .code(400)
        .send({ message: "Não é possível adicionar lançamentos a uma fatura paga." });
    }

    const transaction = {
      id: transactionId,
      ownerId: requestContextFrom(request).ownerId,
      ...transactionData
    };

    await db.insert(transactions).values(transaction);
    return reply.code(201).send(transaction);
  });

  app.put("/transactions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = await findOwnedTransaction(connection, requestContextFrom(request).ownerId, id);

    if (!current) {
      return reply.code(404).send({ message: "Lançamento não encontrado." });
    }

    if (current.creditCardBillId && (await isBillFinanciallyLocked(db, current.creditCardBillId))) {
      return reply.code(409).send({
        message: "A fatura possui pagamento ou está fechada; altere apenas os metadados da compra."
      });
    }

    const payload = parseTransactionPayloadOrReply(request.body, reply);

    if (!payload) {
      return reply;
    }

    if (
      !(await ensureReferencesOrReply(
        connection,
        requestContextFrom(request).ownerId,
        payload,
        reply
      ))
    ) {
      return reply;
    }

    const transferValidation = await validateTransferPayload(
      connection,
      requestContextFrom(request).ownerId,
      payload
    );
    if (transferValidation) {
      return reply.code(400).send({ message: transferValidation });
    }

    const { destinationAccountId, installmentCount, ...rawTransactionData } = payload;

    // Handle installment conversion for card transaction
    if (installmentCount > 1 && rawTransactionData.creditCardId) {
      const created = await buildCreditCardInstallmentTransactions(
        connection,
        requestContextFrom(request).ownerId,
        rawTransactionData,
        installmentCount
      );

      const [first, ...rest] = created;
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
            eq(transactions.id, id)
          )
        );

      for (const t of rest) {
        await db
          .insert(transactions)
          .values({ ...t, ownerId: requestContextFrom(request).ownerId });
      }

      await createInstallmentMetadataForTransactions(connection, {
        creditCardId: rawTransactionData.creditCardId,
        originalDescription: rawTransactionData.description,
        originalEventDate: rawTransactionData.eventDate,
        installmentCount,
        totalAmountCents: rawTransactionData.amountCents,
        source: "manual",
        transactions: created.map((transaction, index) => ({
          transaction: index === 0 ? { ...transaction, id } : transaction,
          installmentNumber: index + 1
        }))
      });

      const updated = await findOwnedTransaction(
        connection,
        requestContextFrom(request).ownerId,
        id
      );
      return reply.code(200).send(updated);
    }

    const transactionData = await normalizeTransactionForStorage(
      connection,
      requestContextFrom(request).ownerId,
      rawTransactionData
    );

    if (destinationAccountId)
      return reply.code(400).send({ message: "Use o endpoint /transfers para transferências." });
    await db
      .update(transactions)
      .set({
        ...transactionData,
        updatedAt: new Date().toISOString()
      })
      .where(
        and(eq(transactions.ownerId, requestContextFrom(request).ownerId), eq(transactions.id, id))
      );

    return await findOwnedTransaction(connection, requestContextFrom(request).ownerId, id);
  });

  app.patch("/transactions/:id/metadata", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = await findOwnedTransaction(connection, requestContextFrom(request).ownerId, id);
    if (!current) return reply.code(404).send({ message: "Lançamento não encontrado." });
    const body = isRecord(request.body) ? request.body : {};
    let description: string;
    let subcategoryId: string | null;
    let notes: string | null;
    try {
      description = parseRequiredString(body.description, "description");
      subcategoryId = parseOptionalString(body.subcategoryId, "subcategoryId");
      notes = parseOptionalString(body.notes, "notes");
    } catch (error) {
      return sendPayloadError(error, reply, "Metadados inválidos.");
    }
    try {
      await ensureOptionalSubcategoryExists(
        connection,
        requestContextFrom(request).ownerId,
        subcategoryId,
        assertTransactionType(current.type)
      );
    } catch (error) {
      return sendPayloadError(error, reply, "Subcategoria inválida.");
    }
    await db
      .update(transactions)
      .set({ description, subcategoryId, notes, updatedAt: new Date().toISOString() })
      .where(
        and(eq(transactions.ownerId, requestContextFrom(request).ownerId), eq(transactions.id, id))
      );
    return await findOwnedTransaction(connection, requestContextFrom(request).ownerId, id);
  });

  app.delete("/transactions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = await findOwnedTransaction(connection, requestContextFrom(request).ownerId, id);

    if (!current) {
      return reply.code(404).send({ message: "Lançamento não encontrado." });
    }

    if (
      current.creditCardId &&
      current.creditCardBillId &&
      (await isBillFinanciallyLocked(db, current.creditCardBillId))
    ) {
      return reply.code(409).send({
        message: "Não é possível excluir lançamentos de uma fatura fechada ou com pagamento."
      });
    }

    await connection.transaction(async (tx) => {
      await tx.delete(installments).where(eq(installments.purchaseTransactionId, id));
      await tx
        .delete(transactions)
        .where(
          and(
            eq(transactions.ownerId, requestContextFrom(request).ownerId),
            eq(transactions.id, id)
          )
        );
    });

    return reply.code(204).send();
  });

  app.get("/transactions/export", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const filters = buildTransactionFilters(requestContextFrom(request).ownerId, query);

    const baseQuery = db
      .select({
        id: transactions.id,
        eventDate: transactions.eventDate,
        budgetMonth: transactions.budgetMonth,
        type: transactions.type,
        description: transactions.description,
        amountCents: transactions.amountCents,
        accountName: accounts.name,
        paymentMethodName: paymentMethods.name,
        subcategoryName: subcategories.name,
        creditCardName: creditCards.name,
        status: transactions.status,
        notes: transactions.notes
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
      .leftJoin(subcategories, eq(transactions.subcategoryId, subcategories.id))
      .leftJoin(creditCards, eq(transactions.creditCardId, creditCards.id));

    const queryWithFilters = filters.length > 0 ? baseQuery.where(and(...filters)) : baseQuery;
    const rows = await queryWithFilters.orderBy(
      desc(transactions.eventDate),
      asc(transactions.description)
    );

    const escapeCsv = (val: unknown): string => {
      if (val === undefined || val === null) {
        return "";
      }
      const str = String(val);
      const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
      if (safe.includes(",") || safe.includes('"') || safe.includes("\n") || safe.includes("\r")) {
        return `"${safe.replace(/"/g, '""')}"`;
      }
      return safe;
    };

    const headers = [
      "ID",
      "Data",
      "Competência",
      "Tipo",
      "Descrição",
      "Valor (Centavos)",
      "Valor (BRL)",
      "Conta",
      "Meio de Pagamento",
      "Subcategoria",
      "Cartão",
      "Status",
      "Observações"
    ].join(",");

    const csvLines = rows.map((r) => {
      const amountBrl = (r.amountCents / 100).toFixed(2);
      return [
        r.id,
        r.eventDate,
        r.budgetMonth,
        r.type === "income" ? "Receita" : "Despesa",
        r.description,
        r.amountCents,
        amountBrl,
        r.accountName ?? "",
        r.paymentMethodName ?? "",
        r.subcategoryName ?? "",
        r.creditCardName ?? "",
        r.status,
        r.notes ?? ""
      ]
        .map(escapeCsv)
        .join(",");
    });

    const csvContent = [headers, ...csvLines].join("\n");

    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header(
        "Content-Disposition",
        `attachment; filename="transacoes-${(query.budgetMonth as string) ?? "export"}.csv"`
      )
      .send(csvContent);
  });

  app.post("/transactions/import-preview", async (request, reply) => {
    const body = request.body as {
      csvContent?: string;
      mappings?: {
        eventDate?: string;
        description?: string;
        amount?: string;
        type?: string;
        subcategoryId?: string;
        accountId?: string;
        installment?: string;
        installmentNumber?: string;
        installmentCount?: string;
      };
      defaultAccountId?: string;
      defaultCreditCardId?: string;
      dateFormat?: "DMY" | "MDY" | "YMD";
      importMode?: "transactions" | "credit_card_bill";
      billMonth?: string;
    };

    if (!body || typeof body.csvContent !== "string" || !body.mappings) {
      return reply.code(400).send({ message: "Payload inválido. CSV e mapeamentos requeridos." });
    }

    const { csvContent, mappings, defaultAccountId, defaultCreditCardId } = body;
    const dateFormat = body.dateFormat ?? "DMY";
    const isCreditCardBillImport = body.importMode === "credit_card_bill";
    const targetBillMonth =
      isCreditCardBillImport && typeof body.billMonth === "string"
        ? assertYearMonth(body.billMonth)
        : null;
    const { rows: csvRows } = parseCsvContent(csvContent);

    if (csvRows.length === 0) {
      return [];
    }

    const card = defaultCreditCardId
      ? (
          await db
            .select()
            .from(creditCards)
            .where(
              and(
                eq(creditCards.ownerId, requestContextFrom(request).ownerId),
                eq(creditCards.id, defaultCreditCardId)
              )
            )
            .limit(1)
        )[0]
      : null;

    if (defaultCreditCardId && !card) {
      return reply.code(400).send({ message: "Cartão de crédito não encontrado." });
    }

    const categoryLookup = await db
      .select({
        id: subcategories.id,
        name: subcategories.name,
        categoryName: dbCategories.name,
        nature: dbCategories.nature
      })
      .from(subcategories)
      .innerJoin(
        dbCategories,
        and(
          eq(subcategories.categoryId, dbCategories.id),
          eq(dbCategories.ownerId, requestContextFrom(request).ownerId)
        )
      );

    const parsedItems = csvRows
      .flatMap((row, idx) => {
        const rawDate = mappings.eventDate ? row[mappings.eventDate] : "";
        const rawDesc = mappings.description ? row[mappings.description] : "";
        const rawAmount = mappings.amount ? row[mappings.amount] : "";
        const rawType = mappings.type ? row[mappings.type] : "";
        const rawSubcategory = mappings.subcategoryId ? row[mappings.subcategoryId] : "";
        const rawAccount = mappings.accountId ? row[mappings.accountId] : "";
        const rawInstallment = mappings.installment ? row[mappings.installment] : "";
        const rawInstallmentNumber = mappings.installmentNumber
          ? row[mappings.installmentNumber]
          : "";
        const rawInstallmentCount = mappings.installmentCount ? row[mappings.installmentCount] : "";

        const eventDate = parseDateString(rawDate, dateFormat);
        if (!eventDate) return [];

        const amountResult = parseAmountToCents(rawAmount);
        if (!amountResult) return [];

        const description = rawDesc || "Transação Importada";
        const installmentInfo = card
          ? parseImportedInstallmentInfo({
              description,
              installment: rawInstallment,
              installmentNumber: rawInstallmentNumber,
              installmentCount: rawInstallmentCount
            })
          : null;
        const baseDescription = installmentInfo?.baseDescription ?? description;

        let type: "income" | "expense" | "refund" | "chargeback" = "expense";
        if (card) {
          type = amountResult.detectedType === "expense" ? "chargeback" : "expense";
        } else {
          type = parseImportedTransactionType(rawType, amountResult.detectedType);
        }
        const subcategoryId = resolveImportedSubcategoryId(rawSubcategory, type, categoryLookup);

        let calculatedBudgetMonth: string | null = null;
        let accountId: string | null = null;
        let paymentMethodId: string | null = null;
        let creditCardId: string | null = null;

        const installmentNumber = installmentInfo?.installmentNumber ?? 1;
        const installmentCount = installmentInfo?.installmentCount ?? 1;

        if (card) {
          creditCardId = card.id;
          accountId = null;
          calculatedBudgetMonth =
            targetBillMonth ?? getCreditCardBillMonth(eventDate, card.closingDay);
        } else {
          accountId = rawAccount || defaultAccountId || null;
          paymentMethodId = null;
          creditCardId = null;
        }

        const installmentRange =
          isCreditCardBillImport && card && installmentCount > 1
            ? Array.from(
                { length: installmentCount - installmentNumber + 1 },
                (_, offset) => installmentNumber + offset
              )
            : [installmentNumber];

        return installmentRange.map((currentInstallment) => ({
          tempId: `temp-${idx}-${currentInstallment}-${Date.now()}`,
          eventDate,
          description:
            installmentCount > 1
              ? formatImportedInstallmentDescription(
                  baseDescription,
                  currentInstallment,
                  installmentCount
                )
              : description,
          amountCents: amountResult.amountCents,
          type,
          accountId,
          paymentMethodId,
          creditCardId,
          budgetMonth:
            calculatedBudgetMonth && card && installmentCount > 1
              ? advanceMonth(calculatedBudgetMonth, currentInstallment - installmentNumber)
              : calculatedBudgetMonth,
          subcategoryId,
          installmentNumber: installmentCount > 1 ? currentInstallment : null,
          installmentCount: installmentCount > 1 ? installmentCount : null,
          isGeneratedFutureInstallment: currentInstallment > installmentNumber
        }));
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (parsedItems.length === 0) {
      return [];
    }

    // Get date range for duplicate check
    const dates = parsedItems.map((item) => new Date(item.eventDate).getTime());
    const minTime = Math.min(...dates);
    const maxTime = Math.max(...dates);
    const minDateStr = new Date(minTime - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const maxDateStr = new Date(maxTime + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const budgetMonths = [
      ...new Set(
        parsedItems
          .filter((item) => item.creditCardId && item.budgetMonth)
          .map((item) => item.budgetMonth as string)
      )
    ];

    // Fetch existing transactions in range. Card installments may keep the
    // original purchase date, so compare by bill month instead of date window.
    const existingTx = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        eventDate: transactions.eventDate,
        amountCents: transactions.amountCents,
        accountId: transactions.accountId,
        creditCardId: transactions.creditCardId,
        budgetMonth: transactions.budgetMonth,
        accountName: accounts.name
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        and(
          eq(transactions.ownerId, requestContextFrom(request).ownerId),
          budgetMonths.length > 0
            ? inArray(transactions.budgetMonth, budgetMonths)
            : and(gte(transactions.eventDate, minDateStr), lte(transactions.eventDate, maxDateStr))
        )
      );

    const parsedItemsWithDuplicates = parsedItems.map((item) => {
      const match = existingTx.find((tx) => {
        const isInstallment = Boolean(item.installmentNumber && item.installmentCount);
        const sameAmount = isImportedAmountMatch(tx.amountCents, item.amountCents, isInstallment);
        const sameAccount = item.creditCardId
          ? tx.creditCardId === item.creditCardId
          : !tx.accountId || !item.accountId || tx.accountId === item.accountId;
        const sameBillMonth = item.creditCardId ? tx.budgetMonth === item.budgetMonth : true;
        const daysDiff = dateDiffInDays(tx.eventDate, item.eventDate);
        const nearDate = daysDiff <= 3;
        const sameImportedDescription =
          normalizeImportedText(tx.description) === normalizeImportedText(item.description);
        if (item.creditCardId) {
          return (
            sameAmount &&
            sameAccount &&
            sameBillMonth &&
            sameImportedDescription &&
            (isInstallment || nearDate)
          );
        }

        return sameAmount && sameAccount && sameBillMonth && nearDate;
      });

      return {
        ...item,
        isDuplicate: !!match,
        duplicateOf: match
          ? {
              id: match.id,
              description: match.description,
              eventDate: match.eventDate,
              amountCents: match.amountCents,
              accountName: match.accountName
            }
          : null
      };
    });

    return parsedItemsWithDuplicates;
  });

  app.post("/transactions/import-confirm", async (request, reply) => {
    const body = request.body as {
      transactions?: Array<{
        eventDate: string;
        description: string;
        amountCents: number;
        type: "income" | "expense" | "refund" | "chargeback";
        accountId?: string | null;
        paymentMethodId?: string | null;
        creditCardId?: string | null;
        budgetMonth?: string | null;
        subcategoryId?: string | null;
        status?: string | null;
        notes?: string | null;
        installmentNumber?: number | null;
        installmentCount?: number | null;
      }>;
      preventDuplicates?: boolean;
    };

    if (!body || !Array.isArray(body.transactions)) {
      return reply.code(400).send({ message: "Payload inválido. Lista de transações requerida." });
    }

    const created: Array<typeof transactions.$inferSelect> = [];
    const createdInstallmentMetadata: Array<{
      transaction: typeof transactions.$inferSelect;
      installmentNumber: number;
      installmentCount: number;
    }> = [];

    await connection.transaction(async (tx) => {
      for (const t of body.transactions!) {
        const id = crypto.randomUUID();
        const eventDate = assertBusinessDate(t.eventDate);
        await ensureOptionalAccountExists(
          connection,
          requestContextFrom(request).ownerId,
          t.creditCardId ? null : (t.accountId ?? null)
        );
        await ensureOptionalPaymentMethodExists(
          connection,
          t.creditCardId ? null : (t.paymentMethodId ?? null)
        );
        await ensureOptionalSubcategoryExists(
          connection,
          requestContextFrom(request).ownerId,
          t.subcategoryId ?? null,
          assertTransactionType(t.type)
        );
        await ensureOptionalCreditCardExists(
          connection,
          requestContextFrom(request).ownerId,
          t.creditCardId ?? null
        );
        await ensurePaymentSource(connection, {
          type: t.type,
          accountId: t.creditCardId ? null : (t.accountId ?? null),
          paymentMethodId: t.creditCardId ? null : (t.paymentMethodId ?? null),
          creditCardId: t.creditCardId ?? null,
          subcategoryId: t.subcategoryId ?? null
        });
        let budgetMonth = t.budgetMonth
          ? assertYearMonth(t.budgetMonth)
          : yearMonthFromDate(eventDate);
        let creditCardBillId: string | null = null;

        if (t.creditCardId) {
          const card = (
            await tx
              .select()
              .from(creditCards)
              .where(
                and(
                  eq(creditCards.ownerId, requestContextFrom(request).ownerId),
                  eq(creditCards.id, t.creditCardId)
                )
              )
              .limit(1)
          )[0];
          if (!card) {
            throw new ValidationError("Cartão de crédito não encontrado.");
          }

          budgetMonth = t.budgetMonth
            ? assertYearMonth(t.budgetMonth)
            : getCreditCardBillMonth(eventDate, card.closingDay);

          const bill = (
            await tx
              .select()
              .from(creditCardBills)
              .where(
                and(
                  eq(creditCardBills.creditCardId, t.creditCardId),
                  eq(creditCardBills.billMonth, budgetMonth)
                )
              )
              .limit(1)
          )[0];

          if (!bill) {
            const { closingDate, dueDate } = getCreditCardBillDates(
              budgetMonth,
              card.closingDay,
              card.dueDay
            );

            const newBill = {
              id: crypto.randomUUID(),
              creditCardId: t.creditCardId,
              billMonth: budgetMonth,
              closingDate,
              dueDate,
              status: "open",
              paidAt: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            await tx.insert(creditCardBills).values(newBill);
            creditCardBillId = newBill.id;
          } else {
            creditCardBillId = bill.id;
            if (bill.status === "paid") {
              throw new ValidationError(
                `Não é possível importar lançamentos para a fatura de ${budgetMonth} porque ela já está paga.`
              );
            }
          }
        }

        const newTx = {
          id,
          ownerId: requestContextFrom(request).ownerId,
          type: assertTransactionType(t.type),
          description: t.description || "Transação Importada",
          amountCents: t.amountCents,
          eventDate,
          budgetMonth,
          accountId: t.creditCardId ? null : t.accountId || null,
          paymentMethodId: t.creditCardId ? null : t.paymentMethodId || null,
          subcategoryId: t.subcategoryId || null,
          creditCardId: t.creditCardId || null,
          creditCardBillId,
          status: assertTransactionStatus(t.status || "confirmed"),
          notes: t.notes || null,
          transferId: null,
          recurrenceRuleId: null,
          recurrenceMonth: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (body.preventDuplicates && (await isDuplicateImportedTransaction(tx, newTx))) {
          continue;
        }

        await tx.insert(transactions).values(newTx);
        created.push(newTx);
        if (newTx.creditCardId && t.installmentNumber && t.installmentCount) {
          createdInstallmentMetadata.push({
            transaction: newTx,
            installmentNumber: t.installmentNumber,
            installmentCount: t.installmentCount
          });
        }
      }
    });

    await createInstallmentMetadataGroupsForImportedTransactions(
      connection,
      createdInstallmentMetadata
    );

    return reply.code(201).send(created);
  });
}

async function findOwnedTransaction(connection: DatabaseConnection, ownerId: string, id: string) {
  return (
    await connection.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.ownerId, ownerId), eq(transactions.id, id)))
      .limit(1)
  )[0];
}

function buildTransactionFilters(ownerId: string, query: Record<string, unknown>): SQL[] {
  return [
    eq(transactions.ownerId, ownerId),
    typeof query.budgetMonth === "string" && query.budgetMonth
      ? eq(transactions.budgetMonth, assertYearMonth(query.budgetMonth))
      : undefined,
    typeof query.type === "string" && query.type
      ? eq(transactions.type, assertTransactionType(query.type))
      : undefined,
    typeof query.status === "string" && query.status
      ? eq(transactions.status, assertTransactionStatus(query.status))
      : undefined,
    buildNullableIdFilter(query.accountId, transactions.accountId),
    buildNullableIdFilter(query.paymentMethodId, transactions.paymentMethodId),
    buildNullableIdFilter(query.subcategoryId, transactions.subcategoryId)
  ].filter((filter): filter is SQL => filter !== undefined);
}

function buildNullableIdFilter(
  value: unknown,
  column:
    | typeof transactions.accountId
    | typeof transactions.paymentMethodId
    | typeof transactions.subcategoryId
): SQL | undefined {
  if (typeof value !== "string" || !value) {
    return undefined;
  }

  return value === missingFilterValue ? isNull(column) : eq(column, value);
}

function parseTransactionPayload(body: unknown) {
  if (!isRecord(body)) {
    throw new ValidationError("Payload do lançamento deve ser um objeto.");
  }

  const payload = body as TransactionPayload;
  const eventDate = assertBusinessDate(parseRequiredString(payload.eventDate, "eventDate"));
  const budgetMonth =
    payload.budgetMonth === undefined || payload.budgetMonth === null || payload.budgetMonth === ""
      ? yearMonthFromDate(eventDate)
      : assertYearMonth(parseRequiredString(payload.budgetMonth, "budgetMonth"));
  const amountCents = parseRequiredInteger(payload.amountCents, "amountCents");

  if (amountCents <= 0) {
    throw new ValidationError("amountCents deve ser maior que zero.");
  }

  const installmentCount = (() => {
    const raw = parseOptionalInteger(
      (payload as TransactionPayload).installmentCount,
      "installmentCount"
    );
    if (raw === undefined || raw === null) return 1;
    if (raw < 1 || raw > 48) throw new ValidationError("installmentCount deve estar entre 1 e 48.");
    return raw;
  })();

  const type = assertTransactionType(parseRequiredString(payload.type, "type"));
  const creditCardId = parseOptionalString(payload.creditCardId, "creditCardId");
  const destinationAccountId = parseOptionalString(
    payload.destinationAccountId,
    "destinationAccountId"
  );

  if (creditCardId && destinationAccountId) {
    throw new ValidationError("Compra no cartão não pode ser transferência entre contas.");
  }

  if (creditCardId && type !== "expense" && type !== "refund" && type !== "chargeback") {
    throw new ValidationError(
      "Lançamento de cartão de crédito deve ser despesa, reembolso ou estorno."
    );
  }

  return {
    type,
    description: parseRequiredString(payload.description, "description"),
    amountCents,
    eventDate,
    budgetMonth,
    accountId: creditCardId ? null : parseOptionalString(payload.accountId, "accountId"),
    paymentMethodId: creditCardId
      ? null
      : parseOptionalString(payload.paymentMethodId, "paymentMethodId"),
    subcategoryId: parseOptionalString(payload.subcategoryId, "subcategoryId"),
    creditCardId,
    creditCardBillId: null as string | null,
    status:
      payload.status === undefined || payload.status === null || payload.status === ""
        ? "confirmed"
        : assertTransactionStatus(parseRequiredString(payload.status, "status")),
    notes: parseOptionalString(payload.notes, "notes"),
    destinationAccountId,
    installmentCount
  };
}

async function validateTransferPayload(
  connection: DatabaseConnection,
  ownerId: string,
  payload: ParsedTransactionPayload
) {
  const isTransferSubcategory = await isTransferSubcategoryId(
    connection,
    ownerId,
    payload.subcategoryId
  );
  const hasDestination = Boolean(payload.destinationAccountId);
  if (payload.creditCardId && (isTransferSubcategory || hasDestination)) {
    return "Compra no cartão não pode ser transferência entre contas.";
  }

  if (isTransferSubcategory || hasDestination)
    return "Use o endpoint /transfers para transferências entre contas.";

  if (payload.destinationAccountId && payload.accountId === payload.destinationAccountId) {
    return "Conta de origem e conta de destino devem ser diferentes.";
  }

  return null;
}

async function isTransferSubcategoryId(
  connection: DatabaseConnection,
  ownerId: string,
  subcategoryId: string | null
) {
  if (!subcategoryId) {
    return false;
  }

  const subcategory = (
    await connection.db
      .select({
        categoryNature: dbCategories.nature
      })
      .from(subcategories)
      .leftJoin(dbCategories, eq(subcategories.categoryId, dbCategories.id))
      .where(eq(subcategories.id, subcategoryId))
      .limit(1)
  )[0];

  return subcategory?.categoryNature === "transfer";
}

async function normalizeTransactionForStorage(
  connection: DatabaseConnection,
  ownerId: string,
  transactionData: TransactionData
): Promise<TransactionData> {
  if (!transactionData.creditCardId) {
    return transactionData;
  }

  const card = await getCreditCardOrThrow(connection, ownerId, transactionData.creditCardId);
  const budgetMonth = getCreditCardBillMonth(transactionData.eventDate, card.closingDay);
  const bill = await getOrCreateCreditCardBill(connection, card, budgetMonth);

  return {
    ...transactionData,
    budgetMonth,
    accountId: null,
    paymentMethodId: null,
    creditCardBillId: bill.id
  };
}

export async function buildCreditCardInstallmentTransactions(
  connection: DatabaseConnection,
  ownerId: string,
  transactionData: TransactionData,
  installmentCount: number
) {
  if (!transactionData.creditCardId) {
    throw new ValidationError("Parcelamento exige cartão de crédito.");
  }

  const card = await getCreditCardOrThrow(connection, ownerId, transactionData.creditCardId);
  const firstBillMonth = getCreditCardBillMonth(transactionData.eventDate, card.closingDay);
  const baseAmountCents = Math.floor(transactionData.amountCents / installmentCount);

  return await Promise.all(
    Array.from({ length: installmentCount }, async (_, index) => {
      const budgetMonth = advanceMonth(firstBillMonth, index);
      const bill = await getOrCreateCreditCardBill(connection, card, budgetMonth);

      return {
        id: crypto.randomUUID(),
        ...transactionData,
        description: `${transactionData.description} (${index + 1}/${installmentCount})`,
        amountCents:
          index === installmentCount - 1
            ? transactionData.amountCents - baseAmountCents * (installmentCount - 1)
            : baseAmountCents,
        budgetMonth,
        accountId: null,
        paymentMethodId: null,
        creditCardBillId: bill.id
      };
    })
  );
}

async function getCreditCardOrThrow(
  connection: DatabaseConnection,
  ownerId: string,
  creditCardId: string
) {
  const card = (
    await connection.db
      .select()
      .from(creditCards)
      .where(and(eq(creditCards.ownerId, ownerId), eq(creditCards.id, creditCardId)))
      .limit(1)
  )[0];

  if (!card) {
    throw new ValidationError("Cartão de crédito não encontrado.");
  }

  return card;
}

async function getOrCreateCreditCardBill(
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
    status: "open",
    paidAt: null,
    minimumDueCents: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now
  };

  await connection.db.insert(creditCardBills).values(bill);

  return bill;
}

export async function isBillPaid(
  db: DatabaseConnection["db"],
  billId: string | null
): Promise<boolean> {
  if (!billId) return false;
  const bill = (
    await db
      .select({ status: creditCardBills.status })
      .from(creditCardBills)
      .where(eq(creditCardBills.id, billId))
      .limit(1)
  )[0];
  return bill?.status === "paid";
}

export async function isBillFinanciallyLocked(
  db: DatabaseConnection["db"],
  billId: string
): Promise<boolean> {
  const bill = (
    await db
      .select({ closedAt: creditCardBills.closedAt })
      .from(creditCardBills)
      .where(eq(creditCardBills.id, billId))
      .limit(1)
  )[0];
  if (bill?.closedAt) return true;
  return (
    (
      await db
        .select({ id: creditCardBillPayments.id })
        .from(creditCardBillPayments)
        .where(
          and(eq(creditCardBillPayments.billId, billId), isNull(creditCardBillPayments.reversedAt))
        )
        .limit(1)
    )[0] !== undefined
  );
}

function parseTransactionPayloadOrReply(body: unknown, reply: FastifyReply) {
  try {
    return parseTransactionPayload(body);
  } catch (error) {
    return sendPayloadError(error, reply, "Payload do lançamento inválido.");
  }
}

async function ensureReferencesOrReply(
  connection: DatabaseConnection,
  ownerId: string,
  payload: ReturnType<typeof parseTransactionPayload>,
  reply: FastifyReply
) {
  try {
    await ensureOptionalAccountExists(connection, ownerId, payload.accountId);
    await ensureOptionalPaymentMethodExists(connection, payload.paymentMethodId);
    await ensureOptionalSubcategoryExists(connection, ownerId, payload.subcategoryId, payload.type);
    await ensureOptionalCreditCardExists(connection, ownerId, payload.creditCardId);
    await ensurePaymentSource(connection, payload);
    return true;
  } catch (error) {
    sendPayloadError(error, reply, "Referências do lançamento inválidas.");
    return false;
  }
}

async function ensurePaymentSource(
  connection: DatabaseConnection,
  payload: Pick<
    ParsedTransactionPayload,
    "type" | "accountId" | "paymentMethodId" | "creditCardId" | "subcategoryId"
  >
) {
  if (payload.creditCardId) return;
  const isConsumption = payload.type === "expense" && Boolean(payload.subcategoryId);
  if (!isConsumption) return;
  if (!payload.accountId || !payload.paymentMethodId) {
    throw new ValidationError("Despesa em conta exige conta e forma de pagamento.");
  }
  await validateActiveAccountPaymentMethod(connection, payload.accountId, payload.paymentMethodId);
}

async function ensureOptionalAccountExists(
  connection: DatabaseConnection,
  ownerId: string,
  accountId: string | null
) {
  if (!accountId) {
    return;
  }

  const account = (
    await connection.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.ownerId, ownerId), eq(accounts.id, accountId)))
      .limit(1)
  )[0];

  if (!account) {
    throw new ValidationError("Conta não encontrada.");
  }
}

async function ensureOptionalPaymentMethodExists(
  connection: DatabaseConnection,
  paymentMethodId: string | null
) {
  if (!paymentMethodId) {
    return;
  }

  const paymentMethod = (
    await connection.db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.id, paymentMethodId))
      .limit(1)
  )[0];

  if (!paymentMethod) {
    throw new ValidationError("Meio de pagamento não encontrado.");
  }
}

async function ensureOptionalSubcategoryExists(
  connection: DatabaseConnection,
  ownerId: string,
  subcategoryId: string | null,
  transactionType?: ReturnType<typeof assertTransactionType>
) {
  if (!subcategoryId) {
    return;
  }

  const sub = (
    await connection.db
      .select({ nature: dbCategories.nature })
      .from(subcategories)
      .innerJoin(
        dbCategories,
        and(eq(subcategories.categoryId, dbCategories.id), eq(dbCategories.ownerId, ownerId))
      )
      .where(eq(subcategories.id, subcategoryId))
      .limit(1)
  )[0];

  if (!sub) {
    throw new ValidationError("Subcategoria não encontrada.");
  }
  if (transactionType && sub.nature !== categoryNatureForTransactionType(transactionType)) {
    throw new ValidationError(
      transactionType === "income"
        ? "Receita exige uma categoria de receita."
        : "Despesa, reembolso ou estorno exige uma categoria de despesa."
    );
  }
}

async function ensureOptionalCreditCardExists(
  connection: DatabaseConnection,
  ownerId: string,
  creditCardId: string | null
) {
  if (!creditCardId) {
    return;
  }

  const card = (
    await connection.db
      .select()
      .from(creditCards)
      .where(and(eq(creditCards.ownerId, ownerId), eq(creditCards.id, creditCardId)))
      .limit(1)
  )[0];

  if (!card) {
    throw new ValidationError("Cartão de crédito não encontrado.");
  }
}

function parseCsvContent(csv: string): { headers: string[]; rows: Record<string, string>[] } {
  const normalized = csv
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines: string[] = [];
  let currentLine = "";
  let insideQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
      currentLine += char;
    } else if (char === "\n" && !insideQuotes) {
      lines.push(currentLine);
      currentLine = "";
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const delimiter = detectCsvDelimiter(lines[0]);

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let currentField = "";
    let insideQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        fields.push(cleanCsvField(currentField));
        currentField = "";
      } else {
        currentField += char;
      }
    }
    fields.push(cleanCsvField(currentField));
    return fields;
  };

  const parsedHeaders = parseLine(lines[0]);
  const parsedRows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const fields = parseLine(lines[i]);
    const rowObj: Record<string, string> = {};
    for (let j = 0; j < parsedHeaders.length; j++) {
      rowObj[parsedHeaders[j]] = fields[j] ?? "";
    }
    parsedRows.push(rowObj);
  }

  return { headers: parsedHeaders, rows: parsedRows };
}

function detectCsvDelimiter(headerLine: string): "," | ";" | "\t" {
  const candidates = [",", ";", "\t"] as const;

  return candidates
    .map((delimiter) => ({
      delimiter,
      count: countDelimiterOutsideQuotes(headerLine, delimiter)
    }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function countDelimiterOutsideQuotes(line: string, delimiter: "," | ";" | "\t"): number {
  let count = 0;
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      count++;
    }
  }

  return count;
}

function cleanCsvField(value: string): string {
  return value.trim().replace(/^\uFEFF/, "");
}

function parseDateString(val: string, format: "DMY" | "MDY" | "YMD" = "DMY"): string | null {
  if (!val) return null;
  const matchYmd = val.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (matchYmd) {
    const year = matchYmd[1];
    const month = matchYmd[2].padStart(2, "0");
    const day = matchYmd[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const matchShort = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (matchShort) {
    const first = matchShort[1].padStart(2, "0");
    const second = matchShort[2].padStart(2, "0");
    const year = matchShort[3];
    const month = format === "MDY" ? first : second;
    const day = format === "MDY" ? second : first;
    return `${year}-${month}-${day}`;
  }
  return null;
}

function parseAmountToCents(
  val: string
): { amountCents: number; detectedType: "income" | "expense" } | null {
  if (!val) return null;
  let clean = val.replace(/[R$\s]/g, "");

  let isNegative = false;
  if (clean.startsWith("-") || clean.endsWith("-")) {
    isNegative = true;
    clean = clean.replace(/-/g, "");
  }
  if (clean.startsWith("(") && clean.endsWith(")")) {
    isNegative = true;
    clean = clean.slice(1, -1);
  }

  if (clean.includes(",") && clean.includes(".")) {
    if (clean.indexOf(".") < clean.indexOf(",")) {
      clean = clean.replace(/\./g, "").replace(",", ".");
    } else {
      clean = clean.replace(/,/g, "");
    }
  } else if (clean.includes(",")) {
    clean = clean.replace(",", ".");
  }

  const num = parseFloat(clean);
  if (isNaN(num)) return null;

  const amountCents = Math.round(num * 100);
  if (amountCents < 0 || isNegative) {
    return {
      amountCents: Math.abs(amountCents),
      detectedType: "expense"
    };
  } else {
    return {
      amountCents,
      detectedType: "income"
    };
  }
}

function parseImportedTransactionType(
  rawType: string,
  fallback: "income" | "expense"
): "income" | "expense" {
  const normalized = normalizeImportedText(rawType);

  if (!normalized) {
    return fallback;
  }

  if (/^\(?\s*\+/.test(normalized)) {
    return "income";
  }

  if (/^\(?\s*-/.test(normalized)) {
    return "expense";
  }

  if (/\b(receita|income|entrada|credito|credit|cr)\b/.test(normalized) || normalized === "c") {
    return "income";
  }

  if (/\b(despesa|expense|saida|debito|debit|db)\b/.test(normalized) || normalized === "d") {
    return "expense";
  }

  return fallback;
}

function parseImportedInstallmentInfo({
  description,
  installment,
  installmentNumber,
  installmentCount
}: {
  description: string;
  installment: string;
  installmentNumber: string;
  installmentCount: string;
}): { installmentNumber: number; installmentCount: number; baseDescription: string } | null {
  const combined =
    parseInstallmentPair(installment) ??
    parseInstallmentPair(description) ??
    parseInstallmentPair(`${installmentNumber}/${installmentCount}`);

  if (combined) {
    const [current, total] = combined;
    if (current >= 1 && total >= 2 && current <= total && total <= 48) {
      return {
        installmentNumber: current,
        installmentCount: total,
        baseDescription: stripInstallmentMarker(description)
      };
    }
  }

  const parsedCount = parseInt(installmentCount.trim(), 10);
  if (!isNaN(parsedCount) && parsedCount >= 2 && parsedCount <= 48) {
    const rawNum = installmentNumber.trim() || installment.trim();
    const parsedNum = parseInt(rawNum, 10);
    if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= parsedCount) {
      return {
        installmentNumber: parsedNum,
        installmentCount: parsedCount,
        baseDescription: stripInstallmentMarker(description)
      };
    }
  }

  return null;
}

function parseInstallmentPair(value: string): [number, number] | null {
  const match = value.match(/(?:^|\D)(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})(?:\D|$)/i);
  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2])];
}

function stripInstallmentMarker(description: string): string {
  return description
    .replace(/\s*(?:\[|\()?\s*\d{1,2}\s*(?:\/|de)\s*\d{1,2}\s*(?:\]|\))?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatImportedInstallmentDescription(
  baseDescription: string,
  installmentNumber: number,
  installmentCount: number
) {
  return `${baseDescription} (${installmentNumber}/${installmentCount})`;
}

type InstallmentMetadataTransaction = {
  transaction: Pick<
    typeof transactions.$inferInsert,
    "id" | "amountCents" | "budgetMonth" | "creditCardBillId"
  >;
  installmentNumber: number;
};

export async function createInstallmentMetadataForTransactions(
  connection: DatabaseConnection,
  params: {
    creditCardId: string;
    originalDescription: string;
    originalEventDate: string;
    installmentCount: number;
    totalAmountCents: number | null;
    source: "manual" | "csv_import";
    transactions: InstallmentMetadataTransaction[];
  }
) {
  if (params.installmentCount <= 1 || params.transactions.length === 0) {
    return null;
  }

  const now = new Date().toISOString();
  const installmentPurchaseId = crypto.randomUUID();
  const baseDescription = stripInstallmentMarker(params.originalDescription);

  await connection.db.insert(installmentPurchases).values({
    id: installmentPurchaseId,
    creditCardId: params.creditCardId,
    originalDescription: baseDescription,
    normalizedDescription: normalizeImportedText(baseDescription),
    originalEventDate: params.originalEventDate,
    installmentCount: params.installmentCount,
    totalAmountCents: params.totalAmountCents,
    source: params.source,
    status: "active",
    createdAt: now,
    updatedAt: now
  });

  for (const { transaction, installmentNumber } of params.transactions) {
    await connection.db.insert(installments).values({
      id: crypto.randomUUID(),
      installmentPurchaseId,
      purchaseTransactionId: transaction.id,
      creditCardBillId: transaction.creditCardBillId,
      installmentNumber,
      installmentCount: params.installmentCount,
      amountCents: transaction.amountCents,
      dueMonth: transaction.budgetMonth,
      createdAt: now,
      updatedAt: now
    });
  }

  return installmentPurchaseId;
}

async function createInstallmentMetadataGroupsForImportedTransactions(
  connection: DatabaseConnection,
  items: Array<{
    transaction: typeof transactions.$inferSelect;
    installmentNumber: number;
    installmentCount: number;
  }>
) {
  const groups = new Map<string, typeof items>();

  for (const item of items) {
    if (!item.transaction.creditCardId || item.installmentCount <= 1) {
      continue;
    }

    const baseDescription = stripInstallmentMarker(item.transaction.description);
    const key = [
      item.transaction.creditCardId,
      normalizeImportedText(baseDescription),
      item.installmentCount,
      item.transaction.eventDate
    ].join("|");
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  for (const group of groups.values()) {
    const first = group[0];
    if (!first.transaction.creditCardId) {
      continue;
    }

    await createInstallmentMetadataForTransactions(connection, {
      creditCardId: first.transaction.creditCardId,
      originalDescription: stripInstallmentMarker(first.transaction.description),
      originalEventDate: first.transaction.eventDate,
      installmentCount: first.installmentCount,
      totalAmountCents: group.reduce((sum, item) => sum + item.transaction.amountCents, 0),
      source: "csv_import",
      transactions: group.map((item) => ({
        transaction: item.transaction,
        installmentNumber: item.installmentNumber
      }))
    });
  }
}

async function isDuplicateImportedTransaction(
  db: Pick<DatabaseConnection["db"], "select">,
  candidate: typeof transactions.$inferInsert
) {
  if (candidate.creditCardId) {
    const existingCardTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.ownerId, candidate.ownerId),
          eq(transactions.budgetMonth, candidate.budgetMonth)
        )
      );

    return existingCardTransactions.some((transaction) => {
      const candidateInstallment = parseImportedInstallmentInfo({
        description: candidate.description,
        installment: "",
        installmentNumber: "",
        installmentCount: ""
      });
      const isInstallment = Boolean(candidateInstallment);

      return (
        transaction.creditCardId === candidate.creditCardId &&
        isImportedAmountMatch(transaction.amountCents, candidate.amountCents, isInstallment) &&
        normalizeImportedText(transaction.description) ===
          normalizeImportedText(candidate.description)
      );
    });
  }

  const existing = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.ownerId, candidate.ownerId),
        eq(transactions.amountCents, candidate.amountCents),
        eq(transactions.eventDate, candidate.eventDate),
        eq(transactions.description, candidate.description),
        eq(transactions.budgetMonth, candidate.budgetMonth)
      )
    );

  return existing.some((transaction) => {
    return transaction.accountId === candidate.accountId;
  });
}

type ImportedCategoryLookupItem = {
  id: string;
  name: string;
  categoryName: string | null;
  nature: string | null;
};

function resolveImportedSubcategoryId(
  rawCategory: string,
  transactionType: "income" | "expense" | "refund" | "chargeback",
  categoryLookup: ImportedCategoryLookupItem[]
): string | null {
  const normalizedCategory = normalizeImportedCategoryText(rawCategory);

  if (!normalizedCategory) {
    return null;
  }

  const byId = categoryLookup.find((item) => item.id === rawCategory);
  if (byId) {
    return byId.id;
  }

  const compatibleNatures =
    transactionType === "income" ? ["income", "transfer"] : ["expense", "transfer"];
  const compatibleItems = categoryLookup.filter((item) =>
    item.nature ? compatibleNatures.includes(item.nature) : true
  );

  const exact = compatibleItems.find(
    (item) => normalizeImportedText(item.name) === normalizedCategory
  );
  if (exact) {
    return exact.id;
  }

  const exactWithCategory = compatibleItems.find((item) => {
    const categoryName = item.categoryName ? normalizeImportedText(item.categoryName) : "";
    return `${categoryName} ${normalizeImportedText(item.name)}`.trim() === normalizedCategory;
  });
  if (exactWithCategory) {
    return exactWithCategory.id;
  }

  const contained = compatibleItems.find((item) =>
    normalizedCategory.includes(normalizeImportedText(item.name))
  );
  return contained?.id ?? null;
}

function normalizeImportedCategoryText(value: string): string {
  return normalizeImportedText(value)
    .replace(/^\(?\s*[+-]\s*\)?\s*/, "")
    .replace(
      /\b(receita|income|entrada|credito|credit|cr|despesa|expense|saida|debito|debit|db)\b/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function isImportedAmountMatch(
  existingAmountCents: number,
  importedAmountCents: number,
  isInstallment: boolean
) {
  const differenceInCents = Math.abs(existingAmountCents - importedAmountCents);
  return isInstallment ? differenceInCents <= 2 : differenceInCents === 0;
}

function normalizeImportedText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function dateDiffInDays(d1Str: string, d2Str: string): number {
  const d1 = new Date(d1Str);
  const d2 = new Date(d2Str);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
