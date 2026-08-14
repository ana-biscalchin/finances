import { Accordion, Badge, Divider, Group, Paper, Stack, Text, Title } from "@mantine/core";
import type { MonthlyOverview } from "../shared/api-contracts.js";
import { formatMoney } from "../shared/money.js";
import { BudgetAllocationEditor } from "./BudgetAllocationEditor.js";
import { BudgetPaymentMethodBreakdown } from "./BudgetPaymentMethodBreakdown.js";
import { sortMonthlyItems } from "./monthly-dashboard-ui.js";

export function BudgetCategoryTable({ items, paymentMethodOptions, month, onChanged }: {
  items: MonthlyOverview["items"];
  paymentMethodOptions: MonthlyOverview["availablePaymentMethods"];
  month: string;
  onChanged: () => Promise<void>;
}) {
  const categories = new Map<string, MonthlyOverview["items"]>();
  for (const item of sortMonthlyItems(items)) {
    const key = item.categoryId ?? "uncategorized";
    categories.set(key, [...(categories.get(key) ?? []), item]);
  }
  return (
    <Stack gap="sm">
      <Title order={3}>Orçamento por categoria e meio de pagamento</Title>
      {!items.length && <Paper withBorder p="md"><Text c="dimmed">O mês ainda não tem orçamento nem gastos categorizados.</Text></Paper>}
      <Accordion multiple variant="separated">
        {[...categories.entries()].map(([categoryId, categoryItems]) => {
          const planned = categoryItems.reduce((total, item) => total + item.plannedCents, 0);
          const spent = categoryItems.reduce((total, item) => total + item.spentCents, 0);
          return (
            <Accordion.Item key={categoryId} value={categoryId}>
              <Accordion.Control>
                <Group justify="space-between" wrap="wrap">
                  <Text fw={700}>{categoryItems[0]?.categoryName}</Text>
                  <Group><Text>Orçado {formatMoney(planned)}</Text><Text>Gasto {formatMoney(spent)}</Text></Group>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack>
                  {categoryItems.map((item) => (
                    <Paper key={item.subcategoryId} withBorder p="md" radius="md">
                      <Stack>
                        <Group justify="space-between" wrap="wrap">
                          <Text fw={600}>{item.subcategoryName}</Text>
                          <Group>
                            <Text size="sm">Orçado {formatMoney(item.plannedCents)}</Text>
                            <Text size="sm">Gasto {formatMoney(item.spentCents)}</Text>
                            {item.abovePlannedCents > 0 ? <Badge color="red">Saldo -{formatMoney(item.abovePlannedCents)}</Badge> : <Badge color="teal">Saldo {formatMoney(item.availableCents)}</Badge>}
                          </Group>
                        </Group>
                        <BudgetPaymentMethodBreakdown methods={item.paymentMethods} />
                        <Divider label="Editar orçamento" labelPosition="left" />
                        <BudgetAllocationEditor item={item} options={paymentMethodOptions} month={month} onChanged={onChanged} />
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </Stack>
  );
}
