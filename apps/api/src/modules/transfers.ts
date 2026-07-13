import type { createDatabaseConnection } from "@finances/database";
import type { FastifyInstance } from "fastify";
import { createTransferService } from "../application/transfer-service.js";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

export function registerTransferRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const service = createTransferService(connection);

  app.post("/transfers", async (request, reply) =>
    reply.code(201).send(service.create(request.body))
  );

  app.put("/transfers/:id", async (request) => {
    const { id } = request.params as { id: string };
    return service.update(id, request.body);
  });

  app.patch("/transfers/:id/metadata", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { description?: unknown };
    return service.updateMetadata(id, typeof body.description === "string" ? body.description : "");
  });

  app.delete("/transfers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    service.remove(id);
    return reply.code(204).send();
  });
}
