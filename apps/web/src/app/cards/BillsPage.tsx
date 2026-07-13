import {
  Alert,
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Collapse,
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
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip
} from "@mantine/core";
import { formatMoney, moneyFromCents, parseMoneyToCents } from "@finances/domain";
import {
  IconCreditCard,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconEdit,
  IconAlertCircle,
  IconPlus,
  IconTrash,
  IconUpload,
  IconAlertTriangle,
  IconEraser,
  IconCopy,
  IconSearch
} from "@tabler/icons-react";
import { useClipboard } from "@mantine/hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  formatBusinessDateForDisplay,
  getLastDayOfMonth,
  getTodayBusinessDate
} from "../date-format";
import { BusinessDateInput } from "../shared/BusinessDateInput";
import { BillPaymentPanel } from "./BillPaymentPanel";
import { parseCsvHeaderLine } from "../shared/csv-utils";
import { formatCategoryPromptGroups, getAmountColor } from "../shared/transaction-ui";
import { getErrorMessage, getResponseError, reportClientError } from "../shared/errors";
import { CategoryMultiSelect, CategorySelect, QuickCategoryEdit } from "../shared/CategorySelect";
import { MonthSelector } from "../shared/MonthSelector";
import { QuickAmountEdit, QuickDateEdit, QuickTextEdit } from "../shared/QuickEditFields";
import { SortableTableHeader } from "../shared/SortableTableHeader";

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
  minimumDueCents: number | null;
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
  installmentPurchaseId?: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
  installmentAmountCents?: number | null;
  installmentDueMonth?: string | null;
};

type CardTransactionEditForm = {
  type: "expense" | "refund" | "chargeback";
  description: string;
  amountReais: number | string;
  eventDate: string;
  subcategoryId: string;
  status: string;
  notes: string;
  installmentCount: number;
};

type CardTransactionForm = CardTransactionEditForm;

type ImportPreviewItem = {
  tempId: string;
  eventDate: string;
  description: string;
  amountCents: number;
  type: "income" | "expense" | "refund" | "chargeback";
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
  summary: { status: string; remainingCents: number; minimumMet: boolean };
  payments: Array<{ id: string; paymentDate: string; principalCents: number; interestCents: number; penaltyCents: number; reversedAt: string | null }>;
};

type SortDirection = "asc" | "desc";
type BillSortColumn = "date" | "description" | "amount" | "category";
type DateFilterMode = "all" | "until" | "period";

const today = getTodayBusinessDate();
const currentMonth = today.slice(0, 7);
const emptySelectValue = "__none__";
const missingFilterValue = "__missing__";

function getNextMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const nextDate = new Date(year, month, 1);
  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
}

const defaultSelectedMonth = getNextMonth(currentMonth);

export function BillsPage() {
  return <FaturasView />;
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
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("faturas-collapsed-cards");
    if (!saved) return {};
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem("faturas-collapsed-cards");
      return {};
    }
  });

  const activeCards = useMemo(() => cards.filter((c) => c.isActive), [cards]);

  function toggleCardCollapsed(cardId: string) {
    setCollapsedCards((current) => {
      const updated = { ...current, [cardId]: !(current[cardId] ?? false) };
      localStorage.setItem("faturas-collapsed-cards", JSON.stringify(updated));
      return updated;
    });
  }

  async function loadCards() {
    setIsLoadingCards(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/credit-cards`);
      if (!res.ok) throw new Error("Não foi possível carregar os cartões.");
      setCards(await res.json());
    } catch (e) {
      reportClientError("bills.loadCards", e);
      setError(getErrorMessage(e));
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
      reportClientError("bills.loadCategories", e);
      setError(getErrorMessage(e));
      throw e;
    }
  }

  async function loadAccounts() {
    try {
      const res = await fetch(`${apiBaseUrl}/accounts`);
      if (!res.ok) throw new Error("Não foi possível carregar as contas.");
      setAccounts(await res.json());
    } catch (e) {
      reportClientError("bills.loadAccounts", e);
      setError(getErrorMessage(e));
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

  // Track which card+month combos have already been loaded to avoid redundant
  // fetches that would reset child component state (e.g. the create form).
  const loadedBillKeysRef = useRef<Set<string>>(new Set());

  const loadBillForCardStable = useCallback((cardId: string, month: string, force = false) => {
    const key = `${cardId}::${month}`;
    if (!force && loadedBillKeysRef.current.has(key)) return;
    loadedBillKeysRef.current.add(key);
    void loadBillForCard(cardId, month);
  }, []);

  useEffect(() => {
    void loadCards();
    void loadCategories();
    void loadAccounts();
  }, []);

  useEffect(() => {
    // Reset loaded keys when month changes so bills are re-fetched.
    loadedBillKeysRef.current = new Set();
    for (const card of activeCards) {
      loadBillForCardStable(card.id, selectedMonth);
    }
  }, [activeCards, selectedMonth, loadBillForCardStable]);

  return (
    <Stack gap="lg">
      <MonthSelector
        title="Mês da fatura"
        selectedMonth={selectedMonth}
        onChange={setSelectedMonth}
      />

      {error ? (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      ) : null}

      {isLoadingCards ? (
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      ) : activeCards.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Stack align="center" gap="xs">
            <IconCreditCard size={40} opacity={0.3} />
            <Title order={4}>Nenhum cartão ativo</Title>
            <Text c="dimmed">Cadastre um cartão em Contas para ver as faturas aqui.</Text>
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
            isCollapsed={collapsedCards[card.id] ?? false}
            onToggleCollapsed={() => toggleCardCollapsed(card.id)}
            onReload={() => loadBillForCardStable(card.id, selectedMonth, true)}
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
  isCollapsed,
  onToggleCollapsed,
  onReload
}: {
  card: CreditCard;
  billData: BillData | null;
  isLoading: boolean;
  selectedMonth: string;
  categories: Category[];
  accounts: Account[];
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onReload: () => void;
}) {
  const [filterSubcategoryIds, setFilterSubcategoryIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<BillSortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("all");
  const [filterDateFrom, setFilterDateFrom] = useState(`${selectedMonth}-01`);
  const [filterDateTo, setFilterDateTo] = useState(getLastDayOfMonth(selectedMonth));
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
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

  function updateCreateEventDate(value: string) {
    setCreateForm((current) => ({
      ...current,
      eventDate: value
    }));
  }

  function updateEditEventDate(value: string) {
    setEditForm((current) => ({
      ...current,
      eventDate: value
    }));
  }
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
  const [previewInstallmentFilter, setPreviewInstallmentFilter] = useState<
    "all" | "single" | "installment"
  >("all");
  const [selectedImportTempIds, setSelectedImportTempIds] = useState<Set<string>>(new Set());
  const [isImportPreviewLoading, setIsImportPreviewLoading] = useState(false);
  const [isImportConfirming, setIsImportConfirming] = useState(false);
  const [importModalError, setImportModalError] = useState<string | null>(null);

  const clipboard = useClipboard({ timeout: 2000 });

  const billPromptText = useMemo(() => {
    return `Por favor, converta o texto da fatura de cartão de crédito abaixo em um arquivo CSV estruturado.
Use como separador o ponto e vírgula (;). O cabeçalho deve ser exatamente: Data;Descricao;Valor;Categoria;Parcela;TotalParcelas

Siga rigorosamente estas regras:
1. Data: Converta todas as datas para o formato DD/MM/AAAA.
2. Descrição: Simplifique e limpe a descrição do lançamento (remova identificadores longos, números ou códigos, deixando apenas o nome legível do estabelecimento, ex: "Uber *Trip" vira "Uber", "Pao de Acucar Sp" vira "Pão de Açúcar"). Se o lançamento for parcelado no texto original (ex: "Compra 1/3" ou "Compra - 2 de 5"), remova a indicação de parcelas da descrição (pois ela irá para as colunas Parcela e TotalParcelas).
3. Valor: Escreva no formato decimal brasileiro positivo (usando vírgula para centavos, ex: 120,50). No caso de faturas, todas as compras normais entram como despesa (valor positivo). Se for um estorno ou crédito na fatura, represente com sinal de menos (ex: -50,00). IMPORTANTE: Sempre envolva o valor com aspas duplas (ex: "120,50" ou "-50,00") para que a vírgula do centavo não quebre o alinhamento das colunas.
4. Categoria: Preencha com o nome da subcategoria de despesa mais adequada. Use a categoria pai abaixo apenas como contexto:
${formatCategoryPromptGroups(categories, ["expense"])}
5. Parcela: Se a compra for parcelada, extraia o número da parcela atual sendo cobrada nesta fatura (ex: na compra "Mercado 2/3", a parcela atual é 2). Deixe em branco se for à vista.
6. TotalParcelas: Se a compra for parcelada, extraia o número total de parcelas (ex: na compra "Mercado 2/3", o total de parcelas é 3). Deixe em branco se for à vista.

Texto da fatura a ser convertido:
[Cole o texto da sua fatura aqui]`;
  }, [categories]);

  const isPaid = billData?.bill.status === "paid" || Boolean(billData?.payments.some((payment) => !payment.reversedAt));
  const isClosed = billData?.bill.closingDate ? today >= billData.bill.closingDate : false;

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
    const query = searchQuery.toLowerCase().trim();
    const filtered = sourceTransactions.filter((transaction) => {
      if (transaction.status === "canceled" || transaction.status === "planned") {
        return false;
      }

      if (
        filterSubcategoryIds.length > 0 &&
        !filterSubcategoryIds.some((subcategoryId) =>
          subcategoryId === missingFilterValue
            ? transaction.subcategoryId === null
            : transaction.subcategoryId === subcategoryId
        )
      ) {
        return false;
      }

      if (dateFilterMode === "until" && transaction.eventDate > filterDateTo) {
        return false;
      }

      if (
        dateFilterMode === "period" &&
        (transaction.eventDate < filterDateFrom || transaction.eventDate > filterDateTo)
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const matchesDescription = transaction.description.toLowerCase().includes(query);
      const matchesNotes = transaction.notes?.toLowerCase().includes(query) ?? false;
      const formattedDate = formatBusinessDateForDisplay(transaction.eventDate);
      const matchesDate = transaction.eventDate.includes(query) || formattedDate.includes(query);
      const matchesCategory = getBillCategoryLabel(transaction.subcategoryId, categories)
        .toLowerCase()
        .includes(query);
      const matchesType = getCardTransactionTypeLabel(transaction.type)
        .toLowerCase()
        .includes(query);
      const matchesInstallment =
        transaction.installmentNumber && transaction.installmentCount
          ? `${transaction.installmentNumber}/${transaction.installmentCount}`.includes(query)
          : false;

      return (
        matchesDescription ||
        matchesNotes ||
        matchesDate ||
        matchesCategory ||
        matchesType ||
        matchesInstallment
      );
    });

    return [...filtered].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      let result = 0;

      if (sortColumn === "date") {
        result = a.eventDate.localeCompare(b.eventDate);
      } else if (sortColumn === "description") {
        result = a.description.localeCompare(b.description, "pt-BR");
      } else if (sortColumn === "amount") {
        result = a.amountCents - b.amountCents;
      } else if (sortColumn === "category") {
        result = getBillCategoryLabel(a.subcategoryId, categories).localeCompare(
          getBillCategoryLabel(b.subcategoryId, categories),
          "pt-BR"
        );
      }

      return result === 0
        ? b.eventDate.localeCompare(a.eventDate) ||
            a.description.localeCompare(b.description, "pt-BR")
        : result * direction;
    });
  }, [
    categories,
    dateFilterMode,
    filterDateFrom,
    filterDateTo,
    filterSubcategoryIds,
    searchQuery,
    sortColumn,
    sortDirection,
    sourceTransactions
  ]);

  function handleSort(column: string) {
    const nextColumn = column as BillSortColumn;
    if (sortColumn === nextColumn) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(nextColumn);
    setSortDirection(nextColumn === "date" || nextColumn === "amount" ? "desc" : "asc");
  }

  const totalCents = billData?.totalCents ?? 0;
  const selectedTransactions = useMemo(
    () => sourceTransactions.filter((transaction) => selectedTransactionIds.has(transaction.id)),
    [selectedTransactionIds, sourceTransactions]
  );
  const filteredPreviewTransactions = useMemo(() => {
    if (previewInstallmentFilter === "single") {
      return previewTransactions.filter(
        (item) => !item.installmentNumber || !item.installmentCount
      );
    }

    if (previewInstallmentFilter === "installment") {
      return previewTransactions.filter((item) => item.installmentNumber && item.installmentCount);
    }

    return previewTransactions;
  }, [previewInstallmentFilter, previewTransactions]);
  const previewSingleCount = useMemo(
    () =>
      previewTransactions.filter((item) => !item.installmentNumber || !item.installmentCount)
        .length,
    [previewTransactions]
  );
  const previewInstallmentCount = previewTransactions.length - previewSingleCount;
  const visiblePreviewIds = useMemo(
    () => filteredPreviewTransactions.map((item) => item.tempId),
    [filteredPreviewTransactions]
  );
  const allVisiblePreviewSelected =
    visiblePreviewIds.length > 0 &&
    visiblePreviewIds.every((tempId) => selectedImportTempIds.has(tempId));
  useEffect(() => {
    setSelectedTransactionIds(new Set());
    setPanelError(null);
    // Only reset the create form when the drawer is NOT open,
    // otherwise the user would lose their in-progress draft.
    if (!isCreateDrawerOpen) {
      setCreateForm((current) => ({ ...current, eventDate: today }));
    }
  }, [billData?.bill.id, selectedMonth]);

  useEffect(() => {
    setFilterDateFrom(`${selectedMonth}-01`);
    setFilterDateTo(getLastDayOfMonth(selectedMonth));
  }, [selectedMonth]);

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
      Pick<
        CardTransaction,
        "type" | "description" | "amountCents" | "eventDate" | "subcategoryId" | "status" | "notes"
      > & {
        installmentCount?: number;
        preserveBillMonth?: boolean;
      }
    >
  ) {
    if (!billData) {
      throw new Error("Fatura não carregada.");
    }

    const response = await fetch(
      isPaid ? `${apiBaseUrl}/transactions/${transaction.id}/metadata` : `${apiBaseUrl}/credit-cards/${card.id}/bills/${billData.bill.id}/transactions/${transaction.id}`,
      {
        method: isPaid ? "PATCH" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isPaid ? {} : { type: changes.type ?? transaction.type,
          description: changes.description ?? transaction.description,
          amountCents: changes.amountCents ?? transaction.amountCents,
          eventDate: changes.eventDate ?? transaction.eventDate,
          subcategoryId:
            changes.subcategoryId === undefined ? transaction.subcategoryId : changes.subcategoryId,
          notes: changes.notes === undefined ? transaction.notes : changes.notes,
          status: changes.status ?? transaction.status,
          installmentCount: changes.installmentCount,
          preserveBillMonth: changes.preserveBillMonth }),
          description: changes.description ?? transaction.description,
          subcategoryId: changes.subcategoryId === undefined ? transaction.subcategoryId : changes.subcategoryId,
          notes: changes.notes === undefined ? transaction.notes : changes.notes
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
            type: createForm.type,
            description,
            amountCents,
            eventDate: createForm.eventDate,
            subcategoryId:
              createForm.subcategoryId === emptySelectValue ? null : createForm.subcategoryId,
            status: createForm.status,
            notes: createForm.notes.trim() || null,
            installmentCount: createForm.installmentCount
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
      reportClientError("bills.createCardTransaction", error);
      setPanelError(getErrorMessage(error));
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
      reportClientError("bills.deleteCardTransaction", error);
      setPanelError(getErrorMessage(error));
      onReload();
    }
  }

  async function updateCategoryInline(transaction: CardTransaction, nextSubcategoryId: string) {
    const subcategoryId = nextSubcategoryId === emptySelectValue ? null : nextSubcategoryId;
    if (transaction.subcategoryId === subcategoryId) return;

    setPanelError(null);
    try {
      await updateCardTransaction(transaction, { subcategoryId, preserveBillMonth: true });
      onReload();
    } catch (error) {
      reportClientError("bills.updateCategoryInline", error);
      setPanelError(getErrorMessage(error));
      onReload();
    }
  }

  async function updateCardTransactionInline(
    transaction: CardTransaction,
    changes: Partial<
      Pick<
        CardTransaction,
        "description" | "amountCents" | "eventDate" | "subcategoryId" | "status" | "notes"
      >
    >
  ) {
    setPanelError(null);
    try {
      await updateCardTransaction(transaction, {
        ...changes,
        preserveBillMonth: changes.eventDate === undefined
      });
      onReload();
    } catch (error) {
      reportClientError("bills.updateTransactionInline", error);
      setPanelError(getErrorMessage(error));
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
        type: editForm.type,
        description,
        amountCents,
        eventDate: editForm.eventDate,
        subcategoryId: editForm.subcategoryId === emptySelectValue ? null : editForm.subcategoryId,
        status: editForm.status,
        notes: editForm.notes.trim() || null,
        installmentCount: editingTransaction.installmentNumber
          ? undefined
          : editForm.installmentCount,
        preserveBillMonth: Boolean(editingTransaction.installmentNumber)
      });
      setEditingTransaction(null);
      onReload();
    } catch (error) {
      reportClientError("bills.saveEditedTransaction", error);
      setEditError(getErrorMessage(error));
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function applyBulkEdits() {
    if (selectedTransactionIds.size === 0) {
      setPanelError("Selecione pelo menos uma compra para editar em massa.");
      return;
    }

    const hasCategoryEdit = bulkSubcategoryId !== emptySelectValue;

    if (!hasCategoryEdit) {
      setPanelError("Escolha uma categoria para aplicar em massa.");
      return;
    }

    setIsBulkSaving(true);
    setPanelError(null);

    try {
      for (const transaction of selectedTransactions) {
        await updateCardTransaction(transaction, {
          subcategoryId: hasCategoryEdit
            ? bulkSubcategoryId === "__clear__"
              ? null
              : bulkSubcategoryId
            : undefined
        });
      }

      setSelectedTransactionIds(new Set());
      setBulkSubcategoryId(emptySelectValue);
      onReload();
    } catch (error) {
      reportClientError("bills.applyBulkEdits", error);
      setPanelError(getErrorMessage(error));
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
          throw new Error(
            await getResponseError(
              response,
              `Não foi possível excluir "${transaction.description}".`
            )
          );
        }
      }

      setSelectedTransactionIds(new Set());
      onReload();
    } catch (error) {
      reportClientError("bills.deleteSelectedTransactions", error);
      setPanelError(getErrorMessage(error));
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
            subcategoryId:
              mappings.subcategoryId === emptySelectValue ? "" : mappings.subcategoryId,
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
      setSelectedImportTempIds(
        new Set(items.filter((item) => !item.isDuplicate).map((item) => item.tempId))
      );
      setImportStep(3);
    } catch (error) {
      reportClientError("bills.importPreview", error);
      setImportModalError(getErrorMessage(error));
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
            type: item.type,
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
      reportClientError("bills.importConfirm", error);
      setImportModalError(getErrorMessage(error));
    } finally {
      setIsImportConfirming(false);
    }
  }

  const allVisibleSelected =
    transactions.length > 0 &&
    transactions.every((transaction) => selectedTransactionIds.has(transaction.id));
  const hasVisibleSelection = transactions.some((transaction) =>
    selectedTransactionIds.has(transaction.id)
  );

  return (
    <Paper withBorder radius="md">
      {/* Card header */}
      <Group
        px="md"
        py="xs"
        justify="space-between"
        align="center"
        style={{
          borderBottom: isCollapsed ? "none" : "1px solid var(--mantine-color-gray-2)",
          cursor: "pointer",
          userSelect: "none"
        }}
        onClick={onToggleCollapsed}
      >
        <Group gap="sm">
          <IconCreditCard size={20} />
          <div>
            <Text fw={700}>{card.name}</Text>
            {card.institution && (
              <Text size="xs" c="dimmed">
                {card.institution}
              </Text>
            )}
          </div>
          {billData ? (
            <Badge variant="light" color={statusColor}>
              {statusLabel} — vence {formatBusinessDateForDisplay(billData.bill.dueDate)}
            </Badge>
          ) : null}
        </Group>

        <Group gap="sm" onClick={(event) => event.stopPropagation()}>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={openCreateDrawer}
            disabled={!billData || isPaid}
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
            disabled={!billData || isPaid}
          >
            Importar fatura
          </Button>
          <Text fw={700} c={totalCents > 0 ? "red" : "dimmed"}>
            {totalCents > 0 ? `− ${formatMoney(moneyFromCents(totalCents))}` : "R$ 0,00"}
          </Text>
          <Tooltip label={isCollapsed ? "Expandir cartão" : "Recolher cartão"}>
            <ActionIcon
              variant="subtle"
              size="sm"
              aria-label={
                isCollapsed ? `Expandir fatura de ${card.name}` : `Recolher fatura de ${card.name}`
              }
              onClick={onToggleCollapsed}
            >
              {isCollapsed ? <IconChevronDown size={20} /> : <IconChevronUp size={20} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Collapse in={!isCollapsed}>
        {billData ? <BillPaymentPanel cardId={card.id} billId={billData.bill.id} accounts={accounts} remainingCents={billData.summary.remainingCents} minimumDueCents={billData.bill.minimumDueCents} minimumMet={billData.summary.minimumMet} status={billData.summary.status} payments={billData.payments} onChanged={onReload}/> : null}
        {panelError ? (
          <Alert color="red" variant="light" m="md">
            {panelError}
          </Alert>
        ) : null}

        {/* Transactions */}
        {isLoading && !billData ? (
          <Group justify="center" p="xl">
            <Loader size="sm" />
          </Group>
        ) : sourceTransactions.length === 0 ? (
          <Group p="xl" gap="xs" c="dimmed">
            <IconAlertCircle size={16} />
            <Text size="sm">
              Nenhum lançamento com este cartão em {selectedMonth}. Use Novo lançamento ou importe o
              CSV da fatura.
            </Text>
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreateDrawer}>
              Novo lançamento
            </Button>
          </Group>
        ) : (
          <Stack gap={0}>
            <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="Buscar"
                  placeholder="Descrição, data, categoria..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.currentTarget.value)}
                  leftSection={<IconSearch size={16} />}
                />
                <CategoryMultiSelect
                  label="Categorias"
                  categories={categories}
                  filterNatures={["expense"]}
                  value={filterSubcategoryIds}
                  onChange={setFilterSubcategoryIds}
                  placeholder="Todas"
                  extraOptions={[{ value: missingFilterValue, label: "Sem categoria" }]}
                />
              </SimpleGrid>
              <Group justify="space-between" align="center" mt="sm">
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={
                    isAdvancedFiltersOpen ? (
                      <IconChevronUp size={14} />
                    ) : (
                      <IconChevronDown size={14} />
                    )
                  }
                  onClick={() => setIsAdvancedFiltersOpen((opened) => !opened)}
                >
                  Busca avançada
                </Button>
                <Group gap="xs">
                  <Text size="xs" c="dimmed">
                    {transactions.length} de {sourceTransactions.length} compras
                  </Text>
                  <Button
                    variant="light"
                    size="xs"
                    onClick={() => {
                      setFilterSubcategoryIds([]);
                      setSearchQuery("");
                      setDateFilterMode("all");
                      setFilterDateFrom(`${selectedMonth}-01`);
                      setFilterDateTo(getLastDayOfMonth(selectedMonth));
                      setSortColumn("date");
                      setSortDirection("desc");
                    }}
                  >
                    Limpar filtros
                  </Button>
                </Group>
              </Group>
              <Collapse in={isAdvancedFiltersOpen}>
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mt="sm">
                  <SegmentedControl
                    data={[
                      { value: "all", label: "Fatura inteira" },
                      { value: "until", label: "Até data" },
                      { value: "period", label: "Período" }
                    ]}
                    value={dateFilterMode}
                    onChange={(value) => setDateFilterMode(value as DateFilterMode)}
                  />
                  {dateFilterMode === "period" ? (
                    <BusinessDateInput
                      label="De"
                      value={filterDateFrom}
                      onChange={setFilterDateFrom}
                      referenceMonth={selectedMonth}
                    />
                  ) : (
                    <Box />
                  )}
                  {dateFilterMode === "until" || dateFilterMode === "period" ? (
                    <BusinessDateInput
                      label={dateFilterMode === "until" ? "Data de corte" : "Até"}
                      value={filterDateTo}
                      onChange={setFilterDateTo}
                      referenceMonth={selectedMonth}
                    />
                  ) : (
                    <Box />
                  )}
                </SimpleGrid>
              </Collapse>
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
                      disabled={isPaid}
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
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                      <CategorySelect
                        label="Categoria"
                        categories={categories}
                        filterNatures={["expense"]}
                        value={bulkSubcategoryId}
                        onChange={(value) => setBulkSubcategoryId(value)}
                        emptyOptionLabel="Manter categoria atual"
                        placeholder="Manter"
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
              <Table.ScrollContainer minWidth={960}>
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
                      <SortableTableHeader
                        label="Data"
                        column="date"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        style={{ width: 96 }}
                      />
                      <SortableTableHeader
                        label="Descrição"
                        column="description"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        style={{ minWidth: 260 }}
                      />
                      <SortableTableHeader
                        label="Valor"
                        column="amount"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        style={{ width: 120 }}
                      />
                      <SortableTableHeader
                        label="Categoria"
                        column="category"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        style={{ minWidth: 220 }}
                      />
                      <Table.Th>Ações</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {transactions.map((transaction) => (
                      <Table.Tr key={transaction.id} style={{ verticalAlign: "middle" }}>
                        <Table.Td>
                          <Checkbox
                            aria-label={`Selecionar compra ${transaction.description}`}
                            checked={selectedTransactionIds.has(transaction.id)}
                            onChange={() => toggleTransactionSelection(transaction.id)}
                          />
                        </Table.Td>
                        <Table.Td>
                          <QuickDateEdit
                            value={transaction.eventDate}
                            referenceMonth={transaction.eventDate.slice(0, 7) || selectedMonth}
                            onSave={(eventDate) =>
                              updateCardTransactionInline(transaction, { eventDate })
                            }
                          />
                        </Table.Td>
                        <Table.Td style={{ maxWidth: 350, wordBreak: "break-word" }}>
                          <Group gap="xs" align="center">
                            <QuickTextEdit
                              value={transaction.description}
                              fw={500}
                              placeholder="Descrição"
                              onSave={(description) =>
                                updateCardTransactionInline(transaction, { description })
                              }
                            />
                            {transaction.type === "refund" && (
                              <Badge variant="light" color="teal" size="xs">
                                Reembolso
                              </Badge>
                            )}
                            {transaction.type === "chargeback" && (
                              <Badge variant="light" color="teal" size="xs">
                                Estorno
                              </Badge>
                            )}
                            {transaction.installmentNumber && transaction.installmentCount ? (
                              <Badge variant="light" color="grape" size="xs">
                                {transaction.installmentNumber}/{transaction.installmentCount}
                              </Badge>
                            ) : null}
                          </Group>
                          {transaction.notes ? (
                            <Text size="xs" c="dimmed">
                              {transaction.notes}
                            </Text>
                          ) : null}
                        </Table.Td>
                        <Table.Td>
                          <QuickAmountEdit
                            valueCents={transaction.amountCents}
                            color={getAmountColor(transaction.type)}
                            prefix={transaction.type === "expense" ? "− " : "+ "}
                            onSave={(amountCents) =>
                              updateCardTransactionInline(transaction, { amountCents })
                            }
                          />
                        </Table.Td>
                        <Table.Td>
                          <QuickCategoryEdit
                            categories={categories}
                            filterNatures={["expense"]}
                            value={transaction.subcategoryId ?? emptySelectValue}
                            onChange={(value) => void updateCategoryInline(transaction, value)}
                            emptyOptionLabel="Sem categoria"
                          />
                        </Table.Td>
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
                            <Tooltip
                              label={
                                isPaid ? "Fatura paga - não é possível excluir" : "Excluir compra"
                              }
                            >
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                aria-label={`Excluir compra ${transaction.description}`}
                                onClick={() => void deleteCardTransaction(transaction)}
                                disabled={isPaid}
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
      </Collapse>

      <Modal
        opened={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={
          <Group gap="xs">
            <IconUpload size={22} color="var(--mantine-color-blue-filled)" />
            <Text fw={700} size="lg">
              Importar fatura
            </Text>
          </Group>
        }
        size="min(96vw, 1180px)"
        radius="md"
        padding="xl"
      >
        <Stack gap="md">
          <Group justify="space-between" mb="xs">
            <Badge
              color={importStep >= 1 ? "blue" : "gray"}
              variant={importStep === 1 ? "filled" : "light"}
            >
              1. Arquivo & Fatura
            </Badge>
            <Badge
              color={importStep >= 2 ? "blue" : "gray"}
              variant={importStep === 2 ? "filled" : "light"}
            >
              2. Mapear Colunas
            </Badge>
            <Badge
              color={importStep >= 3 ? "blue" : "gray"}
              variant={importStep === 3 ? "filled" : "light"}
            >
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
                      Compras desta fatura entram no cartão; parcelas restantes serão projetadas nas
                      próximas faturas.
                    </Text>
                  </div>
                  <Badge variant="light" color="indigo">
                    {selectedMonth}
                  </Badge>
                </Group>
              </Paper>

              <Paper
                withBorder
                p="md"
                radius="md"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(224, 242, 254, 0.35) 0%, rgba(238, 242, 255, 0.35) 100%)",
                  borderColor: "var(--mantine-color-blue-light-color)",
                  borderLeft: "4px solid var(--mantine-color-blue-filled)"
                }}
              >
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Box style={{ flex: 1 }}>
                    <Text size="sm" fw={700} c="blue.8">
                      Dica: Converta faturas com IA
                    </Text>
                    <Text size="xs" c="dimmed" mt={2}>
                      Copie o prompt estruturado e envie para uma IA (como ChatGPT, Gemini ou
                      Claude) para formatar o texto da sua fatura em um CSV pronto para importação.
                    </Text>
                  </Box>
                  <Button
                    size="xs"
                    variant={clipboard.copied ? "filled" : "light"}
                    color={clipboard.copied ? "teal" : "blue"}
                    leftSection={
                      clipboard.copied ? <IconCheck size={14} /> : <IconCopy size={14} />
                    }
                    onClick={() => clipboard.copy(billPromptText)}
                    style={{ flexShrink: 0 }}
                  >
                    {clipboard.copied ? "Copiado!" : "Copiar prompt IA"}
                  </Button>
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
                Selecione as colunas do CSV. Para parcelamento, use coluna combinada 2/3 ou as
                colunas separadas Parcela atual e Total de parcelas.
              </Text>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Select
                  label="Coluna de data"
                  data={csvHeaders}
                  value={mappings.eventDate}
                  onChange={(value) =>
                    setMappings((current) => ({ ...current, eventDate: value ?? "" }))
                  }
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
                  onChange={(value) =>
                    setImportDateFormat((value as "DMY" | "MDY" | "YMD") ?? "DMY")
                  }
                  required
                />
                <Select
                  label="Coluna de descrição"
                  data={csvHeaders}
                  value={mappings.description}
                  onChange={(value) =>
                    setMappings((current) => ({ ...current, description: value ?? "" }))
                  }
                  required
                />
                <Select
                  label="Coluna de valor"
                  data={csvHeaders}
                  value={mappings.amount}
                  onChange={(value) =>
                    setMappings((current) => ({ ...current, amount: value ?? "" }))
                  }
                  required
                />
                <Select
                  label="Coluna de categoria"
                  data={[
                    { value: emptySelectValue, label: "Definir depois" },
                    ...csvHeaders.map((header) => ({ value: header, label: header }))
                  ]}
                  value={mappings.subcategoryId}
                  onChange={(value) =>
                    setMappings((current) => ({
                      ...current,
                      subcategoryId: value ?? emptySelectValue
                    }))
                  }
                  clearable
                />
                <Select
                  label="Coluna de parcela (2/3)"
                  description="Use quando uma coluna já vem como 2/3 ou 2 de 3."
                  data={[
                    { value: emptySelectValue, label: "Sem coluna combinada" },
                    ...csvHeaders.map((header) => ({ value: header, label: header }))
                  ]}
                  value={mappings.installment}
                  onChange={(value) =>
                    setMappings((current) => ({
                      ...current,
                      installment: value ?? emptySelectValue
                    }))
                  }
                  clearable
                />
                <Select
                  label="Parcela atual"
                  description="Use com Total de parcelas quando vierem em colunas separadas."
                  data={[
                    { value: emptySelectValue, label: "Sem parcela atual" },
                    ...csvHeaders.map((header) => ({ value: header, label: header }))
                  ]}
                  value={mappings.installmentNumber}
                  onChange={(value) =>
                    setMappings((current) => ({
                      ...current,
                      installmentNumber: value ?? emptySelectValue
                    }))
                  }
                  clearable
                />
                <Select
                  label="Total de parcelas"
                  data={[
                    { value: emptySelectValue, label: "Sem total de parcelas" },
                    ...csvHeaders.map((header) => ({ value: header, label: header }))
                  ]}
                  value={mappings.installmentCount}
                  onChange={(value) =>
                    setMappings((current) => ({
                      ...current,
                      installmentCount: value ?? emptySelectValue
                    }))
                  }
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
                    {filteredPreviewTransactions.length} de {previewTransactions.length} compras na
                    prévia.
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
                Linhas já duplicadas começam desmarcadas. Se uma linha vier como 2/3, a prévia
                inclui a 2/3 nesta fatura e gera a 3/3 no mês seguinte.
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
                                <Text size="sm" c="dimmed">
                                  À vista
                                </Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <Text fw={700} c="red">
                                − {formatMoney(moneyFromCents(item.amountCents))}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <CategorySelect
                                size="xs"
                                categories={categories}
                                filterNatures={["expense"]}
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
                                emptyOptionLabel="Sem categoria"
                                placeholder="Sem categoria"
                                label=""
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
              data={[
                { value: "expense", label: "Despesa" },
                { value: "refund", label: "Reembolso" },
                { value: "chargeback", label: "Estorno" }
              ]}
              value={createForm.type}
              onChange={(value) =>
                setCreateForm((current) => ({
                  ...current,
                  type: value as "expense" | "refund" | "chargeback",
                  installmentCount: value === "expense" ? current.installmentCount : 1
                }))
              }
            />
          </Stack>

          <TextInput
            label="Descrição"
            placeholder="Mercado, farmácia, assinatura..."
            value={createForm.description}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setCreateForm((current) => ({ ...current, description: value }));
            }}
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
              setCreateForm((current) => ({ ...current, amountReais: normalizeAmountInput(value) }))
            }
            onFocus={(e) => e.currentTarget.select()}
            required
          />

          <BusinessDateInput
            label="Data da compra"
            value={createForm.eventDate}
            onChange={updateCreateEventDate}
            referenceMonth={createForm.eventDate.slice(0, 7) || selectedMonth}
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

          {/* Installments */}
          {createForm.type === "expense" && (
            <Stack gap={6}>
              <Text size="sm" fw={500}>
                Parcelamento
              </Text>
              <SegmentedControl
                fullWidth
                data={[
                  { value: "1", label: "À vista" },
                  { value: "n", label: "Parcelado" }
                ]}
                value={createForm.installmentCount === 1 ? "1" : "n"}
                onChange={(v) =>
                  setCreateForm((current) => ({
                    ...current,
                    installmentCount: v === "1" ? 1 : 2
                  }))
                }
              />
              {createForm.installmentCount > 1 && (
                <Group align="flex-end" gap="sm">
                  <NumberInput
                    label="Número de parcelas"
                    min={2}
                    max={48}
                    style={{ flex: 1 }}
                    value={createForm.installmentCount}
                    onChange={(v) =>
                      setCreateForm((current) => ({
                        ...current,
                        installmentCount: Math.max(2, Math.min(48, Number(v) || 2))
                      }))
                    }
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Text size="sm" c="teal" fw={600} pb={6}>
                    {createForm.installmentCount}x de{" "}
                    {formatInstallmentPreview(createForm.amountReais, createForm.installmentCount)}
                  </Text>
                </Group>
              )}
            </Stack>
          )}

          <CategorySelect
            label="Categoria"
            categories={categories}
            filterNatures={["expense"]}
            value={createForm.subcategoryId}
            onChange={(value) => setCreateForm((current) => ({ ...current, subcategoryId: value }))}
          />

          <Textarea
            label="Observação"
            autosize
            minRows={2}
            value={createForm.notes}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setCreateForm((current) => ({ ...current, notes: value }));
            }}
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

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              Tipo
            </Text>
            <SegmentedControl
              fullWidth
              data={[
                { value: "expense", label: "Despesa" },
                { value: "refund", label: "Reembolso" },
                { value: "chargeback", label: "Estorno" }
              ]}
              value={editForm.type}
              onChange={(value) =>
                setEditForm((current) => ({
                  ...current,
                  type: value as "expense" | "refund" | "chargeback",
                  installmentCount: value === "expense" ? current.installmentCount : 1
                }))
              }
            />
          </Stack>

          <TextInput
            label="Descrição"
            value={editForm.description}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setEditForm((current) => ({ ...current, description: value }));
            }}
            required
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <BusinessDateInput
              label="Data da compra"
              value={editForm.eventDate}
              onChange={updateEditEventDate}
              referenceMonth={editForm.eventDate.slice(0, 7) || selectedMonth}
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
                setEditForm((current) => ({ ...current, amountReais: normalizeAmountInput(value) }))
              }
              onFocus={(e) => e.currentTarget.select()}
              required
            />
          </SimpleGrid>

          {/* Installments */}
          {editForm.type === "expense" && (
            <Stack gap={6}>
              <Text size="sm" fw={500}>
                Parcelamento
              </Text>
              {editingTransaction?.installmentNumber && editingTransaction.installmentCount ? (
                <Group gap="xs">
                  <Badge variant="light" color="grape">
                    Parcela {editingTransaction.installmentNumber} de{" "}
                    {editingTransaction.installmentCount}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    Edição altera apenas esta parcela.
                  </Text>
                </Group>
              ) : (
                <>
                  <SegmentedControl
                    fullWidth
                    data={[
                      { value: "1", label: "À vista" },
                      { value: "n", label: "Parcelado" }
                    ]}
                    value={editForm.installmentCount === 1 ? "1" : "n"}
                    onChange={(v) =>
                      setEditForm((current) => ({
                        ...current,
                        installmentCount: v === "1" ? 1 : 2
                      }))
                    }
                  />
                  {editForm.installmentCount > 1 && (
                    <Group align="flex-end" gap="sm">
                      <NumberInput
                        label="Número de parcelas"
                        min={2}
                        max={48}
                        style={{ flex: 1 }}
                        value={editForm.installmentCount}
                        onChange={(v) =>
                          setEditForm((current) => ({
                            ...current,
                            installmentCount: Math.max(2, Math.min(48, Number(v) || 2))
                          }))
                        }
                        onFocus={(e) => e.currentTarget.select()}
                      />
                      <Text size="sm" c="teal" fw={600} pb={6}>
                        {editForm.installmentCount}x de{" "}
                        {formatInstallmentPreview(editForm.amountReais, editForm.installmentCount)}
                      </Text>
                    </Group>
                  )}
                </>
              )}
            </Stack>
          )}

          <CategorySelect
            label="Categoria"
            categories={categories}
            filterNatures={["expense"]}
            value={editForm.subcategoryId}
            onChange={(value) => setEditForm((current) => ({ ...current, subcategoryId: value }))}
          />

          <Textarea
            label="Observação"
            autosize
            minRows={2}
            value={editForm.notes}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setEditForm((current) => ({ ...current, notes: value }));
            }}
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

function buildEditForm(transaction: CardTransaction | null): CardTransactionEditForm {
  return {
    type: (transaction?.type as "expense" | "refund" | "chargeback") ?? "expense",
    description: transaction?.description ?? "",
    amountReais: transaction && transaction.amountCents !== 0 ? transaction.amountCents / 100 : "",
    eventDate: transaction?.eventDate ?? today,
    subcategoryId: transaction?.subcategoryId ?? emptySelectValue,
    status: transaction?.status ?? "confirmed",
    notes: transaction?.notes ?? "",
    installmentCount: transaction?.installmentCount ?? 1
  };
}

function formatInstallmentPreview(amountReais: number | string, count: number): string {
  if (count <= 0) return "";
  const totalCents = parseCardTransactionAmount(amountReais);
  const installmentCents = Math.floor(totalCents / count);
  return formatMoney(moneyFromCents(installmentCents));
}

function parseCardTransactionAmount(value: number | string) {
  if (typeof value === "number") {
    return Math.round(value * 100);
  }

  return parseMoneyToCents(value);
}

function normalizeAmountInput(value: number | string) {
  if (typeof value === "number") {
    return Math.floor(value * 100) / 100;
  }

  const [integerPart, decimalPart] = value.split(",");

  if (decimalPart === undefined) {
    return value;
  }

  return `${integerPart},${decimalPart.slice(0, 2)}`;
}

function getBillCategoryLabel(subcategoryId: string | null, categories: Category[]) {
  if (!subcategoryId) return "Sem categoria";

  for (const category of categories) {
    const subcategory = category.subcategories.find((sub) => sub.id === subcategoryId);
    if (subcategory) {
      return `${category.name} ${subcategory.name}`;
    }
  }

  return "Sem categoria";
}

function getCardTransactionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    expense: "Despesa",
    refund: "Reembolso",
    chargeback: "Estorno"
  };

  return labels[type] ?? type;
}
