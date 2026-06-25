import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Title,
  Select,
  FileInput,
  Badge,
  Card,
  SimpleGrid,
  TextInput,
  Alert,
  ThemeIcon,
  Box,
  ScrollArea,
  Divider
} from "@mantine/core";
import {
  IconCheck,
  IconUpload,
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconHelp,
  IconTrash
} from "@tabler/icons-react";
import { useState, useMemo, useEffect } from "react";
import { formatMoney, moneyFromCents } from "@finances/domain";
import { getErrorMessage, getResponseError, reportClientError } from "../shared/errors";

type Account = {
  id: string;
  name: string;
  isActive: boolean;
};

type CreditCard = {
  id: string;
  name: string;
  institution: string | null;
  isActive: boolean;
};

type Category = {
  id: string;
  nature: string;
  name: string;
  subcategories: Array<{
    id: string;
    name: string;
  }>;
};

type CsvRow = {
  date: string;
  description: string;
  amountCents: number;
};

type MatchCandidate = {
  transactionId: string;
  description: string;
  eventDate: string;
  amountCents: number;
  score: number;
};

type MatchResult = {
  csvRow: CsvRow;
  status: "no_match" | "soft_match" | "exact_match";
  bestCandidate: MatchCandidate | null;
  allCandidates: MatchCandidate[];
};

type Resolution = {
  csvRow: CsvRow;
  action: "match" | "create" | "ignore";
  transactionId?: string | null;
  newTransaction?: {
    type: "income" | "expense";
    description: string;
    amountCents: number;
    eventDate: string;
    subcategoryId: string;
    notes?: string | null;
  } | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accounts: Account[];
  creditCards: CreditCard[];
  categories: Category[];
};

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function ReconciliationWizard({
  isOpen,
  onClose,
  onSuccess,
  accounts,
  creditCards,
  categories
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [targetType, setTargetType] = useState<"account" | "card">("account");
  const [targetId, setTargetId] = useState<string>("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvTextContent, setCsvTextContent] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState({
    eventDate: "",
    description: "",
    amount: ""
  });
  const [dateFormat, setDateFormat] = useState<"DMY" | "MDY" | "YMD">("DMY");

  // Step 2 State
  const [previewItems, setPreviewItems] = useState<MatchResult[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);
  const [resolutions, setResolutions] = useState<Record<number, Resolution>>({});

  // Auto-filled new transaction fields per row
  const [customSubcategoryId, setCustomSubcategoryId] = useState<string>("");
  const [customNotes, setCustomNotes] = useState<string>("");

  const activeAccounts = useMemo(() => accounts.filter((a) => a.isActive), [accounts]);
  const activeCards = useMemo(() => creditCards.filter((c) => c.isActive), [creditCards]);

  const subcategoryOptions = useMemo(() => {
    return categories
      .map((cat) => ({
        group: cat.name,
        items: cat.subcategories.map((sub) => ({
          value: sub.id,
          label: `${cat.name} > ${sub.name}`
        }))
      }))
      .filter((g) => g.items.length > 0);
  }, [categories]);

  // Handle CSV file upload
  const handleFileChange = (file: File | null) => {
    setCsvFile(file);
    setError(null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvTextContent(text);

      const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/)[0] ?? "";
      const headers = parseCsvHeaderLine(firstLine).filter(Boolean);
      setCsvHeaders(headers);

      // Simple auto-mapping guess
      const nextMappings = { eventDate: "", description: "", amount: "" };
      for (const h of headers) {
        const lower = h.toLowerCase();
        if (lower.includes("data") || lower.includes("date")) {
          nextMappings.eventDate = h;
        } else if (
          lower.includes("desc") ||
          lower.includes("hist") ||
          lower.includes("memo") ||
          lower.includes("detalhe")
        ) {
          nextMappings.description = h;
        } else if (
          lower.includes("valor") ||
          lower.includes("val") ||
          lower.includes("quant") ||
          lower.includes("amount")
        ) {
          nextMappings.amount = h;
        }
      }
      setMappings(nextMappings);
    };
    reader.readAsText(file);
  };

  // Run preview matching API
  const handleAnalyze = async () => {
    if (!targetId) {
      setError("Por favor, selecione a conta ou cartão de destino.");
      return;
    }
    if (!csvFile || !csvTextContent) {
      setError("Por favor, envie um arquivo extrato CSV.");
      return;
    }
    if (!mappings.eventDate || !mappings.description || !mappings.amount) {
      setError("Mapeie as colunas de Data, Descrição e Valor do CSV.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Parse CSV into rows on client first
      const rows = parseCsvToRows(csvTextContent, mappings, dateFormat);
      if (rows.length === 0) {
        throw new Error(
          "Nenhuma linha válida encontrada no CSV. Verifique o mapeamento das colunas."
        );
      }

      const payload = {
        accountId: targetType === "account" ? targetId : null,
        creditCardId: targetType === "card" ? targetId : null,
        csvRows: rows
      };

      const response = await fetch(`${apiBaseUrl}/reconciliation/match-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Erro ao consultar matches no backend."));
      }

      const results = (await response.json()) as MatchResult[];
      setPreviewItems(results);

      // Pre-populate resolutions
      const initialResolutions: Record<number, Resolution> = {};
      results.forEach((item, index) => {
        if (item.status === "exact_match" && item.bestCandidate) {
          initialResolutions[index] = {
            csvRow: item.csvRow,
            action: "match",
            transactionId: item.bestCandidate.transactionId
          };
        } else {
          initialResolutions[index] = {
            csvRow: item.csvRow,
            action: "create",
            newTransaction: {
              type: item.csvRow.amountCents > 0 ? "income" : "expense",
              description: item.csvRow.description,
              amountCents: Math.abs(item.csvRow.amountCents),
              eventDate: item.csvRow.date,
              subcategoryId: ""
            }
          };
        }
      });

      setResolutions(initialResolutions);
      setSelectedItemIndex(0);
      setStep(2);
    } catch (err) {
      reportClientError("reconciliation.preview", err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Submit final resolutions to API
  const handleConfirmReconciliation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const resolutionList = Object.values(resolutions);

      // Basic validation: ensure all "create" actions have subcategory
      const missingCategory = resolutionList.some(
        (res) =>
          res.action === "create" && (!res.newTransaction || !res.newTransaction.subcategoryId)
      );

      if (missingCategory) {
        throw new Error("Por favor, atribua uma subcategoria para todos os lançamentos criados.");
      }

      const payload = {
        accountId: targetType === "account" ? targetId : null,
        creditCardId: targetType === "card" ? targetId : null,
        resolutions: resolutionList
      };

      const response = await fetch(`${apiBaseUrl}/reconciliation/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "Erro ao enviar resoluções de conciliação.")
        );
      }

      onSuccess();
      onClose();
    } catch (err) {
      reportClientError("reconciliation.confirm", err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Update single resolution action
  const updateAction = (
    index: number,
    action: "match" | "create" | "ignore",
    extra?: Partial<Resolution>
  ) => {
    setResolutions((prev) => {
      const current = prev[index];
      let newTransaction = current.newTransaction;

      if (action === "create" && !newTransaction) {
        newTransaction = {
          type: current.csvRow.amountCents > 0 ? "income" : "expense",
          description: current.csvRow.description,
          amountCents: Math.abs(current.csvRow.amountCents),
          eventDate: current.csvRow.date,
          subcategoryId: ""
        };
      }

      return {
        ...prev,
        [index]: {
          ...current,
          action,
          ...extra,
          newTransaction
        }
      };
    });
  };

  const selectedItem = previewItems[selectedItemIndex];
  const selectedResolution = resolutions[selectedItemIndex];

  // Sync right side inputs with selected item's resolution state
  useEffect(() => {
    if (selectedResolution?.action === "create" && selectedResolution.newTransaction) {
      setCustomSubcategoryId(selectedResolution.newTransaction.subcategoryId || "");
      setCustomNotes(selectedResolution.newTransaction.notes || "");
    }
  }, [selectedItemIndex, selectedResolution]);

  const handleUpdateCustomTransaction = (subId: string, notes: string) => {
    setCustomSubcategoryId(subId);
    setCustomNotes(notes);

    setResolutions((prev) => {
      const current = prev[selectedItemIndex];
      if (current.action === "create" && current.newTransaction) {
        return {
          ...prev,
          [selectedItemIndex]: {
            ...current,
            newTransaction: {
              ...current.newTransaction,
              subcategoryId: subId,
              notes: notes || null
            }
          }
        };
      }
      return prev;
    });
  };

  // Helper stats
  const stats = useMemo(() => {
    if (previewItems.length === 0) return { exact: 0, soft: 0, none: 0 };
    let exact = 0,
      soft = 0,
      none = 0;
    previewItems.forEach((item) => {
      if (item.status === "exact_match") exact++;
      else if (item.status === "soft_match") soft++;
      else none++;
    });
    return { exact, soft, none };
  }, [previewItems]);

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon color="teal" size="md" radius="sm">
            <IconCheck size={20} />
          </ThemeIcon>
          <Title order={4}>Conciliador de Extrato Bancário</Title>
        </Group>
      }
      size={step === 1 ? "lg" : "100%"}
      fullScreen={step === 2}
    >
      <Stack gap="md" style={{ height: step === 2 ? "calc(100vh - 120px)" : "auto" }}>
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Erro" color="red">
            {error}
          </Alert>
        )}

        {step === 1 ? (
          /* ── STEP 1: IMPORT CONFIGURATION ──────────────────────────────── */
          <Stack gap="md">
            <SimpleGrid cols={2}>
              <Select
                label="Tipo de Destino"
                value={targetType}
                onChange={(val) => {
                  setTargetType(val as "account" | "card");
                  setTargetId("");
                }}
                data={[
                  { value: "account", label: "Conta Bancária (Corrente/Líquida)" },
                  { value: "card", label: "Cartão de Crédito" }
                ]}
              />

              {targetType === "account" ? (
                <Select
                  label="Conta de Destino"
                  placeholder="Selecione a conta"
                  value={targetId}
                  onChange={(val) => setTargetId(val || "")}
                  data={activeAccounts.map((a) => ({ value: a.id, label: a.name }))}
                />
              ) : (
                <Select
                  label="Cartão de Crédito"
                  placeholder="Selecione o cartão"
                  value={targetId}
                  onChange={(val) => setTargetId(val || "")}
                  data={activeCards.map((c) => ({
                    value: c.id,
                    label: c.institution ? `${c.name} (${c.institution})` : c.name
                  }))}
                />
              )}
            </SimpleGrid>

            <FileInput
              label="Arquivo Extrato (.csv)"
              placeholder="Clique para fazer upload"
              accept=".csv"
              leftSection={<IconUpload size={18} />}
              value={csvFile}
              onChange={handleFileChange}
            />

            {csvHeaders.length > 0 && (
              <Card withBorder p="md" radius="md">
                <Text fw={700} size="sm" mb="sm">
                  Mapeamento de Colunas do CSV
                </Text>
                <SimpleGrid cols={3}>
                  <Select
                    label="Data da Transação"
                    placeholder="Selecione a coluna"
                    value={mappings.eventDate}
                    onChange={(val) => setMappings((prev) => ({ ...prev, eventDate: val || "" }))}
                    data={csvHeaders.map((h) => ({ value: h, label: h }))}
                  />
                  <Select
                    label="Descrição/Histórico"
                    placeholder="Selecione a coluna"
                    value={mappings.description}
                    onChange={(val) => setMappings((prev) => ({ ...prev, description: val || "" }))}
                    data={csvHeaders.map((h) => ({ value: h, label: h }))}
                  />
                  <Select
                    label="Valor (R$)"
                    placeholder="Selecione a coluna"
                    value={mappings.amount}
                    onChange={(val) => setMappings((prev) => ({ ...prev, amount: val || "" }))}
                    data={csvHeaders.map((h) => ({ value: h, label: h }))}
                  />
                </SimpleGrid>

                <Select
                  label="Formato das Datas no CSV"
                  mt="sm"
                  value={dateFormat}
                  onChange={(val) => setDateFormat(val as "DMY" | "MDY" | "YMD")}
                  data={[
                    { value: "DMY", label: "Dia/Mês/Ano (ex: 28/05/2026)" },
                    { value: "MDY", label: "Mês/Dia/Ano (ex: 05/28/2026)" },
                    { value: "YMD", label: "Ano-Mês-Dia (ex: 2026-05-28)" }
                  ]}
                />
              </Card>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                color="teal"
                onClick={handleAnalyze}
                loading={isLoading}
                rightSection={<IconArrowRight size={18} />}
              >
                Analisar Matches
              </Button>
            </Group>
          </Stack>
        ) : (
          /* ── STEP 2: SIDE-BY-SIDE MATCHING & RESOLUTIONS ────────────── */
          <Group align="stretch" gap="md" style={{ flexGrow: 1, overflow: "hidden" }}>
            {/* LEFT COLUMN: CSV ROWS */}
            <Stack style={{ width: "45%", height: "100%" }} gap="xs">
              <Card withBorder p="xs" radius="sm">
                <SimpleGrid cols={3} spacing="xs">
                  <Badge color="green" variant="light" size="xs">
                    {stats.exact} Match Exato
                  </Badge>
                  <Badge color="yellow" variant="light" size="xs">
                    {stats.soft} Parcial
                  </Badge>
                  <Badge color="gray" variant="light" size="xs">
                    {stats.none} Sem Match
                  </Badge>
                </SimpleGrid>
              </Card>

              <ScrollArea style={{ height: "calc(100% - 60px)" }} scrollbars="y" type="scroll">
                <Stack gap={6}>
                  {previewItems.map((item, idx) => {
                    const res = resolutions[idx];
                    const isSelected = idx === selectedItemIndex;
                    const amount = item.csvRow.amountCents;

                    let badgeColor = "gray";
                    let badgeLabel = "Sem Match";
                    if (item.status === "exact_match") {
                      badgeColor = "green";
                      badgeLabel = "Match Exato";
                    } else if (item.status === "soft_match") {
                      badgeColor = "yellow";
                      badgeLabel = "Match Parcial";
                    }

                    if (res?.action === "ignore") {
                      badgeColor = "red";
                      badgeLabel = "Ignorado";
                    } else if (res?.action === "create") {
                      badgeColor = "blue";
                      badgeLabel = "Criar";
                    }

                    return (
                      <Card
                        key={idx}
                        withBorder
                        p="xs"
                        radius="sm"
                        style={{
                          cursor: "pointer",
                          backgroundColor: isSelected
                            ? "var(--mantine-color-teal-light)"
                            : "transparent",
                          borderColor: isSelected
                            ? "var(--mantine-color-teal-filled)"
                            : "var(--mantine-color-default-border)"
                        }}
                        onClick={() => setSelectedItemIndex(idx)}
                      >
                        <Group justify="space-between" align="center">
                          <Box style={{ flexGrow: 1, maxWidth: "70%" }}>
                            <Text fw={700} size="sm" truncate>
                              {item.csvRow.description}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {item.csvRow.date}
                            </Text>
                          </Box>
                          <Stack gap={2} align="flex-end">
                            <Text fw={700} size="sm" color={amount < 0 ? "red" : "green"}>
                              {amount < 0 ? "-" : "+"}{" "}
                              {formatMoney(moneyFromCents(Math.abs(amount)))}
                            </Text>
                            <Badge color={badgeColor} size="xs" variant="filled">
                              {badgeLabel}
                            </Badge>
                          </Stack>
                        </Group>
                      </Card>
                    );
                  })}
                </Stack>
              </ScrollArea>
            </Stack>

            {/* RIGHT COLUMN: RESOLUTION PANEL */}
            <Card withBorder style={{ width: "53%", height: "100%" }} p="md" radius="sm">
              {selectedItem ? (
                <Stack gap="md" style={{ height: "100%" }} justify="space-between">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={5}>Resolução do Item</Title>
                      <Badge
                        size="lg"
                        color={selectedItem.csvRow.amountCents < 0 ? "red" : "green"}
                      >
                        {formatMoney(moneyFromCents(Math.abs(selectedItem.csvRow.amountCents)))}
                      </Badge>
                    </Group>

                    <Card withBorder p="sm" bg="var(--mantine-color-gray-0)">
                      <Text size="xs" c="dimmed">
                        DADO IMPORTADO DO EXTRATO:
                      </Text>
                      <Text fw={700} size="md">
                        {selectedItem.csvRow.description}
                      </Text>
                      <Text size="sm">Data: {selectedItem.csvRow.date}</Text>
                    </Card>

                    <Divider label="Escolha a Ação" labelPosition="center" />

                    <SimpleGrid cols={3}>
                      <Button
                        variant={selectedResolution?.action === "match" ? "filled" : "light"}
                        color="green"
                        disabled={selectedItem.allCandidates.length === 0}
                        onClick={() =>
                          updateAction(selectedItemIndex, "match", {
                            transactionId: selectedItem.bestCandidate?.transactionId
                          })
                        }
                      >
                        Vincular Lançamento
                      </Button>
                      <Button
                        variant={selectedResolution?.action === "create" ? "filled" : "light"}
                        color="blue"
                        onClick={() => updateAction(selectedItemIndex, "create")}
                      >
                        Novo Lançamento
                      </Button>
                      <Button
                        variant={selectedResolution?.action === "ignore" ? "filled" : "light"}
                        color="red"
                        onClick={() => updateAction(selectedItemIndex, "ignore")}
                      >
                        Ignorar Linha
                      </Button>
                    </SimpleGrid>

                    {/* VINCULAR DETAILS */}
                    {selectedResolution?.action === "match" && (
                      <Stack gap="sm" mt="sm">
                        <Text fw={700} size="sm">
                          Selecione o Lançamento Correspondente:
                        </Text>
                        {selectedItem.allCandidates.map((c) => {
                          const isBest = c.transactionId === selectedResolution.transactionId;
                          return (
                            <Card
                              key={c.transactionId}
                              withBorder
                              p="xs"
                              radius="sm"
                              style={{
                                cursor: "pointer",
                                borderColor: isBest
                                  ? "var(--mantine-color-green-filled)"
                                  : "var(--mantine-color-default-border)",
                                backgroundColor: isBest
                                  ? "var(--mantine-color-green-light)"
                                  : "transparent"
                              }}
                              onClick={() =>
                                updateAction(selectedItemIndex, "match", {
                                  transactionId: c.transactionId
                                })
                              }
                            >
                              <Group justify="space-between">
                                <Box>
                                  <Text fw={700} size="sm">
                                    {c.description}
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    Data do Lançamento: {c.eventDate}
                                  </Text>
                                </Box>
                                <Group gap="xs">
                                  <Badge color={c.score >= 90 ? "green" : "yellow"}>
                                    Confiança: {c.score}%
                                  </Badge>
                                </Group>
                              </Group>
                            </Card>
                          );
                        })}
                      </Stack>
                    )}

                    {/* CREATE DETAILS */}
                    {selectedResolution?.action === "create" && (
                      <Stack gap="sm" mt="sm">
                        <Text fw={700} size="sm">
                          Criar novo lançamento com os dados do extrato:
                        </Text>
                        <Select
                          label="Subcategoria"
                          placeholder="Escolha a categoria"
                          searchable
                          required
                          value={customSubcategoryId}
                          onChange={(val) => handleUpdateCustomTransaction(val || "", customNotes)}
                          data={subcategoryOptions}
                        />
                        <TextInput
                          label="Observações/Notas (Opcional)"
                          placeholder="Notas da transação"
                          value={customNotes}
                          onChange={(e) =>
                            handleUpdateCustomTransaction(customSubcategoryId, e.target.value)
                          }
                        />
                      </Stack>
                    )}

                    {/* IGNORE DETAILS */}
                    {selectedResolution?.action === "ignore" && (
                      <Alert mt="sm" color="red" icon={<IconTrash size={16} />}>
                        Esta linha do extrato será descartada e nenhuma alteração será feita no
                        sistema.
                      </Alert>
                    )}
                  </Stack>

                  <Group justify="space-between" mt="xl">
                    <Button
                      variant="subtle"
                      disabled={selectedItemIndex === 0}
                      onClick={() => setSelectedItemIndex((prev) => prev - 1)}
                      leftSection={<IconArrowLeft size={16} />}
                    >
                      Anterior
                    </Button>
                    {selectedItemIndex < previewItems.length - 1 ? (
                      <Button
                        variant="subtle"
                        onClick={() => setSelectedItemIndex((prev) => prev + 1)}
                        rightSection={<IconArrowRight size={16} />}
                      >
                        Próximo
                      </Button>
                    ) : (
                      <Button
                        color="teal"
                        onClick={handleConfirmReconciliation}
                        loading={isLoading}
                        leftSection={<IconCheck size={18} />}
                      >
                        Finalizar Conciliação
                      </Button>
                    )}
                  </Group>
                </Stack>
              ) : (
                <Stack align="center" justify="center" style={{ height: "100%" }}>
                  <IconHelp size={48} color="dimmed" />
                  <Text c="dimmed">Selecione um item importado na lista ao lado.</Text>
                </Stack>
              )}
            </Card>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}

// ── CSV CLIENT-SIDE PARSER HELPERS ──────────────────────────────────────────

function parseCsvHeaderLine(headerLine: string): string[] {
  const delimiter = detectCsvDelimiter(headerLine);
  const fields: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i];
    if (char === '"') {
      if (insideQuotes && headerLine[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      fields.push(currentField.trim().replace(/^\uFEFF/, ""));
      currentField = "";
    } else {
      currentField += char;
    }
  }

  fields.push(currentField.trim().replace(/^\uFEFF/, ""));
  return fields;
}

function detectCsvDelimiter(headerLine: string): "," | ";" | "\t" {
  const candidates = [",", ";", "\t"] as const;
  let bestDelimiter: "," | ";" | "\t" = candidates[0];
  let maxCount = -1;

  for (const delimiter of candidates) {
    let count = 0;
    let insideQuotes = false;
    for (let i = 0; i < headerLine.length; i++) {
      const char = headerLine[i];
      if (char === '"') {
        if (insideQuotes && headerLine[i + 1] === '"') i++;
        else insideQuotes = !insideQuotes;
      } else if (char === delimiter && !insideQuotes) {
        count++;
      }
    }
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

function parseCsvToRows(
  csvText: string,
  mappings: { eventDate: string; description: string; amount: string },
  dateFormat: "DMY" | "MDY" | "YMD"
): CsvRow[] {
  const lines = csvText.split(/\r?\n/);
  if (lines.length <= 1) return [];

  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const delimiter = detectCsvDelimiter(headerLine);
  const headers = parseCsvHeaderLine(headerLine);

  const dateIdx = headers.indexOf(mappings.eventDate);
  const descIdx = headers.indexOf(mappings.description);
  const amountIdx = headers.indexOf(mappings.amount);

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    return [];
  }

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields: string[] = [];
    let currentField = "";
    let insideQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (insideQuotes && line[j + 1] === '"') {
          currentField += '"';
          j++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        fields.push(currentField.trim());
        currentField = "";
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());

    const rawDate = fields[dateIdx];
    const rawDesc = fields[descIdx];
    const rawAmount = fields[amountIdx];

    if (!rawDate || !rawAmount) continue;

    const date = parseDateStringClient(rawDate, dateFormat);
    const amountCents = parseAmountToCentsClient(rawAmount);

    if (date && amountCents !== null) {
      rows.push({
        date,
        description: rawDesc || "Sem descrição",
        amountCents
      });
    }
  }

  return rows;
}

function parseDateStringClient(rawDate: string, format: "DMY" | "MDY" | "YMD"): string | null {
  const cleaned = rawDate.replace(/[^\d/.-]/g, "").trim();
  const parts = cleaned.split(/[/.-]/);
  if (parts.length !== 3) return null;

  let day = 0,
    month = 0,
    year = 0;
  if (format === "DMY") {
    [day, month, year] = parts.map(Number);
  } else if (format === "MDY") {
    [month, day, year] = parts.map(Number);
  } else if (format === "YMD") {
    [year, month, day] = parts.map(Number);
  }

  if (year < 100) year += 2000;
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseAmountToCentsClient(rawAmount: string): number | null {
  let clean = rawAmount.replace(/[R$\s]/g, "").trim();
  if (!clean) return null;

  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");

  const isCommaDecimal = lastComma > lastDot;

  if (isCommaDecimal) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else {
    clean = clean.replace(/,/g, "");
  }

  const parsed = parseFloat(clean);
  if (isNaN(parsed)) return null;

  return Math.round(parsed * 100);
}
