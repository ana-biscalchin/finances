import type { createDatabaseConnection } from "@finances/database";
import { yearMonthSchema } from "@finances/domain";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ValidationError } from "../http.js";
import { createPlannedExpenseService } from "./planned-expenses/application/service.js";

type Connection = ReturnType<typeof createDatabaseConnection>;
const copySchema = z.object({ sourceMonth: yearMonthSchema, targetMonth: yearMonthSchema });
const parse = <T>(schema: z.ZodType<T>, value: unknown) => { const result = schema.safeParse(value); if (!result.success) throw new ValidationError(result.error.issues[0]?.message ?? "Requisição inválida."); return result.data; };
export function registerPlannedExpenseRoutes(app: FastifyInstance, connection: Connection) {
  const service = createPlannedExpenseService(connection);
  app.post("/planned-expenses", async (request, reply) => reply.code(201).send(service.create(request.body)));
  app.put("/planned-expenses/:id", async (request) => service.update((request.params as { id: string }).id, request.body));
  app.delete("/planned-expenses/:id", async (request, reply) => { service.remove((request.params as { id: string }).id); return reply.code(204).send(); });
  app.post("/planned-expenses/copy", async (request) => { const body = parse(copySchema, request.body); return service.copy(body.sourceMonth, body.targetMonth); });
}
