import { Alert, Button, Group, NumberInput, Paper, Select, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { z } from "zod";
import { apiClient } from "../shared/api-client.js";
import { billPaymentResultSchema } from "../shared/api-contracts.js";
import { BusinessDateInput } from "../shared/BusinessDateInput.js";

type Account = { id: string; name: string };
type Payment = { id: string; paymentDate: string; principalCents: number; interestCents: number; penaltyCents: number; reversedAt: string | null };
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
export const canEditBillFinancialFields = (payments: Payment[]) => payments.every((payment) => Boolean(payment.reversedAt));

export function BillPaymentPanel({ cardId, billId, accounts, remainingCents, minimumMet, status, payments, onChanged }: { cardId: string; billId: string; accounts: Account[]; remainingCents: number; minimumMet: boolean; status: string; payments: Payment[]; onChanged: () => void }) {
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [principal, setPrincipal] = useState(remainingCents / 100);
  const [interest, setInterest] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!accountId) { setError("Escolha a conta de pagamento."); return; }
    const principalCents = Math.round(principal * 100); const interestCents = Math.round(interest * 100); const penaltyCents = Math.round(penalty * 100);
    try {
      setError(null);
      await apiClient.post(`/credit-cards/${cardId}/bills/${billId}/payments`, { accountId, paymentDate: date, amountCents: principalCents + interestCents + penaltyCents, principalCents, interestCents, penaltyCents }, billPaymentResultSchema, { "Idempotency-Key": crypto.randomUUID() });
      onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao pagar."); }
  }
  async function reverse(id: string) {
    try { await apiClient.post(`/credit-cards/${cardId}/bills/${billId}/payments/${id}/reverse`, {}, z.unknown()); onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao reverter."); }
  }

  return <Paper withBorder p="md"><Stack><Group justify="space-between"><Text fw={700}>Pagamentos</Text><Text>Saldo {money(remainingCents)} · mínimo {minimumMet ? "atendido" : "pendente"} · {status}</Text></Group>{error ? <Alert color="red">{error}</Alert> : null}<Group align="end"><Select label="Conta" data={accounts.map((item) => ({ value: item.id, label: item.name }))} value={accountId} onChange={setAccountId}/><BusinessDateInput label="Data" value={date} referenceMonth={date.slice(0, 7)} onChange={setDate}/><NumberInput label="Principal" value={principal} onChange={(value) => setPrincipal(Number(value) || 0)} min={0}/><NumberInput label="Juros" value={interest} onChange={(value) => setInterest(Number(value) || 0)} min={0}/><NumberInput label="Multa" value={penalty} onChange={(value) => setPenalty(Number(value) || 0)} min={0}/><Button onClick={pay}>Registrar</Button></Group>{payments.map((payment) => <Group key={payment.id} justify="space-between"><Text>{payment.paymentDate} · principal {money(payment.principalCents)} · encargos {money(payment.interestCents + payment.penaltyCents)} {payment.reversedAt ? "· revertido" : ""}</Text>{!payment.reversedAt ? <Button size="xs" color="red" variant="subtle" onClick={() => void reverse(payment.id)}>Reverter</Button> : null}</Group>)}</Stack></Paper>;
}
