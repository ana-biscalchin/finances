import type { createDatabaseConnection } from "@finances/database";
import type { FastifyInstance } from "fastify";

import { requestContextFrom } from "../application/request-context.js";
import { createMonthlyIncomePlanService } from "./monthly-income-plans/application/service.js";

type Connection = ReturnType<typeof createDatabaseConnection>;

export function registerMonthlyIncomePlanRoutes(app: FastifyInstance, connection: Connection) {
  app.put("/monthly-income-plans", async (request) =>
    createMonthlyIncomePlanService(connection, requestContextFrom(request).ownerId).replace(
      request.body
    )
  );
}
