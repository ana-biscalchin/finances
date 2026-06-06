import cors from "@fastify/cors";
import Fastify from "fastify";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

export function buildServer() {
  const app = Fastify({
    logger: true
  });

  app.register(cors, {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"]
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

  return app;
}

const app = buildServer();

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
