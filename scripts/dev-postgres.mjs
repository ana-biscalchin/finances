import { execFileSync, spawn } from "node:child_process";
import process from "node:process";

import { resolveLocalDatabaseUrl } from "./dev-postgres-config.mjs";

try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  console.warn(".env não encontrado; copie .env.example para .env antes de iniciar.");
}

const runtimeEnv = {
  ...process.env,
  DATABASE_DIALECT: "postgres",
  DATABASE_URL: resolveLocalDatabaseUrl(process.env),
  AUTH_ENABLED: "true",
  SEED_LOCAL_USER: "true"
};
execFileSync("docker", ["compose", "up", "-d", "--wait", "postgres"], {
  stdio: "inherit"
});
execFileSync("pnpm", ["db:migrate:postgres"], { stdio: "inherit", env: runtimeEnv });
execFileSync("pnpm", ["db:seed:postgres"], { stdio: "inherit", env: runtimeEnv });

const child = spawn("pnpm", ["dev:apps"], {
  stdio: "inherit",
  env: runtimeEnv
});

const forwardSignal = (signal) => child.kill(signal);
process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
