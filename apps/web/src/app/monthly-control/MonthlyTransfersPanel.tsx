import { Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import type { MonthlyOverview } from "../shared/api-contracts.js";
import { formatMoney } from "../shared/money.js";

export function MonthlyTransfersPanel({ transfers }: { transfers: MonthlyOverview["transfers"] }) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <div>
          <Title order={3}>Transferências entre contas</Title>
          <Text size="sm" c="dimmed">Movimentam seu saldo, mas não contam como gasto nem consomem orçamento.</Text>
        </div>
        {!transfers.length && <Text c="dimmed">Nenhuma transferência realizada neste mês.</Text>}
        {transfers.map((transfer) => (
          <Group key={transfer.id} justify="space-between" wrap="wrap">
            <Stack gap={0}>
              <Group gap="xs">
                <Text>{transfer.sourceAccount.name}</Text><IconArrowRight size={16} /><Text>{transfer.destinationAccount.name}</Text>
              </Group>
              <Text size="xs" c="dimmed">{transfer.eventDate} · {transfer.description}</Text>
            </Stack>
            <Text fw={600}>{formatMoney(transfer.amountCents)}</Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}
