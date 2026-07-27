import { describe, expect, it } from "vitest";

import { loadConfig, redactConfigError } from "./environment.js";

const production = {
  NODE_ENV: "production",
  PUBLIC_URL: "https://finances.example.com",
  DATABASE_DIALECT: "postgres",
  DATABASE_URL: "postgresql://user:top-secret@example.com/db?sslmode=require",
  SESSION_SECRET: "a-secret-with-at-least-thirty-two-characters",
  FEATURE_GOOGLE_DRIVE: "false"
};

describe("environment configuration", () => {
  it("keeps explicit local defaults for development and test", () => {
    expect(loadConfig({ NODE_ENV: "development" }).database).toEqual({
      dialect: "sqlite",
      path: "data/financas.sqlite"
    });
    expect(loadConfig({ NODE_ENV: "test" }).serveWeb).toBe(false);
  });

  it("loads a valid production configuration", () => {
    const config = loadConfig(production);
    expect(config.environment).toBe("production");
    expect(config.database.dialect).toBe("postgres");
    expect(config.trustProxy).toBe(true);
    expect(config.features.googleDrive).toBe(false);
    expect(config.auth.enabled).toBe(true);
  });

  it.each([
    [{ ...production, PUBLIC_URL: undefined }, "PUBLIC_URL"],
    [{ ...production, PUBLIC_URL: "http://localhost:3000" }, "PUBLIC_URL"],
    [{ ...production, DATABASE_DIALECT: "sqlite" }, "PostgreSQL"],
    [{ ...production, DATABASE_URL: undefined }, "PostgreSQL"],
    [{ ...production, SESSION_SECRET: "short" }, "SESSION_SECRET"],
    [{ ...production, AUTH_ENABLED: "false" }, "autenticação"],
    [{ ...production, CORS_ORIGINS: "http://localhost:5173" }, "localhost"],
    [{ ...production, GOOGLE_CLIENT_SECRET: "must-never-appear" }, "Google Drive"]
  ])("fails fast for unsafe production input", (source, message) => {
    expect(() => loadConfig(source)).toThrow(message);
  });

  it("never includes secret values in validation errors", () => {
    const secret = "postgresql://ana:do-not-log-this@example.com/db";
    let message = "";
    try {
      loadConfig({ ...production, DATABASE_URL: secret, SESSION_SECRET: "short" });
    } catch (error) {
      message = redactConfigError(error);
    }
    expect(message).not.toContain(secret);
    expect(message).not.toContain("do-not-log-this");
  });

  it("rejects malformed booleans without echoing the value", () => {
    expect(() => loadConfig({ FEATURE_GOOGLE_DRIVE: "secret-ish-value" })).toThrow(
      "Configuração booleana inválida"
    );
  });
});
