import type { createDatabaseConnection } from "@finances/database";
import { budgetInputSchema, yearMonthSchema } from "@finances/domain";
import type { FastifyInstance } from "fastify";
import { createMonthlyOverviewService } from "../application/monthly-overview-service.js";
type Connection = ReturnType<typeof createDatabaseConnection>;
export function registerMonthlyOverviewRoutes(app: FastifyInstance, connection: Connection) {
  const service = createMonthlyOverviewService(connection);
  app.get("/monthly-overview", async (request) => service.overview(yearMonthSchema.parse((request.query as { month?: string }).month)));
  app.get("/cash-position", async (request) => service.cashPosition(yearMonthSchema.parse((request.query as { month?: string }).month)));
  app.put("/monthly-budgets", async (request) => { const body = request.body as Record<string, unknown>; const amount = body.amountCents === 0 ? 0 : budgetInputSchema.parse(body).amountCents; return service.setBudget(yearMonthSchema.parse(body.budgetMonth), String(body.subcategoryId ?? ""), amount); });
}
