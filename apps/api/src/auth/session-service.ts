import { sessions, users, type createDatabaseConnection } from "@finances/database";
import { and, eq, gt, isNull } from "drizzle-orm";
import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { hashPassword, verifyPassword } from "./password.js";

type Connection = ReturnType<typeof createDatabaseConnection>;
export type AuthenticatedUser = { id: string; username: string; role: "owner" };
type SessionConfig = { secret: string; absoluteTtlSeconds: number; idleTtlSeconds: number };

export function createSessionService(
  connection: Connection,
  config: SessionConfig,
  now: () => Date = () => new Date()
) {
  const tokenHash = (token: string) =>
    createHmac("sha256", config.secret).update(token).digest("hex");

  function createSession(userId: string) {
    const token = randomBytes(32).toString("base64url");
    const current = now();
    connection.db
      .insert(sessions)
      .values({
        id: randomUUID(),
        userId,
        tokenHash: tokenHash(token),
        expiresAt: new Date(current.getTime() + config.absoluteTtlSeconds * 1000).toISOString(),
        lastSeenAt: current.toISOString()
      })
      .run();
    return token;
  }

  const dummyPasswordHash =
    "$argon2id$v=19$m=19456,t=2,p=1$AmjJ6/o5886RCds10TpvzQ$o+6hQ/WP+IMOV9Tr90AEO+UXfH4osxGvTQyO/tTAwyg";

  async function authenticate(username: string, password: string) {
    const normalized = username.trim().toLocaleLowerCase("pt-BR");
    const user = connection.db.select().from(users).where(eq(users.username, normalized)).get();
    const passwordMatches = await verifyPassword(user?.passwordHash ?? dummyPasswordHash, password);
    if (!user || !user.isActive || !passwordMatches) return null;
    return {
      user: { id: user.id, username: user.username, role: "owner" as const },
      token: createSession(user.id)
    };
  }

  function resolve(token: string | undefined): AuthenticatedUser | null {
    if (!token) return null;
    const current = now();
    const row = connection.db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash(token)),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, current.toISOString()),
          eq(users.isActive, true)
        )
      )
      .get();
    if (!row) return null;
    if (
      current.getTime() - new Date(row.session.lastSeenAt).getTime() >
      config.idleTtlSeconds * 1000
    ) {
      connection.db
        .update(sessions)
        .set({ revokedAt: current.toISOString(), updatedAt: current.toISOString() })
        .where(eq(sessions.id, row.session.id))
        .run();
      return null;
    }
    connection.db
      .update(sessions)
      .set({ lastSeenAt: current.toISOString(), updatedAt: current.toISOString() })
      .where(eq(sessions.id, row.session.id))
      .run();
    return { id: row.user.id, username: row.user.username, role: "owner" };
  }

  function revoke(token: string | undefined) {
    if (!token) return;
    const current = now().toISOString();
    connection.db
      .update(sessions)
      .set({ revokedAt: current, updatedAt: current })
      .where(and(eq(sessions.tokenHash, tokenHash(token)), isNull(sessions.revokedAt)))
      .run();
  }

  async function changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = connection.db.select().from(users).where(eq(users.id, userId)).get();
    if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) return null;
    const current = now().toISOString();
    const passwordHash = await hashPassword(newPassword);
    connection.db.transaction((tx) => {
      tx.update(users)
        .set({ passwordHash, passwordChangedAt: current, updatedAt: current })
        .where(eq(users.id, userId))
        .run();
      tx.update(sessions)
        .set({ revokedAt: current, updatedAt: current })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
        .run();
    });
    return createSession(userId);
  }

  return { authenticate, changePassword, createSession, resolve, revoke };
}
export type SessionService = ReturnType<typeof createSessionService>;
