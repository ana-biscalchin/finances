import type { Account } from "../shared/api-contracts";
import { changeAccountPaymentSource } from "./payment-source-state";

export type ImportPreviewBulkItem = {
  tempId: string;
  type: "income" | "expense";
  accountId: string | null;
  paymentMethodId: string | null;
  subcategoryId: string | null;
};

export type ImportPreviewBulkEdit = {
  type: string;
  accountId: string;
  paymentMethodId: string;
  subcategoryId: string;
};

export function applyImportPreviewBulkEdits<T extends ImportPreviewBulkItem>(
  items: T[],
  selectedTempIds: Set<string>,
  edit: ImportPreviewBulkEdit,
  accounts: Account[],
  emptySelectValue: string
): T[] {
  return items.map((item) => {
    if (!selectedTempIds.has(item.tempId)) {
      return item;
    }

    const nextItem = { ...item };

    if (edit.type !== emptySelectValue) {
      nextItem.type = edit.type as "income" | "expense";
    }

    if (edit.accountId !== emptySelectValue) {
      nextItem.accountId = edit.accountId === "__clear__" ? null : edit.accountId;
      if (edit.accountId === "__clear__") {
        nextItem.paymentMethodId = null;
      } else if (edit.paymentMethodId === emptySelectValue) {
        nextItem.paymentMethodId = changeAccountPaymentSource(
          accounts,
          edit.accountId,
          nextItem.paymentMethodId
        ).paymentMethodId;
      }
    }

    if (edit.paymentMethodId !== emptySelectValue) {
      nextItem.paymentMethodId =
        edit.paymentMethodId === "__clear__" ? null : edit.paymentMethodId;
    }

    if (edit.subcategoryId !== emptySelectValue) {
      nextItem.subcategoryId = edit.subcategoryId === "__clear__" ? null : edit.subcategoryId;
    }

    return nextItem;
  });
}
