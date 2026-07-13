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
import { registerReconciliationRoutes } from "./modules/reconciliation.js";
import { registerBackupRoutes } from "./modules/backups.js";
import { registerSettingsRoutes } from "./modules/settings.js";
import { registerTransferRoutes } from "./modules/transfers.js";
import { registerRecurrenceRoutes } from "./modules/recurrences.js";
import { registerMonthlyOverviewRoutes } from "./modules/monthly-overview.js";
import { registerSimpleImportRoutes } from "./modules/simple-import.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

type BuildServerOptions = {
  databasePath?: string;
  logger?: boolean;
  connection?: ReturnType<typeof createDatabaseConnection>;
};

type ApiError = Error & { statusCode?: number };

function normalizeApiError(error: unknown): ApiError {
  return error instanceof Error ? error : new Error("Erro desconhecido.");
}

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

  app.setErrorHandler((error, request, reply) => {
    const apiError = normalizeApiError(error);
    const statusCode =
      typeof apiError.statusCode === "number" && apiError.statusCode >= 400
        ? apiError.statusCode
        : 500;
    const message =
      statusCode >= 500
        ? "Erro interno na API. Verifique os logs do servidor."
        : apiError.message || "Requisição inválida.";

    if (statusCode >= 500) {
      request.log.error({ err: apiError }, "Erro inesperado na API");
    } else {
      request.log.warn({ err: apiError }, "Requisição rejeitada pela API");
    }

    reply.code(statusCode).send({ message });
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
  registerReconciliationRoutes(app, connection);
  registerBackupRoutes(app, connection);
  registerSettingsRoutes(app, connection);
  registerTransferRoutes(app, connection);
  registerRecurrenceRoutes(app, connection);
  registerMonthlyOverviewRoutes(app, connection);
  registerSimpleImportRoutes(app, connection);

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
