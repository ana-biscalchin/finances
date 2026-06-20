import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Group,
  Loader,
  NumberInput,
  Paper,
  Popover,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  ThemeIcon,
  Title,
  Tooltip
} from "@mantine/core";
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconLayoutGrid,
  IconPlus,
  IconWallet
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney, moneyFromCents } from "@finances/domain";

import { MonthSelector } from "../shared/MonthSelector";
import { CategorySelect } from "../shared/CategorySelect";
import { CashMonthlyView } from "./CashMonthlyView";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface TreeNode {
  id: string;
  name: string;
  nature: "income" | "expense" | "mixed" | "transfer";
  behavior?: "fixed" | "variable" | "extra";
  budgeted: number;
  realized: number;
  committed: number;
  available: number;
  realizedCash?: number;
  realizedCredit?: number;
  committedCash?: number;
  committedCredit?: number;
  subcategoryId?: string;
  accountId?: string | null;
  paymentMethodId?: string | null;
  children?: TreeNode[];
}

interface SummaryData {
  income: { budgeted: number; realized: number; committed: number };
  expense: {
    budgeted: number;
    realized: number;
    committed: number;
    realizedCash?: number;
    realizedCredit?: number;
    committedCash?: number;
    committedCredit?: number;
  };
}

interface AccountMonthlySummary {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  isActive: boolean;
  openingBalance: number;
  realizedInflow: number;
  realizedOutflow: number;
  realizedBalance: number;
  projectedBalance: number;
}

interface RowData {
  id: string;
  name: string;
  nature: "income" | "expense" | "mixed" | "transfer";
  behavior?: "fixed" | "variable" | "extra";
  budgeted: number;
  realized: number;
  committed: number;
  available: number;
  realizedCash?: number;
  realizedCredit?: number;
  committedCash?: number;
  committedCredit?: number;
  level: number;
  parentId: string | null;
  hasChildren: boolean;
  subcategoryId?: string;
  accountId?: string | null;
  paymentMethodId?: string | null;
}

type Account = {
  id: string;
  name: string;
  isActive: boolean;
};

type PaymentMethod = {
  id: string;
  name: string;
};

type Category = {
  id: string;
  nature: string;
  name: string;
  subcategories: Array<{ id: string; name: string }>;
};

type GroupByMode = "category" | "source";

const emptySelectValue = "__none__";

interface CategoryProgressProps {
  budgeted: number;
  realized: number;
  committed: number;
  realizedCash?: number;
  realizedCredit?: number;
  committedCash?: number;
  committedCredit?: number;
  nature: "income" | "expense" | "mixed" | "transfer";
}

function CategoryProgress({
  budgeted,
  realized,
  committed,
  realizedCash,
  realizedCredit,
  committedCash,
  committedCredit,
  nature
}: CategoryProgressProps) {
  if (budgeted <= 0) return <Text size="xs" c="dimmed">—</Text>;

  const totalUsed = realized + committed;
  const isIncome = nature === "income" || nature === "mixed";

  const rCash = realizedCash ?? (isIncome ? realized : realized - (realizedCredit ?? 0));
  const rCredit = realizedCredit ?? 0;
  const cCash = committedCash ?? (isIncome ? committed : committed - (committedCredit ?? 0));
  const cCredit = committedCredit ?? 0;

  const pctRealizedCash = (rCash / budgeted) * 100;
  const pctRealizedCredit = (rCredit / budgeted) * 100;
  const pctCommittedCash = (cCash / budgeted) * 100;
  const pctCommittedCredit = (cCredit / budgeted) * 100;
  const totalPct = (totalUsed / budgeted) * 100;

  const isOver = !isIncome && totalUsed > budgeted;

  return (
    <Tooltip
      multiline
      w={260}
      withArrow
      label={
        <Stack gap={4} p={4}>
          <Text size="xs" fw={700}>Detalhamento do uso:</Text>
          <Text size="xs">💵 À Vista Realizado: {formatMoney(moneyFromCents(rCash))} ({Math.round(pctRealizedCash)}%)</Text>
          <Text size="xs">💳 Cartão Realizado: {formatMoney(moneyFromCents(rCredit))} ({Math.round(pctRealizedCredit)}%)</Text>
          <Text size="xs">⏳ À Vista Planejado: {formatMoney(moneyFromCents(cCash))} ({Math.round(pctCommittedCash)}%)</Text>
          <Text size="xs">⏳ Cartão Planejado: {formatMoney(moneyFromCents(cCredit))} ({Math.round(pctCommittedCredit)}%)</Text>
          <Text size="xs" fw={700} mt={4} style={{ borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 4 }}>
            Total: {formatMoney(moneyFromCents(totalUsed))} ({Math.round(totalPct)}%)
          </Text>
        </Stack>
      }
    >
      <Group gap="xs" wrap="nowrap" style={{ flexGrow: 1 }}>
        <Progress.Root size="md" radius="xl" style={{ flexGrow: 1 }}>
          <Progress.Section value={pctRealizedCash} color="teal" />
          <Progress.Section value={pctRealizedCredit} color="grape" />
          <Progress.Section value={pctCommittedCash} color="teal.2" />
          <Progress.Section value={pctCommittedCredit} color="grape.2" />
        </Progress.Root>
        <Text size="xs" fw={700} c={isOver ? "red" : isIncome ? "teal" : "dimmed"}>
          {Math.round(totalPct)}%
        </Text>
      </Group>
    </Tooltip>
  );
}

interface ControleMensalPageProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}

export function ControleMensalPage({ selectedMonth, setSelectedMonth }: ControleMensalPageProps) {
  const [activeView, setActiveView] = useState<"competence" | "cash">("competence");
  const [groupBy, setGroupBy] = useState<GroupByMode>("category");
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [accountSummaries, setAccountSummaries] = useState<AccountMonthlySummary[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [oldestAvailableMonth, setOldestAvailableMonth] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [isAllocationSaving, setIsAllocationSaving] = useState(false);
  const [allocationForm, setAllocationForm] = useState({
    subcategoryId: emptySelectValue,
    accountId: emptySelectValue,
    paymentMethodId: emptySelectValue,
    amountReais: "" as number | string
  });

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("controle-mensal-expanded-nodes");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return {};
  });

  const [summaryCollapsed, setSummaryCollapsed] = useState(() => {
    return localStorage.getItem("controle-mensal-summary-collapsed") === "true";
  });
  const [balancesCollapsed, setBalancesCollapsed] = useState(() => {
    return localStorage.getItem("controle-mensal-balances-collapsed") === "true";
  });
  const [allocationCollapsed, setAllocationCollapsed] = useState(() => {
    return localStorage.getItem("controle-mensal-allocation-collapsed") === "true";
  });

  const handleToggleSummary = () => {
    setSummaryCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("controle-mensal-summary-collapsed", String(next));
      return next;
    });
  };

  const handleToggleBalances = () => {
    setBalancesCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("controle-mensal-balances-collapsed", String(next));
      return next;
    });
  };

  const handleToggleAllocation = () => {
    setAllocationCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("controle-mensal-allocation-collapsed", String(next));
      return next;
    });
  };

  async function loadData(silent = false) {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/controle-mensal?month=${selectedMonth}&groupBy=${groupBy}`
      );
      if (!res.ok) throw new Error("Erro ao carregar dados do orçamento.");
      const data = await res.json();
      setTreeData(data.tree);
      setSummary(data.summary);
      setAccountSummaries(data.accountSummaries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  async function handleCopyBudget() {
    const [year, month] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    if (
      !window.confirm(
        `Copiar orçamentos de ${prevMonthStr} para ${selectedMonth}? Isso irá substituir os limites atuais do mês de destino.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/budgets/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromMonth: prevMonthStr,
          toMonth: selectedMonth
        })
      });
      if (!res.ok) throw new Error("Erro ao copiar orçamentos.");
      alert("Orçamentos copiados com sucesso!");
      void loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro inesperado.");
    }
  }

  async function loadMonthRange() {
    try {
      const res = await fetch(`${apiBaseUrl}/controle-mensal/month-range`);
      if (!res.ok) return;
      const data = (await res.json()) as { oldestMonth?: unknown };
      setOldestAvailableMonth(typeof data.oldestMonth === "string" ? data.oldestMonth : null);
    } catch {
      setOldestAvailableMonth(null);
    }
  }

  async function loadReferences() {
    try {
      const [accountsResponse, paymentMethodsResponse, categoriesResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/accounts`),
        fetch(`${apiBaseUrl}/payment-methods`),
        fetch(`${apiBaseUrl}/categories?includeInactive=true`)
      ]);

      if (!accountsResponse.ok || !paymentMethodsResponse.ok || !categoriesResponse.ok) {
        throw new Error("Não foi possível carregar contas, meios e categorias.");
      }

      setAccounts((await accountsResponse.json()) as Account[]);
      setPaymentMethods((await paymentMethodsResponse.json()) as PaymentMethod[]);
      setCategories((await categoriesResponse.json()) as Category[]);
    } catch (loadError) {
      setAllocationError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    }
  }

  async function saveAllocation() {
    setAllocationError(null);
    setIsAllocationSaving(true);

    try {
      if (allocationForm.subcategoryId === emptySelectValue) {
        throw new Error("Escolha uma subcategoria.");
      }

      const rawAmount = typeof allocationForm.amountReais === "number"
        ? allocationForm.amountReais
        : Number(String(allocationForm.amountReais).replace(",", "."));
      const amountCents = Math.round((Number.isFinite(rawAmount) ? rawAmount : 0) * 100);
      if (amountCents <= 0) {
        throw new Error("Informe um valor maior que zero.");
      }

      const res = await fetch(`${apiBaseUrl}/budgets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetMonth: selectedMonth,
          subcategoryId: allocationForm.subcategoryId,
          accountId: allocationForm.accountId === emptySelectValue ? null : allocationForm.accountId,
          paymentMethodId:
            allocationForm.paymentMethodId === emptySelectValue ? null : allocationForm.paymentMethodId,
          amountCents
        })
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
        throw new Error(
          typeof body?.message === "string" ? body.message : "Não foi possível salvar a alocação."
        );
      }

      setAllocationForm({
        subcategoryId: emptySelectValue,
        accountId: emptySelectValue,
        paymentMethodId: emptySelectValue,
        amountReais: ""
      });
      await loadData(true);
    } catch (saveError) {
      setAllocationError(saveError instanceof Error ? saveError.message : "Erro inesperado.");
    } finally {
      setIsAllocationSaving(false);
    }
  }

  useEffect(() => {
    void loadMonthRange();
    void loadReferences();
  }, []);

  useEffect(() => {
    void loadData();
  }, [selectedMonth, groupBy]);

  const toggleNode = (id: string, currentlyExpanded: boolean) => {
    setExpandedNodes((prev) => {
      const updated = {
        ...prev,
        [id]: !currentlyExpanded
      };
      localStorage.setItem("controle-mensal-expanded-nodes", JSON.stringify(updated));
      return updated;
    });
  };

  const getLeafDetails = (
    node: TreeNode
  ): { subcategoryId: string; accountId: string | null; paymentMethodId: string | null } | null => {
    if (node.subcategoryId) {
      return {
        subcategoryId: node.subcategoryId,
        accountId: node.accountId ?? null,
        paymentMethodId: node.paymentMethodId ?? null
      };
    }

    const { id } = node;
    if (id.startsWith("sub-")) {
      return {
        subcategoryId: id.slice(4),
        accountId: null,
        paymentMethodId: null
      };
    }
    return null;
  };

  const flatRows = useMemo(() => {
    const list: RowData[] = [];
    const flatten = (nodes: TreeNode[], level = 0, parentId: string | null = null) => {
      for (const node of nodes) {
        const leafDetails = getLeafDetails(node);
        const isLeaf = !node.children || node.children.length === 0;

        list.push({
          id: node.id,
          name: node.name,
          nature: node.nature,
          behavior: node.behavior,
          budgeted: node.budgeted,
          realized: node.realized,
          committed: node.committed,
          available: node.available,
          realizedCash: node.realizedCash,
          realizedCredit: node.realizedCredit,
          committedCash: node.committedCash,
          committedCredit: node.committedCredit,
          level,
          parentId,
          hasChildren: !isLeaf,
          subcategoryId: leafDetails?.subcategoryId,
          accountId: leafDetails?.accountId,
          paymentMethodId: leafDetails?.paymentMethodId
        });

        const isExpanded = expandedNodes[node.id] !== undefined
          ? expandedNodes[node.id]
          : false;
        if (node.children && node.children.length > 0 && isExpanded) {
          flatten(node.children, level + 1, node.id);
        }
      }
    };
    flatten(treeData);
    return list;
  }, [treeData, expandedNodes, groupBy]);

  // Totals calculations
  const totalExpenseBudgeted = summary?.expense.budgeted ?? 0;
  const totalExpenseRealized = summary?.expense.realized ?? 0;
  const totalExpenseCommitted = summary?.expense.committed ?? 0;
  const totalExpenseUsed = totalExpenseRealized + totalExpenseCommitted;

  const totalExpenseRealizedCash = summary?.expense.realizedCash ?? 0;
  const totalExpenseRealizedCredit = summary?.expense.realizedCredit ?? 0;

  const totalIncomeBudgeted = summary?.income.budgeted ?? 0;
  const totalIncomeRealized = summary?.income.realized ?? 0;

  const netBalanceRealized = totalIncomeRealized - totalExpenseRealized;
  const totalOpeningBalance = accountSummaries.reduce(
    (total, account) => total + account.openingBalance,
    0
  );
  const totalAccountRealizedBalance = accountSummaries.reduce(
    (total, account) => total + account.realizedBalance,
    0
  );
  const totalAccountProjectedBalance = accountSummaries.reduce(
    (total, account) => total + account.projectedBalance,
    0
  );


  const accountOptions = useMemo(
    () => accounts
      .filter((account) => account.isActive)
      .map((account) => ({ value: account.id, label: account.name })),
    [accounts]
  );

  const paymentMethodOptions = useMemo(
    () => paymentMethods.map((paymentMethod) => ({
      value: paymentMethod.id,
      label: paymentMethod.name
    })),
    [paymentMethods]
  );

  return (
    <Stack gap="lg">
      {/* Page Title & Copy Button */}
      <Paper withBorder p="xl" radius="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <div>
            <Title order={2}>Controle mensal</Title>
            <Text c="dimmed" mt={6}>
              Planejamento de orçamento e acompanhamento de gastos mensais.
            </Text>
          </div>
          <Button
            leftSection={<IconCopy size={16} />}
            variant="light"
            color="teal"
            onClick={handleCopyBudget}
          >
            Copiar do mês anterior
          </Button>
        </Group>
      </Paper>

      <MonthSelector
        selectedMonth={selectedMonth}
        onChange={setSelectedMonth}
        minMonth={oldestAvailableMonth}
      />

      <Tabs value={activeView} onChange={(val) => setActiveView(val as "competence" | "cash")}>
        <Tabs.List>
          <Tabs.Tab value="competence" leftSection={<IconLayoutGrid size={16} />}>
            Regime de Competência
          </Tabs.Tab>
          <Tabs.Tab value="cash" leftSection={<IconWallet size={16} />}>
            Regime de Caixa (Fluxo)
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="competence" pt="md">
          <Stack gap="lg">
            {/* Summary Cards */}
            <Paper withBorder radius="md">
              <Group
                justify="space-between"
                align="center"
                px="md"
                py="xs"
                style={{
                  borderBottom: summaryCollapsed ? "none" : "1px solid var(--mantine-color-gray-2)",
                  cursor: "pointer",
                  userSelect: "none"
                }}
                onClick={handleToggleSummary}
              >
                <div>
                  <Text fw={700}>Resumo financeiro</Text>
                  <Text size="xs" c="dimmed">
                    Consolidado de receitas, despesas, limites e resultado líquido.
                  </Text>
                </div>
                <Group gap="xs">
                  {summaryCollapsed ? <IconChevronDown size={20} /> : <IconChevronUp size={20} />}
                </Group>
              </Group>
              <Collapse in={!summaryCollapsed}>
                <Box p="md">
                  <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                    {/* Income Card */}
                    <Card withBorder padding="md" radius="md">
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                            Receitas do mês
                          </Text>
                          <Badge color="teal" variant="light">
                            Entradas
                          </Badge>
                        </Group>
                        <div>
                          <Text size="xl" fw={700} c="teal">
                            {formatMoney(moneyFromCents(totalIncomeRealized))}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Planejado: {formatMoney(moneyFromCents(totalIncomeBudgeted))}
                          </Text>
                        </div>
                        <Progress
                          value={totalIncomeBudgeted > 0 ? (totalIncomeRealized / totalIncomeBudgeted) * 100 : 0}
                          color="teal"
                          size="sm"
                          radius="xl"
                        />
                      </Stack>
                    </Card>

                    {/* Expense Card */}
                    <Card withBorder padding="md" radius="md">
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                            Despesas vs limite
                          </Text>
                          <Badge color="red" variant="light">
                            Saídas
                          </Badge>
                        </Group>
                        <div>
                          <Text size="xl" fw={700} c={totalExpenseUsed > totalExpenseBudgeted ? "red" : "blue"}>
                            {formatMoney(moneyFromCents(totalExpenseUsed))}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Limite planejado: {formatMoney(moneyFromCents(totalExpenseBudgeted))}
                          </Text>
                        </div>
                        <Progress
                          value={totalExpenseBudgeted > 0 ? (totalExpenseUsed / totalExpenseBudgeted) * 100 : 0}
                          color={totalExpenseUsed > totalExpenseBudgeted ? "red" : "blue"}
                          size="sm"
                          radius="xl"
                        />
                      </Stack>
                    </Card>

                    {/* Credit Independence Card */}
                    <Card withBorder padding="md" radius="md">
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                            Independência de Crédito
                          </Text>
                          <Badge color="grape" variant="light">
                            Autonomia
                          </Badge>
                        </Group>
                        <div>
                          <Text size="xl" fw={700} c="teal">
                            {totalExpenseRealized > 0
                              ? `${Math.round((totalExpenseRealizedCash / totalExpenseRealized) * 100)}% à vista`
                              : "—"}
                          </Text>
                          <Text size="xs" c="dimmed">
                            À vista: {formatMoney(moneyFromCents(totalExpenseRealizedCash))}
                          </Text>
                          <Text size="xs" c="dimmed">
                            No cartão: {formatMoney(moneyFromCents(totalExpenseRealizedCredit))}
                          </Text>
                        </div>
                        <Progress.Root size="sm" radius="xl">
                          <Progress.Section
                            value={totalExpenseRealized > 0 ? (totalExpenseRealizedCash / totalExpenseRealized) * 100 : 0}
                            color="teal"
                          />
                          <Progress.Section
                            value={totalExpenseRealized > 0 ? (totalExpenseRealizedCredit / totalExpenseRealized) * 100 : 0}
                            color="grape"
                          />
                        </Progress.Root>
                      </Stack>
                    </Card>

                    {/* Net Balance Card */}
                    <Card withBorder padding="md" radius="md">
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                            Resultado líquido (realizado)
                          </Text>
                          <Badge color={netBalanceRealized >= 0 ? "teal" : "red"} variant="light">
                            Saldo Real
                          </Badge>
                        </Group>
                        <div>
                          <Text size="xl" fw={700} c={netBalanceRealized >= 0 ? "teal" : "red"}>
                            {formatMoney(moneyFromCents(netBalanceRealized))}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Receita realizada − despesa realizada
                          </Text>
                        </div>
                        <Box h={10} />
                      </Stack>
                    </Card>
                  </SimpleGrid>
                </Box>
              </Collapse>
            </Paper>

            {/* Nova alocação mensal */}
            <Paper withBorder radius="md">
              <Group
                justify="space-between"
                align="center"
                px="md"
                py="xs"
                style={{
                  borderBottom: allocationCollapsed ? "none" : "1px solid var(--mantine-color-gray-2)",
                  cursor: "pointer",
                  userSelect: "none"
                }}
                onClick={handleToggleAllocation}
              >
                <div>
                  <Text fw={700}>Nova alocação mensal</Text>
                  <Text size="xs" c="dimmed">
                    Planeje por subcategoria, conta/carteira e meio de pagamento quando fizer sentido.
                  </Text>
                </div>
                <Group gap="xs">
                  {allocationCollapsed ? <IconChevronDown size={20} /> : <IconChevronUp size={20} />}
                </Group>
              </Group>

              <Collapse in={!allocationCollapsed}>
                <Stack gap="sm" p="md">
                  <Group justify="flex-end">
                    <Button
                      leftSection={<IconPlus size={16} />}
                      color="teal"
                      variant="light"
                      onClick={() => void saveAllocation()}
                      loading={isAllocationSaving}
                    >
                      Salvar alocação
                    </Button>
                  </Group>

                  {allocationError ? (
                    <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                      {allocationError}
                    </Alert>
                  ) : null}

                  <SimpleGrid cols={{ base: 1, md: 4 }} spacing="sm">
                    <CategorySelect
                      label="Subcategoria"
                      categories={categories}
                      value={allocationForm.subcategoryId}
                      onChange={(value) =>
                        setAllocationForm((current) => ({ ...current, subcategoryId: value }))
                      }
                      emptyOptionLabel="Escolha uma subcategoria"
                      placeholder="Escolha uma subcategoria"
                    />
                    <Select
                      label="Fonte / conta"
                      data={[{ value: emptySelectValue, label: "Geral, sem fonte específica" }, ...accountOptions]}
                      value={allocationForm.accountId}
                      onChange={(value) =>
                        setAllocationForm((current) => ({ ...current, accountId: value ?? emptySelectValue }))
                      }
                      searchable
                    />
                    <Select
                      label="Meio"
                      data={[{ value: emptySelectValue, label: "Todos os meios" }, ...paymentMethodOptions]}
                      value={allocationForm.paymentMethodId}
                      onChange={(value) =>
                        setAllocationForm((current) => ({ ...current, paymentMethodId: value ?? emptySelectValue }))
                      }
                      searchable
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
                      value={allocationForm.amountReais}
                      onChange={(value) =>
                        setAllocationForm((current) => ({ ...current, amountReais: value }))
                      }
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  </SimpleGrid>
                </Stack>
              </Collapse>
            </Paper>

            {/* Account Balances */}
            <Paper withBorder radius="md">
              <Group
                justify="space-between"
                align="center"
                px="md"
                py="xs"
                style={{
                  borderBottom: balancesCollapsed ? "none" : "1px solid var(--mantine-color-gray-2)",
                  cursor: "pointer",
                  userSelect: "none"
                }}
                onClick={handleToggleBalances}
              >
                <div>
                  <Text fw={700}>Saldos por conta</Text>
                  <Text size="xs" c="dimmed">
                    Fluxo de caixa do mês por data do lançamento.
                  </Text>
                </div>
                <Group gap="xs">
                  <Badge color={totalAccountProjectedBalance >= 0 ? "teal" : "red"} variant="light">
                    Projetado: {formatMoney(moneyFromCents(totalAccountProjectedBalance))}
                  </Badge>
                  {balancesCollapsed ? <IconChevronDown size={20} /> : <IconChevronUp size={20} />}
                </Group>
              </Group>

              <Collapse in={!balancesCollapsed}>
                {isLoading ? (
                  <Group justify="center" p="xl">
                    <Loader size="sm" />
                  </Group>
                ) : accountSummaries.length === 0 ? (
                  <Box p="xl" style={{ textAlign: "center" }}>
                    <Text c="dimmed">Nenhuma conta ativa ou movimentação encontrada para este mês.</Text>
                  </Box>
                ) : (
                  <Stack gap={0}>
                    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={0}>
                      <Box p="md">
                        <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                          Saldo inicial
                        </Text>
                        <Text fw={700} c={totalOpeningBalance >= 0 ? "teal" : "red"}>
                          {formatMoney(moneyFromCents(totalOpeningBalance))}
                        </Text>
                      </Box>
                      <Box p="md">
                        <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                          Saldo realizado
                        </Text>
                        <Text fw={700} c={totalAccountRealizedBalance >= 0 ? "teal" : "red"}>
                          {formatMoney(moneyFromCents(totalAccountRealizedBalance))}
                        </Text>
                      </Box>
                      <Box p="md">
                        <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                          Saldo projetado
                        </Text>
                        <Text fw={700} c={totalAccountProjectedBalance >= 0 ? "teal" : "red"}>
                          {formatMoney(moneyFromCents(totalAccountProjectedBalance))}
                        </Text>
                      </Box>
                    </SimpleGrid>

                    <Table.ScrollContainer minWidth={900}>
                      <Table verticalSpacing="xs">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Conta</Table.Th>
                            <Table.Th style={{ textAlign: "right" }}>Saldo inicial</Table.Th>
                            <Table.Th style={{ textAlign: "right" }}>Entradas</Table.Th>
                            <Table.Th style={{ textAlign: "right" }}>Saídas</Table.Th>
                            <Table.Th style={{ textAlign: "right" }}>Saldo projetado</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {accountSummaries.map((account) => {
                            return (
                              <Table.Tr key={account.id}>
                                <Table.Td>
                                  <Group gap="xs" wrap="nowrap">
                                    <ThemeIcon variant="light" color={account.projectedBalance >= 0 ? "teal" : "red"}>
                                      <IconWallet size={16} />
                                    </ThemeIcon>
                                    <div>
                                      <Text fw={600}>{account.name}</Text>
                                      <Text size="xs" c="dimmed">
                                        {account.institution || getAccountTypeLabel(account.type)}
                                        {!account.isActive ? " · arquivada" : ""}
                                      </Text>
                                    </div>
                                  </Group>
                                </Table.Td>
                                <Table.Td style={{ textAlign: "right" }}>
                                  <Text size="sm" fw={600} c={account.openingBalance >= 0 ? "teal" : "red"}>
                                    {formatMoney(moneyFromCents(account.openingBalance))}
                                  </Text>
                                </Table.Td>
                                <Table.Td style={{ textAlign: "right" }}>
                                  <Text size="sm" c="teal">
                                    {formatMoney(moneyFromCents(account.realizedInflow))}
                                  </Text>
                                </Table.Td>
                                <Table.Td style={{ textAlign: "right" }}>
                                  <Text size="sm" c={account.realizedOutflow > 0 ? "red" : "dimmed"}>
                                    {formatMoney(moneyFromCents(account.realizedOutflow))}
                                  </Text>
                                </Table.Td>
                                <Table.Td style={{ textAlign: "right" }}>
                                  <Text size="sm" fw={700} c={account.projectedBalance >= 0 ? "teal" : "red"}>
                                    {formatMoney(moneyFromCents(account.projectedBalance))}
                                  </Text>
                                </Table.Td>
                              </Table.Tr>
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </Stack>
                )}
              </Collapse>
            </Paper>

            {/* Main Aggregated Table */}
            <Paper withBorder radius="md">
              <Group justify="space-between" align="center" px="md" py="xs" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
                <Text fw={700}>Detalhamento do orçamento</Text>
                <SegmentedControl
                  size="xs"
                  value={groupBy}
                  onChange={(val) => setGroupBy(val as GroupByMode)}
                  data={[
                    { label: "Por Categoria", value: "category" },
                    { label: "Por Fonte", value: "source" }
                  ]}
                />
              </Group>

              {isLoading ? (
                <Group justify="center" p="xl">
                  <Loader />
                </Group>
              ) : error ? (
                <Box p="md">
                  <Alert color="red" variant="light" title="Erro" icon={<IconAlertCircle size={16} />}>
                    {error}
                  </Alert>
                </Box>
              ) : flatRows.length === 0 ? (
                <Box p="xl" style={{ textAlign: "center" }}>
                  <Text c="dimmed">Nenhum orçamento configurado ou lançamento registrado para este mês.</Text>
                </Box>
              ) : (
                <Table.ScrollContainer minWidth={800}>
                  <Table verticalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: "35%" }}>Item</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Planejado/Alocado</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Realizado</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Comprometido</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Disponível / Diferença</Table.Th>
                        <Table.Th style={{ width: "15%" }}>Uso</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {flatRows.map((row) => {
                        const isExpanded = expandedNodes[row.id] !== undefined
                          ? expandedNodes[row.id]
                          : false;

                        const styleBg =
                          row.level === 0
                            ? { backgroundColor: "var(--mantine-color-gray-0)" }
                            : {};

                        return (
                          <Table.Tr key={row.id} style={styleBg}>
                            {/* Name / Category */}
                            <Table.Td style={{ paddingLeft: `${row.level * 24 + 12}px` }}>
                              <Group gap="xs" wrap="nowrap">
                                {row.hasChildren ? (
                                  <Tooltip label={isExpanded ? "Recolher" : "Expandir"}>
                                    <ThemeIcon
                                      size="xs"
                                      variant="subtle"
                                      color="gray"
                                      style={{ cursor: "pointer" }}
                                      onClick={() => toggleNode(row.id, isExpanded)}
                                    >
                                      {isExpanded ? (
                                        <IconChevronUp size={14} />
                                      ) : (
                                        <IconChevronDown size={14} />
                                      )}
                                    </ThemeIcon>
                                  </Tooltip>
                                ) : (
                                  <Box w={16} />
                                )}
                                <Text
                                  size="sm"
                                  fw={row.level <= 1 ? 700 : 500}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px"
                                  }}
                                >
                                  {row.level === 0 && groupBy === "source" ? (
                                    <IconWallet size={16} opacity={0.6} />
                                  ) : null}
                                  {row.name}
                                  {row.behavior && groupBy === "category" && !row.hasChildren ? (
                                    <Badge
                                      size="xs"
                                      variant="light"
                                      color={
                                        row.behavior === "fixed" ? "blue"
                                          : row.behavior === "variable" ? "teal"
                                          : "orange"
                                      }
                                      style={{ flexShrink: 0 }}
                                    >
                                      {row.behavior === "fixed" ? "Fixo"
                                        : row.behavior === "variable" ? "Variável"
                                        : "Extra"}
                                    </Badge>
                                  ) : null}
                                </Text>
                              </Group>
                            </Table.Td>

                            {/* Budgeted */}
                            <Table.Td style={{ textAlign: "right" }}>
                              <BudgetCell
                                initialCents={row.budgeted}
                                subcategoryId={row.subcategoryId}
                                accountId={row.accountId}
                                paymentMethodId={row.paymentMethodId}
                                selectedMonth={selectedMonth}
                                onSave={() => void loadData(true)}
                              />
                            </Table.Td>

                            {/* Realized */}
                            <Table.Td style={{ textAlign: "right" }}>
                              <Text size="sm">{formatMoney(moneyFromCents(row.realized))}</Text>
                            </Table.Td>

                            {/* Committed */}
                            <Table.Td style={{ textAlign: "right" }} c="dimmed">
                              <Text size="sm">
                                {row.committed > 0
                                  ? formatMoney(moneyFromCents(row.committed))
                                  : "—"}
                              </Text>
                            </Table.Td>

                            {/* Available */}
                            <Table.Td style={{ textAlign: "right" }}>
                              <Text
                                size="sm"
                                fw={700}
                                c={
                                  row.available < 0
                                    ? "red"
                                    : row.budgeted > 0 || row.available > 0
                                      ? "teal"
                                      : "dimmed"
                                }
                              >
                                {formatMoney(moneyFromCents(row.available))}
                              </Text>
                            </Table.Td>

                            {/* Progress Bar */}
                            <Table.Td style={{ width: "20%" }}>
                              <CategoryProgress
                                budgeted={row.budgeted}
                                realized={row.realized}
                                committed={row.committed}
                                realizedCash={row.realizedCash}
                                realizedCredit={row.realizedCredit}
                                committedCash={row.committedCash}
                                committedCredit={row.committedCredit}
                                nature={row.nature}
                              />
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Paper>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="cash" pt="md">
          <CashMonthlyView selectedMonth={selectedMonth} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function BudgetCell({
  initialCents,
  subcategoryId,
  accountId,
  paymentMethodId,
  selectedMonth,
  onSave
}: {
  initialCents: number;
  subcategoryId?: string;
  accountId?: string | null;
  paymentMethodId?: string | null;
  selectedMonth: string;
  onSave: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const [value, setValue] = useState<number | string>(initialCents === 0 ? "" : initialCents / 100);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialCents === 0 ? "" : initialCents / 100);
  }, [initialCents]);

  useEffect(() => {
    if (opened) {
      setValue(initialCents === 0 ? "" : initialCents / 100);
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [opened, initialCents]);

  if (!subcategoryId) {
    return (
      <Text size="sm" fw={600}>
        {initialCents > 0 ? formatMoney(moneyFromCents(initialCents)) : "—"}
      </Text>
    );
  }

  const handleSave = async () => {
    try {
      const parsedValue = typeof value === "number"
        ? value
        : parseFloat(String(value).replace(",", ".")) || 0;
      const amountCents = Math.round(parsedValue * 100);
      const res = await fetch(`${apiBaseUrl}/budgets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetMonth: selectedMonth,
          subcategoryId,
          accountId,
          paymentMethodId,
          amountCents
        })
      });
      if (res.ok) {
        setOpened(false);
        onSave();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom" withArrow shadow="md">
      <Popover.Target>
        <Text
          size="sm"
          style={{
            cursor: "pointer",
            textDecoration: "underline dashed var(--mantine-color-teal-5)"
          }}
          c="teal"
          fw={500}
          onClick={() => setOpened(true)}
        >
          {initialCents > 0 ? formatMoney(moneyFromCents(initialCents)) : "Definir"}
        </Text>
      </Popover.Target>
      <Popover.Dropdown p="xs">
        <Stack gap="xs">
          <Text size="xs" fw={700}>
            Definir limite:
          </Text>
          <Group gap="xs" align="flex-end">
            <NumberInput
              ref={inputRef}
              size="xs"
              value={value}
              onChange={(val) => setValue(val)}
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator="."
              decimalSeparator=","
              prefix="R$ "
              w={120}
              min={0}
              step={0.01}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSave();
              }}
            />
            <Button size="xs" color="teal" onClick={handleSave}>
              Salvar
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function getAccountTypeLabel(type: string) {
  const labels: Record<string, string> = {
    checking: "Conta corrente",
    savings: "Poupança",
    investment: "Investimento",
    cash: "Dinheiro",
    digital_wallet: "Carteira digital"
  };

  return labels[type] ?? type;
}
