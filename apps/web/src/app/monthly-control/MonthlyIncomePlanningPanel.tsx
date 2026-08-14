import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { apiClient } from "../shared/api-client.js";
import type { MonthlyOverview } from "../shared/api-contracts.js";
import { formatMoney } from "../shared/money.js";
import { buildMonthlyIncomePlanPayload, type IncomePlanRow } from "./income-plan-form-state.js";

type IncomePlanning = MonthlyOverview["incomePlanning"];

const statusLabels: Record<IncomePlanning["items"][number]["status"], string> = {
  pending: "A receber",
  partial: "Recebido parcialmente",
  received: "Recebido",
  above_planned: "Acima do previsto",
  unplanned: "Não planejado"
};

const statusColors: Record<IncomePlanning["items"][number]["status"], string> = {
  pending: "gray",
  partial: "yellow",
  received: "teal",
  above_planned: "blue",
  unplanned: "orange"
};

function initialRows(data: IncomePlanning): IncomePlanRow[] {
  return data.items
    .filter((item) => item.plannedCents > 0)
    .map((item) => ({
      subcategoryId: item.subcategoryId,
      accountId: item.accountId,
      amount: item.plannedCents / 100
    }));
}

export function MonthlyIncomePlanningPanel({
  data,
  month,
  onChanged
}: {
  data: IncomePlanning;
  month: string;
  onChanged: () => Promise<void>;
}) {
  const [rows, setRows] = useState<IncomePlanRow[]>(() => initialRows(data));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setRows(initialRows(data)), [data]);

  const updateRow = (index: number, update: Partial<IncomePlanRow>) =>
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...update } : row))
    );
  const addRow = () =>
    setRows((current) => [
      ...current,
      {
        subcategoryId: data.availableSubcategories[0]?.id ?? "",
        accountId: data.availableAccounts[0]?.id ?? "",
        amount: 0
      }
    ]);
  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      await apiClient.put(
        "/monthly-income-plans",
        buildMonthlyIncomePlanPayload({ budgetMonth: month, rows }),
        z.unknown()
      );
      await onChanged();
      setEditing(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar as entradas previstas."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack>
        <Group justify="space-between">
          <div>
            <Title order={3}>Entradas do mês</Title>
            <Text c="dimmed" size="sm">
              Acompanhe o que estava previsto e o que realmente entrou.
            </Text>
          </div>
          <Button variant="light" onClick={() => setEditing((value) => !value)}>
            {editing ? "Fechar edição" : "Planejar entradas"}
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 2, md: 4 }}>
          {[
            ["Previsto", data.summary.plannedCents],
            ["Recebido", data.summary.receivedCents],
            ["A receber", data.summary.remainingCents],
            ["Acima do previsto", data.summary.abovePlannedCents]
          ].map(([label, value]) => (
            <Card key={String(label)} withBorder padding="sm">
              <Text size="xs" c="dimmed">
                {label}
              </Text>
              <Text fw={700}>{formatMoney(Number(value))}</Text>
            </Card>
          ))}
        </SimpleGrid>

        {editing && (
          <Stack gap="sm">
            {rows.map((row, index) => (
              <Group key={`${index}-${row.subcategoryId}-${row.accountId}`} align="end" wrap="wrap">
                <Select
                  label="Categoria de receita"
                  data={data.availableSubcategories.map((item) => ({
                    value: item.id,
                    label: `${item.categoryName} · ${item.name}`
                  }))}
                  value={row.subcategoryId}
                  onChange={(value) => updateRow(index, { subcategoryId: value ?? "" })}
                  searchable
                  flex={1}
                  miw={220}
                />
                <Select
                  label="Conta de destino"
                  data={data.availableAccounts.map((item) => ({
                    value: item.id,
                    label: item.name
                  }))}
                  value={row.accountId}
                  onChange={(value) => updateRow(index, { accountId: value ?? "" })}
                  searchable
                  flex={1}
                  miw={200}
                />
                <NumberInput
                  label="Valor previsto"
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
                  aria-label="Remover entrada prevista"
                  onClick={() =>
                    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
                  }
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Group>
            ))}
            {!rows.length && (
              <Alert color="gray">Nenhuma entrada foi planejada para este mês.</Alert>
            )}
            <Group justify="space-between">
              <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addRow}>
                Adicionar entrada
              </Button>
              <Button loading={saving} onClick={() => void save()}>
                Salvar entradas
              </Button>
            </Group>
            {error && (
              <Text c="red" size="sm">
                {error}
              </Text>
            )}
          </Stack>
        )}

        {data.items.length ? (
          <Table.ScrollContainer minWidth={700}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Entrada</Table.Th>
                  <Table.Th>Conta</Table.Th>
                  <Table.Th>Previsto</Table.Th>
                  <Table.Th>Recebido</Table.Th>
                  <Table.Th>A receber / diferença</Table.Th>
                  <Table.Th>Situação</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.items.map((item) => (
                  <Table.Tr key={`${item.subcategoryId}:${item.accountId}`}>
                    <Table.Td>
                      <Text fw={600}>{item.subcategoryName}</Text>
                      <Text size="xs" c="dimmed">
                        {item.categoryName}
                      </Text>
                    </Table.Td>
                    <Table.Td>{item.accountName}</Table.Td>
                    <Table.Td>{formatMoney(item.plannedCents)}</Table.Td>
                    <Table.Td>{formatMoney(item.receivedCents)}</Table.Td>
                    <Table.Td>
                      {formatMoney(item.remainingCents || item.abovePlannedCents)}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={statusColors[item.status]} variant="light">
                        {statusLabels[item.status]}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : (
          <Alert color="gray">Nenhuma entrada prevista ou recebida neste mês.</Alert>
        )}
      </Stack>
    </Paper>
  );
}
