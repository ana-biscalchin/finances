import { Alert, Badge, Group, Paper, Stack, Text, Title } from "@mantine/core";
import type { MonthlyOverview } from "../shared/api-contracts.js";
import { formatMoney } from "../shared/money.js";
import { buildAttentionItems } from "./monthly-dashboard-ui.js";

const labels = { over: "Acima do orçamento", near_limit: "Perto do limite", unplanned: "Sem orçamento" } as const;
const colors = { over: "red", near_limit: "orange", unplanned: "violet" } as const;

export function MonthlyAttentionPanel({ items }: { items: MonthlyOverview["items"] }) {
  const attention = buildAttentionItems(items);
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Title order={3}>Pontos de atenção</Title>
        {!attention.length && <Alert color="teal">Tudo dentro do planejado até agora.</Alert>}
        {attention.map((item) => (
          <Group key={item.subcategoryId} justify="space-between">
            <Text>{item.categoryName} · {item.subcategoryName}</Text>
            <Group gap="xs">
              <Badge color={colors[item.attention as keyof typeof colors]}>{labels[item.attention as keyof typeof labels]}</Badge>
              <Text size="sm" fw={600}>{formatMoney(item.spentCents)}</Text>
            </Group>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}
