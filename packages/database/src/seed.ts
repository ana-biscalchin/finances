import { createDatabaseConnection } from "./connection.js";
import { categoryGroups, categoryMacros, categoryMicros, paymentMethods } from "./schema.js";
import { categorySeeds, paymentMethodSeeds } from "./seed-data.js";

const { db, sqlite } = createDatabaseConnection();

for (const [sortOrder, paymentMethod] of paymentMethodSeeds.entries()) {
  db.insert(paymentMethods)
    .values({
      ...paymentMethod,
      sortOrder,
      isDefault: true
    })
    .onConflictDoNothing()
    .run();
}

for (const [groupSortOrder, group] of categorySeeds.entries()) {
  db.insert(categoryGroups)
    .values({
      id: group.id,
      nature: group.nature,
      name: group.name,
      sortOrder: groupSortOrder
    })
    .onConflictDoNothing()
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
      .onConflictDoNothing()
      .run();

    for (const [microSortOrder, microName] of macro.micros.entries()) {
      db.insert(categoryMicros)
        .values({
          id: `${macroId}-micro-${slugify(microName)}`,
          macroId,
          name: microName,
          sortOrder: microSortOrder
        })
        .onConflictDoNothing()
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
