import {
  accountPaymentMethods,
  paymentMethods,
  type createDatabaseConnection
} from "@finances/database";
import type { AccountPaymentMethodInput } from "@finances/domain";
import { and, eq, inArray } from "drizzle-orm";
import { ValidationError } from "../../http.js";

type Connection = ReturnType<typeof createDatabaseConnection>;
type Transaction = Parameters<Parameters<Connection["transaction"]>[0]>[0];

export async function validateAccountPaymentMethods(
  connection: Connection,
  associations: AccountPaymentMethodInput[]
) {
  if (!associations.length) return;
  const ids = associations.map((item) => item.paymentMethodId);
  const activeIds = new Set(
    (await connection.db.select().from(paymentMethods).where(inArray(paymentMethods.id, ids)))
      .filter((item) => item.isActive)
      .map((item) => item.id)
  );
  if (ids.some((id) => !activeIds.has(id)))
    throw new ValidationError("Forma de pagamento ativa não encontrada.");
}

export async function replaceAccountPaymentMethods(
  tx: Transaction,
  accountId: string,
  associations: AccountPaymentMethodInput[],
  now: string
) {
  await tx
    .update(accountPaymentMethods)
    .set({ isActive: false, isDefault: false, archivedAt: now, updatedAt: now })
    .where(eq(accountPaymentMethods.accountId, accountId));
  for (const association of associations) {
    await tx
      .insert(accountPaymentMethods)
      .values({
        id: crypto.randomUUID(),
        accountId,
        paymentMethodId: association.paymentMethodId,
        isDefault: association.isDefault,
        isActive: true,
        archivedAt: null
      })
      .onConflictDoUpdate({
        target: [accountPaymentMethods.accountId, accountPaymentMethods.paymentMethodId],
        set: { isDefault: association.isDefault, isActive: true, archivedAt: null, updatedAt: now }
      });
  }
}

export async function listAccountPaymentMethods(
  connection: Connection,
  accountId: string,
  includeInactive = false
) {
  const methods = new Map(
    (await connection.db.select().from(paymentMethods)).map((item) => [item.id, item])
  );
  return (
    await connection.db
      .select()
      .from(accountPaymentMethods)
      .where(eq(accountPaymentMethods.accountId, accountId))
  )
    .filter((item) => includeInactive || item.isActive)
    .map((association) => ({ ...association, method: methods.get(association.paymentMethodId) }))
    .sort((left, right) => (left.method?.sortOrder ?? 0) - (right.method?.sortOrder ?? 0));
}

export async function getDefaultAccountPaymentMethodId(connection: Connection, accountId: string) {
  return (
    (
      await connection.db
        .select()
        .from(accountPaymentMethods)
        .where(eq(accountPaymentMethods.accountId, accountId))
    ).find((item) => item.isActive && item.isDefault)?.paymentMethodId ?? null
  );
}

export async function validateActiveAccountPaymentMethod(
  connection: Connection,
  accountId: string,
  paymentMethodId: string
) {
  const association = (
    await connection.db
      .select()
      .from(accountPaymentMethods)
      .where(
        and(
          eq(accountPaymentMethods.accountId, accountId),
          eq(accountPaymentMethods.paymentMethodId, paymentMethodId)
        )
      )
      .limit(1)
  )[0];
  if (!association?.isActive) {
    throw new ValidationError("A forma de pagamento não está ativa para esta conta.");
  }
}
