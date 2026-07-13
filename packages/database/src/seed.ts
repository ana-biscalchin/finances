import { createDatabaseConnection } from "./connection.js";
import { accountPaymentMethods, accounts, categories, subcategories, paymentMethods } from "./schema.js";
import { accountPaymentMethodSeeds, accountSeeds, categorySeeds, paymentMethodSeeds } from "./seed-data.js";
import { notInArray } from "drizzle-orm";

const { db, sqlite } = createDatabaseConnection();
const now = new Date().toISOString();
const activePaymentMethodIds = paymentMethodSeeds.map((paymentMethod) => paymentMethod.id);

for (const [sortOrder, paymentMethod] of paymentMethodSeeds.entries()) {
  db.insert(paymentMethods)
    .values({
      ...paymentMethod,
      sortOrder,
      isDefault: true
    })
    .onConflictDoUpdate({
      target: paymentMethods.id,
      set: {
        name: paymentMethod.name,
        kind: paymentMethod.kind,
        sortOrder,
        isDefault: true,
        isActive: true,
        updatedAt: now
      }
    })
    .run();
}

db.update(paymentMethods)
  .set({
    isActive: false,
    isDefault: false,
    updatedAt: now
  })
  .where(notInArray(paymentMethods.id, activePaymentMethodIds))
  .run();

for (const account of accountSeeds) {
  db.insert(accounts).values({ ...account, initialBalanceCents: 0 }).onConflictDoUpdate({
    target: accounts.id,
    set: { ...account, isActive: true, updatedAt: now }
  }).run();
}

for (const association of accountPaymentMethodSeeds) {
  db.insert(accountPaymentMethods).values(association).onConflictDoUpdate({
    target: accountPaymentMethods.id,
    set: { ...association, isActive: true, archivedAt: null, updatedAt: now }
  }).run();
}

for (const [categorySortOrder, category] of categorySeeds.entries()) {
  db.insert(categories)
    .values({
      id: category.id,
      nature: category.nature,
      name: category.name,
      sortOrder: categorySortOrder
    })
    .onConflictDoUpdate({
      target: categories.id,
      set: {
        nature: category.nature,
        name: category.name,
        sortOrder: categorySortOrder,
        updatedAt: now
      }
    })
    .run();

  for (const [subSortOrder, sub] of category.subcategories.entries()) {
    const subcategory = typeof sub === "string" ? { name: sub, behavior: "variable" } : sub;

    db.insert(subcategories)
      .values({
        id: "id" in subcategory ? subcategory.id : `${category.id}-sub-${slugify(subcategory.name)}`,
        categoryId: category.id,
        name: subcategory.name,
        behavior: subcategory.behavior,
        sortOrder: subSortOrder
      })
      .onConflictDoUpdate({
        target: subcategories.id,
        set: {
          categoryId: category.id,
          name: subcategory.name,
          behavior: subcategory.behavior,
          sortOrder: subSortOrder,
          updatedAt: now
        }
      })
      .run();
  }
}

sqlite.close();

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
