import { Badge, Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { MonthlyOverview } from "../shared/api-contracts.js";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);

export function PaymentSourceSummary({ sources }: { sources: MonthlyOverview["sourceSummary"] }) {
  if (!sources.length) return null;
  return (
    <Stack gap="xs">
      <Text fw={600}>Por conta e cartão</Text>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {sources.map((source) => (
          <Card withBorder key={`${source.kind}:${source.id}`}>
            <Group justify="space-between">
              <Text fw={500}>{source.name}</Text>
              <Badge variant="light">{source.kind === "account" ? "Conta" : "Cartão"}</Badge>
            </Group>
            <Text size="sm">Planejado: {money(source.plannedCents)}</Text>
            <Text size="sm">Realizado: {money(source.spentCents)}</Text>
            <Text size="sm" c={source.differenceCents < 0 ? "red" : "dimmed"}>
              Diferença: {money(source.differenceCents)}
            </Text>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
