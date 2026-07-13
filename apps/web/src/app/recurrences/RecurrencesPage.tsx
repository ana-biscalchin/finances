import { Alert, Badge, Button, Group, NumberInput, Paper, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { apiClient } from "../shared/api-client.js";
import { recurrenceSchema } from "../shared/api-contracts.js";
import { MonthSelector } from "../shared/MonthSelector.js";

const recurrenceList = z.array(recurrenceSchema);
const targetList = z.array(z.object({ id: z.string(), name: z.string() }).passthrough());
type Rule = z.infer<typeof recurrenceSchema>;
export const recurrenceVisualKind = (item: { recurrenceRuleId?: string | null; installmentCount?: number | null }) => item.installmentCount ? "Parcela" : item.recurrenceRuleId ? "Recorrência confirmada" : "Previsão recorrente";

export function RecurrencesPage({ selectedMonth, setSelectedMonth }: { selectedMonth: string; setSelectedMonth: (month: string) => void }) {
  const [rules, setRules] = useState<Rule[]>([]); const [forecasts, setForecasts] = useState<Array<Record<string, unknown>>>([]); const [targets, setTargets] = useState<Array<{ value: string; label: string }>>([]);
  const [description, setDescription] = useState(""); const [amount, setAmount] = useState(0); const [target, setTarget] = useState<string | null>(null); const [subcategoryId, setSubcategoryId] = useState(""); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setError(null);
      const [loadedRules, loadedForecasts, accounts, cards] = await Promise.all([apiClient.get("/recurrences", recurrenceList), apiClient.get(`/recurrences?month=${selectedMonth}`, z.array(z.record(z.string(), z.unknown()))), apiClient.get("/accounts", targetList), apiClient.get("/credit-cards", targetList)]);
      setRules(loadedRules); setForecasts(loadedForecasts); setTargets([...accounts.map((item) => ({ value: `account:${item.id}`, label: `Conta · ${item.name}` })), ...cards.map((item) => ({ value: `card:${item.id}`, label: `Cartão · ${item.name}` }))]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar recorrências."); }
  }, [selectedMonth]);
  useEffect(() => { void load(); }, [load]);
  async function create() { if (!target) return; const [kind, id] = target.split(":"); await apiClient.post("/recurrences", { kind: "expense", description, amountCents: Math.round(amount * 100), subcategoryId, accountId: kind === "account" ? id : null, creditCardId: kind === "card" ? id : null, frequency: "monthly", dayOfMonth: 1, startMonth: selectedMonth }, recurrenceSchema); await load(); }
  async function action(id: string, name: "pause" | "resume") { await apiClient.post(`/recurrences/${id}/${name}`, {}, recurrenceSchema); await load(); }
  return <Stack><Title order={2}>Recorrências</Title><MonthSelector selectedMonth={selectedMonth} onChange={setSelectedMonth}/>{error ? <Alert color="red">{error}</Alert> : null}<Paper withBorder p="md"><Group align="end"><TextInput label="Descrição" value={description} onChange={(event) => setDescription(event.currentTarget.value)}/><NumberInput label="Valor" value={amount} onChange={(value) => setAmount(Number(value) || 0)}/><TextInput label="Subcategoria (ID)" value={subcategoryId} onChange={(event) => setSubcategoryId(event.currentTarget.value)}/><Select label="Conta ou cartão" data={targets} value={target} onChange={setTarget}/><Button onClick={() => void create()}>Criar regra</Button></Group></Paper>{rules.map((rule) => <Paper key={rule.id} withBorder p="md"><Group justify="space-between"><div><Text fw={700}>{rule.description}</Text><Badge>{rule.status}</Badge></div><Group><Button size="xs" onClick={() => void action(rule.id, rule.status === "paused" ? "resume" : "pause")}>{rule.status === "paused" ? "Retomar" : "Pausar"}</Button><Button size="xs" color="red" onClick={() => void apiClient.delete(`/recurrences/${rule.id}`, recurrenceSchema).then(load)}>Encerrar</Button></Group></Group></Paper>)}<Title order={3}>Previsões</Title>{forecasts.map((forecast, index) => <Paper key={String(forecast.ruleId ?? index)} withBorder p="sm"><Badge color="blue">Previsão recorrente</Badge> <Text component="span">{String(forecast.description ?? "")}</Text><Button size="xs" ml="md" onClick={() => void apiClient.post(`/recurrences/${String(forecast.ruleId)}/confirm-occurrence`, { month: selectedMonth }, z.unknown()).then(load)}>Confirmar ocorrência</Button></Paper>)}</Stack>;
}
