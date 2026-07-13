import { Button, Group, NumberInput, Text } from "@mantine/core";
import { useState } from "react";

export function canSaveBudget(valueCents: number, nextCents: number, confirmRemoval: () => boolean) {
  return !(nextCents === 0 && valueCents > 0) || confirmRemoval();
}

export function InlineBudgetAmount({ valueCents, onSave }: { valueCents: number; onSave: (value: number) => Promise<void> }) {
  const [draft, setDraft] = useState(valueCents / 100); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  async function save() {
    const cents = Math.round(Number(draft || 0) * 100);
    if (!canSaveBudget(valueCents, cents, () => window.confirm("Remover este planejamento?"))) return;
    setSaving(true); setError(null);
    try { await onSave(cents); } catch (cause) { setDraft(valueCents / 100); setError(cause instanceof Error ? cause.message : "Não foi possível salvar."); } finally { setSaving(false); }
  }
  return <><Group gap="xs" wrap="nowrap"><NumberInput aria-label="Valor planejado" value={draft} onChange={(value) => setDraft(Number(value) || 0)} min={0} decimalScale={2} prefix="R$ " w={150}/><Button size="xs" loading={saving} onClick={save}>Salvar</Button></Group>{error ? <Text c="red" size="xs">{error}</Text> : null}</>;
}
