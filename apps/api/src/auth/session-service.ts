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

  async function createSession(userId: string) {
    const token = randomBytes(32).toString("base64url");
    const current = now();
    await connection.db.insert(sessions).values({
      id: randomUUID(),
      userId,
      tokenHash: tokenHash(token),
      expiresAt: new Date(current.getTime() + config.absoluteTtlSeconds * 1000).toISOString(),
      lastSeenAt: current.toISOString()
    });
    return token;
  }

  const dummyPasswordHash =
    "$argon2id$v=19$m=19456,t=2,p=1$AmjJ6/o5886RCds10TpvzQ$o+6hQ/WP+IMOV9Tr90AEO+UXfH4osxGvTQyO/tTAwyg";

  async function authenticate(username: string, password: string) {
    const normalized = username.trim().toLocaleLowerCase("pt-BR");
    const user = (
      await connection.db.select().from(users).where(eq(users.username, normalized)).limit(1)
    )[0];
    const passwordMatches = await verifyPassword(user?.passwordHash ?? dummyPasswordHash, password);
    if (!user || !user.isActive || !passwordMatches) return null;
    return {
      user: { id: user.id, username: user.username, role: "owner" as const },
      token: await createSession(user.id)
    };
  }

  async function resolve(token: string | undefined): Promise<AuthenticatedUser | null> {
    if (!token) return null;
    const current = now();
    const row = (
      await connection.db
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
        .limit(1)
    )[0];
    if (!row) return null;
    if (
      current.getTime() - new Date(row.session.lastSeenAt).getTime() >
      config.idleTtlSeconds * 1000
    ) {
      await connection.db
        .update(sessions)
        .set({ revokedAt: current.toISOString(), updatedAt: current.toISOString() })
        .where(eq(sessions.id, row.session.id));
      return null;
    }
    await connection.db
      .update(sessions)
      .set({ lastSeenAt: current.toISOString(), updatedAt: current.toISOString() })
      .where(eq(sessions.id, row.session.id));
    return { id: row.user.id, username: row.user.username, role: "owner" };
  }

  async function revoke(token: string | undefined) {
    if (!token) return;
    const current = now().toISOString();
    await connection.db
      .update(sessions)
      .set({ revokedAt: current, updatedAt: current })
      .where(and(eq(sessions.tokenHash, tokenHash(token)), isNull(sessions.revokedAt)));
  }

  async function changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = (await connection.db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) return null;
    const current = now().toISOString();
    const passwordHash = await hashPassword(newPassword);
    await connection.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, passwordChangedAt: current, updatedAt: current })
        .where(eq(users.id, userId));
      await tx
        .update(sessions)
        .set({ revokedAt: current, updatedAt: current })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    });
    return await createSession(userId);
  }

  return { authenticate, changePassword, createSession, resolve, revoke };
}
export type SessionService = ReturnType<typeof createSessionService>;
