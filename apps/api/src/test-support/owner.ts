import { users, type createDatabaseConnection } from "@finances/database";

export const TEST_OWNER_ID = "test-owner";
export const TEST_OWNER_USERNAME = "test-owner";

export function seedTestOwner(connection: ReturnType<typeof createDatabaseConnection>) {
  connection.db
    .insert(users)
    .values({
      id: TEST_OWNER_ID,
      username: TEST_OWNER_USERNAME,
      passwordHash: "argon2id-test-only",
      passwordChangedAt: new Date().toISOString()
    })
    .onConflictDoNothing()
    .run();
}
