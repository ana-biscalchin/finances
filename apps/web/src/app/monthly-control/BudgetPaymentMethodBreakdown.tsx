import { Badge, Group, Progress, Stack, Text } from "@mantine/core";
import type { MonthlyOverview } from "../shared/api-contracts.js";
import { formatMoney } from "../shared/money.js";

const colors = { over: "red", near_limit: "orange", unplanned: "violet", on_track: "teal", unused: "gray" } as const;

export function BudgetPaymentMethodBreakdown({ methods }: { methods: MonthlyOverview["items"][number]["paymentMethods"] }) {
  return (
    <Stack gap="xs">
      {methods.map((method) => {
        const identity = method.kind === "account_method"
          ? `${method.accountId}:${method.paymentMethodId}`
          : method.creditCardId;
        return (
          <Stack key={`${method.kind}:${identity}`} gap={4}>
            <Group justify="space-between" wrap="wrap">
              <Text size="sm" fw={500}>{method.label}</Text>
              <Group gap="xs">
                <Text size="sm">{formatMoney(method.spentCents)} de {formatMoney(method.plannedCents)}</Text>
                {method.abovePlannedCents > 0 ? (
                  <Badge color="red">saldo -{formatMoney(method.abovePlannedCents)}</Badge>
                ) : (
                  <Badge color={colors[method.attention]}>saldo {formatMoney(method.availableCents)}</Badge>
                )}
              </Group>
            </Group>
            <Progress value={Math.min(method.usagePercent ?? 100, 100)} color={colors[method.attention]} size="sm" />
          </Stack>
        );
      })}
    </Stack>
  );
}
