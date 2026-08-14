import { ActionIcon, Alert, Button, Group, NumberInput, Select, Stack, Text } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { apiClient } from "../shared/api-client.js";
import type { MonthlyOverview } from "../shared/api-contracts.js";
import {
  buildBudgetAllocationPayload,
  encodePaymentMethodValue,
  type BudgetAllocationRow
} from "./budget-allocation-form-state.js";

type Item = MonthlyOverview["items"][number];
type Option = MonthlyOverview["availablePaymentMethods"][number];

function sourceFromAllocation(allocation: Item["allocations"][number]) {
  return allocation.accountId && allocation.paymentMethodId
    ? encodePaymentMethodValue({
        kind: "account_method",
        accountId: allocation.accountId,
        paymentMethodId: allocation.paymentMethodId
      })
    : encodePaymentMethodValue({ kind: "credit_card", creditCardId: allocation.creditCardId! });
}

function initialRows(item: Item): BudgetAllocationRow[] {
  return item.allocations.map((allocation) => ({
    source: sourceFromAllocation(allocation),
    amount: allocation.amountCents / 100
  }));
}

export function BudgetAllocationEditor({
  item,
  options,
  month,
  onChanged
}: {
  item: Item;
  options: Option[];
  month: string;
  onChanged: () => Promise<void>;
}) {
  const [rows, setRows] = useState<BudgetAllocationRow[]>(() => initialRows(item));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setRows(initialRows(item)), [item]);

  const selectOptions = options.map((option) => ({
    value: encodePaymentMethodValue(option),
    label: option.label
  }));
  const updateRow = (index: number, update: Partial<BudgetAllocationRow>) =>
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...update } : row))
    );
  const addRow = () => {
    const used = new Set(rows.map((row) => row.source));
    const available = selectOptions.find((option) => !used.has(option.value));
    if (!available) {
      setError("Todas as formas de pagamento disponíveis já foram adicionadas.");
      return;
    }
    setRows((current) => [...current, { source: available.value, amount: 0 }]);
  };
  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      await apiClient.put(
        "/monthly-budget-allocations",
        buildBudgetAllocationPayload({ budgetMonth: month, subcategoryId: item.subcategoryId, rows }),
        z.unknown()
      );
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o orçamento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="sm">
      {rows.map((row, index) => (
        <Group key={`${index}-${row.source}`} align="end" wrap="wrap">
          <Select
            label="Meio de pagamento"
            data={selectOptions}
            value={row.source}
            onChange={(value) => updateRow(index, { source: value ?? "" })}
            searchable
            flex={1}
            miw={240}
          />
          <NumberInput
            label="Orçamento"
            value={row.amount}
            onChange={(value) => updateRow(index, { amount: Number(value) || 0 })}
            min={0}
            decimalScale={2}
            prefix="R$ "
            w={170}
          />
          <ActionIcon
            color="red"
            variant="subtle"
            aria-label="Remover meio de pagamento"
            onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Group>
      ))}
      {!rows.length && <Alert color="gray">Ainda não há orçamento para esta subcategoria.</Alert>}
      <Group justify="space-between">
        <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addRow}>
          Adicionar meio
        </Button>
        <Button loading={saving} onClick={() => void save()}>
          Salvar orçamento
        </Button>
      </Group>
      {error && <Text c="red" size="sm">{error}</Text>}
    </Stack>
  );
}
