import type { createDatabaseConnection } from "@finances/database";
import type { FastifyInstance } from "fastify";
import { requestContextFrom } from "../application/request-context.js";
import { z } from "zod";
import { createTransactionImportService } from "../application/transaction-import-service.js";
import { ValidationError } from "../http.js";

const requestSchema = z.object({ transactions: z.array(z.unknown()) });
function parse(body: unknown) {
  const result = requestSchema.safeParse(body);
  if (!result.success)
    throw new ValidationError(result.error.issues[0]?.message ?? "Importação inválida.");
  return result.data;
}

export function registerSimpleImportRoutes(
  app: FastifyInstance,
  connection: ReturnType<typeof createDatabaseConnection>
) {
  const serviceFor = (request: Parameters<typeof requestContextFrom>[0]) =>
    createTransactionImportService(connection, requestContextFrom(request).ownerId);
  app.post("/simple-import/preview", async (request) =>
    serviceFor(request).preview(parse(request.body).transactions)
  );
  app.post("/simple-import/confirm", async (request, reply) =>
    reply.code(201).send(await serviceFor(request).confirm(parse(request.body).transactions))
  );
}
