import { Alert, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import { z } from "zod";
import { apiClient } from "../shared/api-client.js";

export function MonthlyBudgetEmptyState({ month, onChanged }: { month: string; onChanged: () => Promise<void> }) {
  const [sourceMonth, setSourceMonth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const copy = async () => {
    try {
      setCopying(true);
      setError(null);
      if (!/^\d{4}-\d{2}$/.test(sourceMonth) || sourceMonth === month) {
        throw new Error("Escolha um mês de origem diferente do mês atual.");
      }
      await apiClient.post(
        "/monthly-budget-allocations/copy",
        { sourceMonth, targetMonth: month },
        z.unknown()
      );
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível copiar o orçamento.");
    } finally {
      setCopying(false);
    }
  };
  return (
    <Alert title="Este mês ainda não tem orçamento" color="blue">
      <Stack gap="sm">
        <Text size="sm">Expanda uma categoria abaixo para começar do zero ou copie as alocações de outro mês.</Text>
        <Group align="end">
          <TextInput label="Copiar do mês" type="month" value={sourceMonth} onChange={(event) => setSourceMonth(event.currentTarget.value)} />
          <Button variant="light" loading={copying} onClick={() => void copy()}>Copiar orçamento</Button>
        </Group>
        {error && <Text c="red" size="sm">{error}</Text>}
      </Stack>
    </Alert>
  );
}
