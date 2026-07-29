import { execFileSync, spawn } from "node:child_process";
import process from "node:process";

try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  console.warn(".env não encontrado; copie .env.example para .env antes de iniciar.");
}

const runtimeEnv = { ...process.env, DATABASE_DIALECT: "postgres", AUTH_ENABLED: "true" };
execFileSync("pnpm", ["db:migrate:postgres"], { stdio: "inherit", env: runtimeEnv });
execFileSync("pnpm", ["db:seed:postgres"], { stdio: "inherit", env: runtimeEnv });

const child = spawn("pnpm", ["dev"], {
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
