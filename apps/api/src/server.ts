import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import { createDatabaseConnection } from "@finances/database";
import Fastify, { type FastifyInstance } from "fastify";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createDatabaseProbe, type DatabaseProbe } from "./config/database-probe.js";
import { loadConfig, redactConfigError, type ApiConfig } from "./config/environment.js";

import { registerAccountRoutes } from "./modules/accounts.js";
import { registerCategoryRoutes } from "./modules/categories.js";
import { registerCreditCardRoutes } from "./modules/credit-cards.js";
import { registerPaymentMethodRoutes } from "./modules/payment-methods.js";
import { registerTransactionRoutes } from "./modules/transactions.js";
import { registerReportRoutes } from "./modules/reports.js";
import { registerBackupRoutes } from "./modules/backups.js";
import { registerSettingsRoutes } from "./modules/settings.js";
import { registerTransferRoutes } from "./modules/transfers.js";
import { registerRecurrenceRoutes } from "./modules/recurrences.js";
import { registerMonthlyOverviewRoutes } from "./modules/monthly-overview.js";
import { registerSimpleImportRoutes } from "./modules/simple-import.js";
import { registerPlannedExpenseRoutes } from "./modules/planned-expenses.js";

type BuildServerOptions = {
  databasePath?: string;
  logger?: boolean;
  connection?: ReturnType<typeof createDatabaseConnection>;
  config?: ApiConfig;
  databaseProbe?: DatabaseProbe;
};

type ApiError = Error & { statusCode?: number };

function normalizeApiError(error: unknown): ApiError {
  return error instanceof Error ? error : new Error("Erro desconhecido.");
}

export function buildServer(options: BuildServerOptions = {}) {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: config.logLevel,
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "req.body.password",
                "req.body.currentPassword",
                "req.body.newPassword"
              ],
              censor: "[REDACTED]"
            }
          },
    bodyLimit: 1_048_576,
    trustProxy: config.trustProxy,
    requestIdHeader: "x-request-id"
  });
  const connection =
    options.connection ??
    createDatabaseConnection(
      options.databasePath ??
        (config.database.dialect === "sqlite"
          ? config.database.path
          : (process.env.PROOF_DATABASE_PATH ?? "/tmp/finances-proof.sqlite"))
    );
  const databaseProbe = options.databaseProbe ?? createDatabaseProbe(config);

  app.addHook("onClose", async () => {
    await databaseProbe.close();
    connection.sqlite.close();
  });

  app.register(cors, {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const allowed = new Set([
        ...(config.publicUrl ? [config.publicUrl] : []),
        ...config.corsOrigins
      ]);
      callback(null, allowed.has(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
  app.register(helmet, { contentSecurityPolicy: false });

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

  app.get("/health", async () => ({ status: "OK", service: "finances-api" }));
  app.get("/health/live", async () => ({ status: "OK" }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await databaseProbe.check();
      return { status: "OK" };
    } catch {
      return reply.code(503).send({ status: "UNAVAILABLE" });
    }
  });

  app.get("/meta", async () => ({
    name: "Carteira da Ana",
    version: "0.1.0",
    storage: "local-sqlite"
  }));

  const registerBusinessRoutes = async (routesApp: FastifyInstance) => {
    registerAccountRoutes(routesApp, connection);
    registerCategoryRoutes(routesApp, connection);
    registerPaymentMethodRoutes(routesApp, connection);
    registerTransactionRoutes(routesApp, connection);
    registerCreditCardRoutes(routesApp, connection);
    registerReportRoutes(routesApp, connection);
    registerBackupRoutes(routesApp, connection);
    if (config.features.googleDrive) registerSettingsRoutes(routesApp, connection);
    registerTransferRoutes(routesApp, connection);
    registerRecurrenceRoutes(routesApp, connection);
    registerMonthlyOverviewRoutes(routesApp, connection);
    registerPlannedExpenseRoutes(routesApp, connection);
    registerSimpleImportRoutes(routesApp, connection);
  };
  app.register(registerBusinessRoutes, { prefix: "/api" });
  if (config.environment !== "production") app.register(registerBusinessRoutes);
  if (config.serveWeb) {
    const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const webRoot = resolve(workspaceRoot, "apps/web/dist");
    app.register(fastifyStatic, { root: webRoot, wildcard: false });
    app.setNotFoundHandler((request, reply) =>
      request.url.startsWith("/api/")
        ? reply.code(404).send({ message: "Recurso não encontrado." })
        : reply.sendFile("index.html")
    );
  }

  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const config = loadConfig();
    const app = buildServer({ config });
    await app.listen({ port: config.port, host: config.host });
  } catch (error) {
    console.error(redactConfigError(error));
    process.exit(1);
  }
}
