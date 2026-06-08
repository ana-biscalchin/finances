import {
  ActionIcon,
  Affix,
  Alert,
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  Loader,
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
  Title,
  Modal,
  Checkbox,
  FileInput
} from "@mantine/core";
import {
  formatMoney,
  getCategoryColor,
  moneyFromCents,
  parseMoneyToCents,
  transactionStatuses,
  transactionTypes
} from "@finances/domain";
import {
  IconTrash,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconEraser,
  IconPlus,
  IconDownload,
  IconUpload,
  IconAlertTriangle,
  IconCheck
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatBusinessDateForDisplay } from "../date-format";

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
  linkedTransactionId?: string | null;
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
  isDuplicate: boolean;
  duplicateOf?: {
    id: string;
    description: string;
    eventDate: string;
    amountCents: number;
    accountName: string | null;
  } | null;
};

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
const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);
const emptySelectValue = "__none__";
const transactionTypeOptions = transactionTypes.map((transactionType) => ({
  value: transactionType.value,
  label: transactionType.label
}));

const emptyForm: TransactionFormState = {
  type: "expense",
  description: "",
  amountReais: 0,
  eventDate: today,
  budgetMonth: currentMonth,
  accountId: emptySelectValue,
  paymentMethodId: emptySelectValue,
  subcategoryId: emptySelectValue,
  status: "planned",
  notes: "",
  destinationAccountId: emptySelectValue,
  paymentMode: "account",
  creditCardId: emptySelectValue,
  installmentCount: 1
};

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [filterType, setFilterType] = useState<string>(emptySelectValue);
  const [filterStatus, setFilterStatus] = useState<string>(emptySelectValue);
  const [filterAccountId, setFilterAccountId] = useState<string>(emptySelectValue);
  const [filterPaymentMethodId, setFilterPaymentMethodId] = useState<string>(emptySelectValue);
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>(emptySelectValue);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [form, setForm] = useState<TransactionFormState>(emptyForm);
  const [eventDateText, setEventDateText] = useState(formatDateForDisplay(emptyForm.eventDate));
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [bulkAccountId, setBulkAccountId] = useState<string>(emptySelectValue);
  const [bulkPaymentMethodId, setBulkPaymentMethodId] = useState<string>(emptySelectValue);
  const [bulkSubcategoryId, setBulkSubcategoryId] = useState<string>(emptySelectValue);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const calendarInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  // Import/Export CSV state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [csvTextContent, setCsvTextContent] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState({
    eventDate: "",
    description: "",
    amount: "",
    type: "",
    subcategoryId: ""
  });
  const [importDateFormat, setImportDateFormat] = useState<"DMY" | "MDY" | "YMD">("DMY");
  const [importAccountId, setImportAccountId] = useState<string>(emptySelectValue);
  const [importType, setImportType] = useState<"account" | "card">("account");
  const [importCreditCardId, setImportCreditCardId] = useState<string>(emptySelectValue);
  const [previewTransactions, setPreviewTransactions] = useState<ImportPreviewItem[]>([]);
  const [selectedImportTempIds, setSelectedImportTempIds] = useState<Set<string>>(new Set());
  const [bulkImportType, setBulkImportType] = useState<string>(emptySelectValue);
  const [bulkImportAccountId, setBulkImportAccountId] = useState<string>(emptySelectValue);
  const [bulkImportPaymentMethodId, setBulkImportPaymentMethodId] = useState<string>(emptySelectValue);
  const [bulkImportSubcategoryId, setBulkImportSubcategoryId] = useState<string>(emptySelectValue);
  const [isImportPreviewLoading, setIsImportPreviewLoading] = useState(false);
  const [isImportConfirming, setIsImportConfirming] = useState(false);
  const [importModalError, setImportModalError] = useState<string | null>(null);

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
  const creditCardOptions = useMemo(
    () => [
      { value: emptySelectValue, label: "Selecione um cartão" },
      ...creditCards
        .filter((c) => c.isActive)
        .map((c) => ({ value: c.id, label: c.institution ? `${c.name} (${c.institution})` : c.name }))
    ],
    [creditCards]
  );
  const hasDraft = useMemo(
    () => isTransactionDraftDirty(form, buildEmptyFormWithDefaults(accounts, selectedMonth, creditCards)),
    [accounts, form, selectedMonth, creditCards]
  );
  const hasCreateDraft = !editingTransaction && hasDraft;
  const selectedTransactions = useMemo(
    () => transactions.filter((transaction) => selectedTransactionIds.has(transaction.id)),
    [selectedTransactionIds, transactions]
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

  const filteredCategoryOptions = useMemo(() => {
    let filtered = categories;
    
    let natureFilters: string[] = [];
    if (form.type === "income") natureFilters = ["income", "transfer"];
    if (form.type === "expense") natureFilters = ["expense", "transfer"];
    if (form.type === "refund" || form.type === "chargeback") natureFilters = ["expense"];

    if (natureFilters.length > 0) {
      filtered = categories.filter((c) => natureFilters.includes(c.nature));
    }
    
    return buildCategoryGroups(filtered);
  }, [categories, form.type]);

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

  async function loadTransactions() {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ budgetMonth: selectedMonth });
      if (filterType !== emptySelectValue) params.set("type", filterType);
      if (filterStatus !== emptySelectValue) params.set("status", filterStatus);
      if (filterAccountId !== emptySelectValue) params.set("accountId", filterAccountId);
      if (filterPaymentMethodId !== emptySelectValue) {
        params.set("paymentMethodId", filterPaymentMethodId);
      }
      if (filterSubcategoryId !== emptySelectValue) {
        params.set("subcategoryId", filterSubcategoryId);
      }

      const response = await fetch(`${apiBaseUrl}/transactions?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Não foi possível carregar os lançamentos.");
      }

      setTransactions(await response.json());
      setSelectedTransactionIds(new Set());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleExportCsv() {
    const params = new URLSearchParams({ budgetMonth: selectedMonth });
    if (filterType !== emptySelectValue) params.set("type", filterType);
    if (filterStatus !== emptySelectValue) params.set("status", filterStatus);
    if (filterAccountId !== emptySelectValue) params.set("accountId", filterAccountId);
    if (filterPaymentMethodId !== emptySelectValue) {
      params.set("paymentMethodId", filterPaymentMethodId);
    }
    if (filterSubcategoryId !== emptySelectValue) {
      params.set("subcategoryId", filterSubcategoryId);
    }
    window.open(`${apiBaseUrl}/transactions/export?${params.toString()}`, "_blank");
  }

  function handleFileChange(file: File | null) {
    setImportFile(file);
    setImportModalError(null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvTextContent(text);

      const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/)[0] ?? "";
      const headers = parseCsvHeaderLine(firstLine).filter(Boolean);
      setCsvHeaders(headers);

      const nextMappings = { eventDate: "", description: "", amount: "", type: "", subcategoryId: "" };
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
          lower.includes("amount") ||
          lower.includes("cents")
        ) {
          nextMappings.amount = h;
        } else if (lower.includes("tipo") || lower.includes("type") || lower.includes("natureza")) {
          nextMappings.type = h;
          nextMappings.subcategoryId = h;
        } else if (
          lower.includes("categoria") ||
          lower.includes("category") ||
          lower.includes("subcategoria")
        ) {
          nextMappings.subcategoryId = h;
        }
      }
      setMappings(nextMappings);
    };
    reader.readAsText(file);
  }

  async function generateImportPreview() {
    if (!mappings.eventDate || !mappings.description || !mappings.amount) {
      setImportModalError("Por favor, preencha o mapeamento para Data, Descrição e Valor.");
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
          mappings,
          dateFormat: importDateFormat,
          defaultAccountId: importType === "account" && importAccountId !== emptySelectValue ? importAccountId : null,
          defaultCreditCardId: importType === "card" && importCreditCardId !== emptySelectValue ? importCreditCardId : null
        })
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Erro ao gerar prévia da importação."));
      }

      const items = (await response.json()) as ImportPreviewItem[];
      setPreviewTransactions(items);

      // Select all that are not duplicates by default
      const initialSelected = new Set<string>();
      for (const item of items) {
        if (!item.isDuplicate) {
          initialSelected.add(item.tempId);
        }
      }
      setSelectedImportTempIds(initialSelected);
      setImportStep(3);
    } catch (err) {
      setImportModalError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsImportPreviewLoading(false);
    }
  }

  async function confirmImport() {
    const toImport = previewTransactions.filter((item) => selectedImportTempIds.has(item.tempId));
    if (toImport.length === 0) {
      setImportModalError("Nenhuma transação selecionada para importação.");
      return;
    }

    setIsImportConfirming(true);
    setImportModalError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/transactions/import-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: toImport.map((t) => ({
            eventDate: t.eventDate,
            description: t.description,
            amountCents: t.amountCents,
            type: t.type,
            accountId: t.accountId,
            paymentMethodId: t.paymentMethodId,
            creditCardId: t.creditCardId,
            subcategoryId: t.subcategoryId,
            status: "confirmed"
          }))
        })
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Erro ao confirmar importação."));
      }

      // Success!
      setIsImportModalOpen(false);
      resetImportState();
      await loadTransactions();
    } catch (err) {
      setImportModalError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsImportConfirming(false);
    }
  }

  function resetImportState() {
    setImportStep(1);
    setImportFile(null);
    setCsvTextContent("");
    setCsvHeaders([]);
    setMappings({ eventDate: "", description: "", amount: "", type: "", subcategoryId: "" });
    setImportDateFormat("DMY");
    setImportAccountId(emptySelectValue);
    setImportType("account");
    setImportCreditCardId(emptySelectValue);
    setPreviewTransactions([]);
    setSelectedImportTempIds(new Set());
    setBulkImportType(emptySelectValue);
    setBulkImportAccountId(emptySelectValue);
    setBulkImportPaymentMethodId(emptySelectValue);
    setBulkImportSubcategoryId(emptySelectValue);
    setImportModalError(null);
  }

  function toggleSelectImport(tempId: string) {
    setSelectedImportTempIds((current) => {
      const next = new Set(current);
      if (next.has(tempId)) {
        next.delete(tempId);
      } else {
        next.add(tempId);
      }
      return next;
    });
  }

  function toggleSelectAllImport() {
    setSelectedImportTempIds((current) => {
      if (current.size === previewTransactions.length) {
        return new Set();
      } else {
        return new Set(previewTransactions.map((t) => t.tempId));
      }
    });
  }

  function updateImportItemSubcategory(tempId: string, subcategoryId: string | null) {
    setPreviewTransactions((current) =>
      current.map((item) => (item.tempId === tempId ? { ...item, subcategoryId } : item))
    );
  }

  function applyBulkImportEdits() {
    if (selectedImportTempIds.size === 0) {
      setImportModalError("Selecione pelo menos um lançamento para editar em lote.");
      return;
    }

    const selectedAccount =
      bulkImportAccountId === emptySelectValue
        ? null
        : accounts.find((account) => account.id === bulkImportAccountId);

    setPreviewTransactions((current) =>
      current.map((item) => {
        if (!selectedImportTempIds.has(item.tempId)) {
          return item;
        }

        const nextItem = { ...item };

        if (bulkImportType !== emptySelectValue) {
          nextItem.type = bulkImportType as "income" | "expense";
        }

        if (importType === "account" && bulkImportAccountId !== emptySelectValue) {
          nextItem.accountId = bulkImportAccountId === "__clear__" ? null : bulkImportAccountId;
          if (
            bulkImportPaymentMethodId === emptySelectValue &&
            selectedAccount?.defaultPaymentMethodId
          ) {
            nextItem.paymentMethodId = selectedAccount.defaultPaymentMethodId;
          }
        }

        if (importType === "account" && bulkImportPaymentMethodId !== emptySelectValue) {
          nextItem.paymentMethodId =
            bulkImportPaymentMethodId === "__clear__" ? null : bulkImportPaymentMethodId;
        }

        if (bulkImportSubcategoryId !== emptySelectValue) {
          nextItem.subcategoryId =
            bulkImportSubcategoryId === "__clear__" ? null : bulkImportSubcategoryId;
        }

        return nextItem;
      })
    );
    setImportModalError(null);
  }

  useEffect(() => {
    void loadReferences().catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.")
    );
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [
    selectedMonth,
    filterType,
    filterStatus,
    filterAccountId,
    filterPaymentMethodId,
    filterSubcategoryId
  ]);

  useEffect(() => {
    if (editingTransaction) {
      return;
    }

    const nextForm = buildEmptyFormWithDefaults(accounts, selectedMonth);
    setForm((current) => {
      if (isPristineTransactionDraft(current)) {
        setEventDateText(formatDateForDisplay(nextForm.eventDate));
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

      const nextForm = buildEmptyFormWithDefaults(accounts, selectedMonth, creditCards);
      setEventDateText(formatDateForDisplay(nextForm.eventDate));
      return nextForm;
    });
    setIsDrawerOpen(true);
  }

  function openEditDrawer(transaction: Transaction) {
    setEditingTransaction(transaction);
    setDrawerError(null);

    const isCardTransaction = Boolean(transaction.creditCardId);
    let destinationAccountId = emptySelectValue;
    if (transaction.linkedTransactionId) {
      const linked = transactions.find((t) => t.id === transaction.linkedTransactionId);
      if (linked) {
        destinationAccountId = linked.accountId ?? emptySelectValue;
      }
    }

    setForm({
      type: transaction.type,
      description: transaction.description,
      amountReais: transaction.amountCents / 100,
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
    setEventDateText(formatDateForDisplay(transaction.eventDate));
    setIsDrawerOpen(true);
  }

  function discardDraft() {
    const nextForm = buildEmptyFormWithDefaults(accounts, selectedMonth);
    setEditingTransaction(null);
    setDrawerError(null);
    setForm(nextForm);
    setEventDateText(formatDateForDisplay(nextForm.eventDate));
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
    setEventDateText(formatDateForDisplay(value));
  }

  function updateEventDateText(value: string) {
    const nextText = formatDayMonthInput(value);
    const nextDate = parseFlexibleDateToIso(nextText, selectedMonth);

    setEventDateText(nextDate ? formatDateForDisplay(nextDate) : nextText);

    if (nextDate) {
      setForm((current) => ({
        ...current,
        eventDate: nextDate,
        budgetMonth: nextDate.slice(0, 7)
      }));
    }
  }

  function openCalendarPicker() {
    const calendarInput = calendarInputRef.current;

    if (!calendarInput) {
      return;
    }

    const showPicker = (calendarInput as HTMLInputElement & { showPicker?: () => void }).showPicker;

    if (showPicker) {
      showPicker.call(calendarInput);
      return;
    }

    calendarInput.focus();
    calendarInput.click();
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
            status: form.status,
            notes: form.notes,
            destinationAccountId:
              isTransferCategory ? toNullableSelectValue(form.destinationAccountId) : null,
            installmentCount: !editingTransaction && isCardMode ? form.installmentCount : 1
          })
        }
      );

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível salvar o lançamento."));
      }

      const nextForm = buildEmptyFormWithDefaults(accounts, selectedMonth, creditCards);
      setEditingTransaction(null);
      setForm(nextForm);
      setEventDateText(formatDateForDisplay(nextForm.eventDate));
      setIsDrawerOpen(true);
      window.setTimeout(() => descriptionInputRef.current?.focus(), 120);
      await loadTransactions();
    } catch (saveError) {
      setDrawerError(saveError instanceof Error ? saveError.message : "Erro inesperado.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTransaction(transaction: Transaction) {
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
      setError(deleteError instanceof Error ? deleteError.message : "Erro inesperado.");
    }
  }

  async function updateTransactionCategoryInline(transaction: Transaction, newSubcategoryId: string) {
    const value = newSubcategoryId === emptySelectValue ? null : newSubcategoryId;
    if (transaction.subcategoryId === value) return;

    setTransactions((current) =>
      current.map((t) => (t.id === transaction.id ? { ...t, subcategoryId: value } : t))
    );

    try {
      const response = await fetch(`${apiBaseUrl}/transactions/${transaction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: transaction.type,
          description: transaction.description,
          amountCents: transaction.amountCents,
          eventDate: transaction.eventDate,
          budgetMonth: transaction.budgetMonth,
          accountId: transaction.accountId,
          paymentMethodId: transaction.paymentMethodId,
          subcategoryId: value,
          creditCardId: transaction.creditCardId,
          status: transaction.status,
          notes: transaction.notes
        })
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível atualizar a categoria."));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      void loadTransactions();
    }
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
      if (current.size === transactions.length) {
        return new Set();
      }

      return new Set(transactions.map((transaction) => transaction.id));
    });
  }

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
            await getResponseError(response, `Não foi possível atualizar "${transaction.description}".`)
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
      setError(bulkError instanceof Error ? bulkError.message : "Erro inesperado.");
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
                resetImportState();
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

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Text fw={700}>Mês dos lançamentos</Text>
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

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={700}>Filtros</Text>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => {
                setFilterType(emptySelectValue);
                setFilterStatus(emptySelectValue);
                setFilterAccountId(emptySelectValue);
                setFilterPaymentMethodId(emptySelectValue);
                setFilterSubcategoryId(emptySelectValue);
              }}
            >
              Limpar filtros
            </Button>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="sm">
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
              label="Status"
              data={[{ value: emptySelectValue, label: "Todos" }, ...transactionStatuses]}
              value={filterStatus}
              onChange={(value) => setFilterStatus(value ?? emptySelectValue)}
            />
            <Select
              label="Conta"
              data={[{ value: emptySelectValue, label: "Todas" }, ...accountOptions]}
              value={filterAccountId}
              onChange={(value) => setFilterAccountId(value ?? emptySelectValue)}
              searchable
            />
            <Select
              label="Forma"
              data={paymentMethodOptions.map((option) =>
                option.value === emptySelectValue ? { ...option, label: "Todas" } : option
              )}
              value={filterPaymentMethodId}
              onChange={(value) => setFilterPaymentMethodId(value ?? emptySelectValue)}
              searchable
            />
            <Select
              label="Categoria"
              data={[{ value: emptySelectValue, label: "Todas" }, ...buildCategoryGroups(categories)]}
              value={filterSubcategoryId}
              onChange={(value) => setFilterSubcategoryId(value ?? emptySelectValue)}
              searchable
            />
          </SimpleGrid>
        </Stack>
      </Paper>

      {error ? (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      ) : null}

      <Paper withBorder radius="md">
        {isLoading ? (
          <Group justify="center" p="xl">
            <Loader />
          </Group>
        ) : transactions.length === 0 ? (
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
                        ...paymentMethodOptions.filter((option) => option.value !== emptySelectValue)
                      ]}
                      value={bulkPaymentMethodId}
                      onChange={(value) => setBulkPaymentMethodId(value ?? emptySelectValue)}
                      searchable
                    />
                    <Select
                      label="Categoria"
                      placeholder="Manter"
                      data={[
                        { value: emptySelectValue, label: "Manter categoria atual" },
                        { value: "__clear__", label: "Sem categoria" },
                        ...buildCategoryGroups(categories)
                      ]}
                      value={bulkSubcategoryId}
                      onChange={(value) => setBulkSubcategoryId(value ?? emptySelectValue)}
                      searchable
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
            <Table.ScrollContainer minWidth={940}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 44 }}>
                    <Checkbox
                      aria-label="Selecionar todos os lançamentos"
                      checked={selectedTransactionIds.size === transactions.length}
                      indeterminate={
                        selectedTransactionIds.size > 0 &&
                        selectedTransactionIds.size < transactions.length
                      }
                      onChange={toggleSelectAllTransactions}
                    />
                  </Table.Th>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Descrição</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Valor</Table.Th>
                  <Table.Th>Conta</Table.Th>
                  <Table.Th>Meio</Table.Th>
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
                        aria-label={`Selecionar lançamento ${transaction.description}`}
                        checked={selectedTransactionIds.has(transaction.id)}
                        onChange={() => toggleTransactionSelection(transaction.id)}
                      />
                    </Table.Td>
                    <Table.Td>{formatBusinessDateForDisplay(transaction.eventDate)}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Text fw={600}>{transaction.description}</Text>
                        {transaction.linkedTransactionId && (
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
                      <Text fw={700} c={getAmountColor(transaction.type)}>
                        {formatTransactionAmount(transaction)}
                      </Text>
                    </Table.Td>
                    <Table.Td>{getAccountLabel(transaction.accountId, accounts)}</Table.Td>
                    <Table.Td>
                      {getPaymentMethodLabel(transaction.paymentMethodId, paymentMethods)}
                    </Table.Td>
                    <Table.Td>
                      <Select
                        size="xs"
                        variant="unstyled"
                        placeholder="Sem categoria"
                        data={[{ value: emptySelectValue, label: "Sem categoria" }, ...buildCategoryGroups(categories)]}
                        value={transaction.subcategoryId ?? emptySelectValue}
                        onChange={(value) => void updateTransactionCategoryInline(transaction, value ?? emptySelectValue)}
                        searchable
                        styles={{ 
                          input: { cursor: 'pointer', fontWeight: 500, padding: 0, minHeight: 'unset', height: 'auto' },
                          root: { minWidth: 160 }
                        }}
                        renderOption={({ option }) => {
                          const text = option.label.includes(" > ") ? option.label.split(" > ")[1] : option.label;
                          const itemColor = (option as unknown as { color?: string }).color;
                          if (itemColor) {
                            return (
                              <Badge variant="light" color={itemColor} size="md" fw={600} style={{ textTransform: 'none' }}>
                                {text}
                              </Badge>
                            );
                          }
                          return <Text size="sm">{text}</Text>;
                        }}
                      />
                    </Table.Td>
                    <Table.Td>{renderStatusBadge(transaction.status)}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          aria-label="Editar lançamento"
                          onClick={() => openEditDrawer(transaction)}
                        >
                          <IconEdit size={18} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label="Excluir lançamento"
                          title="Excluir lançamento"
                          onClick={() => void deleteTransaction(transaction)}
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
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
            required
          />
          <TextInput
            label="Data da compra"
            inputMode="numeric"
            placeholder="dd"
            value={eventDateText}
            onChange={(event) => {
              const { value } = event.currentTarget;
              updateEventDateText(value);
            }}
            onBlur={() => setEventDateText(formatDateForDisplay(form.eventDate))}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }
              event.preventDefault();
              openCalendarPicker();
            }}
            required
          />
          <input
            ref={calendarInputRef}
            aria-hidden="true"
            tabIndex={-1}
            type="date"
            value={form.eventDate}
            onChange={(event) => updateEventDate(event.currentTarget.value)}
            style={{
              height: 0,
              opacity: 0,
              pointerEvents: "none",
              position: "absolute",
              width: 0
            }}
          />

          {form.type === "expense" && (
            <Stack gap={6}>
              <Text size="sm" fw={500}>Forma de pagamento</Text>
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
                      creditCardId: isCard ? (defaultCard?.id ?? emptySelectValue) : emptySelectValue
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
                    setForm((current) => ({ ...current, destinationAccountId: value ?? emptySelectValue }))
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
                description="Auto-calculado pelo fechamento. Edite se necessário."
                value={form.budgetMonth}
                onChange={(event) =>
                  setForm((current) => ({ ...current, budgetMonth: event.currentTarget.value }))
                }
                placeholder="YYYY-MM"
              />

              {/* Installments — only for new card transactions */}
              {!editingTransaction && (
                <Stack gap={6}>
                  <Text size="sm" fw={500}>Parcelamento</Text>
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

          <Select
            label="Categoria"
            data={[{ value: emptySelectValue, label: "Sem categoria" }, ...filteredCategoryOptions]}
            value={form.subcategoryId}
            onChange={(value) =>
              setForm((current) => ({ ...current, subcategoryId: value ?? emptySelectValue }))
            }
            searchable
            renderOption={({ option }) => {
              const text = option.label.includes(" > ") ? option.label.split(" > ")[1] : option.label;
              const itemColor = (option as unknown as { color?: string }).color;
              if (itemColor) {
                return (
                  <Badge variant="light" color={itemColor} size="md" fw={600} style={{ textTransform: 'none' }}>
                    {text}
                  </Badge>
                );
              }
              return <Text size="sm">{text}</Text>;
            }}
          />
          <Select
            label="Status"
            data={transactionStatuses}
            value={form.status}
            onChange={(value) => setForm((current) => ({ ...current, status: value ?? "planned" }))}
            required
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

      <Modal
        opened={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={
          <Group gap="xs">
            <IconUpload size={22} color="var(--mantine-color-blue-filled)" />
            <Text fw={700} size="lg">Importação de Transações CSV</Text>
          </Group>
        }
        size="xl"
        radius="md"
        padding="xl"
      >
        <Stack gap="md">
          {/* Step indicator header */}
          <Group justify="space-between" mb="xs">
            <Badge color={importStep >= 1 ? "blue" : "gray"} variant={importStep === 1 ? "filled" : "light"}>
              1. Arquivo & Conta
            </Badge>
            <Badge color={importStep >= 2 ? "blue" : "gray"} variant={importStep === 2 ? "filled" : "light"}>
              2. Mapear Colunas
            </Badge>
            <Badge color={importStep >= 3 ? "blue" : "gray"} variant={importStep === 3 ? "filled" : "light"}>
              3. Pré-visualização
            </Badge>
          </Group>

          {importModalError && (
            <Alert color="red" title="Erro" icon={<IconAlertTriangle size={18} />} variant="light">
              {importModalError}
            </Alert>
          )}

          {/* STEP 1: UPLOAD FILE & DEFAULT ACCOUNT */}
          {importStep === 1 && (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Faça o upload do seu arquivo de extrato bancário ou planilha no formato CSV para importar suas transações.
              </Text>

              <FileInput
                label="Selecione o arquivo CSV"
                placeholder="Clique para escolher o arquivo"
                accept=".csv"
                value={importFile}
                onChange={handleFileChange}
                required
                clearable
              />

              <SegmentedControl
                value={importType}
                onChange={(val) => setImportType(val as "account" | "card")}
                data={[
                  { label: "Conta Corrente", value: "account" },
                  { label: "Cartão de Crédito", value: "card" }
                ]}
                fullWidth
              />

              {importType === "account" ? (
                <Select
                  label="Associar à Conta (opcional)"
                  description="Opcional. Se não for especificado no arquivo CSV, todas as transações importadas pertencerão a esta conta."
                  data={[{ value: emptySelectValue, label: "Nenhuma (deixar sem conta)" }, ...accountOptions]}
                  value={importAccountId}
                  onChange={(value) => setImportAccountId(value ?? emptySelectValue)}
                />
              ) : (
                <Select
                  label="Associar ao Cartão de Crédito"
                  description="Selecione o cartão ao qual as compras importadas serão associadas."
                  data={creditCardOptions}
                  value={importCreditCardId}
                  onChange={(value) => setImportCreditCardId(value ?? emptySelectValue)}
                  required
                />
              )}

              <Group justify="flex-end" mt="md">
                <Button
                  onClick={() => setImportStep(2)}
                  disabled={
                    !importFile ||
                    !csvTextContent ||
                    (importType === "card" && importCreditCardId === emptySelectValue)
                  }
                >
                  Continuar
                </Button>
              </Group>
            </Stack>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {importStep === 2 && (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Selecione qual coluna do seu arquivo CSV corresponde a cada um dos campos abaixo. O sistema tentou adivinhar os mapeamentos automaticamente.
              </Text>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Select
                  label="Coluna de Data (Obrigatório)"
                  placeholder="Selecione a coluna"
                  data={csvHeaders}
                  value={mappings.eventDate}
                  onChange={(val) => setMappings(m => ({ ...m, eventDate: val ?? "" }))}
                  required
                />

                <Select
                  label="Formato da Data"
                  data={[
                    { value: "DMY", label: "DD/MM/AAAA" },
                    { value: "MDY", label: "MM/DD/AAAA" },
                    { value: "YMD", label: "AAAA-MM-DD" }
                  ]}
                  value={importDateFormat}
                  onChange={(val) => setImportDateFormat((val as "DMY" | "MDY" | "YMD") ?? "DMY")}
                  required
                />

                <Select
                  label="Coluna de Descrição (Obrigatório)"
                  placeholder="Selecione a coluna"
                  data={csvHeaders}
                  value={mappings.description}
                  onChange={(val) => setMappings(m => ({ ...m, description: val ?? "" }))}
                  required
                />

                <Select
                  label="Coluna de Valor (Obrigatório)"
                  placeholder="Selecione a coluna"
                  data={csvHeaders}
                  value={mappings.amount}
                  onChange={(val) => setMappings(m => ({ ...m, amount: val ?? "" }))}
                  required
                />

                <Select
                  label="Coluna de Tipo/Natureza (Opcional)"
                  description="Receita/Despesa. Se vazio, o sinal do valor define o tipo."
                  placeholder="Selecione a coluna"
                  data={[{ value: "", label: "Auto-detectar pelo sinal do valor" }, ...csvHeaders.map(h => ({ value: h, label: h }))]}
                  value={mappings.type}
                  onChange={(val) => setMappings(m => ({ ...m, type: val ?? "" }))}
                />

                <Select
                  label="Coluna de Categoria (Opcional)"
                  description="Pode ser uma coluna com nomes como Farmácia, Delivery ou textos como (-) Farmácia."
                  placeholder="Selecione a coluna"
                  data={[{ value: "", label: "Definir na pré-visualização" }, ...csvHeaders.map(h => ({ value: h, label: h }))]}
                  value={mappings.subcategoryId}
                  onChange={(val) => setMappings(m => ({ ...m, subcategoryId: val ?? "" }))}
                />
              </SimpleGrid>

              <Group justify="space-between" mt="md">
                <Button variant="subtle" onClick={() => setImportStep(1)}>
                  Voltar
                </Button>
                <Button
                  onClick={generateImportPreview}
                  loading={isImportPreviewLoading}
                  disabled={!mappings.eventDate || !mappings.description || !mappings.amount}
                >
                  Ver Prévia
                </Button>
              </Group>
            </Stack>
          )}

          {/* STEP 3: RECONCILIATION & CONFIRMATION */}
          {importStep === 3 && (
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="sm" fw={600}>
                  {previewTransactions.length} transações encontradas no arquivo.
                </Text>
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={toggleSelectAllImport}
                >
                  {selectedImportTempIds.size === previewTransactions.length ? "Desmarcar Todos" : "Selecionar Todos"}
                </Button>
              </Group>

              <Text size="xs" c="dimmed">
                As transações marcadas com aviso de duplicidade foram desmarcadas automaticamente para evitar duplicatas, mas você pode ativá-las manualmente. Você também pode ajustar os lançamentos selecionados em lote antes de importar.
              </Text>

              <Paper withBorder p="sm" radius="sm">
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Text size="sm" fw={700}>
                      Edição em lote
                    </Text>
                    <Badge variant="light" color="teal">
                      {selectedImportTempIds.size} selecionados
                    </Badge>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: importType === "account" ? 4 : 2 }} spacing="sm">
                    <Select
                      label="Lançamento"
                      placeholder="Manter"
                      data={[
                        { value: emptySelectValue, label: "Manter tipo atual" },
                        { value: "income", label: "Receita" },
                        { value: "expense", label: "Despesa" }
                      ]}
                      value={bulkImportType}
                      onChange={(value) => setBulkImportType(value ?? emptySelectValue)}
                    />
                    {importType === "account" ? (
                      <>
                        <Select
                          label="Conta"
                          placeholder="Manter"
                          data={[
                            { value: emptySelectValue, label: "Manter conta atual" },
                            { value: "__clear__", label: "Sem conta" },
                            ...accountOptions
                          ]}
                          value={bulkImportAccountId}
                          onChange={(value) => setBulkImportAccountId(value ?? emptySelectValue)}
                          searchable
                        />
                        <Select
                          label="Forma de pagamento"
                          placeholder="Manter"
                          data={[
                            { value: emptySelectValue, label: "Manter forma atual" },
                            { value: "__clear__", label: "Sem meio de pagamento" },
                            ...paymentMethodOptions.filter((option) => option.value !== emptySelectValue)
                          ]}
                          value={bulkImportPaymentMethodId}
                          onChange={(value) => setBulkImportPaymentMethodId(value ?? emptySelectValue)}
                          searchable
                        />
                      </>
                    ) : null}
                    <Select
                      label="Categoria"
                      placeholder="Manter"
                      data={[
                        { value: emptySelectValue, label: "Manter categoria atual" },
                        { value: "__clear__", label: "Sem categoria" },
                        ...buildCategoryGroups(categories)
                      ]}
                      value={bulkImportSubcategoryId}
                      onChange={(value) => setBulkImportSubcategoryId(value ?? emptySelectValue)}
                      searchable
                    />
                  </SimpleGrid>
                  <Group justify="flex-end">
                    <Button variant="light" size="xs" onClick={applyBulkImportEdits}>
                      Aplicar aos selecionados
                    </Button>
                  </Group>
                </Stack>
              </Paper>

              <Box style={{ maxHeight: 350, overflowY: "auto", border: "1px solid var(--mantine-color-gray-3)", borderRadius: "var(--mantine-radius-md)" }}>
                <Table verticalSpacing="xs" striped highlightOnHover>
                  <Table.Thead style={{ position: "sticky", top: 0, background: "var(--mantine-color-body)", zIndex: 1 }}>
                    <Table.Tr>
                      <Table.Th style={{ width: 40 }}></Table.Th>
                      <Table.Th>Data/Desc</Table.Th>
                      <Table.Th>Tipo</Table.Th>
                      {importType === "account" ? <Table.Th>Conta</Table.Th> : null}
                      {importType === "account" ? <Table.Th>Forma</Table.Th> : null}
                      {importType === "card" ? <Table.Th>Fatura</Table.Th> : null}
                      <Table.Th style={{ textAlign: "right" }}>Valor</Table.Th>
                      <Table.Th>Subcategoria</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {previewTransactions.map((item) => {
                      const isSelected = selectedImportTempIds.has(item.tempId);
                      return (
                        <Table.Tr key={item.tempId} style={{ opacity: isSelected ? 1 : 0.6 }}>
                          <Table.Td style={{ verticalAlign: "middle" }}>
                            <Checkbox
                              checked={isSelected}
                              onChange={() => toggleSelectImport(item.tempId)}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Stack gap={2}>
                              <Group gap="xs" wrap="nowrap">
                                <Text size="xs" c="dimmed">{formatBusinessDateForDisplay(item.eventDate)}</Text>
                                {item.isDuplicate && (
                                  <Badge color="yellow" size="xs" leftSection={<IconAlertTriangle size={10} />} style={{ textTransform: "none" }}>
                                    Duplicada
                                  </Badge>
                                )}
                              </Group>
                              <Text size="sm" fw={600}>{item.description}</Text>
                              {item.isDuplicate && item.duplicateOf && (
                                <Text size="10px" c="yellow.8" style={{ lineHeight: 1.2 }}>
                                  Match com: {item.duplicateOf.description} ({formatBusinessDateForDisplay(item.duplicateOf.eventDate)})
                                </Text>
                              )}
                            </Stack>
                          </Table.Td>
                          <Table.Td style={{ verticalAlign: "middle" }}>
                            <Badge variant="light" color={getAmountColor(item.type)} style={{ textTransform: "none" }}>
                              {getTransactionTypeLabel(item.type)}
                            </Badge>
                          </Table.Td>
                          {importType === "account" ? (
                            <Table.Td style={{ verticalAlign: "middle" }}>
                              <Text size="xs">{getAccountLabel(item.accountId, accounts)}</Text>
                            </Table.Td>
                          ) : null}
                          {importType === "account" ? (
                            <Table.Td style={{ verticalAlign: "middle" }}>
                              <Text size="xs">
                                {getPaymentMethodLabel(item.paymentMethodId, paymentMethods)}
                              </Text>
                            </Table.Td>
                          ) : null}
                          {importType === "card" ? (
                            <Table.Td style={{ verticalAlign: "middle" }}>
                              <Badge variant="light" color="indigo" style={{ textTransform: "none" }}>
                                {item.budgetMonth ?? "-"}
                              </Badge>
                            </Table.Td>
                          ) : null}
                          <Table.Td style={{ textAlign: "right", verticalAlign: "middle" }}>
                            <Text fw={700} size="sm" c={getAmountColor(item.type)}>
                              {item.type === "expense" ? "-" : "+"} {formatMoney(moneyFromCents(item.amountCents))}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ verticalAlign: "middle", minWidth: 150 }}>
                            <Select
                              size="xs"
                              placeholder="Categoria"
                              data={[{ value: emptySelectValue, label: "Sem categoria" }, ...buildCategoryGroups(categories)]}
                              value={item.subcategoryId ?? emptySelectValue}
                              onChange={(val) => updateImportItemSubcategory(item.tempId, val === emptySelectValue ? null : val)}
                              searchable
                            />
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Box>

              <Group justify="space-between" mt="md">
                <Button variant="subtle" onClick={() => setImportStep(2)}>
                  Voltar Mapeamento
                </Button>
                <Group gap="sm">
                  <Text size="xs" c="dimmed">
                    {selectedImportTempIds.size} selecionadas
                  </Text>
                  <Button
                    onClick={confirmImport}
                    loading={isImportConfirming}
                    color="teal"
                    leftSection={<IconCheck size={18} />}
                  >
                    Confirmar Importação
                  </Button>
                </Group>
              </Group>
            </Stack>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}

function buildCategoryGroups(categories: Category[]) {
  return categories.map((category) => ({
    group: category.name,
    items: category.subcategories.map((sub) => ({
      value: sub.id,
      label: `${category.name} > ${sub.name}`,
      color: getCategoryColor(category.id)
    } as unknown as { value: string; label: string; color: string }))
  })).filter(g => g.items.length > 0);
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
      fields.push(cleanCsvField(currentField));
      currentField = "";
    } else {
      currentField += char;
    }
  }

  fields.push(cleanCsvField(currentField));
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

function cleanCsvField(value: string): string {
  return value.trim().replace(/^\uFEFF/, "");
}

function buildEmptyFormWithDefaults(
  accounts: Account[],
  budgetMonth: string,
  creditCards?: CreditCard[]
): TransactionFormState {
  const primaryAccount = accounts.find((account) => account.isPrimary);
  const defaultCard = creditCards?.find((card) => card.isDefault && card.isActive);
  const eventDate = getDefaultEventDateForMonth(budgetMonth);

  return {
    ...emptyForm,
    eventDate,
    budgetMonth,
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
    form.status === "planned" &&
    form.notes.trim() === "" &&
    form.paymentMode === "account" &&
    form.creditCardId === emptySelectValue &&
    form.installmentCount === 1
  );
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

function getDefaultEventDateForMonth(budgetMonth: string) {
  if (budgetMonth === currentMonth) {
    return today;
  }

  return `${budgetMonth}-01`;
}

function getMonthOptions() {
  const baseYear = new Date().getFullYear();

  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(baseYear, index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    return {
      value,
      label: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "")
    };
  });
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

function formatDayMonthInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseFlexibleDateToIso(value: string, selectedYearMonth: string) {
  const digits = value.replace(/\D/g, "");
  const [selectedYear, selectedMonthNumber] = selectedYearMonth.split("-").map(Number);

  if (![2, 4, 8].includes(digits.length)) {
    return null;
  }

  const day = Number(digits.slice(0, 2));
  const month = digits.length >= 4 ? Number(digits.slice(2, 4)) : selectedMonthNumber;
  const year = digits.length === 8 ? Number(digits.slice(4, 8)) : selectedYear;
  const candidate = new Date(year, month - 1, day);

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateForDisplay(value: string) {
  return formatBusinessDateForDisplay(value);
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

function formatTransactionAmount(transaction: Transaction) {
  const signal = transaction.type === "expense" ? "-" : "+";

  return `${signal} ${formatMoney(moneyFromCents(transaction.amountCents))}`;
}

function getAmountColor(type: string) {
  if (type === "expense") {
    return "red";
  }

  if (type === "income" || type === "refund") {
    return "teal";
  }

  return "gray";
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


function renderStatusBadge(status: string) {
  const colors: Record<string, string> = {
    planned: "gray",
    confirmed: "blue",
    reconciled: "teal",
    canceled: "red"
  };

  return (
    <Badge color={colors[status] ?? "gray"} variant="light">
      {transactionStatuses.find((transactionStatus) => transactionStatus.value === status)?.label ??
        status}
    </Badge>
  );
}

async function getResponseError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: unknown };

    if (typeof body.message === "string") {
      return body.message;
    }
  } catch {
    return fallback;
  }

  return fallback;
}
