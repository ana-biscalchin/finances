import { createPostgresDatabaseConnection } from "./connection.js";
import { paymentMethods } from "./schema.pg.js";
import { paymentMethodSeeds } from "./seed-data.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL é obrigatória para seed PostgreSQL.");

const connection = createPostgresDatabaseConnection({
  url: databaseUrl,
  poolMax: 2,
  connectTimeoutSeconds: 10
});

try {
  for (const [sortOrder, method] of paymentMethodSeeds.entries()) {
    await connection.db
      .insert(paymentMethods)
      .values({ ...method, sortOrder, isDefault: true, isActive: true })
      .onConflictDoNothing()
      .execute();
  }
  console.log(`Seed PostgreSQL concluído: ${paymentMethodSeeds.length} meios de pagamento.`);
} finally {
  await connection.close();
}
