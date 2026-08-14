import { yearMonthSchema } from "@finances/domain";
import type { createDatabaseConnection } from "@finances/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requestContextFrom } from "../application/request-context.js";
import { ValidationError } from "../http.js";
import { createMonthlyBudgetAllocationService } from "./monthly-budget-allocations/application/service.js";

type Connection = ReturnType<typeof createDatabaseConnection>;
const copySchema = z.object({ sourceMonth: yearMonthSchema, targetMonth: yearMonthSchema });

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? "Requisição inválida.");
  }
  return result.data;
}

export function registerMonthlyBudgetAllocationRoutes(
  app: FastifyInstance,
  connection: Connection
) {
  const serviceFor = (request: Parameters<typeof requestContextFrom>[0]) =>
    createMonthlyBudgetAllocationService(connection, requestContextFrom(request).ownerId);

  app.put("/monthly-budget-allocations", async (request) =>
    serviceFor(request).replace(request.body)
  );
  app.post("/monthly-budget-allocations/copy", async (request) => {
    const input = parse(copySchema, request.body);
    return await serviceFor(request).copy(input.sourceMonth, input.targetMonth);
  });
}
