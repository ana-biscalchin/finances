import cors from "@fastify/cors";
import { createDatabaseConnection } from "@finances/database";
import Fastify from "fastify";
import { pathToFileURL } from "node:url";

import { registerAccountRoutes } from "./modules/accounts.js";
import { registerCategoryRoutes } from "./modules/categories.js";
import { registerCreditCardRoutes } from "./modules/credit-cards.js";
import { registerPaymentMethodRoutes } from "./modules/payment-methods.js";
import { registerTransactionRoutes } from "./modules/transactions.js";
import { registerBudgetRoutes } from "./modules/budgets.js";
import { registerReportRoutes } from "./modules/reports.js";


const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

type BuildServerOptions = {
  databasePath?: string;
  logger?: boolean;
  connection?: ReturnType<typeof createDatabaseConnection>;
};

export function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? true
  });
  const connection = options.connection ?? createDatabaseConnection(options.databasePath);

  app.addHook("onClose", async () => {
    connection.sqlite.close();
  });

  app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });

  app.get("/health", async () => ({
    ok: true,
    service: "finances-api"
  }));

  app.get("/meta", async () => ({
    name: "Financas Pessoais",
    version: "0.1.0",
    storage: "local-sqlite"
  }));

  registerAccountRoutes(app, connection);
  registerCategoryRoutes(app, connection);
  registerPaymentMethodRoutes(app, connection);
  registerTransactionRoutes(app, connection);
  registerCreditCardRoutes(app, connection);
  registerBudgetRoutes(app, connection);
  registerReportRoutes(app, connection);


  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const app = buildServer();

  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}
