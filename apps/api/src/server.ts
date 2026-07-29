import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import {
  createDatabaseConnection,
  createPostgresDatabaseConnection,
  type PostgresDatabaseConnection
} from "@finances/database";
import Fastify, { type FastifyInstance } from "fastify";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { type DatabaseProbe } from "./config/database-probe.js";
import { createSessionService } from "./auth/session-service.js";
import { isTrustedMutationOrigin, registerSessionRoutes } from "./auth/routes.js";
import { loadConfig, redactConfigError, type ApiConfig } from "./config/environment.js";

import { registerAccountRoutes } from "./modules/accounts.js";
import { registerCategoryRoutes } from "./modules/categories.js";
import { registerCreditCardRoutes } from "./modules/credit-cards.js";
import { registerPaymentMethodRoutes } from "./modules/payment-methods.js";
import { registerTransactionRoutes } from "./modules/transactions.js";
import { registerReportRoutes } from "./modules/reports.js";
import { registerBackupRoutes } from "./modules/backups.js";
import { registerExportRoutes } from "./modules/exports.js";
import { registerSettingsRoutes } from "./modules/settings.js";
import { registerTransferRoutes } from "./modules/transfers.js";
import { registerRecurrenceRoutes } from "./modules/recurrences.js";
import { registerMonthlyOverviewRoutes } from "./modules/monthly-overview.js";
import { registerSimpleImportRoutes } from "./modules/simple-import.js";
import { registerPlannedExpenseRoutes } from "./modules/planned-expenses.js";

type BuildServerOptions = {
  databasePath?: string;
  logger?: boolean;
  connection?: ReturnType<typeof createDatabaseConnection> | PostgresDatabaseConnection;
  config?: ApiConfig;
  databaseProbe?: DatabaseProbe;
  testOwnerId?: string;
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
                "req.body.newPassword",
                "req.body.csvContent",
                "req.body.transactions",
                "res.headers.set-cookie"
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
    (config.database.dialect === "postgres"
      ? createPostgresDatabaseConnection({
          url: config.database.url,
          poolMax: config.database.poolMax,
          connectTimeoutSeconds: config.database.connectTimeoutSeconds
        })
      : createDatabaseConnection(options.databasePath ?? config.database.path));
  const databaseProbe = options.databaseProbe ?? connection;
  const applicationConnection = connection as ReturnType<typeof createDatabaseConnection>;

  app.addHook("onClose", async () => {
    if (options.databaseProbe) await options.databaseProbe.close();
    await connection.close();
  });

  app.register(cookie);
  app.register(rateLimit, { global: false });
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
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"]
      }
    }
  });

  app.setErrorHandler(async (error, request, reply) => {
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
    storage: connection.dialect
  }));

  const sessionService = config.auth.enabled
    ? createSessionService(applicationConnection, {
        secret: config.sessionSecret!,
        absoluteTtlSeconds: config.auth.absoluteTtlSeconds,
        idleTtlSeconds: config.auth.idleTtlSeconds
      })
    : undefined;
  if (sessionService) {
    app.register(async (authApp) => registerSessionRoutes(authApp, sessionService, config), {
      prefix: "/api"
    });
  }

  const registerBusinessRoutes = (routesApp: FastifyInstance) => {
    if (!sessionService && config.environment === "test" && options.testOwnerId) {
      routesApp.addHook("onRequest", async (request) => {
        request.requestContext = {
          ownerId: options.testOwnerId!,
          userId: options.testOwnerId!,
          requestId: request.id
        };
      });
    }
    if (sessionService) {
      routesApp.addHook("onRequest", async (request, reply) => {
        if (!isTrustedMutationOrigin(request, config))
          return reply.code(403).send({ message: "Origem não permitida." });
        const user = await sessionService.resolve(request.cookies[config.auth.cookieName]);
        if (!user) return reply.code(401).send({ message: "Autenticação necessária." });
        request.authenticatedUser = user;
        request.requestContext = {
          ownerId: user.id,
          userId: user.id,
          requestId: request.id
        };
      });
    }
    registerAccountRoutes(routesApp, applicationConnection);
    registerCategoryRoutes(routesApp, applicationConnection);
    registerPaymentMethodRoutes(routesApp, applicationConnection);
    registerTransactionRoutes(routesApp, applicationConnection);
    registerCreditCardRoutes(routesApp, applicationConnection);
    registerReportRoutes(routesApp, applicationConnection);
    registerExportRoutes(routesApp, applicationConnection);
    if (connection.dialect === "sqlite") registerBackupRoutes(routesApp, connection);
    if (config.features.googleDrive) registerSettingsRoutes(routesApp, applicationConnection);
    registerTransferRoutes(routesApp, applicationConnection);
    registerRecurrenceRoutes(routesApp, applicationConnection);
    registerMonthlyOverviewRoutes(routesApp, applicationConnection);
    registerPlannedExpenseRoutes(routesApp, applicationConnection);
    registerSimpleImportRoutes(routesApp, applicationConnection);
  };
  app.register(registerBusinessRoutes, { prefix: "/api" });
  if (config.environment !== "production") app.register(registerBusinessRoutes);
  if (config.serveWeb) {
    const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const webRoot = resolve(workspaceRoot, "apps/web/dist");
    app.register(fastifyStatic, { root: webRoot, wildcard: false });
    app.setNotFoundHandler(async (request, reply) =>
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
