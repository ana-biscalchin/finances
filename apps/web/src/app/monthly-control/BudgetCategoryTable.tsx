import { Accordion, Badge, Group, Stack, Text } from "@mantine/core";
import type { MonthlyOverview } from "../shared/api-contracts.js";
import { PlannedExpenseEditor } from "./PlannedExpenseEditor.js";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
export function BudgetCategoryTable({
  items,
  sourceOptions,
  month,
  onChanged
}: {
  items: MonthlyOverview["items"];
  sourceOptions: MonthlyOverview["availableSources"];
  month: string;
  onChanged: () => Promise<void>;
}) {
  return (
    <Accordion multiple variant="separated">
      {items.map((item) => (
        <Accordion.Item key={item.subcategoryId} value={item.subcategoryId}>
          <Accordion.Control>
            <Group justify="space-between" wrap="wrap">
              <Stack gap={0}>
                <Text fw={600}>
                  {item.categoryName} · {item.subcategoryName}
                </Text>
                <Text size="sm" c="dimmed">
                  {item.plannedExpenses.length} despesas planejadas
                </Text>
              </Stack>
              <Group>
                <Text>Planejado {money(item.plannedCents)}</Text>
                <Text>Realizado {money(item.spentCents)}</Text>
                {item.abovePlannedCents > 0 ? (
                  <Badge color="red">Acima · {money(item.abovePlannedCents)}</Badge>
                ) : (
                  <Badge color="teal">Disponível · {money(item.availableCents)}</Badge>
                )}
              </Group>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <PlannedExpenseEditor
              item={item}
              sources={sourceOptions}
              month={month}
              onChanged={onChanged}
            />
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
