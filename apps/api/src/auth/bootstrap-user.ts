import { createDatabaseConnection, users } from "@finances/database";
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
const connection = createDatabaseConnection();
try {
  const existing = connection.db.select().from(users).where(eq(users.username, username)).get();
  if (existing) console.log("Usuária bootstrap já existe; nenhuma alteração foi feita.");
  else {
    const password = await readPasswordFromStdin();
    if (password.length < 12) throw new Error("A senha deve ter ao menos 12 caracteres.");
    connection.db
      .insert(users)
      .values({
        id: randomUUID(),
        username,
        passwordHash: await hashPassword(password),
        passwordChangedAt: new Date().toISOString()
      })
      .run();
    console.log("Usuária bootstrap criada.");
  }
} finally {
  connection.sqlite.close();
}
