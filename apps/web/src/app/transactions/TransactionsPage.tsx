import {
  ActionIcon,
  Affix,
  Alert,
  Badge,
  Box,
  Button,
  Collapse,
  Checkbox,
  Drawer,
  Group,
  Loader,
  MultiSelect,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  Title
} from "@mantine/core";
import { formatMoney, moneyFromCents, parseMoneyToCents, transactionTypes } from "@finances/domain";
import {
  IconTrash,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconEraser,
  IconPlus,
  IconDownload,
  IconUpload,
  IconSearch,
  IconChevronDown,
  IconChevronUp
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  formatBusinessDateForDisplay,
  getLastDayOfMonth,
  getTodayBusinessDate
} from "../date-format";
import { BusinessDateInput } from "../shared/BusinessDateInput";
import { getAmountColor } from "../shared/transaction-ui";
import { getErrorMessage, getResponseError, reportClientError } from "../shared/errors";
import { CategoryMultiSelect, CategorySelect, QuickCategoryEdit } from "../shared/CategorySelect";
import { MonthSelector } from "../shared/MonthSelector";
import { QuickAmountEdit, QuickDateEdit, QuickTextEdit } from "../shared/QuickEditFields";
import { SortableTableHeader } from "../shared/SortableTableHeader";
import { SimpleCsvImportDialog } from "./SimpleCsvImportDialog";

type Transaction = {
  id: string;
  type: string;
  description: string;
  amountCents: number;
  eventDate: string;
  budgetMonth: string;
  accountId: string | null;
  paymentMethodId: string | null;
  subcategoryId: string | null;
  creditCardId: string | null;
  status: string;
  notes: string | null;
  transferId?: string | null;
};

type Account = {
  id: string;
  name: string;
  isActive: boolean;
  isPrimary: boolean;
  defaultPaymentMethodId: string | null;
};

type PaymentMethod = {
  id: string;
  name: string;
  kind?: string;
};

type CreditCard = {
  id: string;
  name: string;
  institution: string | null;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string | null;
  isDefault: boolean;
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

type SortDirection = "asc" | "desc";
type TransactionSortColumn =
  | "date"
  | "description"
  | "type"
  | "amount"
  | "account"
  | "paymentMethod"
  | "category";
type DateFilterMode = "all" | "until" | "period";

type TransactionFormState = {
  type: string;
  description: string;
  amountReais: number | string;
  eventDate: string;
  budgetMonth: string;
  accountId: string;
  paymentMethodId: string;
  subcategoryId: string;
  status: string;
  notes: string;
  destinationAccountId: string;
  /** "account" = conta + meio de pagamento; "card" = cartão de crédito */
  paymentMode: "account" | "card";
  creditCardId: string;
  /** 1 = à vista, 2-48 = parcelado */
  installmentCount: number;
};

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const today = getTodayBusinessDate();
const currentMonth = today.slice(0, 7);
const emptySelectValue = "__none__";
const missingFilterValue = "__missing__";
const transactionTypeOptions = transactionTypes.map((transactionType) => ({
  value: transactionType.value,
  label: transactionType.label
}));

const emptyForm: TransactionFormState = {
  type: "expense",
  description: "",
  amountReais: "",
  eventDate: today,
  budgetMonth: currentMonth,
  accountId: emptySelectValue,
  paymentMethodId: emptySelectValue,
  subcategoryId: emptySelectValue,
  status: "confirmed",
  notes: "",
  destinationAccountId: emptySelectValue,
  paymentMode: "account",
  creditCardId: emptySelectValue,
  installmentCount: 1
};

const creditCardPaymentMethodId = "pm-credit-card";

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [filterType, setFilterType] = useState<string>(emptySelectValue);
  const [filterAccountId, setFilterAccountId] = useState<string>(emptySelectValue);
  const [filterPaymentMethodIds, setFilterPaymentMethodIds] = useState<string[]>([]);
  const [filterSubcategoryIds, setFilterSubcategoryIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<TransactionSortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("all");
  const [filterDateFrom, setFilterDateFrom] = useState(`${selectedMonth}-01`);
  const [filterDateTo, setFilterDateTo] = useState(getLastDayOfMonth(selectedMonth));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [form, setForm] = useState<TransactionFormState>(emptyForm);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [bulkAccountId, setBulkAccountId] = useState<string>(emptySelectValue);
  const [bulkPaymentMethodId, setBulkPaymentMethodId] = useState<string>(emptySelectValue);
  const [bulkSubcategoryId, setBulkSubcategoryId] = useState<string>(emptySelectValue);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const accountOptions = useMemo(
    () => accounts.map((account) => ({ value: account.id, label: account.name })),
    [accounts]
  );
  const paymentMethodOptions = useMemo(
    () => [
      { value: emptySelectValue, label: "Sem meio de pagamento" },
      ...paymentMethods
        .filter((pm) => (pm as PaymentMethod & { kind?: string }).kind !== "credit_card")
        .map((paymentMethod) => ({
          value: paymentMethod.id,
          label: paymentMethod.name
        }))
    ],
    [paymentMethods]
  );
  const filterPaymentMethodOptions = useMemo(
    () => [
      { value: missingFilterValue, label: "Sem forma de pagamento" },
      ...paymentMethods.map((paymentMethod) => ({
        value: paymentMethod.id,
        label: paymentMethod.name
      }))
    ],
    [paymentMethods]
  );
  const creditCardOptions = useMemo(
    () => [
      { value: emptySelectValue, label: "Selecione um cartão" },
      ...creditCards
        .filter((c) => c.isActive)
        .map((c) => ({
          value: c.id,
          label: c.institution ? `${c.name} (${c.institution})` : c.name
        }))
    ],
    [creditCards]
  );
  const hasDraft = useMemo(
    () => isTransactionDraftDirty(form, buildEmptyFormWithDefaults(accounts, creditCards)),
    [accounts, form, creditCards]
  );
  const hasCreateDraft = !editingTransaction && hasDraft;
  const visibleTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) => transaction.status !== "canceled" && transaction.status !== "planned"
      ),
    [transactions]
  );
  const selectedTransactions = useMemo(
    () => visibleTransactions.filter((transaction) => selectedTransactionIds.has(transaction.id)),
    [selectedTransactionIds, visibleTransactions]
  );
  const selectedAccountTransactions = useMemo(
    () => selectedTransactions.filter((transaction) => !transaction.creditCardId),
    [selectedTransactions]
  );

  const selectedSubcategory = useMemo(() => {
    if (!form.subcategoryId || form.subcategoryId === emptySelectValue) return null;
    for (const cat of categories) {
      const sub = cat.subcategories.find((s) => s.id === form.subcategoryId);
      if (sub) return { sub, category: cat };
    }
    return null;
  }, [categories, form.subcategoryId]);

  const isTransferCategory = selectedSubcategory?.category.nature === "transfer";

  async function loadReferences() {
    const [accountsResponse, paymentMethodsResponse, categoriesResponse, creditCardsResponse] =
      await Promise.all([
        fetch(`${apiBaseUrl}/accounts`),
        fetch(`${apiBaseUrl}/payment-methods`),
        fetch(`${apiBaseUrl}/categories?includeInactive=true`),
        fetch(`${apiBaseUrl}/credit-cards`)
      ]);

    if (
      !accountsResponse.ok ||
      !paymentMethodsResponse.ok ||
      !categoriesResponse.ok ||
      !creditCardsResponse.ok
    ) {
      throw new Error("Não foi possível carregar os dados do formulário.");
    }

    const nextAccounts = (await accountsResponse.json()) as Account[];
    const nextPaymentMethods = (await paymentMethodsResponse.json()) as PaymentMethod[];
    const nextCategories = (await categoriesResponse.json()) as Category[];
    const nextCreditCards = (await creditCardsResponse.json()) as CreditCard[];

    setAccounts(nextAccounts);
    setPaymentMethods(nextPaymentMethods);
    setCategories(nextCategories);
    setCreditCards(nextCreditCards);
  }

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = buildTransactionSearchParams({
        selectedMonth,
        filterType,
        filterPaymentMethodIds,
        filterSubcategoryIds
      });

      const response = await fetch(`${apiBaseUrl}/transactions?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Não foi possível carregar os lançamentos.");
      }

      setTransactions(await response.json());
      setSelectedTransactionIds(new Set());
    } catch (loadError) {
      reportClientError("transactions.load", loadError);
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, filterType, filterPaymentMethodIds, filterSubcategoryIds]);

  function handleExportCsv() {
    const params = buildTransactionSearchParams({
      selectedMonth,
      filterType,
      filterPaymentMethodIds,
      filterSubcategoryIds
    });
    window.open(`${apiBaseUrl}/transactions/export?${params.toString()}`, "_blank");
  }

  useEffect(() => {
    void loadReferences().catch((loadError) => {
      reportClientError("transactions.loadReferences", loadError);
      setError(getErrorMessage(loadError));
    });
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [selectedMonth, filterType, filterPaymentMethodIds, filterSubcategoryIds]);

  useEffect(() => {
    setFilterDateFrom(`${selectedMonth}-01`);
    setFilterDateTo(getLastDayOfMonth(selectedMonth));
  }, [selectedMonth]);

  useEffect(() => {
    if (editingTransaction) {
      return;
    }

    const nextForm = buildEmptyFormWithDefaults(accounts);
    setForm((current) => {
      if (isPristineTransactionDraft(current)) {
        return nextForm;
      }

      return {
        ...current,
        budgetMonth: selectedMonth
      };
    });
  }, [accounts, editingTransaction, selectedMonth]);

  useEffect(() => {
    if (!isDrawerOpen) {
      return;
    }

    window.setTimeout(() => descriptionInputRef.current?.focus(), 120);
  }, [isDrawerOpen, editingTransaction]);

  // Auto-calculate bill month when card or event date changes
  useEffect(() => {
    if (form.paymentMode !== "card" || form.creditCardId === emptySelectValue) {
      return;
    }

    const card = creditCards.find((c) => c.id === form.creditCardId);
    if (!card) return;

    const billMonth = calcBillMonth(form.eventDate, card.closingDay);
    setForm((current) => ({ ...current, budgetMonth: billMonth }));
  }, [form.paymentMode, form.creditCardId, form.eventDate, creditCards]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (shouldIgnoreGlobalShortcut(event.target)) {
        return;
      }

      if (event.key.toLowerCase() !== "l" && event.key !== "ArrowLeft") {
        return;
      }

      event.preventDefault();
      openCreateDrawer();
    }

    window.addEventListener("keydown", handleShortcut);

    return () => window.removeEventListener("keydown", handleShortcut);
  }, [accounts, hasCreateDraft, selectedMonth]);

  function openCreateDrawer() {
    setEditingTransaction(null);
    setDrawerError(null);
    setForm((current) => {
      if (hasCreateDraft) {
        return current;
      }

      const nextForm = buildEmptyFormWithDefaults(accounts, creditCards);
      return nextForm;
    });
    setIsDrawerOpen(true);
  }

  const openEditDrawer = useCallback(
    (transaction: Transaction) => {
      setEditingTransaction(transaction);
      setDrawerError(null);

      const isCardTransaction = Boolean(transaction.creditCardId);
      const destinationAccountId = emptySelectValue;

      setForm({
        type: transaction.type,
        description: transaction.description,
        amountReais: transaction.amountCents === 0 ? "" : transaction.amountCents / 100,
        eventDate: transaction.eventDate,
        budgetMonth: transaction.budgetMonth,
        accountId: transaction.accountId ?? emptySelectValue,
        paymentMethodId: transaction.paymentMethodId ?? emptySelectValue,
        subcategoryId: transaction.subcategoryId ?? emptySelectValue,
        status: transaction.status,
        notes: transaction.notes ?? "",
        destinationAccountId,
        paymentMode: (isCardTransaction ? "card" : "account") as "card" | "account",
        creditCardId: transaction.creditCardId ?? emptySelectValue,
        installmentCount: 1
      });
      setIsDrawerOpen(true);
    },
    [transactions]
  );

  function discardDraft() {
    const nextForm = buildEmptyFormWithDefaults(accounts);
    setEditingTransaction(null);
    setDrawerError(null);
    setForm(nextForm);
    window.setTimeout(() => descriptionInputRef.current?.focus(), 120);
  }

  function updateEventDate(value: string) {
    if (!value) {
      return;
    }

    setForm((current) => ({
      ...current,
      eventDate: value,
      budgetMonth: value.slice(0, 7)
    }));
  }

  function updateAccount(accountId: string) {
    const account = accounts.find((currentAccount) => currentAccount.id === accountId);

    setForm((current) => ({
      ...current,
      accountId,
      paymentMethodId: account
        ? (account.defaultPaymentMethodId ?? emptySelectValue)
        : emptySelectValue
    }));
  }

  async function saveTransaction() {
    setIsSaving(true);
    setDrawerError(null);

    try {
      validateTransactionForm(form);

      const isCardMode = form.paymentMode === "card";
      const creditCardId = isCardMode ? toNullableSelectValue(form.creditCardId) : null;
      if (isCardMode && !creditCardId) {
        throw new Error("Selecione um cartão de crédito.");
      }
      if (isTransferCategory) {
        const originAccountId = toNullableSelectValue(form.accountId);
        const destinationAccountId = toNullableSelectValue(form.destinationAccountId);
        if (!originAccountId) {
          throw new Error("Selecione a conta de origem da transferência.");
        }
        if (!destinationAccountId) {
          throw new Error("Selecione a conta de destino da transferência.");
        }
        if (originAccountId === destinationAccountId) {
          throw new Error("Conta de origem e conta de destino devem ser diferentes.");
        }
      }

      const response = await fetch(
        editingTransaction
          ? `${apiBaseUrl}/transactions/${editingTransaction.id}`
          : `${apiBaseUrl}/transactions`,
        {
          method: editingTransaction ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: form.type,
            description: form.description,
            amountCents: parseTransactionAmount(form.amountReais),
            eventDate: form.eventDate,
            budgetMonth: form.budgetMonth,
            accountId: isCardMode ? null : toNullableSelectValue(form.accountId),
            paymentMethodId: isCardMode ? null : toNullableSelectValue(form.paymentMethodId),
            subcategoryId: toNullableSelectValue(form.subcategoryId),
            creditCardId,
            status: editingTransaction ? form.status : "confirmed",
            notes: form.notes,
            destinationAccountId: isTransferCategory
              ? toNullableSelectValue(form.destinationAccountId)
              : null,
            installmentCount: isCardMode ? form.installmentCount : 1
          })
        }
      );

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível salvar o lançamento."));
      }

      const nextForm = buildEmptyFormWithDefaults(accounts, creditCards);
      setEditingTransaction(null);
      setForm(nextForm);
      setIsDrawerOpen(true);
      window.setTimeout(() => descriptionInputRef.current?.focus(), 120);
      await loadTransactions();
    } catch (saveError) {
      reportClientError("transactions.save", saveError);
      setDrawerError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  const deleteTransaction = useCallback(
    async (transaction: Transaction) => {
      const confirmed = window.confirm(`Excluir o lançamento "${transaction.description}"?`);

      if (!confirmed) {
        return;
      }

      setError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/transactions/${transaction.id}`, {
          method: "DELETE"
        });

        if (!response.ok) {
          throw new Error(
            await getResponseError(response, "Não foi possível excluir o lançamento.")
          );
        }

        await loadTransactions();
      } catch (deleteError) {
        reportClientError("transactions.delete", deleteError);
        setError(getErrorMessage(deleteError));
      }
    },
    [loadTransactions]
  );

  const updateTransactionInline = useCallback(
    async (transaction: Transaction, changes: Partial<Transaction>) => {
      const nextTransaction: Transaction = { ...transaction, ...changes };

      if (changes.eventDate) {
        const card = nextTransaction.creditCardId
          ? creditCards.find((currentCard) => currentCard.id === nextTransaction.creditCardId)
          : null;
        nextTransaction.budgetMonth = card
          ? calcBillMonth(changes.eventDate, card.closingDay)
          : changes.eventDate.slice(0, 7);
      }

      setTransactions((current) =>
        current.map((item) => (item.id === transaction.id ? nextTransaction : item))
      );

      try {
        const response = await fetch(`${apiBaseUrl}/transactions/${transaction.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: nextTransaction.type,
            description: nextTransaction.description,
            amountCents: nextTransaction.amountCents,
            eventDate: nextTransaction.eventDate,
            budgetMonth: nextTransaction.budgetMonth,
            accountId: nextTransaction.creditCardId ? null : nextTransaction.accountId,
            paymentMethodId: nextTransaction.creditCardId ? null : nextTransaction.paymentMethodId,
            subcategoryId: nextTransaction.subcategoryId,
            creditCardId: nextTransaction.creditCardId,
            status: nextTransaction.status,
            notes: nextTransaction.notes
          })
        });

        if (!response.ok) {
          throw new Error(
            await getResponseError(response, "Não foi possível atualizar o lançamento.")
          );
        }

        if (nextTransaction.budgetMonth !== selectedMonth) {
          await loadTransactions();
        }
      } catch (err) {
        reportClientError("transactions.inlineUpdate", err);
        setError(getErrorMessage(err));
        void loadTransactions();
      }
    },
    [creditCards, loadTransactions, selectedMonth]
  );

  const toggleTransactionSelection = useCallback((transactionId: string) => {
    setSelectedTransactionIds((current) => {
      const next = new Set(current);
      if (next.has(transactionId)) {
        next.delete(transactionId);
      } else {
        next.add(transactionId);
      }
      return next;
    });
  }, []);

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return visibleTransactions.filter((transaction) => {
      if (dateFilterMode === "until" && transaction.eventDate > filterDateTo) {
        return false;
      }

      if (
        dateFilterMode === "period" &&
        (transaction.eventDate < filterDateFrom || transaction.eventDate > filterDateTo)
      ) {
        return false;
      }

      if (filterAccountId !== emptySelectValue) {
        const effectiveAccountId = getTransactionEffectiveAccountId(transaction, creditCards);
        if (
          filterAccountId === missingFilterValue
            ? effectiveAccountId !== null
            : effectiveAccountId !== filterAccountId
        ) {
          return false;
        }
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

      if (
        filterPaymentMethodIds.length > 0 &&
        !filterPaymentMethodIds.some((paymentMethodId) =>
          paymentMethodId === missingFilterValue
            ? transaction.paymentMethodId === null && !transaction.creditCardId
            : paymentMethodId === creditCardPaymentMethodId
              ? Boolean(transaction.creditCardId) || transaction.paymentMethodId === paymentMethodId
              : transaction.paymentMethodId === paymentMethodId
        )
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      // 1. Descrição
      const matchesDescription = transaction.description.toLowerCase().includes(query);
      // 2. Observação/notas
      const matchesNotes = transaction.notes?.toLowerCase().includes(query) ?? false;
      // 3. Data
      const formattedDate = formatBusinessDateForDisplay(transaction.eventDate);
      const matchesDate = transaction.eventDate.includes(query) || formattedDate.includes(query);
      const matchesCategory = getCategoryLabel(transaction.subcategoryId, categories)
        .toLowerCase()
        .includes(query);
      const matchesAccount = getTransactionAccountLabel(transaction, accounts, creditCards)
        .toLowerCase()
        .includes(query);
      const matchesPaymentMethod = getTransactionPaymentMethodLabel(transaction, paymentMethods)
        .toLowerCase()
        .includes(query);
      const matchesType = getTransactionTypeLabel(transaction.type).toLowerCase().includes(query);

      return (
        matchesDescription ||
        matchesNotes ||
        matchesDate ||
        matchesCategory ||
        matchesAccount ||
        matchesPaymentMethod ||
        matchesType
      );
    });
  }, [
    visibleTransactions,
    searchQuery,
    categories,
    accounts,
    creditCards,
    paymentMethods,
    dateFilterMode,
    filterAccountId,
    filterDateFrom,
    filterDateTo,
    filterPaymentMethodIds,
    filterSubcategoryIds
  ]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      let result = 0;

      if (sortColumn === "date") {
        result = a.eventDate.localeCompare(b.eventDate);
      } else if (sortColumn === "description") {
        result = a.description.localeCompare(b.description, "pt-BR");
      } else if (sortColumn === "type") {
        result = getTransactionTypeLabel(a.type).localeCompare(
          getTransactionTypeLabel(b.type),
          "pt-BR"
        );
      } else if (sortColumn === "amount") {
        result = a.amountCents - b.amountCents;
      } else if (sortColumn === "account") {
        result = getTransactionAccountLabel(a, accounts, creditCards).localeCompare(
          getTransactionAccountLabel(b, accounts, creditCards),
          "pt-BR"
        );
      } else if (sortColumn === "paymentMethod") {
        result = getTransactionPaymentMethodLabel(a, paymentMethods).localeCompare(
          getTransactionPaymentMethodLabel(b, paymentMethods),
          "pt-BR"
        );
      } else if (sortColumn === "category") {
        result = getCategoryLabel(a.subcategoryId, categories).localeCompare(
          getCategoryLabel(b.subcategoryId, categories),
          "pt-BR"
        );
      }

      return result === 0
        ? b.eventDate.localeCompare(a.eventDate) ||
            a.description.localeCompare(b.description, "pt-BR")
        : result * direction;
    });
  }, [
    accounts,
    categories,
    creditCards,
    filteredTransactions,
    paymentMethods,
    sortColumn,
    sortDirection
  ]);

  function handleSort(column: string) {
    const nextColumn = column as TransactionSortColumn;
    if (sortColumn === nextColumn) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(nextColumn);
    setSortDirection(nextColumn === "date" || nextColumn === "amount" ? "desc" : "asc");
  }

  const toggleSelectAllTransactions = useCallback(() => {
    setSelectedTransactionIds((current) => {
      const allFilteredIds = filteredTransactions.map((t) => t.id);
      const allSelected = allFilteredIds.every((id) => current.has(id));
      const next = new Set(current);
      if (allSelected) {
        for (const id of allFilteredIds) {
          next.delete(id);
        }
      } else {
        for (const id of allFilteredIds) {
          next.add(id);
        }
      }
      return next;
    });
  }, [filteredTransactions]);

  const renderedRows = useMemo(() => {
    return sortedTransactions.map((transaction) => (
      <Table.Tr key={transaction.id} style={{ verticalAlign: "middle" }}>
        <Table.Td>
          <Checkbox
            aria-label={`Selecionar lançamento ${transaction.description}`}
            checked={selectedTransactionIds.has(transaction.id)}
            onChange={() => toggleTransactionSelection(transaction.id)}
          />
        </Table.Td>
        <Table.Td>
          <QuickDateEdit
            value={transaction.eventDate}
            referenceMonth={transaction.eventDate.slice(0, 7) || selectedMonth}
            onSave={(eventDate) => updateTransactionInline(transaction, { eventDate })}
          />
        </Table.Td>
        <Table.Td style={{ maxWidth: 350, wordBreak: "break-word" }}>
          <Group gap="xs" wrap="nowrap">
            <QuickTextEdit
              value={transaction.description}
              fw={600}
              placeholder="Descrição"
              onSave={(description) => updateTransactionInline(transaction, { description })}
            />
            {transaction.transferId && (
              <Badge variant="light" color="blue" size="xs">
                Transferência
              </Badge>
            )}
          </Group>
          {transaction.notes ? (
            <Text size="xs" c="dimmed">
              {transaction.notes}
            </Text>
          ) : null}
        </Table.Td>
        <Table.Td>
          <Badge variant="light" color={getAmountColor(transaction.type)}>
            {getTransactionTypeLabel(transaction.type)}
          </Badge>
        </Table.Td>
        <Table.Td>
          <QuickAmountEdit
            valueCents={transaction.amountCents}
            color={getAmountColor(transaction.type)}
            prefix={`${getTransactionSignal(transaction)} `}
            onSave={(amountCents) => updateTransactionInline(transaction, { amountCents })}
          />
        </Table.Td>
        <Table.Td style={{ minWidth: 170, maxWidth: 220 }}>
          {transaction.creditCardId ? (
            <Text size="sm" fw={500} truncate="end">
              {getTransactionAccountLabel(transaction, accounts, creditCards)}
            </Text>
          ) : (
            <Select
              size="xs"
              variant="unstyled"
              data={[{ value: emptySelectValue, label: "Sem conta" }, ...accountOptions]}
              value={transaction.accountId ?? emptySelectValue}
              onChange={(value) =>
                void updateTransactionInline(transaction, {
                  accountId: value === emptySelectValue ? null : value
                })
              }
              searchable
              styles={{
                input: {
                  cursor: "pointer",
                  fontWeight: 500,
                  padding: 0,
                  minHeight: "unset",
                  height: "auto",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                },
                root: { minWidth: 170 }
              }}
            />
          )}
        </Table.Td>
        <Table.Td style={{ minWidth: 190, maxWidth: 240 }}>
          {transaction.creditCardId ? (
            <Text size="sm" fw={500} truncate="end">
              Cartão de Crédito
            </Text>
          ) : (
            <Select
              size="xs"
              variant="unstyled"
              data={paymentMethodOptions}
              value={transaction.paymentMethodId ?? emptySelectValue}
              onChange={(value) =>
                void updateTransactionInline(transaction, {
                  paymentMethodId: value === emptySelectValue ? null : value
                })
              }
              searchable
              styles={{
                input: {
                  cursor: "pointer",
                  fontWeight: 500,
                  padding: 0,
                  minHeight: "unset",
                  height: "auto",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                },
                root: { minWidth: 190 }
              }}
            />
          )}
        </Table.Td>
        <Table.Td style={{ minWidth: 220, maxWidth: 280 }}>
          <QuickCategoryEdit
            categories={categories}
            value={transaction.subcategoryId ?? emptySelectValue}
            onChange={(value) =>
              void updateTransactionInline(transaction, {
                subcategoryId: value === emptySelectValue ? null : value
              })
            }
            emptyOptionLabel="Sem categoria"
          />
        </Table.Td>
        <Table.Td>
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Editar lançamento">
              <ActionIcon
                variant="subtle"
                aria-label={`Editar lançamento ${transaction.description}`}
                onClick={() => openEditDrawer(transaction)}
              >
                <IconEdit size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Excluir lançamento">
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Excluir lançamento ${transaction.description}`}
                onClick={() => void deleteTransaction(transaction)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Table.Td>
      </Table.Tr>
    ));
  }, [
    sortedTransactions,
    selectedTransactionIds,
    categories,
    accounts,
    creditCards,
    paymentMethods,
    toggleTransactionSelection,
    openEditDrawer,
    deleteTransaction,
    updateTransactionInline
  ]);

  async function applyBulkTransactionEdits() {
    if (selectedTransactionIds.size === 0) {
      setError("Selecione pelo menos um lançamento para editar em massa.");
      return;
    }

    const hasAccountEdits =
      bulkAccountId !== emptySelectValue || bulkPaymentMethodId !== emptySelectValue;
    const hasCategoryEdit = bulkSubcategoryId !== emptySelectValue;

    if (!hasAccountEdits && !hasCategoryEdit) {
      setError("Escolha conta, forma de pagamento ou categoria para aplicar em massa.");
      return;
    }

    const selectedAccount =
      bulkAccountId !== emptySelectValue && bulkAccountId !== "__clear__"
        ? accounts.find((account) => account.id === bulkAccountId)
        : null;

    setIsBulkSaving(true);
    setError(null);

    const optimisticUpdates = new Map<string, Partial<Transaction>>();

    try {
      for (const transaction of selectedTransactions) {
        const nextTransaction: Transaction = { ...transaction };

        if (!transaction.creditCardId) {
          if (bulkAccountId !== emptySelectValue) {
            nextTransaction.accountId = bulkAccountId === "__clear__" ? null : bulkAccountId;
            if (
              bulkPaymentMethodId === emptySelectValue &&
              selectedAccount?.defaultPaymentMethodId
            ) {
              nextTransaction.paymentMethodId = selectedAccount.defaultPaymentMethodId;
            }
          }

          if (bulkPaymentMethodId !== emptySelectValue) {
            nextTransaction.paymentMethodId =
              bulkPaymentMethodId === "__clear__" ? null : bulkPaymentMethodId;
          }
        }

        if (bulkSubcategoryId !== emptySelectValue) {
          nextTransaction.subcategoryId =
            bulkSubcategoryId === "__clear__" ? null : bulkSubcategoryId;
        }

        optimisticUpdates.set(transaction.id, {
          accountId: nextTransaction.accountId,
          paymentMethodId: nextTransaction.paymentMethodId,
          subcategoryId: nextTransaction.subcategoryId
        });

        const response = await fetch(`${apiBaseUrl}/transactions/${transaction.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: nextTransaction.type,
            description: nextTransaction.description,
            amountCents: nextTransaction.amountCents,
            eventDate: nextTransaction.eventDate,
            budgetMonth: nextTransaction.budgetMonth,
            accountId: nextTransaction.accountId,
            paymentMethodId: nextTransaction.paymentMethodId,
            subcategoryId: nextTransaction.subcategoryId,
            creditCardId: nextTransaction.creditCardId,
            status: nextTransaction.status,
            notes: nextTransaction.notes
          })
        });

        if (!response.ok) {
          throw new Error(
            await getResponseError(
              response,
              `Não foi possível atualizar "${transaction.description}".`
            )
          );
        }
      }

      setTransactions((current) =>
        current.map((transaction) => ({
          ...transaction,
          ...(optimisticUpdates.get(transaction.id) ?? {})
        }))
      );
      setSelectedTransactionIds(new Set());
      setBulkAccountId(emptySelectValue);
      setBulkPaymentMethodId(emptySelectValue);
      setBulkSubcategoryId(emptySelectValue);
      await loadTransactions();
    } catch (bulkError) {
      reportClientError("transactions.bulkEdit", bulkError);
      setError(getErrorMessage(bulkError));
      await loadTransactions();
    } finally {
      setIsBulkSaving(false);
    }
  }

  return (
    <Stack gap="lg">
      <Paper withBorder p="xl" radius="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <div>
            <Title order={2}>Lançamentos</Title>
            <Text c="dimmed" mt={6}>
              Registre receitas, despesas, ajustes e estornos com conta, categoria e mês de impacto.
            </Text>
          </div>
          <Group gap="xs" justify="flex-end">
            {!isDrawerOpen && hasCreateDraft ? (
              <Tooltip label="Retomar rascunho">
                <ActionIcon
                  size="lg"
                  variant="light"
                  aria-label="Retomar rascunho"
                  onClick={() => setIsDrawerOpen(true)}
                >
                  <IconChevronLeft size={20} />
                </ActionIcon>
              </Tooltip>
            ) : null}
            <Button
              variant="light"
              leftSection={<IconDownload size={18} />}
              onClick={handleExportCsv}
            >
              Exportar CSV
            </Button>
            <Button
              variant="light"
              leftSection={<IconUpload size={18} />}
              onClick={() => {
                
                setIsImportModalOpen(true);
              }}
            >
              Importar CSV
            </Button>
            <Button leftSection={<IconPlus size={18} />} onClick={openCreateDrawer}>
              Novo lançamento
            </Button>
          </Group>
        </Group>
      </Paper>

      <MonthSelector selectedMonth={selectedMonth} onChange={setSelectedMonth} />

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={700}>Filtros</Text>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => {
                setFilterType(emptySelectValue);
                setFilterAccountId(emptySelectValue);
                setFilterPaymentMethodIds([]);
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
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} spacing="sm">
            <TextInput
              label="Buscar"
              placeholder="Descrição, obs, data, categoria..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              leftSection={<IconSearch size={16} />}
            />
            <Select
              label="Tipo"
              data={[
                { value: emptySelectValue, label: "Todos" },
                ...transactionTypes.map((transactionType) => ({
                  value: transactionType.value,
                  label: transactionType.label
                }))
              ]}
              value={filterType}
              onChange={(value) => setFilterType(value ?? emptySelectValue)}
            />
            <Select
              label="Conta"
              data={[
                { value: emptySelectValue, label: "Todas" },
                { value: missingFilterValue, label: "Sem conta" },
                ...accountOptions
              ]}
              value={filterAccountId}
              onChange={(value) => setFilterAccountId(value ?? emptySelectValue)}
              searchable
            />
            <MultiSelect
              label="Formas"
              data={filterPaymentMethodOptions}
              value={filterPaymentMethodIds}
              onChange={setFilterPaymentMethodIds}
              placeholder={filterPaymentMethodIds.length === 0 ? "Todas" : undefined}
              searchable
              clearable
              hidePickedOptions
            />
            <CategoryMultiSelect
              label="Categorias"
              categories={categories}
              value={filterSubcategoryIds}
              onChange={setFilterSubcategoryIds}
              placeholder="Todas"
              extraOptions={[{ value: missingFilterValue, label: "Sem categoria" }]}
            />
          </SimpleGrid>
          <Group justify="space-between" align="center">
            <Button
              variant="subtle"
              size="xs"
              leftSection={
                isAdvancedFiltersOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
              }
              onClick={() => setIsAdvancedFiltersOpen((opened) => !opened)}
            >
              Busca avançada
            </Button>
            <Text size="xs" c="dimmed">
              {filteredTransactions.length} de {visibleTransactions.length} lançamentos
            </Text>
          </Group>
          <Collapse in={isAdvancedFiltersOpen}>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <SegmentedControl
                data={[
                  { value: "all", label: "Mês inteiro" },
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
        </Stack>
      </Paper>

      {error ? (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      ) : null}

      <Paper withBorder radius="md">
        {isLoading && transactions.length === 0 ? (
          <Group justify="center" p="xl">
            <Loader />
          </Group>
        ) : visibleTransactions.length === 0 ? (
          <Stack align="center" p="xl" gap="xs">
            <Title order={4}>Nenhum lançamento neste mês</Title>
            <Text c="dimmed">Crie o primeiro lançamento para acompanhar o mês.</Text>
            <Button mt="sm" leftSection={<IconPlus size={18} />} onClick={openCreateDrawer}>
              Criar lançamento
            </Button>
          </Stack>
        ) : (
          <Stack gap={0}>
            {selectedTransactionIds.size > 1 ? (
              <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
                <Stack gap="sm">
                  <div>
                    <Text fw={700}>Edição em massa</Text>
                    <Text size="xs" c="dimmed">
                      {selectedTransactionIds.size} selecionados
                      {selectedAccountTransactions.length !== selectedTransactionIds.size
                        ? " · conta e forma só se aplicam a lançamentos sem cartão"
                        : ""}
                    </Text>
                  </div>
                  <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="sm">
                    <Select
                      label="Conta"
                      placeholder="Manter"
                      data={[
                        { value: emptySelectValue, label: "Manter conta atual" },
                        { value: "__clear__", label: "Sem conta" },
                        ...accountOptions
                      ]}
                      value={bulkAccountId}
                      onChange={(value) => setBulkAccountId(value ?? emptySelectValue)}
                      searchable
                    />
                    <Select
                      label="Forma de pagamento"
                      placeholder="Manter"
                      data={[
                        { value: emptySelectValue, label: "Manter forma atual" },
                        { value: "__clear__", label: "Sem meio de pagamento" },
                        ...paymentMethodOptions.filter(
                          (option) => option.value !== emptySelectValue
                        )
                      ]}
                      value={bulkPaymentMethodId}
                      onChange={(value) => setBulkPaymentMethodId(value ?? emptySelectValue)}
                      searchable
                    />
                    <CategorySelect
                      label="Categoria"
                      categories={categories}
                      value={bulkSubcategoryId}
                      onChange={(value) => setBulkSubcategoryId(value)}
                      emptyOptionLabel="Manter categoria atual"
                      placeholder="Manter"
                    />
                    <Group align="flex-end">
                      <Button
                        fullWidth
                        onClick={() => void applyBulkTransactionEdits()}
                        loading={isBulkSaving}
                      >
                        Aplicar
                      </Button>
                    </Group>
                  </SimpleGrid>
                </Stack>
              </Box>
            ) : null}
            <Table.ScrollContainer minWidth={1260}>
              <Table verticalSpacing="xs" fz="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 44 }}>
                      <Checkbox
                        aria-label="Selecionar todos os lançamentos"
                        checked={
                          filteredTransactions.length > 0 &&
                          filteredTransactions.every((t) => selectedTransactionIds.has(t.id))
                        }
                        indeterminate={
                          filteredTransactions.some((t) => selectedTransactionIds.has(t.id)) &&
                          !filteredTransactions.every((t) => selectedTransactionIds.has(t.id))
                        }
                        onChange={toggleSelectAllTransactions}
                      />
                    </Table.Th>
                    <SortableTableHeader
                      label="Data"
                      column="date"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      style={{ width: 95 }}
                    />
                    <SortableTableHeader
                      label="Descrição"
                      column="description"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      style={{ minWidth: 220 }}
                    />
                    <SortableTableHeader
                      label="Tipo"
                      column="type"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      style={{ width: 115 }}
                    />
                    <SortableTableHeader
                      label="Valor"
                      column="amount"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      style={{ width: 110 }}
                    />
                    <SortableTableHeader
                      label="Conta"
                      column="account"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      style={{ minWidth: 170 }}
                    />
                    <SortableTableHeader
                      label="Meio"
                      column="paymentMethod"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      style={{ minWidth: 190 }}
                    />
                    <SortableTableHeader
                      label="Categoria"
                      column="category"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      style={{ minWidth: 220 }}
                    />
                    <Table.Th style={{ width: 80 }}>Ações</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{renderedRows}</Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        )}
      </Paper>

      <Drawer
        opened={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        position="right"
        size="min(100vw, 520px)"
        withCloseButton={false}
        title={
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <Tooltip label="Recolher como rascunho">
              <ActionIcon
                variant="subtle"
                aria-label="Recolher como rascunho"
                onClick={() => setIsDrawerOpen(false)}
              >
                <IconChevronRight size={20} />
              </ActionIcon>
            </Tooltip>
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text size="xs" tt="uppercase" fw={700} c="teal">
                Lançamento rápido
              </Text>
              <Title order={3} style={{ overflowWrap: "anywhere" }}>
                {editingTransaction ? "Editar lançamento" : "Novo lançamento"}
              </Title>
              <Text size="sm" c="dimmed">
                {editingTransaction ? "Atualize os dados e salve." : "Salve e continue lançando."}
              </Text>
            </Stack>
          </Group>
        }
      >
        <Stack mih="calc(100vh - 170px)" pb={0}>
          {drawerError ? (
            <Alert color="red" variant="light">
              {drawerError}
            </Alert>
          ) : null}

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              Tipo
            </Text>
            <Box style={{ overflowX: "auto" }}>
              <SegmentedControl
                fullWidth
                data={transactionTypeOptions}
                value={form.type}
                onChange={(value) => setForm((current) => ({ ...current, type: value }))}
                styles={{
                  root: {
                    minWidth: 360
                  }
                }}
              />
            </Box>
          </Stack>
          <TextInput
            ref={descriptionInputRef}
            label="Descrição"
            placeholder="Mercado, salário, reembolso..."
            value={form.description}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setForm((current) => ({ ...current, description: value }));
            }}
            required
          />
          <NumberInput
            label="Valor"
            decimalScale={2}
            fixedDecimalScale
            thousandSeparator="."
            decimalSeparator=","
            prefix="R$ "
            min={0}
            step={0.01}
            value={form.amountReais}
            onChange={(value) =>
              setForm((current) => ({ ...current, amountReais: normalizeAmountInput(value) }))
            }
            onFocus={(e) => e.currentTarget.select()}
            required
          />
          <BusinessDateInput
            label="Data da compra"
            value={form.eventDate}
            onChange={updateEventDate}
            referenceMonth={form.eventDate.slice(0, 7) || selectedMonth}
            required
          />

          {(form.type === "expense" || form.type === "refund" || form.type === "chargeback") && (
            <Stack gap={6}>
              <Text size="sm" fw={500}>
                Forma de pagamento
              </Text>
              <SegmentedControl
                fullWidth
                data={[
                  { value: "account", label: "Conta" },
                  { value: "card", label: "Cartão de crédito" }
                ]}
                value={form.paymentMode}
                onChange={(value) =>
                  setForm((current) => {
                    const isCard = value === "card";
                    const defaultCard = creditCards.find((c) => c.isDefault && c.isActive);
                    return {
                      ...current,
                      paymentMode: isCard ? "card" : "account",
                      creditCardId: isCard
                        ? (defaultCard?.id ?? emptySelectValue)
                        : emptySelectValue
                    };
                  })
                }
              />
            </Stack>
          )}

          {form.paymentMode === "account" && (
            <>
              <Select
                label="Conta"
                data={[...accountOptions, { value: emptySelectValue, label: "Sem conta" }]}
                value={form.accountId}
                onChange={(value) => updateAccount(value ?? emptySelectValue)}
              />
              {isTransferCategory && (
                <Select
                  label="Conta de Destino"
                  data={[...accountOptions, { value: emptySelectValue, label: "Sem conta" }]}
                  value={form.destinationAccountId}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      destinationAccountId: value ?? emptySelectValue
                    }))
                  }
                  required
                />
              )}
              <Select
                label="Meio de pagamento"
                data={paymentMethodOptions}
                value={form.paymentMethodId}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    paymentMethodId: value ?? emptySelectValue
                  }))
                }
              />
            </>
          )}

          {form.paymentMode === "card" && (
            <>
              <Select
                label="Cartão de crédito"
                data={creditCardOptions}
                value={form.creditCardId}
                onChange={(value) =>
                  setForm((current) => ({ ...current, creditCardId: value ?? emptySelectValue }))
                }
                required
              />
              <TextInput
                label="Mês da fatura"
                description="Calculado automaticamente pela data da compra e fechamento do cartão."
                value={form.budgetMonth}
                placeholder="YYYY-MM"
                readOnly
              />

              {/* Installments — only for new card transactions */}
              {form.type === "expense" && form.paymentMode === "card" && (
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
                    value={form.installmentCount === 1 ? "1" : "n"}
                    onChange={(v) =>
                      setForm((current) => ({
                        ...current,
                        installmentCount: v === "1" ? 1 : 2
                      }))
                    }
                  />
                  {form.installmentCount > 1 && (
                    <Group align="flex-end" gap="sm">
                      <NumberInput
                        label="Número de parcelas"
                        min={2}
                        max={48}
                        style={{ flex: 1 }}
                        value={form.installmentCount}
                        onChange={(v) =>
                          setForm((current) => ({
                            ...current,
                            installmentCount: Math.max(2, Math.min(48, Number(v) || 2))
                          }))
                        }
                        onFocus={(e) => e.currentTarget.select()}
                      />
                      <Text size="sm" c="teal" fw={600} pb={6}>
                        {form.installmentCount}x de{" "}
                        {formatInstallmentPreview(form.amountReais, form.installmentCount)}
                      </Text>
                    </Group>
                  )}
                </Stack>
              )}
            </>
          )}

          <CategorySelect
            label="Categoria"
            categories={categories}
            filterNatures={
              form.type === "income"
                ? ["income", "transfer"]
                : form.type === "expense"
                  ? ["expense", "transfer"]
                  : form.type === "refund" || form.type === "chargeback"
                    ? ["expense"]
                    : undefined
            }
            value={form.subcategoryId}
            onChange={(value) => setForm((current) => ({ ...current, subcategoryId: value }))}
          />
          <TextInput
            label="Observação"
            value={form.notes}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setForm((current) => ({ ...current, notes: value }));
            }}
          />
          <Group justify="flex-end">
            <Button onClick={() => void saveTransaction()} loading={isSaving}>
              Salvar
            </Button>
          </Group>
        </Stack>

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
          <Text size="xs" c="dimmed">
            Rascunho
          </Text>
          <Tooltip label="Limpar lançamento">
            <ActionIcon
              size="lg"
              variant="subtle"
              color="gray"
              aria-label="Limpar lançamento"
              onClick={discardDraft}
            >
              <IconEraser size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Drawer>

      {!isDrawerOpen ? (
        <Affix position={{ right: 0, top: "50%" }}>
          <Tooltip label={hasCreateDraft ? "Retomar rascunho" : "Abrir lançamento"}>
            <ActionIcon
              size="xl"
              radius={0}
              variant="filled"
              aria-label={hasCreateDraft ? "Retomar rascunho" : "Abrir lançamento"}
              onClick={openCreateDrawer}
            >
              <IconChevronLeft size={24} />
            </ActionIcon>
          </Tooltip>
        </Affix>
      ) : null}

      <SimpleCsvImportDialog opened={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImported={() => { setIsImportModalOpen(false); void loadTransactions(); }} />

    </Stack>
  );
}

function buildEmptyFormWithDefaults(
  accounts: Account[],
  creditCards?: CreditCard[]
): TransactionFormState {
  const primaryAccount = accounts.find((account) => account.isPrimary);
  const defaultCard = creditCards?.find((card) => card.isDefault && card.isActive);
  const eventDate = today;

  return {
    ...emptyForm,
    eventDate,
    budgetMonth: eventDate.slice(0, 7),
    accountId: primaryAccount?.id ?? emptySelectValue,
    paymentMethodId: primaryAccount?.defaultPaymentMethodId ?? emptySelectValue,
    paymentMode: "account",
    creditCardId: defaultCard?.id ?? emptySelectValue,
    installmentCount: 1
  };
}

function isTransactionDraftDirty(
  form: TransactionFormState,
  comparableEmptyForm: TransactionFormState
) {
  return JSON.stringify(form) !== JSON.stringify(comparableEmptyForm);
}

function isPristineTransactionDraft(form: TransactionFormState) {
  return (
    form.type === "expense" &&
    form.description.trim() === "" &&
    isEmptyAmount(form.amountReais) &&
    form.subcategoryId === emptySelectValue &&
    form.status === "confirmed" &&
    form.notes.trim() === "" &&
    form.paymentMode === "account" &&
    form.creditCardId === emptySelectValue &&
    form.installmentCount === 1
  );
}

function buildTransactionSearchParams({
  selectedMonth,
  filterType,
  filterPaymentMethodIds,
  filterSubcategoryIds
}: {
  selectedMonth: string;
  filterType: string;
  filterPaymentMethodIds: string[];
  filterSubcategoryIds: string[];
}) {
  const params = new URLSearchParams({ budgetMonth: selectedMonth });
  if (filterType !== emptySelectValue) params.set("type", filterType);
  if (
    filterPaymentMethodIds.length === 1 &&
    filterPaymentMethodIds[0] !== creditCardPaymentMethodId
  ) {
    params.set("paymentMethodId", filterPaymentMethodIds[0]);
  }
  if (filterSubcategoryIds.length === 1) {
    params.set("subcategoryId", filterSubcategoryIds[0]);
  }
  return params;
}

/** Shows installment value preview, e.g. "3x de R$ 100,00" */
function formatInstallmentPreview(amountReais: number | string, count: number): string {
  if (count <= 0) return "";
  const totalCents = parseTransactionAmount(amountReais);
  const installmentCents = Math.floor(totalCents / count);
  return formatMoney(moneyFromCents(installmentCents));
}

/**
 * Calcula o mês de impacto (fatura) de uma compra no cartão.
 *
 * Regra: se o dia da compra é ANTES do dia de fechamento, a compra
 * cai na fatura do mês atual. Se for no dia do fechamento ou depois,
 * cai na fatura do mês seguinte.
 *
 * Exemplo: fechamento dia 15.
 *   - Compra dia 10/jun → fatura junho (vence julho)
 *   - Compra dia 15/jun → fatura julho (vence agosto)
 *   - Compra dia 20/jun → fatura julho (vence agosto)
 */
export function calcBillMonth(eventDate: string, closingDay: number): string {
  const [year, month, day] = eventDate.split("-").map(Number);
  if (day < closingDay) {
    return `${year}-${String(month).padStart(2, "0")}`;
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function isEmptyAmount(value: number | string) {
  if (typeof value === "number") {
    return value === 0;
  }

  return value.trim() === "" || parseMoneyToCents(value) === 0;
}

function shouldIgnoreGlobalShortcut(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest("input, textarea, select, button, [contenteditable='true'], [role='textbox']")
  );
}

function validateTransactionForm(form: TransactionFormState) {
  if (!form.description.trim()) {
    throw new Error("Informe a descrição do lançamento.");
  }

  if (parseTransactionAmount(form.amountReais) <= 0) {
    throw new Error("Informe um valor maior que zero.");
  }

  if (!form.eventDate) {
    throw new Error("Informe a data do lançamento.");
  }
}

function parseTransactionAmount(value: number | string) {
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

function toNullableSelectValue(value: string) {
  return value === emptySelectValue ? null : value;
}

function getTransactionSignal(transaction: Transaction) {
  return transaction.type === "expense" ? "−" : "+";
}

function getTransactionTypeLabel(type: string) {
  return transactionTypes.find((transactionType) => transactionType.value === type)?.label ?? type;
}

function getAccountLabel(accountId: string | null, accounts: Account[]) {
  return accounts.find((account) => account.id === accountId)?.name ?? "-";
}

function getPaymentMethodLabel(paymentMethodId: string | null, paymentMethods: PaymentMethod[]) {
  return paymentMethods.find((paymentMethod) => paymentMethod.id === paymentMethodId)?.name ?? "-";
}

function getCategoryLabel(subcategoryId: string | null, categories: Category[]) {
  if (!subcategoryId) return "Sem categoria";

  for (const category of categories) {
    const subcategory = category.subcategories.find((sub) => sub.id === subcategoryId);
    if (subcategory) {
      return `${category.name} ${subcategory.name}`;
    }
  }

  return "Sem categoria";
}

function getTransactionAccountLabel(
  transaction: Transaction,
  accounts: Account[],
  creditCards: CreditCard[]
) {
  return getAccountLabel(getTransactionEffectiveAccountId(transaction, creditCards), accounts);
}

function getTransactionPaymentMethodLabel(
  transaction: Transaction,
  paymentMethods: PaymentMethod[]
) {
  if (transaction.creditCardId) {
    return "Cartão de Crédito";
  }

  return getPaymentMethodLabel(transaction.paymentMethodId, paymentMethods);
}

function getTransactionEffectiveAccountId(
  transaction: Transaction,
  creditCards: CreditCard[]
): string | null {
  if (!transaction.creditCardId) {
    return transaction.accountId;
  }

  return creditCards.find((card) => card.id === transaction.creditCardId)?.paymentAccountId ?? null;
}
