import { Alert, Button, Group, Modal, NumberInput, Select, Stack, TextInput } from "@mantine/core";
import { useState } from "react";
import { z } from "zod";
import { getTodayBusinessDate } from "../date-format.js";
import { BusinessDateInput } from "../shared/BusinessDateInput.js";
import { apiClient } from "../shared/api-client.js";

type AccountOption = { id: string; name: string; isActive: boolean };
const transferResponseSchema = z.object({ transfer: z.object({ id: z.string() }), legs: z.array(z.object({ id: z.string() })) });

export function TransferDialog({ opened, accounts, onClose, onCreated }: { opened: boolean; accounts: AccountOption[]; onClose: () => void; onCreated: () => void }) {
  const active = accounts.filter((account) => account.isActive);
  const [sourceAccountId, setSourceAccountId] = useState<string | null>(null);
  const [destinationAccountId, setDestinationAccountId] = useState<string | null>(null);
  const [amountReais, setAmountReais] = useState<number | string>("");
  const [eventDate, setEventDate] = useState(getTodayBusinessDate());
  const [description, setDescription] = useState("Transferência entre contas");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const options = active.map((account) => ({ value: account.id, label: account.name }));

  async function submit() {
    if (!sourceAccountId || !destinationAccountId || sourceAccountId === destinationAccountId || Number(amountReais) <= 0) {
      setError("Escolha contas diferentes e informe um valor maior que zero.");
      return;
    }
    setSaving(true); setError(null);
    try {
      await apiClient.post("/transfers", { sourceAccountId, destinationAccountId, amountCents: Math.round(Number(amountReais) * 100), eventDate, description }, transferResponseSchema);
      onCreated(); onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível transferir.");
    } finally { setSaving(false); }
  }

  return <Modal opened={opened} onClose={onClose} title="Transferir entre contas"><Stack>{error ? <Alert color="red">{error}</Alert> : null}<Select label="De" data={options} value={sourceAccountId} onChange={setSourceAccountId} searchable/><Select label="Para" data={options.filter((option) => option.value !== sourceAccountId)} value={destinationAccountId} onChange={setDestinationAccountId} searchable/><NumberInput label="Valor" prefix="R$ " decimalScale={2} value={amountReais} onChange={setAmountReais}/><BusinessDateInput label="Data" value={eventDate} onChange={setEventDate} referenceMonth={eventDate.slice(0, 7)}/><TextInput label="Descrição" value={description} onChange={(event) => setDescription(event.currentTarget.value)}/><Group justify="end"><Button variant="default" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={() => void submit()}>Transferir</Button></Group></Stack></Modal>;
}
