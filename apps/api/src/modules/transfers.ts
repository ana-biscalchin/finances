import type { createDatabaseConnection } from "@finances/database";
import { transferInputSchema } from "@finances/domain";
import type { FastifyInstance } from "fastify";
import { requestContextFrom } from "../application/request-context.js";
import { z } from "zod";
import { createTransferService } from "../application/transfer-service.js";
import { ValidationError } from "../http.js";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;
const paramsSchema = z.object({ id: z.string().min(1) });
const metadataSchema = z.object({ description: z.string().trim().min(1) });
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ValidationError(result.error.issues[0]?.message ?? "Transferência inválida.");
  return result.data;
}

export function registerTransferRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const serviceFor = (request: Parameters<typeof requestContextFrom>[0]) =>
    createTransferService(connection, requestContextFrom(request).ownerId);
  app.post("/transfers", async (request, reply) =>
    reply.code(201).send(await serviceFor(request).create(parse(transferInputSchema, request.body)))
  );
  app.put("/transfers/:id", async (request) =>
    serviceFor(request).update(
      parse(paramsSchema, request.params).id,
      parse(transferInputSchema, request.body)
    )
  );
  app.patch("/transfers/:id/metadata", async (request) =>
    serviceFor(request).updateMetadata(
      parse(paramsSchema, request.params).id,
      parse(metadataSchema, request.body).description
    )
  );
  app.delete("/transfers/:id", async (request, reply) => {
    await serviceFor(request).remove(parse(paramsSchema, request.params).id);
    return reply.code(204).send();
  });
}
