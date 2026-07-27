import { z } from "zod";

export type AppEnvironment = "development" | "test" | "production";

export type ApiConfig = {
  environment: AppEnvironment;
  host: string;
  port: number;
  publicUrl?: string;
  corsOrigins: string[];
  database:
    | { dialect: "sqlite"; path: string }
    | { dialect: "postgres"; url: string; poolMax: number; connectTimeoutSeconds: number };
  sessionSecret?: string;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  trustProxy: boolean;
  serveWeb: boolean;
  features: {
    googleDrive: boolean;
  };
};

const localhostPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
const forbiddenGoogleKeys = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "GOOGLE_DRIVE_FOLDER_ID"
] as const;

const rawSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  PUBLIC_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().optional(),
  DATABASE_DIALECT: z.enum(["sqlite", "postgres"]).default("sqlite"),
  DATABASE_PATH: z.string().min(1).default("data/financas.sqlite"),
  DATABASE_URL: z.string().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
  DATABASE_CONNECT_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(60).default(10),
  SESSION_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  TRUST_PROXY: z.string().optional(),
  SERVE_WEB: z.string().optional(),
  FEATURE_GOOGLE_DRIVE: z.string().optional()
});

function booleanValue(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("Configuração booleana inválida.");
}

function parseOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin);
}

function configError(message: string): Error {
  return new Error(`Configuração inválida: ${message}`);
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = rawSchema.safeParse(source);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path[0]).filter(Boolean))];
    throw configError(`revise ${fields.join(", ") || "as variáveis de ambiente"}.`);
  }

  const raw = parsed.data;
  const production = raw.NODE_ENV === "production";
  const publicUrl = raw.PUBLIC_URL ? new URL(raw.PUBLIC_URL).origin : undefined;
  const corsOrigins = parseOrigins(raw.CORS_ORIGINS);
  const googleDrive = booleanValue(raw.FEATURE_GOOGLE_DRIVE, !production);

  if (production) {
    if (!publicUrl || localhostPattern.test(publicUrl)) {
      throw configError("PUBLIC_URL deve ser uma origem HTTPS pública.");
    }
    if (!publicUrl.startsWith("https://")) {
      throw configError("PUBLIC_URL deve usar HTTPS.");
    }
    if (raw.DATABASE_DIALECT !== "postgres" || !raw.DATABASE_URL) {
      throw configError("a conexão PostgreSQL hospedada é obrigatória em produção.");
    }
    if (
      !raw.DATABASE_URL.startsWith("postgresql://") &&
      !raw.DATABASE_URL.startsWith("postgres://")
    ) {
      throw configError("DATABASE_URL deve usar PostgreSQL.");
    }
    if (!raw.SESSION_SECRET || raw.SESSION_SECRET.length < 32) {
      throw configError("SESSION_SECRET deve ter pelo menos 32 caracteres.");
    }
    if (googleDrive || forbiddenGoogleKeys.some((key) => Boolean(source[key]))) {
      throw configError("Google Drive não é permitido no release online.");
    }
    if (corsOrigins.some((origin) => localhostPattern.test(origin))) {
      throw configError("CORS_ORIGINS não pode conter localhost em produção.");
    }
  }

  return {
    environment: raw.NODE_ENV,
    host: raw.HOST,
    port: raw.PORT,
    publicUrl,
    corsOrigins,
    database:
      raw.DATABASE_DIALECT === "postgres" && raw.DATABASE_URL
        ? {
            dialect: "postgres",
            url: raw.DATABASE_URL,
            poolMax: raw.DATABASE_POOL_MAX,
            connectTimeoutSeconds: raw.DATABASE_CONNECT_TIMEOUT_SECONDS
          }
        : { dialect: "sqlite", path: raw.DATABASE_PATH },
    sessionSecret: raw.SESSION_SECRET,
    logLevel: raw.LOG_LEVEL,
    trustProxy: booleanValue(raw.TRUST_PROXY, production),
    serveWeb: booleanValue(raw.SERVE_WEB, production),
    features: { googleDrive }
  };
}

export function redactConfigError(error: unknown): string {
  return error instanceof Error ? error.message : "Configuração inválida.";
}
