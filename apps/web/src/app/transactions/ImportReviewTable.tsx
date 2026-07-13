import { Checkbox, Select, Table } from "@mantine/core";

import type { Account } from "../shared/api-contracts";
import {
  changeAccountPaymentSource,
  getAccountPaymentMethodOptions,
  isValidAccountPaymentSource
} from "./payment-source-state";
import type { SimpleImportRow } from "./simple-import";

export function ImportReviewTable({
  rows,
  accounts,
  onChange
}: {
  rows: SimpleImportRow[];
  accounts: Account[];
  onChange: (rows: SimpleImportRow[]) => void;
}) {
  const update = (tempId: string, changes: Partial<SimpleImportRow>) =>
    onChange(rows.map((row) => (row.tempId === tempId ? { ...row, ...changes } : row)));

  return (
    <Table>
      <Table.Thead><Table.Tr><Table.Th /><Table.Th>Data</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Valor</Table.Th><Table.Th>Conta</Table.Th><Table.Th>Forma</Table.Th><Table.Th>Situação</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>
        {rows.map((row) => {
          const valid = row.type !== "expense" || Boolean(row.creditCardId) ||
            isValidAccountPaymentSource(accounts, row.accountId, row.paymentMethodId);
          return (
            <Table.Tr key={row.tempId}>
              <Table.Td><Checkbox aria-label={`Importar ${row.description}`} checked={row.selected} onChange={(event) => update(row.tempId, { selected: event.currentTarget.checked })} /></Table.Td>
              <Table.Td>{row.eventDate}</Table.Td><Table.Td>{row.description}</Table.Td><Table.Td>{row.amountCents / 100}</Table.Td>
              <Table.Td><Select aria-label={`Conta de ${row.description}`} data={accounts.filter((account) => account.isActive).map((account) => ({ value: account.id, label: account.name }))} value={row.accountId} onChange={(accountId) => update(row.tempId, changeAccountPaymentSource(accounts, accountId, row.paymentMethodId))} /></Table.Td>
              <Table.Td><Select aria-label={`Forma de ${row.description}`} data={getAccountPaymentMethodOptions(accounts, row.accountId)} value={row.paymentMethodId} disabled={!row.accountId} onChange={(paymentMethodId) => update(row.tempId, { paymentMethodId })} /></Table.Td>
              <Table.Td>{row.isDuplicate ? "Possível duplicata" : valid ? "Pronto" : "Corrija conta e forma"}</Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
