import {
  ActionIcon,
  Alert,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { apiClient } from "../shared/api-client.js";
import type { MonthlyOverview } from "../shared/api-contracts.js";
import { buildPlannedExpensePayload } from "./planned-expense-form-state.js";
import { z } from "zod";

type Item = MonthlyOverview["items"][number];
type Source = MonthlyOverview["availableSources"][number];
const sourceValue = (line: Item["plannedExpenses"][number]) =>
  line.accountId ? `account:${line.accountId}` : `credit_card:${line.creditCardId}`;

function ExpenseRow({
  line,
  sources,
  onChanged
}: {
  line: Item["plannedExpenses"][number];
  sources: Source[];
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState(line.name);
  const [amount, setAmount] = useState(line.amountCents / 100);
  const [source, setSource] = useState(sourceValue(line));
  const [error, setError] = useState<string | null>(null);
  const payload = () =>
    buildPlannedExpensePayload({
      budgetMonth: line.budgetMonth,
      subcategoryId: line.subcategoryId,
      name,
      amount,
      source
    });
  const save = async () => {
    try {
      setError(null);
      await apiClient.put(`/planned-expenses/${line.id}`, payload(), z.unknown());
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    }
  };
  const remove = async () => {
    if (!window.confirm(`Excluir ${line.name} do planejamento?`)) return;
    try {
      await apiClient.delete(`/planned-expenses/${line.id}`, z.unknown());
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir.");
    }
  };
  return (
    <Stack gap={4}>
      <Group align="end" wrap="wrap">
        <TextInput
          label="Despesa"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          flex={2}
        />
        <NumberInput
          label="Valor"
          value={amount}
          onChange={(value) => setAmount(Number(value) || 0)}
          min={0}
          decimalScale={2}
          prefix="R$ "
          w={150}
        />
        <Select
          label="Conta ou cartão"
          data={sources.map((item) => ({ value: `${item.kind}:${item.id}`, label: item.name }))}
          value={source}
          onChange={(value) => setSource(value ?? "")}
          flex={1}
        />
        <Button onClick={() => void save()}>Salvar</Button>
        <ActionIcon
          color="red"
          variant="subtle"
          aria-label={`Excluir ${line.name}`}
          onClick={() => void remove()}
        >
          <IconTrash size={18} />
        </ActionIcon>
      </Group>
      {error && (
        <Text c="red" size="xs">
          {error}
        </Text>
      )}
    </Stack>
  );
}

export function PlannedExpenseEditor({
  item,
  sources,
  month,
  onChanged
}: {
  item: Item;
  sources: Source[];
  month: string;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    try {
      setError(null);
      await apiClient.post(
        "/planned-expenses",
        buildPlannedExpensePayload({
          budgetMonth: month,
          subcategoryId: item.subcategoryId,
          name,
          amount,
          source
        }),
        z.unknown()
      );
      setName("");
      setAmount(0);
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível adicionar.");
    }
  };
  return (
    <Stack>
      {item.plannedExpenses.map((line) => (
        <ExpenseRow key={line.id} line={line} sources={sources} onChanged={onChanged} />
      ))}
      {!item.plannedExpenses.length && <Alert>Nenhuma despesa planejada nesta categoria.</Alert>}
      <Group align="end" wrap="wrap">
        <TextInput
          label="Nova despesa"
          placeholder="Ex.: Energia"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          flex={2}
        />
        <NumberInput
          label="Valor"
          value={amount}
          onChange={(value) => setAmount(Number(value) || 0)}
          min={0}
          decimalScale={2}
          prefix="R$ "
          w={150}
        />
        <Select
          label="Conta ou cartão"
          placeholder="Escolha a origem"
          data={sources.map((item) => ({ value: `${item.kind}:${item.id}`, label: item.name }))}
          value={source}
          onChange={(value) => setSource(value ?? "")}
          flex={1}
        />
        <Button onClick={() => void add()}>Adicionar despesa</Button>
      </Group>
      {error && (
        <Text c="red" size="sm">
          {error}
        </Text>
      )}
    </Stack>
  );
}
