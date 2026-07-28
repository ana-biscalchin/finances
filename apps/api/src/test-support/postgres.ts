import {
  createPostgresDatabaseConnection,
  users,
  type PostgresDatabaseConnection
} from "@finances/database";
import { eq, sql } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
export const postgresTestsEnabled = process.env.DATABASE_DIALECT === "postgres" && Boolean(databaseUrl);

export function requirePostgresTestUrl() {
  if (!databaseUrl) throw new Error("DATABASE_URL é obrigatória para os testes PostgreSQL.");
  return databaseUrl;
}

export function createPostgresTestConnection(): PostgresDatabaseConnection {
  return createPostgresDatabaseConnection({
    url: requirePostgresTestUrl(),
    poolMax: 2,
    connectTimeoutSeconds: 10
  });
}

/** Keep suites deterministic when they share the ephemeral CI database. */
export async function resetPostgresTestDatabase(connection: PostgresDatabaseConnection) {
  const postgresDb = connection.db as unknown as { execute(query: unknown): Promise<unknown> };
  await postgresDb.execute(sql.raw(`TRUNCATE TABLE
    sessions, reserve_movements, reserve_goals, installments, installment_purchases,
    credit_card_bill_payments, planned_expenses, transactions, recurrence_rules,
    account_transfers, credit_card_bills, credit_cards, account_payment_methods,
    payment_methods, accounts, subcategories, categories, settings, users
    RESTART IDENTITY CASCADE`));
}

export async function seedPostgresTestOwner(
  connection: PostgresDatabaseConnection,
  ownerId: string,
  username = ownerId
) {
  await resetPostgresTestDatabase(connection);
  await connection.db
    .insert(users)
    .values({
      id: ownerId,
      username,
      passwordHash: "argon2id-test-only",
      passwordChangedAt: new Date().toISOString()
    })
    .onConflictDoNothing();
}

export async function removePostgresTestOwner(
  connection: PostgresDatabaseConnection,
  ownerId: string
) {
  await connection.db.delete(users).where(eq(users.id, ownerId));
}
