import type { createDatabaseConnection } from "@finances/database";
import { budgetInputSchema, yearMonthSchema } from "@finances/domain";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createMonthlyOverviewService } from "../application/monthly-overview-service.js";
import { ValidationError } from "../http.js";

type Connection = ReturnType<typeof createDatabaseConnection>;
const querySchema = z.object({ month: yearMonthSchema });
const budgetSchema = budgetInputSchema.extend({ budgetMonth: yearMonthSchema, subcategoryId: z.string().min(1), amountCents: z.number().int().min(0) });
function parse<T>(schema: z.ZodType<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success) throw new ValidationError(result.error.issues[0]?.message ?? "Requisição inválida."); return result.data; }

export function registerMonthlyOverviewRoutes(app: FastifyInstance, connection: Connection) {
  const service = createMonthlyOverviewService(connection);
  app.get("/monthly-overview", async (request) => service.overview(parse(querySchema, request.query).month));
  app.get("/cash-position", async (request) => service.cashPosition(parse(querySchema, request.query).month));
  app.put("/monthly-budgets", async (request) => { const body = parse(budgetSchema, request.body); return service.setBudget(body.budgetMonth, body.subcategoryId, body.amountCents); });
}
