import type { createDatabaseConnection } from "@finances/database";
import { yearMonthSchema } from "@finances/domain";
import type { FastifyInstance } from "fastify";
import { requestContextFrom } from "../application/request-context.js";
import { z } from "zod";
import { createMonthlyOverviewService } from "../application/monthly-overview-service.js";
import { ValidationError } from "../http.js";

type Connection = ReturnType<typeof createDatabaseConnection>;
const querySchema = z.object({ month: yearMonthSchema });
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ValidationError(result.error.issues[0]?.message ?? "Requisição inválida.");
  return result.data;
}

export function registerMonthlyOverviewRoutes(app: FastifyInstance, connection: Connection) {
  const serviceFor = (request: Parameters<typeof requestContextFrom>[0]) =>
    createMonthlyOverviewService(connection, requestContextFrom(request).ownerId);
  app.get(
    "/monthly-overview",
    async (request) => await serviceFor(request).overview(parse(querySchema, request.query).month)
  );
  app.get(
    "/cash-position",
    async (request) =>
      await serviceFor(request).cashPosition(parse(querySchema, request.query).month)
  );
}
