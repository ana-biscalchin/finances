import { createPostgresDatabaseConnection } from "./connection.js";
import { resolveLocalUserSeed } from "./local-user-seed.js";
import {
  accountPaymentMethods,
  accounts,
  categories,
  creditCards,
  paymentMethods,
  subcategories,
  users
} from "./schema.pg.js";
import { paymentMethodSeeds } from "./seed-data.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL é obrigatória para seed PostgreSQL.");

const connection = createPostgresDatabaseConnection({
  url: databaseUrl,
  poolMax: 2,
  connectTimeoutSeconds: 10
});

try {
  const localUser = resolveLocalUserSeed(process.env);
  if (localUser) {
    await connection.db
      .insert(users)
      .values({
        id: localUser.id,
        username: localUser.username,
        passwordHash: localUser.passwordHash,
        role: localUser.role,
        isActive: localUser.isActive,
        passwordChangedAt: localUser.passwordChangedAt
      })
      .onConflictDoNothing()
      .execute();
  }

  for (const [sortOrder, method] of paymentMethodSeeds.entries()) {
    await connection.db
      .insert(paymentMethods)
      .values({ ...method, sortOrder, isDefault: true, isActive: true })
      .onConflictDoNothing()
      .execute();
  }

  if (localUser) {
    for (const account of localUser.accounts) {
      await connection.db
        .insert(accounts)
        .values({ ...account, ownerId: localUser.id })
        .onConflictDoNothing()
        .execute();
    }

    for (const association of localUser.accountPaymentMethods) {
      await connection.db
        .insert(accountPaymentMethods)
        .values(association)
        .onConflictDoNothing()
        .execute();
    }

    for (const card of localUser.creditCards) {
      await connection.db
        .insert(creditCards)
        .values({ ...card, ownerId: localUser.id })
        .onConflictDoNothing()
        .execute();
    }

    for (const [categorySortOrder, category] of localUser.categories.entries()) {
      await connection.db
        .insert(categories)
        .values({
          id: category.id,
          ownerId: localUser.id,
          nature: category.nature,
          name: category.name,
          color: category.color,
          sortOrder: categorySortOrder
        })
        .onConflictDoNothing()
        .execute();

      for (const [subcategorySortOrder, subcategory] of category.subcategories.entries()) {
        await connection.db
          .insert(subcategories)
          .values({
            id:
              "id" in subcategory
                ? subcategory.id
                : `${category.id}-sub-${slugify(subcategory.name)}`,
            categoryId: category.id,
            name: subcategory.name,
            behavior: subcategory.behavior,
            sortOrder: subcategorySortOrder
          })
          .onConflictDoNothing()
          .execute();
      }
    }
  }

  console.log(
    `Seed PostgreSQL concluído: ${paymentMethodSeeds.length} meios de pagamento${localUser ? ", usuário e dados locais" : ""}.`
  );
} finally {
  await connection.close();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
