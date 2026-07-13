import { Alert, Button, Group, Modal, Select, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { z } from "zod";

import type { Account } from "../shared/api-contracts";
import { apiClient } from "../shared/api-client";
import { CsvFileStep } from "./CsvFileStep";
import { ImportReviewTable } from "./ImportReviewTable";
import { changeAccountPaymentSource, getAccountPaymentMethodOptions, validateImportPaymentSources } from "./payment-source-state";
import { applyDuplicateSelection, parseSimpleCsv, type SimpleImportRow } from "./simple-import";

const previewSchema = z.array(z.object({ isDuplicate: z.boolean() }).passthrough());
const resultSchema = z.object({ created: z.number(), duplicatesIgnored: z.number(), invalid: z.number() });

export function SimpleCsvImportDialog({ opened, accounts, onClose, onImported }: { opened: boolean; accounts: Account[]; onClose: () => void; onImported: () => void }) {
  const [rows, setRows] = useState<SimpleImportRow[]>([]);
  const [bulkAccountId, setBulkAccountId] = useState<string | null>(null);
  const [bulkPaymentMethodId, setBulkPaymentMethodId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function file(content: string) {
    try {
      setError(null);
      const parsed = parseSimpleCsv(content);
      const preview = await apiClient.post("/simple-import/preview", { transactions: parsed }, previewSchema);
      setRows(applyDuplicateSelection(parsed.map((row, index) => ({ ...row, isDuplicate: preview[index]?.isDuplicate }))));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha na prévia."); }
  }

  function applyBulkSource() {
    if (!bulkAccountId) return;
    setRows((current) => current.map((row) => row.selected && row.type === "expense"
      ? { ...row, ...changeAccountPaymentSource(accounts, bulkAccountId, bulkPaymentMethodId ?? row.paymentMethodId) }
      : row));
  }

  async function confirm() {
    const invalid = validateImportPaymentSources(accounts, rows);
    if (invalid.length > 0) {
      setError(`Corrija conta e forma de ${invalid.length} lançamento(s) selecionado(s).`);
      return;
    }
    try {
      setError(null);
      const response = await apiClient.post("/simple-import/confirm", { transactions: rows.filter((row) => row.selected) }, resultSchema);
      setResult(`${response.created} criados, ${response.duplicatesIgnored} duplicados ignorados e ${response.invalid} inválidos.`);
      onImported();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao importar."); }
  }

  return <Modal opened={opened} onClose={onClose} title="Importar e conferir CSV" size="xl"><Stack>{error ? <Alert color="red">{error}</Alert> : null}{result ? <Alert color="teal">{result}</Alert> : null}{rows.length ? <><Group align="end"><Select label="Conta para selecionados" data={accounts.filter((account) => account.isActive).map((account) => ({ value: account.id, label: account.name }))} value={bulkAccountId} onChange={(accountId) => { setBulkAccountId(accountId); setBulkPaymentMethodId(changeAccountPaymentSource(accounts, accountId, null).paymentMethodId); }} /><Select label="Forma para selecionados" data={getAccountPaymentMethodOptions(accounts, bulkAccountId)} value={bulkPaymentMethodId} disabled={!bulkAccountId} onChange={setBulkPaymentMethodId} /><Button onClick={applyBulkSource}>Aplicar aos selecionados</Button></Group><ImportReviewTable rows={rows} accounts={accounts} onChange={setRows} /></> : <CsvFileStep onContent={(content) => void file(content)} />}<Group justify="end"><Button variant="default" onClick={onClose}>Fechar</Button>{rows.length ? <Button onClick={() => void confirm()}>Confirmar importação</Button> : null}</Group><Text size="xs">Categoria é opcional e pode ser conferida depois.</Text></Stack></Modal>;
}
