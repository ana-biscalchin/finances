import { spawn } from "node:child_process";
import process from "node:process";

try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  console.warn(".env não encontrado; copie .env.example para .env antes de iniciar.");
}

const child = spawn("pnpm", ["dev"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_DIALECT: "postgres", AUTH_ENABLED: "true" }
});

const forwardSignal = (signal) => child.kill(signal);
process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
