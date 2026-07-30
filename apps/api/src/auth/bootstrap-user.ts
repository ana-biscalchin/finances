import {
  createDatabaseConnection,
  createPostgresDatabaseConnection,
  users
} from "@finances/database";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { hashPassword } from "./password.js";

async function readPasswordFromStdin() {
  if (process.stdin.isTTY) throw new Error("Forneça a senha pela entrada padrão segura.");
  let password = "";
  for await (const chunk of process.stdin) password += chunk;
  return password.replace(/\r?\n$/, "");
}
const username = process.env.BOOTSTRAP_USERNAME?.trim().toLocaleLowerCase("pt-BR");
if (!username) throw new Error("BOOTSTRAP_USERNAME é obrigatório.");
const databaseUrl = process.env.DATABASE_URL;
if (process.env.DATABASE_DIALECT === "postgres" && !databaseUrl)
  throw new Error("DATABASE_URL é obrigatória para bootstrap PostgreSQL.");
const connection =
  process.env.DATABASE_DIALECT === "postgres"
    ? createPostgresDatabaseConnection({
        url: databaseUrl!,
        poolMax: Number(process.env.DATABASE_POOL_MAX ?? 2),
        connectTimeoutSeconds: Number(process.env.DATABASE_CONNECT_TIMEOUT_SECONDS ?? 10)
      })
    : createDatabaseConnection();
try {
  const existing = (
    await connection.db.select().from(users).where(eq(users.username, username)).limit(1)
  )[0];
  if (existing) console.log("Usuária bootstrap já existe; nenhuma alteração foi feita.");
  else {
    const password = await readPasswordFromStdin();
    if (password.length < 12) throw new Error("A senha deve ter ao menos 12 caracteres.");
    await connection.db.insert(users).values({
      id: randomUUID(),
      username,
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date().toISOString()
    });
    console.log("Usuária bootstrap criada.");
  }
} finally {
  await connection.close();
}
