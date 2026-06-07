import { createDatabaseConnection } from "./connection.js";
import { categoryGroups, categoryMacros, categoryMicros, paymentMethods } from "./schema.js";
import { categorySeeds, paymentMethodSeeds } from "./seed-data.js";
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

for (const [groupSortOrder, group] of categorySeeds.entries()) {
  db.insert(categoryGroups)
    .values({
      id: group.id,
      nature: group.nature,
      name: group.name,
      sortOrder: groupSortOrder
    })
    .onConflictDoUpdate({
      target: categoryGroups.id,
      set: {
        nature: group.nature,
        name: group.name,
        sortOrder: groupSortOrder,
        updatedAt: now
      }
    })
    .run();

  for (const [macroSortOrder, macro] of group.macros.entries()) {
    const macroId = `${group.id}-macro-${slugify(macro.name)}`;

    db.insert(categoryMacros)
      .values({
        id: macroId,
        groupId: group.id,
        name: macro.name,
        sortOrder: macroSortOrder
      })
      .onConflictDoUpdate({
        target: categoryMacros.id,
        set: {
          groupId: group.id,
          name: macro.name,
          sortOrder: macroSortOrder,
          updatedAt: now
        }
      })
      .run();

    for (const [microSortOrder, microName] of macro.micros.entries()) {
      const micro = typeof microName === "string" ? { name: microName } : microName;

      db.insert(categoryMicros)
        .values({
          id: "id" in micro ? micro.id : `${macroId}-micro-${slugify(micro.name)}`,
          macroId,
          name: micro.name,
          sortOrder: microSortOrder
        })
        .onConflictDoUpdate({
          target: categoryMicros.id,
          set: {
            macroId,
            name: micro.name,
            sortOrder: microSortOrder,
            updatedAt: now
          }
        })
        .run();
    }
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
