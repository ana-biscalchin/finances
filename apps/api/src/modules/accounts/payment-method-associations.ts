import {
  accountPaymentMethods,
  paymentMethods,
  type createDatabaseConnection
} from "@finances/database";
import type { AccountPaymentMethodInput } from "@finances/domain";
import { and, eq, inArray } from "drizzle-orm";
import { ValidationError } from "../../http.js";

type Connection = ReturnType<typeof createDatabaseConnection>;
type Transaction = Parameters<Parameters<Connection["db"]["transaction"]>[0]>[0];

export function validateAccountPaymentMethods(
  connection: Connection,
  associations: AccountPaymentMethodInput[]
) {
  if (!associations.length) return;
  const ids = associations.map((item) => item.paymentMethodId);
  const activeIds = new Set(
    connection.db
      .select()
      .from(paymentMethods)
      .where(inArray(paymentMethods.id, ids))
      .all()
      .filter((item) => item.isActive)
      .map((item) => item.id)
  );
  if (ids.some((id) => !activeIds.has(id)))
    throw new ValidationError("Forma de pagamento ativa não encontrada.");
}

export function replaceAccountPaymentMethods(
  tx: Transaction,
  accountId: string,
  associations: AccountPaymentMethodInput[],
  now: string
) {
  tx.update(accountPaymentMethods)
    .set({ isActive: false, isDefault: false, archivedAt: now, updatedAt: now })
    .where(eq(accountPaymentMethods.accountId, accountId))
    .run();
  for (const association of associations) {
    tx.insert(accountPaymentMethods)
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
      })
      .run();
  }
}

export function listAccountPaymentMethods(
  connection: Connection,
  accountId: string,
  includeInactive = false
) {
  const methods = new Map(
    connection.db
      .select()
      .from(paymentMethods)
      .all()
      .map((item) => [item.id, item])
  );
  return connection.db
    .select()
    .from(accountPaymentMethods)
    .where(eq(accountPaymentMethods.accountId, accountId))
    .all()
    .filter((item) => includeInactive || item.isActive)
    .map((association) => ({ ...association, method: methods.get(association.paymentMethodId) }))
    .sort((left, right) => (left.method?.sortOrder ?? 0) - (right.method?.sortOrder ?? 0));
}

export function getDefaultAccountPaymentMethodId(connection: Connection, accountId: string) {
  return (
    connection.db
      .select()
      .from(accountPaymentMethods)
      .where(eq(accountPaymentMethods.accountId, accountId))
      .all()
      .find((item) => item.isActive && item.isDefault)?.paymentMethodId ?? null
  );
}

export function validateActiveAccountPaymentMethod(
  connection: Connection,
  accountId: string,
  paymentMethodId: string
) {
  const association = connection.db
    .select()
    .from(accountPaymentMethods)
    .where(
      and(
        eq(accountPaymentMethods.accountId, accountId),
        eq(accountPaymentMethods.paymentMethodId, paymentMethodId)
      )
    )
    .get();
  if (!association?.isActive) {
    throw new ValidationError("A forma de pagamento não está ativa para esta conta.");
  }
}
