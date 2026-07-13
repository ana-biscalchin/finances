import { Alert, Card, SimpleGrid, Text } from "@mantine/core";
import type { CashPosition } from "../shared/api-contracts.js";
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
export const hasCashRisk = (positions: CashPosition) => positions.some((item) => item.atRisk);
export function CashPositionSummary({ positions }: { positions: CashPosition }) {
  const current = positions.reduce((sum, item) => sum + item.currentBalanceCents, 0);
  const expected = positions.reduce((sum, item) => sum + item.expectedBalanceCents, 0);
  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Card withBorder>
          <Text c="dimmed">Dinheiro atual</Text>
          <Text size="xl" fw={700}>
            {money(current)}
          </Text>
        </Card>
        <Card withBorder>
          <Text c="dimmed">Saldo esperado</Text>
          <Text size="xl" fw={700} c={expected < 0 ? "red" : "teal"}>
            {money(expected)}
          </Text>
        </Card>
      </SimpleGrid>
      {hasCashRisk(positions) ? (
        <Alert color="red" title="Risco de saldo negativo">
          Revise as próximas cobranças e a conta usada para pagar faturas.
        </Alert>
      ) : null}
    </>
  );
}
