import { transactions, type createDatabaseConnection } from "@finances/database";
import {
  calculateMatchScore,
  assertTransactionType,
  assertBusinessDate,
  yearMonthFromDate,
  getCreditCardBillMonth,
  getCreditCardBillDates
} from "@finances/domain";
import { creditCards, creditCardBills } from "@finances/database";
import { and, eq, not } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

export function registerReconciliationRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const { db } = connection;

  app.post("/reconciliation/match-preview", async (request, reply) => {
    const body = request.body as {
      accountId?: string | null;
      creditCardId?: string | null;
      csvRows?: Array<{
        date: string;
        description: string;
        amountCents: number;
      }>;
    };

    if (!body || !Array.isArray(body.csvRows)) {
      return reply.code(400).send({ message: "Payload inválido. csvRows é obrigatório." });
    }

    const { accountId = null, creditCardId = null, csvRows } = body;

    const results = csvRows.map((row) => {
      // Busca transações candidatas com o mesmo valor absoluto e não conciliadas/canceladas
      const absAmount = Math.abs(row.amountCents);
      const dbCandidates = db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.amountCents, absAmount),
            not(eq(transactions.status, "canceled")),
            not(eq(transactions.status, "reconciled"))
          )
        )
        .all();

      const candidatesWithScores = dbCandidates
        .map((tx) => {
          const score = calculateMatchScore(row, tx, { accountId, creditCardId });
          return { tx, score };
        })
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score);

      const bestCandidate = candidatesWithScores[0] || null;

      let status: "no_match" | "soft_match" | "exact_match" = "no_match";
      if (bestCandidate) {
        if (bestCandidate.score >= 90) {
          status = "exact_match";
        } else if (bestCandidate.score >= 50) {
          status = "soft_match";
        }
      }

      return {
        csvRow: row,
        status,
        bestCandidate: bestCandidate
          ? {
              transactionId: bestCandidate.tx.id,
              description: bestCandidate.tx.description,
              eventDate: bestCandidate.tx.eventDate,
              amountCents: bestCandidate.tx.amountCents,
              score: bestCandidate.score
            }
          : null,
        allCandidates: candidatesWithScores.map((c) => ({
          transactionId: c.tx.id,
          description: c.tx.description,
          eventDate: c.tx.eventDate,
          amountCents: c.tx.amountCents,
          score: c.score
        }))
      };
    });

    return results;
  });

  app.post("/reconciliation/confirm", async (request, reply) => {
    const body = request.body as {
      accountId?: string | null;
      creditCardId?: string | null;
      resolutions?: Array<{
        csvRow: {
          date: string;
          description: string;
          amountCents: number;
        };
        action: "match" | "create" | "ignore";
        transactionId?: string | null;
        newTransaction?: {
          type: "income" | "expense";
          description: string;
          amountCents: number;
          eventDate: string;
          subcategoryId: string;
          notes?: string | null;
        } | null;
      }>;
    };

    if (!body || !Array.isArray(body.resolutions)) {
      return reply.code(400).send({ message: "Payload inválido. resolutions é obrigatório." });
    }

    const { accountId = null, creditCardId = null, resolutions } = body;

    db.transaction((tx) => {
      for (const res of resolutions) {
        if (res.action === "ignore") {
          continue;
        }

        if (res.action === "match" && res.transactionId) {
          tx.update(transactions)
            .set({
              status: "reconciled",
              updatedAt: new Date().toISOString()
            })
            .where(eq(transactions.id, res.transactionId))
            .run();
        } else if (res.action === "create" && res.newTransaction) {
          const t = res.newTransaction;
          const id = crypto.randomUUID();
          const eventDate = assertBusinessDate(t.eventDate);
          let budgetMonth = yearMonthFromDate(eventDate);
          let creditCardBillId: string | null = null;

          if (creditCardId) {
            const card = tx.select().from(creditCards).where(eq(creditCards.id, creditCardId)).get();
            if (!card) {
              throw new Error("Cartão de crédito não encontrado.");
            }
            budgetMonth = getCreditCardBillMonth(eventDate, card.closingDay);

            const bill = tx
              .select()
              .from(creditCardBills)
              .where(
                and(
                  eq(creditCardBills.creditCardId, creditCardId),
                  eq(creditCardBills.billMonth, budgetMonth)
                )
              )
              .get();

            if (!bill) {
              const { closingDate, dueDate } = getCreditCardBillDates(
                budgetMonth,
                card.closingDay,
                card.dueDay
              );

              const newBill = {
                id: crypto.randomUUID(),
                creditCardId,
                billMonth: budgetMonth,
                closingDate,
                dueDate,
                status: "open",
                paidAt: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };

              tx.insert(creditCardBills).values(newBill).run();
              creditCardBillId = newBill.id;
            } else {
              creditCardBillId = bill.id;
              if (bill.status === "paid") {
                throw new Error(
                  `Não é possível criar lançamentos para a fatura de ${budgetMonth} porque ela já está paga.`
                );
              }
            }
          }

          const newTx = {
            id,
            type: assertTransactionType(t.type),
            description: t.description,
            amountCents: t.amountCents,
            eventDate,
            budgetMonth,
            accountId: creditCardId ? null : accountId,
            paymentMethodId: null,
            subcategoryId: t.subcategoryId,
            creditCardId: creditCardId || null,
            creditCardBillId,
            status: "reconciled" as const,
            notes: t.notes || null,
            linkedTransactionId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          tx.insert(transactions).values(newTx).run();
        }
      }
    });

    return reply.code(200).send({ message: "Conciliação realizada com sucesso." });
  });
}
