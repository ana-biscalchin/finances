import { paymentMethods, type createDatabaseConnection } from "@finances/database";
import { asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

export function registerPaymentMethodRoutes(app: FastifyInstance, connection: DatabaseConnection) {
  const { db } = connection;

  app.get("/payment-methods", async () =>
    db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.isActive, true))
      .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name))
      .all()
  );
}
