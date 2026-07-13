import type { createDatabaseConnection } from "@finances/database";
import type { FastifyInstance } from "fastify";
import { createRecurrenceService } from "../application/recurrence-service.js";

type Connection = ReturnType<typeof createDatabaseConnection>;
export function registerRecurrenceRoutes(app: FastifyInstance, connection: Connection) {
  const service = createRecurrenceService(connection);
  app.get("/recurrences", async (request) => {
    const month = (request.query as { month?: string }).month;
    return month ? service.forecast(month) : service.list();
  });
  app.post("/recurrences", async (request, reply) => reply.code(201).send(service.create(request.body)));
  app.post("/recurrences/:id/pause", async (request) => service.pause((request.params as { id: string }).id));
  app.post("/recurrences/:id/resume", async (request) => service.resume((request.params as { id: string }).id));
  app.delete("/recurrences/:id", async (request) => service.end((request.params as { id: string }).id));
  app.post("/recurrences/:id/confirm-occurrence", async (request, reply) => {
    const month = (request.body as { month?: string }).month ?? "";
    return reply.code(201).send(service.confirm((request.params as { id: string }).id, month));
  });
  app.put("/recurrences/:id", async (request) => {
    const body = request.body as { effectiveMonth?: string; changes?: Record<string, unknown> };
    return service.changeFrom((request.params as { id: string }).id, body.effectiveMonth ?? "", body.changes ?? {});
  });
}
