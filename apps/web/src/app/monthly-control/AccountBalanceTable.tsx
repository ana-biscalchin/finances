import { Badge, Table } from "@mantine/core";
import type { CashPosition } from "../shared/api-contracts.js";
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
export function AccountBalanceTable({ positions }: { positions: CashPosition }) {
  return (
    <Table.ScrollContainer minWidth={900}>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Conta</Table.Th>
            <Table.Th>Atual</Table.Th>
            <Table.Th>Entradas previstas</Table.Th>
            <Table.Th>Benefícios</Table.Th>
            <Table.Th>Plano direto restante</Table.Th>
            <Table.Th>Cartão esperado</Table.Th>
            <Table.Th>Faturas</Table.Th>
            <Table.Th>Esperado</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {positions.map((item) => (
            <Table.Tr key={item.accountId}>
              <Table.Td>{item.accountName}</Table.Td>
              <Table.Td>{money(item.currentBalanceCents)}</Table.Td>
              <Table.Td>{money(item.expectedIncomeCents)}</Table.Td>
              <Table.Td>{money(item.benefitIncomeCents)}</Table.Td>
              <Table.Td>{money(item.directPlanRemainingCents)}</Table.Td>
              <Table.Td>{money(item.expectedCardPurchasesCents)}</Table.Td>
              <Table.Td>{money(item.outstandingBillsCents)}</Table.Td>
              <Table.Td>
                {item.atRisk ? (
                  <Badge color="red">{money(item.expectedBalanceCents)}</Badge>
                ) : (
                  money(item.expectedBalanceCents)
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
