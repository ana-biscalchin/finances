import {
  Alert,
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Drawer,
  FileInput,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip
} from "@mantine/core";
import {
  formatMoney,
  getCategoryColor,
  moneyFromCents,
  parseMoneyToCents,
  transactionStatuses
} from "@finances/domain";
import {
  IconCreditCard,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconAlertCircle,
  IconPlus,
  IconTrash,
  IconUpload,
  IconAlertTriangle,
  IconEraser
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { formatBusinessDateForDisplay } from "../date-format";

import { CreditCardsPage } from "./CreditCardsPage";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type CreditCard = {
  id: string;
  name: string;
  institution: string | null;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string | null;
  limitCents: number | null;
  isActive: boolean;
};

type Account = {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  defaultPaymentMethodId: string | null;
  isActive: boolean;
};

type Bill = {
  id: string;
  creditCardId: string;
  billMonth: string;
  closingDate: string | null;
  dueDate: string;
  status: string;
  paidAt: string | null;
};

type CardTransaction = {
  id: string;
  type: string;
  description: string;
  amountCents: number;
  eventDate: string;
  subcategoryId: string | null;
  status: string;
  notes: string | null;
};

type CardTransactionEditForm = {
  description: string;
  amountReais: number | string;
  eventDate: string;
  subcategoryId: string;
  status: string;
  notes: string;
};

type CardTransactionForm = CardTransactionEditForm;

type ImportPreviewItem = {
  tempId: string;
  eventDate: string;
  description: string;
  amountCents: number;
  type: "income" | "expense";
  accountId: string | null;
  paymentMethodId: string | null;
  creditCardId?: string | null;
  budgetMonth?: string | null;
  subcategoryId: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
  isGeneratedFutureInstallment?: boolean;
  isDuplicate: boolean;
  duplicateOf?: {
    id: string;
    description: string;
    eventDate: string;
    amountCents: number;
    accountName: string | null;
  } | null;
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

type BillData = {
  bill: Bill;
  transactions: CardTransaction[];
  totalCents: number;
};

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);
const emptySelectValue = "__none__";

function getNextMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const nextDate = new Date(year, month, 1);
  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
}

const defaultSelectedMonth = getNextMonth(currentMonth);

export function BillsPage() {
  return (
    <Tabs defaultValue="faturas">
      <Tabs.List mb="lg">
        <Tabs.Tab value="faturas" leftSection={<IconCreditCard size={16} />}>
          Faturas
        </Tabs.Tab>
        <Tabs.Tab value="cartoes" leftSection={<IconEdit size={16} />}>
          Gerenciar cartões
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="faturas">
        <FaturasView />
      </Tabs.Panel>

      <Tabs.Panel value="cartoes">
        <CreditCardsPage />
      </Tabs.Panel>
    </Tabs>
  );
}

function FaturasView() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(defaultSelectedMonth);

  const [billData, setBillData] = useState<Record<string, BillData | null>>({});
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [loadingBills, setLoadingBills] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const activeCards = useMemo(() => cards.filter((c) => c.isActive), [cards]);

  async function loadCards() {
    setIsLoadingCards(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/credit-cards`);
      if (!res.ok) throw new Error("Não foi possível carregar os cartões.");
      setCards(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setIsLoadingCards(false);
    }
  }

  async function loadCategories() {
    try {
      const res = await fetch(`${apiBaseUrl}/categories?includeInactive=true`);
      if (!res.ok) throw new Error("Não foi possível carregar as categorias.");
      setCategories(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      throw e;
    }
  }

  async function loadAccounts() {
    try {
      const res = await fetch(`${apiBaseUrl}/accounts`);
      if (!res.ok) throw new Error("Não foi possível carregar as contas.");
      setAccounts(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    }
  }

  async function loadBillForCard(cardId: string, month: string) {
    setLoadingBills((prev) => ({ ...prev, [cardId]: true }));
    try {
      const res = await fetch(`${apiBaseUrl}/credit-cards/${cardId}/bills?month=${month}`);
      if (!res.ok) throw new Error("Erro ao carregar fatura.");
      const data = (await res.json()) as BillData;
      setBillData((prev) => ({ ...prev, [cardId]: data }));
    } catch {
      setBillData((prev) => ({ ...prev, [cardId]: null }));
    } finally {
      setLoadingBills((prev) => ({ ...prev, [cardId]: false }));
    }
  }

  async function markAsPaid(cardId: string, billId: string, accountId: string) {
    try {
      const res = await fetch(`${apiBaseUrl}/credit-cards/${cardId}/bills/${billId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId })
      });
      if (!res.ok) {
        throw new Error(await getResponseError(res, "Erro ao marcar fatura como paga."));
      }
      await loadBillForCard(cardId, selectedMonth);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    }
  }

  function handleNavigateMonth(direction: number) {
    const [year, month] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(year, month - 1 + direction, 1);
    const nextYear = nextDate.getFullYear();
    const nextMonthNum = String(nextDate.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${nextYear}-${nextMonthNum}`);
  }

  useEffect(() => {
    void loadCards();
    void loadCategories();
    void loadAccounts();
  }, []);

  useEffect(() => {
    for (const card of activeCards) {
      void loadBillForCard(card.id, selectedMonth);
    }
  }, [activeCards, selectedMonth]);

  return (
    <Stack gap="lg">
      {/* Month selector */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={700}>Mês da fatura</Text>
            <Group gap="xs">
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconChevronLeft size={16} />}
                onClick={() => handleNavigateMonth(-1)}
              >
                Mês anterior
              </Button>
              <Button
                size="xs"
                variant="subtle"
                rightSection={<IconChevronRight size={16} />}
                onClick={() => handleNavigateMonth(1)}
              >
                Próximo mês
              </Button>
            </Group>
          </Group>
          <SimpleGrid cols={{ base: 3, xs: 4, sm: 6, md: 12 }} spacing="xs">
            {getMonthOptions().map((month) => (
              <Button
                key={month.value}
                fullWidth
                size="xs"
                variant={selectedMonth === month.value ? "filled" : "light"}
                onClick={() => setSelectedMonth(month.value)}
              >
                {month.label}
              </Button>
            ))}
          </SimpleGrid>
        </Stack>
      </Paper>

      {error ? <Alert color="red" variant="light">{error}</Alert> : null}

      {isLoadingCards ? (
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      ) : activeCards.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Stack align="center" gap="xs">
            <IconCreditCard size={40} opacity={0.3} />
            <Title order={4}>Nenhum cartão ativo</Title>
            <Text c="dimmed">
              Cadastre um cartão na aba "Gerenciar cartões" para ver as faturas aqui.
            </Text>
          </Stack>
        </Paper>
      ) : (
        activeCards.map((card) => (
          <CardBillPanel
            key={card.id}
            card={card}
            billData={billData[card.id] ?? null}
            isLoading={loadingBills[card.id] ?? false}
            selectedMonth={selectedMonth}
            categories={categories}
            accounts={accounts}
            onMarkAsPaid={(billId, accountId) => markAsPaid(card.id, billId, accountId)}
            onReload={() => void loadBillForCard(card.id, selectedMonth)}
          />
        ))
      )}
    </Stack>
  );
}

function CardBillPanel({
  card,
  billData,
  isLoading,
  selectedMonth,
  categories,
  accounts,
  onMarkAsPaid,
  onReload
}: {
  card: CreditCard;
  billData: BillData | null;
  isLoading: boolean;
  selectedMonth: string;
  categories: Category[];
  accounts: Account[];
  onMarkAsPaid: (billId: string, accountId: string) => Promise<void>;
  onReload: () => void;
}) {
  const [filterStatus, setFilterStatus] = useState<string>(emptySelectValue);
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>(emptySelectValue);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>(emptySelectValue);
  const [bulkSubcategoryId, setBulkSubcategoryId] = useState<string>(emptySelectValue);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<CardTransaction | null>(null);
  const [editForm, setEditForm] = useState<CardTransactionEditForm>(() => buildEditForm(null));
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CardTransactionForm>(() => buildEditForm(null));
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [csvTextContent, setCsvTextContent] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState({
    eventDate: "",
    description: "",
    amount: "",
    subcategoryId: emptySelectValue,
    installment: emptySelectValue,
    installmentNumber: emptySelectValue,
    installmentCount: emptySelectValue
  });
  const [importDateFormat, setImportDateFormat] = useState<"DMY" | "MDY" | "YMD">("DMY");
  const [previewTransactions, setPreviewTransactions] = useState<ImportPreviewItem[]>([]);
  const [previewInstallmentFilter, setPreviewInstallmentFilter] =
    useState<"all" | "single" | "installment">("all");
  const [selectedImportTempIds, setSelectedImportTempIds] = useState<Set<string>>(new Set());
  const [isImportPreviewLoading, setIsImportPreviewLoading] = useState(false);
  const [isImportConfirming, setIsImportConfirming] = useState(false);
  const [importModalError, setImportModalError] = useState<string | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paymentAccountId, setPaymentAccountId] = useState<string>(card.paymentAccountId ?? emptySelectValue);
  const [isPayingBill, setIsPayingBill] = useState(false);

  const isPaid = billData?.bill.status === "paid";
  const isClosed = billData?.bill.closingDate ? (today >= billData.bill.closingDate) : false;

  let statusLabel = "Aberta";
  let statusColor = "blue";

  if (isPaid) {
    statusLabel = "Paga";
    statusColor = "teal";
  } else if (isClosed) {
    statusLabel = "Fechada";
    statusColor = "orange";
  }

  const sourceTransactions = billData?.transactions ?? [];
  const transactions = useMemo(() => {
    return sourceTransactions.filter((transaction) => {
      if (filterStatus !== emptySelectValue && transaction.status !== filterStatus) {
        return false;
      }

      if (filterSubcategoryId !== emptySelectValue) {
        const desiredSubcategoryId = filterSubcategoryId === "__clear__" ? null : filterSubcategoryId;
        if (transaction.subcategoryId !== desiredSubcategoryId) {
          return false;
        }
      }

      return true;
    });
  }, [filterStatus, filterSubcategoryId, sourceTransactions]);
  const totalCents = billData?.totalCents ?? 0;
  const selectedTransactions = useMemo(
    () => sourceTransactions.filter((transaction) => selectedTransactionIds.has(transaction.id)),
    [selectedTransactionIds, sourceTransactions]
  );
  const filteredPreviewTransactions = useMemo(() => {
    if (previewInstallmentFilter === "single") {
      return previewTransactions.filter((item) => !item.installmentNumber || !item.installmentCount);
    }

    if (previewInstallmentFilter === "installment") {
      return previewTransactions.filter((item) => item.installmentNumber && item.installmentCount);
    }

    return previewTransactions;
  }, [previewInstallmentFilter, previewTransactions]);
  const previewSingleCount = useMemo(
    () => previewTransactions.filter((item) => !item.installmentNumber || !item.installmentCount).length,
    [previewTransactions]
  );
  const previewInstallmentCount = previewTransactions.length - previewSingleCount;
  const visiblePreviewIds = useMemo(
    () => filteredPreviewTransactions.map((item) => item.tempId),
    [filteredPreviewTransactions]
  );
  const allVisiblePreviewSelected =
    visiblePreviewIds.length > 0 && visiblePreviewIds.every((tempId) => selectedImportTempIds.has(tempId));
  const accountOptions = useMemo(
    () => accounts.map((account) => ({ value: account.id, label: account.name })),
    [accounts]
  );

  useEffect(() => {
    setSelectedTransactionIds(new Set());
    setPanelError(null);
    setCreateForm((current) => ({ ...current, eventDate: today }));
  }, [billData?.bill.id, selectedMonth]);

  function openEditModal(transaction: CardTransaction) {
    setEditingTransaction(transaction);
    setEditForm(buildEditForm(transaction));
    setEditError(null);
  }

  function closeEditModal() {
    if (isSavingEdit) return;
    setEditingTransaction(null);
    setEditError(null);
  }

  function openCreateDrawer() {
    setPanelError(null);
    setIsCreateDrawerOpen(true);
  }

  function openPayModal() {
    setPanelError(null);
    setPaymentAccountId(card.paymentAccountId ?? accounts[0]?.id ?? emptySelectValue);
    setIsPayModalOpen(true);
  }

  async function payBill() {
    if (!billData) return;

    if (paymentAccountId === emptySelectValue) {
      setPanelError("Escolha a conta usada para pagar a fatura.");
      return;
    }

    setIsPayingBill(true);
    setPanelError(null);

    try {
      await onMarkAsPaid(billData.bill.id, paymentAccountId);
      setIsPayModalOpen(false);
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setIsPayingBill(false);
    }
  }

  function closeCreateDrawer() {
    if (isSavingCreate) return;
    setIsCreateDrawerOpen(false);
  }

  function discardCreateDraft() {
    setCreateForm(buildEditForm(null));
    setPanelError(null);
  }

  function toggleTransactionSelection(transactionId: string) {
    setSelectedTransactionIds((current) => {
      const next = new Set(current);
      if (next.has(transactionId)) {
        next.delete(transactionId);
      } else {
        next.add(transactionId);
      }
      return next;
    });
  }

  function toggleSelectAllTransactions() {
    setSelectedTransactionIds((current) => {
      const visibleIds = transactions.map((transaction) => transaction.id);
      const allVisibleSelected =
        visibleIds.length > 0 && visibleIds.every((transactionId) => current.has(transactionId));

      if (allVisibleSelected) {
        const next = new Set(current);
        for (const transactionId of visibleIds) {
          next.delete(transactionId);
        }
        return next;
      }

      return new Set([...current, ...visibleIds]);
    });
  }

  async function updateCardTransaction(
    transaction: CardTransaction,
    changes: Partial<
      Pick<CardTransaction, "description" | "amountCents" | "eventDate" | "subcategoryId" | "status" | "notes">
    >
  ) {
    if (!billData) {
      throw new Error("Fatura não carregada.");
    }

    const response = await fetch(
      `${apiBaseUrl}/credit-cards/${card.id}/bills/${billData.bill.id}/transactions/${transaction.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: changes.description ?? transaction.description,
          amountCents: changes.amountCents ?? transaction.amountCents,
          eventDate: changes.eventDate ?? transaction.eventDate,
          subcategoryId:
            changes.subcategoryId === undefined ? transaction.subcategoryId : changes.subcategoryId,
          notes: changes.notes === undefined ? transaction.notes : changes.notes,
          status: changes.status ?? transaction.status
        })
      }
    );

    if (!response.ok) {
      throw new Error(await getResponseError(response, "Não foi possível atualizar a compra."));
    }
  }

  async function createCardTransaction() {
    if (!billData) {
      setPanelError("Fatura não carregada.");
      return;
    }

    const description = createForm.description.trim();
    const amountCents = parseCardTransactionAmount(createForm.amountReais);

    if (!description) {
      setPanelError("Informe a descrição da compra.");
      return;
    }

    if (!createForm.eventDate) {
      setPanelError("Informe a data da compra.");
      return;
    }

    if (amountCents <= 0) {
      setPanelError("Informe um valor maior que zero.");
      return;
    }

    setIsSavingCreate(true);
    setPanelError(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/credit-cards/${card.id}/bills/${billData.bill.id}/transactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description,
            amountCents,
            eventDate: createForm.eventDate,
            subcategoryId: createForm.subcategoryId === emptySelectValue ? null : createForm.subcategoryId,
            status: createForm.status,
            notes: createForm.notes.trim() || null
          })
        }
      );

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível lançar a compra."));
      }

      setCreateForm(buildEditForm(null));
      setIsCreateDrawerOpen(true);
      onReload();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setIsSavingCreate(false);
    }
  }

  async function deleteCardTransaction(transaction: CardTransaction) {
    if (!billData) return;

    const confirmed = window.confirm(`Excluir a compra "${transaction.description}" desta fatura?`);
    if (!confirmed) return;

    setPanelError(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/credit-cards/${card.id}/bills/${billData.bill.id}/transactions/${transaction.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível excluir a compra."));
      }

      setSelectedTransactionIds((current) => {
        const next = new Set(current);
        next.delete(transaction.id);
        return next;
      });
      onReload();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Erro inesperado.");
      onReload();
    }
  }

  async function updateCategoryInline(transaction: CardTransaction, nextSubcategoryId: string) {
    const subcategoryId = nextSubcategoryId === emptySelectValue ? null : nextSubcategoryId;
    if (transaction.subcategoryId === subcategoryId) return;

    setPanelError(null);
    try {
      await updateCardTransaction(transaction, { subcategoryId });
      onReload();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Erro inesperado.");
      onReload();
    }
  }

  async function saveEditedTransaction() {
    if (!editingTransaction) return;

    const description = editForm.description.trim();
    const amountCents = parseCardTransactionAmount(editForm.amountReais);

    if (!description) {
      setEditError("Informe a descrição da compra.");
      return;
    }

    if (!editForm.eventDate) {
      setEditError("Informe a data da compra.");
      return;
    }

    if (amountCents <= 0) {
      setEditError("Informe um valor maior que zero.");
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);
    setPanelError(null);

    try {
      await updateCardTransaction(editingTransaction, {
        description,
        amountCents,
        eventDate: editForm.eventDate,
        subcategoryId: editForm.subcategoryId === emptySelectValue ? null : editForm.subcategoryId,
        status: editForm.status,
        notes: editForm.notes.trim() || null
      });
      setEditingTransaction(null);
      onReload();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function applyBulkEdits() {
    if (selectedTransactionIds.size === 0) {
      setPanelError("Selecione pelo menos uma compra para editar em massa.");
      return;
    }

    const hasStatusEdit = bulkStatus !== emptySelectValue;
    const hasCategoryEdit = bulkSubcategoryId !== emptySelectValue;

    if (!hasStatusEdit && !hasCategoryEdit) {
      setPanelError("Escolha status ou categoria para aplicar em massa.");
      return;
    }

    setIsBulkSaving(true);
    setPanelError(null);

    try {
      for (const transaction of selectedTransactions) {
        await updateCardTransaction(transaction, {
          status: hasStatusEdit ? bulkStatus : undefined,
          subcategoryId: hasCategoryEdit
            ? bulkSubcategoryId === "__clear__"
              ? null
              : bulkSubcategoryId
            : undefined
        });
      }

      setSelectedTransactionIds(new Set());
      setBulkStatus(emptySelectValue);
      setBulkSubcategoryId(emptySelectValue);
      onReload();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Erro inesperado.");
      onReload();
    } finally {
      setIsBulkSaving(false);
    }
  }

  async function deleteSelectedTransactions() {
    if (!billData || selectedTransactionIds.size === 0) {
      setPanelError("Selecione pelo menos uma compra para excluir.");
      return;
    }

    const confirmed = window.confirm(
      `Excluir ${selectedTransactionIds.size} compra${selectedTransactionIds.size === 1 ? "" : "s"} selecionada${selectedTransactionIds.size === 1 ? "" : "s"} desta fatura?`
    );
    if (!confirmed) return;

    setIsBulkSaving(true);
    setPanelError(null);

    try {
      for (const transaction of selectedTransactions) {
        const response = await fetch(
          `${apiBaseUrl}/credit-cards/${card.id}/bills/${billData.bill.id}/transactions/${transaction.id}`,
          { method: "DELETE" }
        );

        if (!response.ok) {
          throw new Error(await getResponseError(response, `Não foi possível excluir "${transaction.description}".`));
        }
      }

      setSelectedTransactionIds(new Set());
      onReload();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Erro inesperado.");
      onReload();
    } finally {
      setIsBulkSaving(false);
    }
  }

  function resetImportState() {
    setImportStep(1);
    setImportFile(null);
    setCsvTextContent("");
    setCsvHeaders([]);
    setMappings({
      eventDate: "",
      description: "",
      amount: "",
      subcategoryId: emptySelectValue,
      installment: emptySelectValue,
      installmentNumber: emptySelectValue,
      installmentCount: emptySelectValue
    });
    setImportDateFormat("DMY");
    setPreviewTransactions([]);
    setPreviewInstallmentFilter("all");
    setSelectedImportTempIds(new Set());
    setImportModalError(null);
  }

  function handleFileChange(file: File | null) {
    setImportFile(file);
    setImportModalError(null);
    setPreviewTransactions([]);
    setPreviewInstallmentFilter("all");
    setSelectedImportTempIds(new Set());
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvTextContent(text);

      const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/)[0] ?? "";
      const headers = parseCsvHeaderLine(firstLine).filter(Boolean);
      setCsvHeaders(headers);

      const nextMappings = {
        eventDate: "",
        description: "",
        amount: "",
        subcategoryId: emptySelectValue,
        installment: emptySelectValue,
        installmentNumber: emptySelectValue,
        installmentCount: emptySelectValue
      };
      for (const header of headers) {
        const lower = header.toLowerCase();
        if (lower.includes("data") || lower.includes("date")) nextMappings.eventDate = header;
        else if (lower.includes("desc") || lower.includes("hist") || lower.includes("memo")) {
          nextMappings.description = header;
        } else if (lower.includes("valor") || lower.includes("amount") || lower.includes("val")) {
          nextMappings.amount = header;
        } else if (lower.includes("categoria") || lower.includes("category")) {
          nextMappings.subcategoryId = header;
        } else if (lower.includes("parcela") && lower.includes("total")) {
          nextMappings.installmentCount = header;
        } else if (lower.includes("parcela") || lower.includes("installment")) {
          nextMappings.installment = header;
        } else if (lower.includes("totalparcelas") || lower.includes("total parcelas")) {
          nextMappings.installmentCount = header;
        }
      }
      setMappings(nextMappings);
    };
    reader.readAsText(file);
  }

  async function generateImportPreview() {
    if (!billData) {
      setImportModalError("Fatura não carregada.");
      return;
    }

    if (!mappings.eventDate || !mappings.description || !mappings.amount) {
      setImportModalError("Preencha o mapeamento para Data, Descrição e Valor.");
      return;
    }

    setIsImportPreviewLoading(true);
    setImportModalError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/transactions/import-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvContent: csvTextContent,
          mappings: {
            ...mappings,
            subcategoryId: mappings.subcategoryId === emptySelectValue ? "" : mappings.subcategoryId,
            installment: mappings.installment === emptySelectValue ? "" : mappings.installment,
            installmentNumber:
              mappings.installmentNumber === emptySelectValue ? "" : mappings.installmentNumber,
            installmentCount:
              mappings.installmentCount === emptySelectValue ? "" : mappings.installmentCount
          },
          dateFormat: importDateFormat,
          defaultCreditCardId: card.id,
          importMode: "credit_card_bill",
          billMonth: selectedMonth
        })
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Erro ao gerar prévia da importação."));
      }

      const items = (await response.json()) as ImportPreviewItem[];
      setPreviewTransactions(items);
      setSelectedImportTempIds(new Set(items.filter((item) => !item.isDuplicate).map((item) => item.tempId)));
      setImportStep(3);
    } catch (error) {
      setImportModalError(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setIsImportPreviewLoading(false);
    }
  }

  async function confirmImport() {
    const toImport = previewTransactions.filter((item) => selectedImportTempIds.has(item.tempId));
    if (toImport.length === 0) {
      setImportModalError("Nenhuma compra selecionada para importação.");
      return;
    }

    setIsImportConfirming(true);
    setImportModalError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/transactions/import-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: toImport.map((item) => ({
            eventDate: item.eventDate,
            description: item.description,
            amountCents: item.amountCents,
            type: "expense",
            creditCardId: card.id,
            subcategoryId: item.subcategoryId,
            status: "confirmed",
            budgetMonth: item.budgetMonth,
            installmentNumber: item.installmentNumber,
            installmentCount: item.installmentCount
          })),
          preventDuplicates: true
        })
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Erro ao confirmar importação."));
      }

      setIsImportModalOpen(false);
      resetImportState();
      onReload();
    } catch (error) {
      setImportModalError(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setIsImportConfirming(false);
    }
  }

  const allVisibleSelected =
    transactions.length > 0 && transactions.every((transaction) => selectedTransactionIds.has(transaction.id));
  const hasVisibleSelection = transactions.some((transaction) => selectedTransactionIds.has(transaction.id));

  return (
    <Paper withBorder radius="md">
      {/* Card header */}
      <Group
        px="xl"
        py="md"
        justify="space-between"
        style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}
      >
        <Group gap="sm">
          <IconCreditCard size={20} />
          <div>
            <Text fw={700}>{card.name}</Text>
            {card.institution && (
              <Text size="xs" c="dimmed">{card.institution}</Text>
            )}
          </div>
          {billData ? (
            <Badge variant="light" color={statusColor}>
              {statusLabel} — vence {formatBusinessDateForDisplay(billData.bill.dueDate)}
            </Badge>
          ) : null}
        </Group>

        <Group gap="sm">
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={openCreateDrawer}
            disabled={!billData}
          >
            Novo lançamento
          </Button>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconUpload size={14} />}
            onClick={() => {
              resetImportState();
              setIsImportModalOpen(true);
            }}
            disabled={!billData}
          >
            Importar fatura
          </Button>
          {billData && !isPaid ? (
            <Tooltip label="Marcar como paga (sem duplicar despesa)">
              <Button
                size="xs"
                leftSection={<IconCheck size={14} />}
                variant="light"
                color="teal"
                onClick={openPayModal}
              >
                Marcar como paga
              </Button>
            </Tooltip>
          ) : null}
          <Text fw={700} c={totalCents > 0 ? "red" : "dimmed"}>
            {totalCents > 0 ? `− ${formatMoney(moneyFromCents(totalCents))}` : "R$ 0,00"}
          </Text>
        </Group>
      </Group>

      {panelError ? (
        <Alert color="red" variant="light" m="md">
          {panelError}
        </Alert>
      ) : null}

      {/* Transactions */}
      {isLoading ? (
        <Group justify="center" p="xl">
          <Loader size="sm" />
        </Group>
      ) : sourceTransactions.length === 0 ? (
        <Group p="xl" gap="xs" c="dimmed">
          <IconAlertCircle size={16} />
          <Text size="sm">
            Nenhum lançamento com este cartão em {selectedMonth}.
            Use Novo lançamento ou importe o CSV da fatura.
          </Text>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreateDrawer}>
            Novo lançamento
          </Button>
        </Group>
      ) : (
        <Stack gap={0}>
          <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <Select
                label="Status"
                data={[{ value: emptySelectValue, label: "Todos" }, ...transactionStatuses]}
                value={filterStatus}
                onChange={(value) => setFilterStatus(value ?? emptySelectValue)}
              />
              <Select
                label="Categoria"
                data={[
                  { value: emptySelectValue, label: "Todas" },
                  { value: "__clear__", label: "Sem categoria" },
                  ...buildCategoryGroups(categories)
                ]}
                value={filterSubcategoryId}
                onChange={(value) => setFilterSubcategoryId(value ?? emptySelectValue)}
                searchable
                renderOption={renderCategoryOption}
              />
              <Group align="flex-end">
                <Button
                  fullWidth
                  variant="light"
                  onClick={() => {
                    setFilterStatus(emptySelectValue);
                    setFilterSubcategoryId(emptySelectValue);
                  }}
                >
                  Limpar filtros
                </Button>
              </Group>
            </SimpleGrid>
          </Box>

          {selectedTransactionIds.size > 0 ? (
            <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <div>
                    <Text fw={700}>Ações em massa</Text>
                    <Text size="xs" c="dimmed">
                      {selectedTransactionIds.size} compras selecionadas
                    </Text>
                  </div>
                  <Button
                    color="red"
                    variant="light"
                    size="xs"
                    leftSection={<IconTrash size={14} />}
                    loading={isBulkSaving}
                    onClick={() => void deleteSelectedTransactions()}
                  >
                    Excluir selecionadas
                  </Button>
                </Group>
                {selectedTransactionIds.size > 1 ? (
                  <div>
                    <Text fw={700}>Edição em massa</Text>
                    <Text size="xs" c="dimmed">
                      {selectedTransactionIds.size} compras selecionadas
                    </Text>
                  </div>
                ) : null}
                {selectedTransactionIds.size > 1 ? (
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                    <Select
                      label="Status"
                      data={[{ value: emptySelectValue, label: "Manter status atual" }, ...transactionStatuses]}
                      value={bulkStatus}
                      onChange={(value) => setBulkStatus(value ?? emptySelectValue)}
                    />
                    <Select
                      label="Categoria"
                      data={[
                        { value: emptySelectValue, label: "Manter categoria atual" },
                        { value: "__clear__", label: "Sem categoria" },
                        ...buildCategoryGroups(categories)
                      ]}
                      value={bulkSubcategoryId}
                      onChange={(value) => setBulkSubcategoryId(value ?? emptySelectValue)}
                      searchable
                      renderOption={renderCategoryOption}
                    />
                    <Group align="flex-end">
                      <Button
                        fullWidth
                        loading={isBulkSaving}
                        onClick={() => void applyBulkEdits()}
                      >
                        Aplicar
                      </Button>
                    </Group>
                  </SimpleGrid>
                ) : null}
              </Stack>
            </Box>
          ) : null}

          {transactions.length === 0 ? (
            <Group p="xl" gap="xs" c="dimmed">
              <IconAlertCircle size={16} />
              <Text size="sm">Nenhuma compra encontrada com os filtros atuais.</Text>
            </Group>
          ) : (
            <Table.ScrollContainer minWidth={860}>
              <Table verticalSpacing="xs" fz="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 44 }}>
                      <Checkbox
                        aria-label="Selecionar compras visíveis"
                        checked={allVisibleSelected}
                        indeterminate={hasVisibleSelection && !allVisibleSelected}
                        onChange={toggleSelectAllTransactions}
                      />
                    </Table.Th>
                    <Table.Th>Data</Table.Th>
                    <Table.Th>Descrição</Table.Th>
                    <Table.Th>Valor</Table.Th>
                    <Table.Th>Categoria</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Ações</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {transactions.map((transaction) => (
                    <Table.Tr key={transaction.id}>
                      <Table.Td>
                        <Checkbox
                          aria-label={`Selecionar compra ${transaction.description}`}
                          checked={selectedTransactionIds.has(transaction.id)}
                          onChange={() => toggleTransactionSelection(transaction.id)}
                        />
                      </Table.Td>
                      <Table.Td c="dimmed">{formatBusinessDateForDisplay(transaction.eventDate)}</Table.Td>
                      <Table.Td>
                        <Text fw={500}>{transaction.description}</Text>
                        {transaction.notes ? (
                          <Text size="xs" c="dimmed">{transaction.notes}</Text>
                        ) : null}
                      </Table.Td>
                      <Table.Td>
                        <Text fw={700} c="red">
                          − {formatMoney(moneyFromCents(transaction.amountCents))}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Select
                          size="xs"
                          variant="unstyled"
                          placeholder="Sem categoria"
                          data={[
                            { value: emptySelectValue, label: "Sem categoria" },
                            ...buildCategoryGroups(categories)
                          ]}
                          value={transaction.subcategoryId ?? emptySelectValue}
                          onChange={(value) =>
                            void updateCategoryInline(transaction, value ?? emptySelectValue)
                          }
                          searchable
                          styles={{
                            input: {
                              cursor: "pointer",
                              fontWeight: 500,
                              padding: 0,
                              minHeight: "unset",
                              height: "auto"
                            },
                            root: { minWidth: 170 }
                          }}
                          renderOption={renderCategoryOption}
                        />
                      </Table.Td>
                      <Table.Td>{renderStatusBadge(transaction.status)}</Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Tooltip label="Editar compra">
                            <ActionIcon
                              variant="subtle"
                              aria-label={`Editar compra ${transaction.description}`}
                              onClick={() => openEditModal(transaction)}
                            >
                              <IconEdit size={18} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Excluir compra">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label={`Excluir compra ${transaction.description}`}
                              onClick={() => void deleteCardTransaction(transaction)}
                            >
                              <IconTrash size={18} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Stack>
      )}
      <Modal
        opened={isPayModalOpen}
        onClose={() => {
          if (!isPayingBill) setIsPayModalOpen(false);
        }}
        title={
          <Group gap="xs">
            <IconCheck size={22} color="var(--mantine-color-teal-filled)" />
            <Text fw={700} size="lg">Pagar fatura</Text>
          </Group>
        }
        radius="md"
        padding="lg"
      >
        <Stack gap="md">
          {billData ? (
            <Paper withBorder p="sm" radius="sm">
              <Group justify="space-between" align="center">
                <div>
                  <Text fw={700}>{card.name}</Text>
                  <Text size="xs" c="dimmed">
                    Vencimento {formatBusinessDateForDisplay(billData.bill.dueDate)}
                  </Text>
                </div>
                <Text fw={700} c={totalCents > 0 ? "red" : "dimmed"}>
                  {totalCents > 0 ? `− ${formatMoney(moneyFromCents(totalCents))}` : "R$ 0,00"}
                </Text>
              </Group>
            </Paper>
          ) : null}

          <Select
            label="Conta de pagamento"
            placeholder="Selecione a conta"
            data={accountOptions}
            value={paymentAccountId === emptySelectValue ? null : paymentAccountId}
            onChange={(value) => setPaymentAccountId(value ?? emptySelectValue)}
            searchable
            nothingFoundMessage="Nenhuma conta ativa encontrada"
            required
          />

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setIsPayModalOpen(false)} disabled={isPayingBill}>
              Cancelar
            </Button>
            <Button
              color="teal"
              leftSection={<IconCheck size={16} />}
              loading={isPayingBill}
              disabled={paymentAccountId === emptySelectValue}
              onClick={() => void payBill()}
            >
              Confirmar pagamento
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={
          <Group gap="xs">
            <IconUpload size={22} color="var(--mantine-color-blue-filled)" />
            <Text fw={700} size="lg">Importar fatura</Text>
          </Group>
        }
        size="min(96vw, 1180px)"
        radius="md"
        padding="xl"
      >
        <Stack gap="md">
          <Group justify="space-between" mb="xs">
            <Badge color={importStep >= 1 ? "blue" : "gray"} variant={importStep === 1 ? "filled" : "light"}>
              1. Arquivo & Fatura
            </Badge>
            <Badge color={importStep >= 2 ? "blue" : "gray"} variant={importStep === 2 ? "filled" : "light"}>
              2. Mapear Colunas
            </Badge>
            <Badge color={importStep >= 3 ? "blue" : "gray"} variant={importStep === 3 ? "filled" : "light"}>
              3. Pré-visualização
            </Badge>
          </Group>

          {importModalError ? (
            <Alert color="red" title="Erro" icon={<IconAlertTriangle size={18} />} variant="light">
              {importModalError}
            </Alert>
          ) : null}

          {importStep === 1 ? (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Faça o upload do CSV da fatura. O cartão e o mês vêm da fatura aberta.
              </Text>

              <Paper withBorder p="sm" radius="sm">
                <Group justify="space-between" align="center">
                  <div>
                    <Text fw={700}>{card.name}</Text>
                    <Text size="xs" c="dimmed">
                      Compras desta fatura entram no cartão; parcelas restantes serão projetadas nas próximas faturas.
                    </Text>
                  </div>
                  <Badge variant="light" color="indigo">
                    {selectedMonth}
                  </Badge>
                </Group>
              </Paper>

              <FileInput
                label="Arquivo CSV da fatura"
                placeholder="Clique para escolher o arquivo"
                accept=".csv"
                value={importFile}
                onChange={handleFileChange}
                clearable
                required
              />

              <Group justify="flex-end" mt="md">
                <Button
                  onClick={() => setImportStep(2)}
                  disabled={!importFile || !csvTextContent || csvHeaders.length === 0}
                >
                  Continuar
                </Button>
              </Group>
            </Stack>
          ) : null}

          {importStep === 2 ? (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Selecione as colunas do CSV. Para parcelamento, use coluna combinada 2/3 ou as colunas separadas Parcela atual e Total de parcelas.
              </Text>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Select
                label="Coluna de data"
                data={csvHeaders}
                value={mappings.eventDate}
                onChange={(value) => setMappings((current) => ({ ...current, eventDate: value ?? "" }))}
                required
              />
              <Select
                label="Formato da data"
                data={[
                  { value: "DMY", label: "DD/MM/AAAA" },
                  { value: "MDY", label: "MM/DD/AAAA" },
                  { value: "YMD", label: "AAAA-MM-DD" }
                ]}
                value={importDateFormat}
                onChange={(value) => setImportDateFormat((value as "DMY" | "MDY" | "YMD") ?? "DMY")}
                required
              />
              <Select
                label="Coluna de descrição"
                data={csvHeaders}
                value={mappings.description}
                onChange={(value) => setMappings((current) => ({ ...current, description: value ?? "" }))}
                required
              />
              <Select
                label="Coluna de valor"
                data={csvHeaders}
                value={mappings.amount}
                onChange={(value) => setMappings((current) => ({ ...current, amount: value ?? "" }))}
                required
              />
              <Select
                label="Coluna de categoria"
                data={[{ value: emptySelectValue, label: "Definir depois" }, ...csvHeaders.map((header) => ({ value: header, label: header }))]}
                value={mappings.subcategoryId}
                onChange={(value) => setMappings((current) => ({ ...current, subcategoryId: value ?? emptySelectValue }))}
                clearable
              />
              <Select
                label="Coluna de parcela (2/3)"
                description="Use quando uma coluna já vem como 2/3 ou 2 de 3."
                data={[{ value: emptySelectValue, label: "Sem coluna combinada" }, ...csvHeaders.map((header) => ({ value: header, label: header }))]}
                value={mappings.installment}
                onChange={(value) => setMappings((current) => ({ ...current, installment: value ?? emptySelectValue }))}
                clearable
              />
              <Select
                label="Parcela atual"
                description="Use com Total de parcelas quando vierem em colunas separadas."
                data={[{ value: emptySelectValue, label: "Sem parcela atual" }, ...csvHeaders.map((header) => ({ value: header, label: header }))]}
                value={mappings.installmentNumber}
                onChange={(value) => setMappings((current) => ({ ...current, installmentNumber: value ?? emptySelectValue }))}
                clearable
              />
              <Select
                label="Total de parcelas"
                data={[{ value: emptySelectValue, label: "Sem total de parcelas" }, ...csvHeaders.map((header) => ({ value: header, label: header }))]}
                value={mappings.installmentCount}
                onChange={(value) => setMappings((current) => ({ ...current, installmentCount: value ?? emptySelectValue }))}
                clearable
              />
              </SimpleGrid>

              <Group justify="space-between" mt="md">
                <Button variant="subtle" onClick={() => setImportStep(1)}>
                  Voltar
                </Button>
                <Button
                  onClick={() => void generateImportPreview()}
                  loading={isImportPreviewLoading}
                  disabled={!mappings.eventDate || !mappings.description || !mappings.amount}
                >
                  Ver Prévia
                </Button>
              </Group>
            </Stack>
          ) : null}

          {importStep === 3 ? (
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Stack gap={2}>
                  <Text size="sm" fw={600}>
                    {filteredPreviewTransactions.length} de {previewTransactions.length} compras na prévia.
                  </Text>
                  <Text size="xs" c="dimmed">
                    {previewSingleCount} à vista · {previewInstallmentCount} parceladas
                  </Text>
                </Stack>
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() =>
                    setSelectedImportTempIds((current) => {
                      if (allVisiblePreviewSelected) {
                        const next = new Set(current);
                        for (const tempId of visiblePreviewIds) {
                          next.delete(tempId);
                        }
                        return next;
                      }

                      return new Set([...current, ...visiblePreviewIds]);
                    })
                  }
                  disabled={visiblePreviewIds.length === 0}
                >
                  {allVisiblePreviewSelected ? "Desmarcar visíveis" : "Selecionar visíveis"}
                </Button>
              </Group>

              <SegmentedControl
                value={previewInstallmentFilter}
                onChange={(value) =>
                  setPreviewInstallmentFilter(value as "all" | "single" | "installment")
                }
                data={[
                  { value: "all", label: "Todas" },
                  { value: "single", label: "À vista" },
                  { value: "installment", label: "Parceladas" }
                ]}
                fullWidth
              />

              <Text size="xs" c="dimmed">
                Linhas já duplicadas começam desmarcadas. Se uma linha vier como 2/3, a prévia inclui a 2/3 nesta fatura e gera a 3/3 no mês seguinte.
              </Text>

              <Box
                style={{
                  border: "1px solid var(--mantine-color-gray-3)",
                  borderRadius: "var(--mantine-radius-md)",
                  maxHeight: 340,
                  overflow: "auto"
                }}
              >
                <Table.ScrollContainer minWidth={1040}>
                  <Table verticalSpacing="xs" striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: 44 }} />
                        <Table.Th style={{ width: 96 }}>Data</Table.Th>
                        <Table.Th style={{ minWidth: 280 }}>Descrição</Table.Th>
                        <Table.Th style={{ width: 104 }}>Fatura</Table.Th>
                        <Table.Th style={{ width: 92 }}>Parcela</Table.Th>
                        <Table.Th style={{ width: 128 }}>Valor</Table.Th>
                        <Table.Th style={{ width: 180 }}>Categoria</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredPreviewTransactions.map((item) => {
                        const isSelected = selectedImportTempIds.has(item.tempId);
                        return (
                          <Table.Tr key={item.tempId} style={{ opacity: isSelected ? 1 : 0.6 }}>
                            <Table.Td>
                              <Checkbox
                                checked={isSelected}
                                onChange={() =>
                                  setSelectedImportTempIds((current) => {
                                    const next = new Set(current);
                                    if (next.has(item.tempId)) next.delete(item.tempId);
                                    else next.add(item.tempId);
                                    return next;
                                  })
                                }
                              />
                            </Table.Td>
                            <Table.Td>{formatBusinessDateForDisplay(item.eventDate)}</Table.Td>
                            <Table.Td>
                              <Group gap="xs" wrap="nowrap">
                                <Text fw={600}>{item.description}</Text>
                                {item.isDuplicate ? (
                                  <Badge color="yellow" size="xs" variant="light">
                                    Possível duplicada
                                  </Badge>
                                ) : null}
                                {item.isGeneratedFutureInstallment ? (
                                  <Badge color="indigo" size="xs" variant="light">
                                    futura
                                  </Badge>
                                ) : null}
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                variant="light"
                                color={item.budgetMonth === selectedMonth ? "blue" : "indigo"}
                                style={{ minWidth: 72, justifyContent: "center" }}
                              >
                                {item.budgetMonth ?? "-"}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              {item.installmentNumber && item.installmentCount ? (
                                <Badge
                                  variant="light"
                                  color="grape"
                                  style={{ minWidth: 48, justifyContent: "center" }}
                                >
                                  {item.installmentNumber}/{item.installmentCount}
                                </Badge>
                              ) : (
                                <Text size="sm" c="dimmed">À vista</Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <Text fw={700} c="red">
                                − {formatMoney(moneyFromCents(item.amountCents))}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Select
                                size="xs"
                                placeholder="Sem categoria"
                                data={[
                                  { value: emptySelectValue, label: "Sem categoria" },
                                  ...buildCategoryGroups(categories)
                                ]}
                                value={item.subcategoryId ?? emptySelectValue}
                                onChange={(value) =>
                                  setPreviewTransactions((current) =>
                                    current.map((previewItem) =>
                                      previewItem.tempId === item.tempId
                                        ? {
                                            ...previewItem,
                                            subcategoryId: value === emptySelectValue ? null : value
                                          }
                                        : previewItem
                                    )
                                  )
                                }
                                searchable
                                renderOption={renderCategoryOption}
                              />
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Box>

              <Group justify="flex-end">
                <Text size="xs" c="dimmed">
                  {selectedImportTempIds.size} selecionadas
                </Text>
                <Button
                  color="teal"
                  leftSection={<IconCheck size={18} />}
                  loading={isImportConfirming}
                  onClick={() => void confirmImport()}
                >
                  Confirmar importação
                </Button>
              </Group>
            </Stack>
          ) : null}
        </Stack>
      </Modal>
      <Drawer
        opened={isCreateDrawerOpen}
        onClose={closeCreateDrawer}
        position="right"
        size="min(100vw, 520px)"
        withCloseButton={false}
        title={
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <Tooltip label="Recolher como rascunho">
              <ActionIcon
                variant="subtle"
                aria-label="Recolher como rascunho"
                onClick={closeCreateDrawer}
              >
                <IconChevronRight size={20} />
              </ActionIcon>
            </Tooltip>
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text size="xs" tt="uppercase" fw={700} c="teal">
                Lançamento rápido
              </Text>
              <Title order={3} style={{ overflowWrap: "anywhere" }}>
                Novo lançamento
              </Title>
              <Text size="sm" c="dimmed">
                Compra lançada direto na fatura {selectedMonth}.
              </Text>
            </Stack>
          </Group>
        }
      >
        <Stack mih="calc(100vh - 170px)" pb={0}>
          {panelError ? (
            <Alert color="red" variant="light">
              {panelError}
            </Alert>
          ) : null}

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              Tipo
            </Text>
            <SegmentedControl
              fullWidth
              data={[{ value: "expense", label: "Despesa" }]}
              value="expense"
              disabled
            />
          </Stack>

          <TextInput
            label="Descrição"
            placeholder="Mercado, farmácia, assinatura..."
            value={createForm.description}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, description: event.currentTarget.value }))
            }
            required
          />

          <NumberInput
            label="Valor"
            min={0}
            decimalScale={2}
            fixedDecimalScale
            prefix="R$ "
            decimalSeparator=","
            thousandSeparator="."
            value={createForm.amountReais}
            onChange={(value) =>
              setCreateForm((current) => ({ ...current, amountReais: value }))
            }
            required
          />

          <TextInput
            label="Data da compra"
            type="date"
            value={createForm.eventDate}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, eventDate: event.currentTarget.value }))
            }
            required
          />

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              Forma de pagamento
            </Text>
            <SegmentedControl
              fullWidth
              data={[{ value: "card", label: "Cartão de crédito" }]}
              value="card"
              disabled
            />
          </Stack>

          <Select
            label="Cartão de crédito"
            data={[
              {
                value: card.id,
                label: card.institution ? `${card.name} (${card.institution})` : card.name
              }
            ]}
            value={card.id}
            disabled
            required
          />

          <TextInput
            label="Mês da fatura"
            description="Definido pela fatura aberta nesta página."
            value={selectedMonth}
            disabled
          />

          <Select
            label="Categoria"
            data={[{ value: emptySelectValue, label: "Sem categoria" }, ...buildCategoryGroups(categories)]}
            value={createForm.subcategoryId}
            onChange={(value) =>
              setCreateForm((current) => ({ ...current, subcategoryId: value ?? emptySelectValue }))
            }
            searchable
            renderOption={renderCategoryOption}
          />

          <Select
            label="Status"
            data={transactionStatuses}
            value={createForm.status}
            onChange={(value) =>
              setCreateForm((current) => ({ ...current, status: value ?? "planned" }))
            }
            required
          />

          <Textarea
            label="Observação"
            autosize
            minRows={2}
            value={createForm.notes}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, notes: event.currentTarget.value }))
            }
          />

          <Group
            justify="space-between"
            mt="auto"
            pt="md"
            pb="md"
            bg="var(--mantine-color-body)"
            style={{
              borderTop: "1px solid var(--mantine-color-gray-2)",
              position: "sticky",
              bottom: 0,
              zIndex: 10
            }}
          >
            <Tooltip label="Limpar lançamento">
              <ActionIcon
                size="lg"
                variant="subtle"
                color="gray"
                aria-label="Limpar lançamento"
                onClick={discardCreateDraft}
              >
                <IconEraser size={20} />
              </ActionIcon>
            </Tooltip>
            <Button onClick={() => void createCardTransaction()} loading={isSavingCreate}>
              Salvar
            </Button>
          </Group>
        </Stack>
      </Drawer>
      <Drawer
        opened={editingTransaction !== null}
        onClose={closeEditModal}
        title="Editar compra do cartão"
        position="right"
        size="md"
        padding="lg"
      >
        <Stack gap="md" h="100%">
          {editError ? (
            <Alert color="red" variant="light">
              {editError}
            </Alert>
          ) : null}

          <TextInput
            label="Descrição"
            value={editForm.description}
            onChange={(event) =>
              setEditForm((current) => ({ ...current, description: event.currentTarget.value }))
            }
            required
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Data da compra"
              type="date"
              value={editForm.eventDate}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, eventDate: event.currentTarget.value }))
              }
              required
            />
            <NumberInput
              label="Valor"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              prefix="R$ "
              decimalSeparator=","
              thousandSeparator="."
              value={editForm.amountReais}
              onChange={(value) =>
                setEditForm((current) => ({ ...current, amountReais: value }))
              }
              required
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="Categoria"
              data={[
                { value: emptySelectValue, label: "Sem categoria" },
                ...buildCategoryGroups(categories)
              ]}
              value={editForm.subcategoryId}
              onChange={(value) =>
                setEditForm((current) => ({ ...current, subcategoryId: value ?? emptySelectValue }))
              }
              searchable
              renderOption={renderCategoryOption}
            />
            <Select
              label="Status"
              data={transactionStatuses}
              value={editForm.status}
              onChange={(value) =>
                setEditForm((current) => ({ ...current, status: value ?? "planned" }))
              }
              required
            />
          </SimpleGrid>

          <Textarea
            label="Observação"
            autosize
            minRows={2}
            value={editForm.notes}
            onChange={(event) =>
              setEditForm((current) => ({ ...current, notes: event.currentTarget.value }))
            }
          />

          <Group
            justify="flex-end"
            mt="auto"
            pt="md"
            pb="md"
            bg="var(--mantine-color-body)"
            style={{
              borderTop: "1px solid var(--mantine-color-gray-2)",
              position: "sticky",
              bottom: 0,
              zIndex: 10
            }}
          >
            <Button variant="subtle" onClick={closeEditModal} disabled={isSavingEdit}>
              Cancelar
            </Button>
            <Button onClick={() => void saveEditedTransaction()} loading={isSavingEdit}>
              Salvar
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </Paper>
  );
}

function getMonthOptions() {
  const now = new Date();
  const options = [];
  // Exibiremos de -3 meses ate +8 meses do mes atual
  for (let i = -3; i <= 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(d).replace(".", "");
    options.push({ value, label });
  }
  return options;
}

function renderStatusBadge(status: string) {
  const colors: Record<string, string> = {
    planned: "gray",
    confirmed: "blue",
    reconciled: "teal",
    canceled: "red"
  };
  const labels: Record<string, string> = {
    planned: "Previsto",
    confirmed: "Confirmado",
    reconciled: "Conciliado",
    canceled: "Cancelado"
  };
  return (
    <Badge color={colors[status] ?? "gray"} variant="light" size="sm">
      {labels[status] ?? status}
    </Badge>
  );
}

function buildEditForm(transaction: CardTransaction | null): CardTransactionEditForm {
  return {
    description: transaction?.description ?? "",
    amountReais: transaction ? moneyFromCents(transaction.amountCents) : 0,
    eventDate: transaction?.eventDate ?? today,
    subcategoryId: transaction?.subcategoryId ?? emptySelectValue,
    status: transaction?.status ?? "planned",
    notes: transaction?.notes ?? ""
  };
}

function parseCardTransactionAmount(value: number | string) {
  if (typeof value === "number") {
    return Math.round(value * 100);
  }

  return parseMoneyToCents(value);
}

function buildCategoryGroups(categories: Category[]) {
  return categories
    .filter((category) => category.nature === "expense")
    .map((category) => ({
      group: category.name,
      items: category.subcategories.map((sub) => ({
        value: sub.id,
        label: `${category.name} > ${sub.name}`,
        color: getCategoryColor(category.id)
      } as unknown as { value: string; label: string; color: string }))
    }))
    .filter((group) => group.items.length > 0);
}

function renderCategoryOption({
  option
}: {
  option: { label: string };
}) {
  const text = option.label.includes(" > ") ? option.label.split(" > ")[1] : option.label;
  const itemColor = (option as { color?: unknown }).color;

  if (typeof itemColor === "string") {
    return (
      <Badge variant="light" color={itemColor} size="md" fw={600} style={{ textTransform: "none" }}>
        {text}
      </Badge>
    );
  }

  return <Text size="sm">{text}</Text>;
}

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
      fields.push(currentField.trim());
      currentField = "";
    } else {
      currentField += char;
    }
  }

  fields.push(currentField.trim());
  return fields;
}

function detectCsvDelimiter(headerLine: string): "," | ";" | "\t" {
  const candidates = [",", ";", "\t"] as const;

  return candidates
    .map((delimiter) => ({
      delimiter,
      count: countDelimiterOutsideQuotes(headerLine, delimiter)
    }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function countDelimiterOutsideQuotes(line: string, delimiter: "," | ";" | "\t"): number {
  let count = 0;
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      count++;
    }
  }

  return count;
}

async function getResponseError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? fallback;
  } catch {
    return fallback;
  }
}
