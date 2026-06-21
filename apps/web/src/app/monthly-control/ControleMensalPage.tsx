import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Grid,
  Group,
  HoverCard,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Progress,
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
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconCreditCard,
  IconInfoCircle,
  IconLayoutGrid,
  IconPencil,
  IconPlus,
  IconTrash,
  IconWallet
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { formatMoney, moneyFromCents } from "@finances/domain";

import { MonthSelector } from "../shared/MonthSelector";
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
  byPaymentMethod?: {
    accountId: string | null;
    creditCardId: string | null;
    paymentMethodId: string | null;
    budgeted: number;
    realized: number;
    committed: number;
  }[];
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
  plannedInflow?: number;
  plannedOutflow?: number;
  openCardBills?: number;
  linkedCards?: string[];
  linkedBillsDetail?: {
    cardName: string;
    billMonth: string;
    amountCents: number;
    dueDate: string;
  }[];
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
  level: number;
  parentId: string | null;
  hasChildren: boolean;
  subcategoryId?: string;
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

type CreditCard = {
  id: string;
  name: string;
  isActive: boolean;
  paymentAccountId?: string | null;
};


/** Same palette used in the reports payment-methods chart */
export const PAYMENT_METHOD_COLORS = [
  "var(--mantine-color-teal-6)",
  "var(--mantine-color-blue-5)",
  "var(--mantine-color-indigo-5)",
  "var(--mantine-color-cyan-5)",
  "var(--mantine-color-violet-5)",
  "var(--mantine-color-grape-5)"
];

interface MethodBreakdown {
  accountId: string | null;
  creditCardId: string | null;
  paymentMethodId: string | null;
  budgeted: number;
  realized: number;
  committed: number;
}

function collectMethodBreakdown(node: TreeNode): MethodBreakdown[] {
  // Leaf node with explicit per-method data from backend
  if (node.byPaymentMethod && node.byPaymentMethod.length > 0) {
    return node.byPaymentMethod;
  }
  if (!node.children || node.children.length === 0) {
    return [{
      accountId: null,
      creditCardId: null,
      paymentMethodId: null,
      budgeted: node.budgeted,
      realized: node.realized,
      committed: node.committed
    }];
  }
  const map = new Map<string, MethodBreakdown>();
  for (const child of node.children) {
    for (const b of collectMethodBreakdown(child)) {
      const key = `${b.accountId || "null"}|${b.creditCardId || "null"}|${b.paymentMethodId || "null"}`;
      const ex = map.get(key);
      if (ex) {
        ex.budgeted += b.budgeted;
        ex.realized += b.realized;
        ex.committed += b.committed;
      } else {
        map.set(key, { ...b });
      }
    }
  }
  return Array.from(map.values());
}

/** Mantine color names (short) matching PAYMENT_METHOD_COLORS order */
const PM_COLOR_NAMES = ["teal", "blue", "indigo", "cyan", "violet", "grape"] as const;

function getCategoryProgressColor(pmId: string | null, paymentMethods: PaymentMethod[], isIncome: boolean): string {
  if (!pmId) return isIncome ? "teal" : "blue";
  const idx = paymentMethods.findIndex((pm) => pm.id === pmId);
  return idx >= 0 ? PM_COLOR_NAMES[idx % PM_COLOR_NAMES.length] : "blue";
}



function getBreakdownItemLabel(
  m: MethodBreakdown,
  accounts: Account[],
  creditCards: CreditCard[],
  paymentMethods: PaymentMethod[]
): string {
  let sourceName = "";
  if (m.creditCardId) {
    sourceName = creditCards.find((c) => c.id === m.creditCardId)?.name ?? "Cartão";
  } else if (m.accountId) {
    sourceName = accounts.find((a) => a.id === m.accountId)?.name ?? "Conta";
  }

  let pmName = "";
  if (m.paymentMethodId) {
    pmName = paymentMethods.find((pm) => pm.id === m.paymentMethodId)?.name ?? "Meio";
  }

  if (sourceName && pmName) {
    return `${sourceName} · ${pmName}`;
  }
  return sourceName || pmName || "Geral";
}

interface ControleMensalPageProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}

export function ControleMensalPage({ selectedMonth, setSelectedMonth }: ControleMensalPageProps) {
  const [activeView, setActiveView] = useState<"competence" | "cash">("competence");
  const groupBy = "category";
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [accountSummaries, setAccountSummaries] = useState<AccountMonthlySummary[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [oldestAvailableMonth, setOldestAvailableMonth] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const [accountsResponse, paymentMethodsResponse, creditCardsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/accounts`),
        fetch(`${apiBaseUrl}/payment-methods`),
        fetch(`${apiBaseUrl}/credit-cards`)
      ]);

      if (!accountsResponse.ok || !paymentMethodsResponse.ok || !creditCardsResponse.ok) {
        throw new Error("Não foi possível carregar contas, meios de pagamento e cartões.");
      }

      setAccounts((await accountsResponse.json()) as Account[]);
      setPaymentMethods((await paymentMethodsResponse.json()) as PaymentMethod[]);
      setCreditCards((await creditCardsResponse.json()) as CreditCard[]);
    } catch (loadError) {
      console.error(loadError);
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
  ): { subcategoryId: string } | null => {
    const { id } = node;
    if (id.startsWith("sub-")) {
      return {
        subcategoryId: id.slice(4)
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
          level,
          parentId,
          hasChildren: !isLeaf,
          subcategoryId: leafDetails?.subcategoryId
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

  /** Map nodeId → per-payment-method breakdown, computed from full tree (not just visible rows) */
  const breakdownMap = useMemo(() => {
    const map = new Map<string, MethodBreakdown[]>();
    const traverse = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        map.set(node.id, collectMethodBreakdown(node));
        if (node.children) traverse(node.children);
      }
    };
    traverse(treeData);
    return map;
  }, [treeData]);

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
                  <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} spacing="md">
                    {/* Card 1: Despesas — gasto vs limite + disponível em destaque */}
                    {(() => {
                      const expensePct = totalExpenseBudgeted > 0
                        ? (totalExpenseUsed / totalExpenseBudgeted) * 100
                        : 0;
                      const expenseAvailable = totalExpenseBudgeted - totalExpenseUsed;
                      const expenseColor = expensePct >= 100 ? "red" : expensePct >= 85 ? "orange" : "blue";
                      return (
                        <Card withBorder padding="md" radius="md" style={{
                          borderLeft: `3px solid var(--mantine-color-${expenseColor}-5)`
                        }}>
                          <Stack gap="xs">
                            <Group justify="space-between" align="flex-start">
                              <Text size="xs" c="dimmed" fw={700} tt="uppercase">Despesas do mês</Text>
                              <Badge color={expenseColor} variant="light" size="sm">
                                {expensePct >= 100 ? "Limite estourado" : expensePct >= 85 ? "Atenção" : `${Math.round(expensePct)}% usado`}
                              </Badge>
                            </Group>
                            <div>
                              <Text size="xl" fw={700} c={expenseColor}>
                                {formatMoney(moneyFromCents(totalExpenseUsed))}
                              </Text>
                              <Text size="xs" c="dimmed">de {formatMoney(moneyFromCents(totalExpenseBudgeted))} planejados</Text>
                            </div>
                            <Progress value={Math.min(expensePct, 100)} color={expenseColor} size="sm" radius="xl" />
                            <Group justify="space-between">
                              <Text size="xs" c="dimmed">Realizado</Text>
                              <Text size="xs" fw={600} c={expenseColor}>
                                {formatMoney(moneyFromCents(totalExpenseRealized))}
                              </Text>
                            </Group>
                            <Group justify="space-between">
                              <Text size="xs" c="dimmed">Disponível</Text>
                              <Text size="xs" fw={700} c={expenseAvailable >= 0 ? "teal" : "red"}>
                                {formatMoney(moneyFromCents(expenseAvailable))}
                              </Text>
                            </Group>
                          </Stack>
                        </Card>
                      );
                    })()}

                    {/* Card 2: Projeção final das contas */}
                    {(() => {
                      const delta = totalAccountProjectedBalance - totalOpeningBalance;
                      const deltaColor = delta >= 0 ? "teal" : "red";
                      return (
                        <Card withBorder padding="md" radius="md" style={{
                          borderLeft: `3px solid var(--mantine-color-${totalAccountProjectedBalance >= 0 ? "teal" : "red"}-5)`
                        }}>
                          <Stack gap="xs">
                            <Group justify="space-between" align="flex-start">
                              <Text size="xs" c="dimmed" fw={700} tt="uppercase">Projeção de saldo</Text>
                              <Badge color={totalAccountProjectedBalance >= 0 ? "teal" : "red"} variant="light" size="sm">
                                Final do mês
                              </Badge>
                            </Group>
                            <div>
                              <Text size="xl" fw={700} c={totalAccountProjectedBalance >= 0 ? "teal" : "red"}>
                                {formatMoney(moneyFromCents(totalAccountProjectedBalance))}
                              </Text>
                              <Text size="xs" c="dimmed">saldo projetado nas contas</Text>
                            </div>
                            <Group justify="space-between">
                              <Text size="xs" c="dimmed">Saldo inicial</Text>
                              <Text size="xs" fw={600}>{formatMoney(moneyFromCents(totalOpeningBalance))}</Text>
                            </Group>
                            <Group justify="space-between">
                              <Text size="xs" c="dimmed">Variação projetada</Text>
                              <Text size="xs" fw={700} c={deltaColor}>
                                {delta >= 0 ? "+" : ""}{formatMoney(moneyFromCents(delta))}
                              </Text>
                            </Group>
                          </Stack>
                        </Card>
                      );
                    })()}

                    {/* Card 3: Resultado líquido realizado */}
                    {(() => {
                      const color = netBalanceRealized >= 0 ? "teal" : "red";
                      return (
                        <Card withBorder padding="md" radius="md" style={{
                          borderLeft: `3px solid var(--mantine-color-${color}-5)`
                        }}>
                          <Stack gap="xs">
                            <Group justify="space-between" align="flex-start">
                              <Text size="xs" c="dimmed" fw={700} tt="uppercase">Resultado realizado</Text>
                              <Badge color={color} variant="light" size="sm">
                                {netBalanceRealized >= 0 ? "Positivo" : "Negativo"}
                              </Badge>
                            </Group>
                            <div>
                              <Text size="xl" fw={700} c={color}>
                                {formatMoney(moneyFromCents(netBalanceRealized))}
                              </Text>
                              <Text size="xs" c="dimmed">receita − despesa realizadas</Text>
                            </div>
                            <Group justify="space-between">
                              <Text size="xs" c="dimmed">Receitas recebidas</Text>
                              <Text size="xs" fw={600} c="teal">{formatMoney(moneyFromCents(totalIncomeRealized))}</Text>
                            </Group>
                            <Group justify="space-between">
                              <Text size="xs" c="dimmed">Despesas pagas</Text>
                              <Text size="xs" fw={600} c="red">{formatMoney(moneyFromCents(totalExpenseRealized))}</Text>
                            </Group>
                          </Stack>
                        </Card>
                      );
                    })()}

                    {/* Card 4: Receitas planejadas vs recebidas */}
                    {(() => {
                      const incomePct = totalIncomeBudgeted > 0
                        ? (totalIncomeRealized / totalIncomeBudgeted) * 100
                        : 0;
                      return (
                        <Card withBorder padding="md" radius="md" style={{
                          borderLeft: "3px solid var(--mantine-color-teal-5)"
                        }}>
                          <Stack gap="xs">
                            <Group justify="space-between" align="flex-start">
                              <Text size="xs" c="dimmed" fw={700} tt="uppercase">Receitas do mês</Text>
                              <Badge color="teal" variant="light" size="sm">
                                {incomePct >= 100 ? "Completo" : `${Math.round(incomePct)}% recebido`}
                              </Badge>
                            </Group>
                            <div>
                              <Text size="xl" fw={700} c="teal">
                                {formatMoney(moneyFromCents(totalIncomeRealized))}
                              </Text>
                              <Text size="xs" c="dimmed">de {formatMoney(moneyFromCents(totalIncomeBudgeted))} esperados</Text>
                            </div>
                            <Progress value={Math.min(incomePct, 100)} color="teal" size="sm" radius="xl" />
                            <Group justify="space-between">
                              <Text size="xs" c="dimmed">A receber ainda</Text>
                              <Text size="xs" fw={700} c={totalIncomeBudgeted > totalIncomeRealized ? "orange" : "teal"}>
                                {formatMoney(moneyFromCents(Math.max(0, totalIncomeBudgeted - totalIncomeRealized)))}
                              </Text>
                            </Group>
                          </Stack>
                        </Card>
                      );
                    })()}

                    {/* Card 5: Independência de crédito */}
                    {(() => {
                      const cashPct = totalExpenseRealized > 0
                        ? (totalExpenseRealizedCash / totalExpenseRealized) * 100
                        : 0;
                      const creditPct = 100 - cashPct;
                      const independenceColor = cashPct >= 70 ? "teal" : cashPct >= 40 ? "orange" : "grape";
                      return (
                        <Card withBorder padding="md" radius="md" style={{
                          borderLeft: `3px solid var(--mantine-color-${independenceColor}-5)`
                        }}>
                          <Stack gap="xs">
                            <Group justify="space-between" align="flex-start">
                              <Text size="xs" c="dimmed" fw={700} tt="uppercase">Independência de crédito</Text>
                              <Badge color={independenceColor} variant="light" size="sm">
                                {cashPct >= 70 ? "Alta" : cashPct >= 40 ? "Média" : "Baixa"}
                              </Badge>
                            </Group>
                            <div>
                              <Text size="xl" fw={700} c={independenceColor}>
                                {totalExpenseRealized > 0 ? `${Math.round(cashPct)}% à vista` : "—"}
                              </Text>
                              <Text size="xs" c="dimmed">do total gasto realizado</Text>
                            </div>
                            <Progress.Root size="sm" radius="xl">
                              <Progress.Section value={cashPct} color="teal" />
                              <Progress.Section value={creditPct} color="grape" />
                            </Progress.Root>
                            <Group justify="space-between">
                              <Text size="xs" c="dimmed">À vista</Text>
                              <Text size="xs" fw={600} c="teal">{formatMoney(moneyFromCents(totalExpenseRealizedCash))}</Text>
                            </Group>
                            <Group justify="space-between">
                              <Text size="xs" c="dimmed">No cartão</Text>
                              <Text size="xs" fw={600} c="grape">{formatMoney(moneyFromCents(totalExpenseRealizedCredit))}</Text>
                            </Group>
                          </Stack>
                        </Card>
                      );
                    })()}
                  </SimpleGrid>
                </Box>
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
                                  <Group gap="xs" wrap="nowrap" align="flex-start">
                                    <ThemeIcon variant="light" color={account.projectedBalance >= 0 ? "teal" : "red"} mt={3}>
                                      <IconWallet size={16} />
                                    </ThemeIcon>
                                    <div>
                                      <Text fw={600}>{account.name}</Text>
                                      <Text size="xs" c="dimmed">
                                        {account.institution || getAccountTypeLabel(account.type)}
                                        {!account.isActive ? " · arquivada" : ""}
                                      </Text>
                                      {account.linkedCards && account.linkedCards.length > 0 && (
                                        <Group gap={4} mt={4}>
                                          {account.linkedCards.map((cardName) => (
                                            <Badge
                                              key={cardName}
                                              variant="light"
                                              color="grape"
                                              size="xs"
                                              leftSection={<IconCreditCard size={10} />}
                                              style={{ textTransform: "none" }}
                                            >
                                              {cardName}
                                            </Badge>
                                          ))}
                                        </Group>
                                      )}
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
                                  <HoverCard width={320} shadow="md" withArrow openDelay={100} position="left">
                                    <HoverCard.Target>
                                      <Group gap={4} justify="flex-end" style={{ cursor: "help", display: "inline-flex" }} wrap="nowrap">
                                        <Text size="sm" fw={700} c={account.projectedBalance >= 0 ? "teal" : "red"}>
                                          {formatMoney(moneyFromCents(account.projectedBalance))}
                                        </Text>
                                        <IconInfoCircle size={14} style={{ opacity: 0.6 }} />
                                        {account.projectedBalance < 0 && (
                                          <IconAlertTriangle size={14} color="var(--mantine-color-red-6)" />
                                        )}
                                      </Group>
                                    </HoverCard.Target>
                                    <HoverCard.Dropdown p="sm">
                                      <Stack gap="xs" style={{ textAlign: "left" }}>
                                        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                                          Detalhamento da Projeção
                                        </Text>
                                        
                                        <Group justify="space-between" wrap="nowrap">
                                          <Text size="xs">Saldo realizado (atual):</Text>
                                          <Text size="xs" fw={600} c={account.realizedBalance >= 0 ? "teal" : "red"}>
                                            {formatMoney(moneyFromCents(account.realizedBalance))}
                                          </Text>
                                        </Group>

                                        {account.plannedInflow ? account.plannedInflow > 0 && (
                                          <Group justify="space-between" wrap="nowrap">
                                            <Text size="xs">(+) Entradas planejadas:</Text>
                                            <Text size="xs" fw={600} c="teal">
                                              +{formatMoney(moneyFromCents(account.plannedInflow))}
                                            </Text>
                                          </Group>
                                        ) : null}

                                        {account.plannedOutflow ? account.plannedOutflow > 0 && (
                                          <Group justify="space-between" wrap="nowrap">
                                            <Text size="xs">(-) Saídas planejadas:</Text>
                                            <Text size="xs" fw={600} c="red">
                                              -{formatMoney(moneyFromCents(account.plannedOutflow))}
                                            </Text>
                                          </Group>
                                        ) : null}

                                        {account.openCardBills ? account.openCardBills > 0 && (
                                          <>
                                            <Group justify="space-between" wrap="nowrap">
                                              <Text size="xs" fw={600}>(-) Faturas em aberto:</Text>
                                              <Text size="xs" fw={700} c="orange">
                                                -{formatMoney(moneyFromCents(account.openCardBills))}
                                              </Text>
                                            </Group>
                                            <Stack gap={2} pl="xs" style={{ borderLeft: "2px solid var(--mantine-color-orange-2)" }}>
                                              {account.linkedBillsDetail?.map((bill, index) => (
                                                <Group key={index} justify="space-between" wrap="nowrap">
                                                  <Text size="10px" c="dimmed">
                                                    {bill.cardName} ({bill.billMonth})
                                                  </Text>
                                                  <Text size="10px" fw={600} c="dimmed">
                                                    -{formatMoney(moneyFromCents(bill.amountCents))}
                                                  </Text>
                                                </Group>
                                              ))}
                                            </Stack>
                                          </>
                                        ) : null}

                                        <Group justify="space-between" wrap="nowrap" pt="xs" style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}>
                                          <Text size="xs" fw={700}>Saldo projetado final:</Text>
                                          <Text size="xs" fw={700} c={account.projectedBalance >= 0 ? "teal" : "red"}>
                                            {formatMoney(moneyFromCents(account.projectedBalance))}
                                          </Text>
                                        </Group>

                                        {account.projectedBalance < 0 && (
                                          <Group gap={4} wrap="nowrap" mt="xs" p={6} style={{ borderRadius: 4, backgroundColor: "var(--mantine-color-red-0)" }}>
                                            <IconAlertTriangle size={14} color="var(--mantine-color-red-6)" />
                                            <Text size="10px" c="red.9" fw={500}>
                                              Atenção: Saldo projetado negativo!
                                            </Text>
                                          </Group>
                                        )}
                                      </Stack>
                                    </HoverCard.Dropdown>
                                  </HoverCard>
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
                        <Table.Th style={{ width: "25%" }}>Item</Table.Th>
                        <Table.Th style={{ textAlign: "right", width: "12%" }}>Planejado</Table.Th>
                        <Table.Th style={{ textAlign: "right", width: "12%" }}>Realizado</Table.Th>
                        <Table.Th style={{ minWidth: 400, width: "51%" }}>Meio / Fonte</Table.Th>
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
                                  {row.name}
                                  {row.behavior && !row.hasChildren ? (
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

                            {/* Planejado */}
                            <Table.Td style={{ textAlign: "right" }}>
                              <Group gap={6} justify="flex-end" wrap="nowrap" align="center">
                                <Text size="sm" fw={row.level <= 1 ? 700 : 500}>
                                  {formatMoney(moneyFromCents(row.budgeted))}
                                </Text>
                                {row.subcategoryId && (
                                  <BudgetCell
                                    initialCents={row.budgeted}
                                    subcategoryId={row.subcategoryId}
                                    subcategoryName={row.name}
                                    selectedMonth={selectedMonth}
                                    accounts={accounts}
                                    paymentMethods={paymentMethods}
                                    creditCards={creditCards}
                                    onSave={() => void loadData(true)}
                                  />
                                )}
                              </Group>
                            </Table.Td>

                            {/* Realizado */}
                            <Table.Td style={{ textAlign: "right" }}>
                              <Text size="sm" fw={row.level <= 1 ? 700 : 500}>
                                {formatMoney(moneyFromCents(row.realized))}
                              </Text>
                            </Table.Td>

                            {/* Meio / Fonte */}
                            <Table.Td>
                              {(() => {
                                const breakdown = breakdownMap.get(row.id) ?? [];
                                const active = breakdown.filter((m) => m.budgeted > 0 || m.realized > 0);
                                if (active.length === 0) {
                                  return <Text size="xs" c="dimmed">—</Text>;
                                }

                                if (row.hasChildren) {
                                  // For parent rows, show only a compact list of active sources (accounts/cards) to avoid vertical stretching
                                  const activeSources = Array.from(
                                    new Set(
                                      active
                                        .map((m) => {
                                          if (m.creditCardId) {
                                            return creditCards.find((c) => c.id === m.creditCardId)?.name;
                                          }
                                          if (m.accountId) {
                                            return accounts.find((a) => a.id === m.accountId)?.name;
                                          }
                                          return null;
                                        })
                                        .filter(Boolean)
                                    )
                                  );

                                  if (activeSources.length === 0) {
                                    return <Text size="xs" c="dimmed">—</Text>;
                                  }

                                  return (
                                    <Group gap={4} wrap="wrap">
                                      {activeSources.map((sourceName) => (
                                        <Badge key={sourceName} size="xs" variant="light" color="gray">
                                          {sourceName}
                                        </Badge>
                                      ))}
                                    </Group>
                                  );
                                }

                                return (
                                  <Group gap="xs" wrap="wrap">
                                    {active.map((m) => {
                                      const name = getBreakdownItemLabel(m, accounts, creditCards, paymentMethods);
                                      const dotColor = getCategoryProgressColor(m.paymentMethodId, paymentMethods, row.nature === "income");
                                      const isIncome = row.nature === "income";
                                      const used = m.realized + m.committed;
                                      const diff = isIncome ? used - m.budgeted : m.budgeted - used;
                                      const diffColor = diff < 0 ? "red" : (diff > 0 ? "teal" : "gray");

                                      return (
                                        <Paper
                                          key={`${m.accountId || "null"}-${m.creditCardId || "null"}-${m.paymentMethodId || "null"}`}
                                          withBorder
                                          px="xs"
                                          py="4px"
                                          radius="sm"
                                          style={{
                                            backgroundColor: "var(--mantine-color-gray-0)",
                                            borderColor: "var(--mantine-color-gray-2)",
                                            minWidth: "160px",
                                            flex: "1 1 auto",
                                            maxWidth: "240px"
                                          }}
                                        >
                                          <Group justify="space-between" wrap="nowrap" gap={4} mb={2}>
                                            <Group gap={5} wrap="nowrap" style={{ overflow: "hidden" }}>
                                              <div style={{
                                                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                                                backgroundColor: `var(--mantine-color-${dotColor}-5)`
                                              }} />
                                              <Text size="11px" fw={600} style={{ whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                                                {name}
                                              </Text>
                                            </Group>
                                            <Badge size="xs" color={diffColor} variant="light" style={{ flexShrink: 0 }}>
                                              {diff === 0 ? "Ok" : formatMoney(moneyFromCents(diff))}
                                            </Badge>
                                          </Group>
                                          <Text size="10px" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                                            Plan: {formatMoney(moneyFromCents(m.budgeted))} / Real: {formatMoney(moneyFromCents(m.realized))}
                                          </Text>
                                        </Paper>
                                      );
                                    })}
                                  </Group>
                                );
                              })()}
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

interface Budget {
  id: string;
  accountId: string | null;
  paymentMethodId: string | null;
  amountCents: number;
  subcategoryId: string;
  budgetMonth: string;
}

interface Transaction {
  id: string;
  description: string;
  amountCents: number;
  eventDate: string;
  accountId?: string | null;
  creditCardId?: string | null;
  paymentMethodId?: string | null;
}

function BudgetCell({
  initialCents,
  subcategoryId,
  subcategoryName,
  selectedMonth,
  accounts,
  paymentMethods,
  creditCards,
  onSave
}: {
  initialCents: number;
  subcategoryId?: string;
  subcategoryName?: string;
  selectedMonth: string;
  accounts: Account[];
  paymentMethods: PaymentMethod[];
  creditCards: CreditCard[];
  onSave: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [budgetsList, setBudgetsList] = useState<Budget[]>([]);
  const [transactionsList, setTransactionsList] = useState<Transaction[]>([]);

  // Budget editing states
  const [budgetAmounts, setBudgetAmounts] = useState<Record<string, number | string>>({});

  // New budget form states
  const [newBudgetAccountId, setNewBudgetAccountId] = useState<string | null>(null);
  const [newBudgetPmId, setNewBudgetPmId] = useState<string | null>(null);
  const [newBudgetAmount, setNewBudgetAmount] = useState<number | string>("");

  const loadModalData = async () => {
    if (!subcategoryId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [budgetsRes, transactionsRes] = await Promise.all([
        fetch(`${apiBaseUrl}/budgets?month=${selectedMonth}`),
        fetch(`${apiBaseUrl}/transactions?budgetMonth=${selectedMonth}&subcategoryId=${subcategoryId}`)
      ]);

      if (!budgetsRes.ok || !transactionsRes.ok) {
        throw new Error("Erro ao carregar dados de limites ou lançamentos.");
      }

      const allBudgets = (await budgetsRes.json()) as Budget[];
      const filteredBudgets = allBudgets.filter((b) => b.subcategoryId === subcategoryId);
      setBudgetsList(filteredBudgets);

      const bAmounts: Record<string, number | string> = {};
      for (const b of filteredBudgets) {
        bAmounts[b.id] = b.amountCents / 100;
      }
      setBudgetAmounts(bAmounts);

      const allTransactions = (await transactionsRes.json()) as Transaction[];
      setTransactionsList(allTransactions);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      void loadModalData();
    }
  }, [opened, selectedMonth, subcategoryId]);

  if (!subcategoryId) {
    return (
      <Text size="sm" fw={600} c="dimmed">
        {initialCents > 0 ? formatMoney(moneyFromCents(initialCents)) : "—"}
      </Text>
    );
  }

  const handleSaveBudget = async (budget: Budget, val: number | string) => {
    const parsedValue = typeof val === "number" ? val : parseFloat(String(val).replace(",", ".")) || 0;
    const amountCents = Math.round(parsedValue * 100);
    try {
      const res = await fetch(`${apiBaseUrl}/budgets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetMonth: selectedMonth,
          subcategoryId,
          accountId: budget.accountId || null,
          paymentMethodId: budget.paymentMethodId || null,
          amountCents
        })
      });
      if (res.ok) {
        await loadModalData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBudget = async (budget: Budget) => {
    if (!window.confirm("Deseja realmente remover este limite planejado?")) return;
    await handleSaveBudget(budget, 0);
  };

  const handleAddBudget = async () => {
    const amt = typeof newBudgetAmount === "number" ? newBudgetAmount : parseFloat(String(newBudgetAmount).replace(",", ".")) || 0;
    if (amt <= 0) return;
    try {
      const res = await fetch(`${apiBaseUrl}/budgets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetMonth: selectedMonth,
          subcategoryId,
          accountId: newBudgetAccountId || null,
          paymentMethodId: newBudgetPmId || null,
          amountCents: Math.round(amt * 100)
        })
      });
      if (res.ok) {
        setNewBudgetAmount("");
        setNewBudgetAccountId(null);
        setNewBudgetPmId(null);
        await loadModalData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const accountOptions = [
    { value: "", label: "Qualquer conta / geral" },
    ...accounts
      .filter((a) => a.isActive)
      .map((a) => ({ value: a.id, label: a.name }))
  ];

  const pmOptions = [
    { value: "", label: "Qualquer meio" },
    ...paymentMethods.map((pm) => ({ value: pm.id, label: pm.name }))
  ];

  return (
    <>
      <Tooltip label={initialCents > 0 ? "Editar planejamento e lançamentos" : "Definir limites e lançamentos"} withArrow position="top">
        <ActionIcon
          size="xs"
          variant="subtle"
          color={initialCents > 0 ? "gray" : "teal"}
          onClick={() => setOpened(true)}
          style={{ flexShrink: 0 }}
        >
          {initialCents > 0 ? <IconPencil size={12} /> : <IconPlus size={12} />}
        </ActionIcon>
      </Tooltip>

      <Modal
        opened={opened}
        onClose={() => {
          setOpened(false);
          onSave();
        }}
        title={
          <Text fw={700} size="md">
            Planejamento e Lançamentos — {subcategoryName}
          </Text>
        }
        size="xl"
        centered
      >
        {isLoading ? (
          <Group justify="center" p="xl">
            <Loader size="md" />
          </Group>
        ) : error ? (
          <Alert color="red" variant="light" title="Erro">
            {error}
          </Alert>
        ) : (
          <Grid gutter="xl">
            {/* Coluna 1: Limites Planejados */}
            <Grid.Col span={6} style={{ borderRight: "1px solid var(--mantine-color-gray-2)" }}>
              <Title order={5} mb="md" c="teal" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <IconPencil size={16} /> Limites Planejados
              </Title>

              <Stack gap="xs" style={{ maxHeight: 300, overflowY: "auto", paddingRight: 6 }}>
                {budgetsList.length === 0 ? (
                  <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
                    Nenhum limite planejado para este mês.
                  </Text>
                ) : (
                  budgetsList.map((b) => (
                    <Paper key={b.id} p="xs" withBorder radius="xs" style={{ backgroundColor: "var(--mantine-color-gray-0)" }}>
                      <Group justify="space-between" wrap="nowrap">
                        <Stack gap={1}>
                          <Text size="xs" fw={700}>
                            {(() => {
                              if (b.accountId && b.paymentMethodId === "pm-credit-card") {
                                const card = creditCards.find((c) => c.paymentAccountId === b.accountId);
                                if (card) return card.name;
                              }
                              return b.accountId
                                ? (accounts.find((a) => a.id === b.accountId)?.name || "Conta específica")
                                : "Geral / qualquer conta";
                            })()}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {b.paymentMethodId ? (paymentMethods.find(pm => pm.id === b.paymentMethodId)?.name || "Meio específico") : "Geral / qualquer meio"}
                          </Text>
                        </Stack>
                        <Group gap={6} wrap="nowrap" align="center">
                          <NumberInput
                            value={budgetAmounts[b.id] ?? ""}
                            onChange={(val) => setBudgetAmounts(prev => ({ ...prev, [b.id]: val }))}
                            decimalScale={2}
                            thousandSeparator="."
                            decimalSeparator=","
                            prefix="R$ "
                            style={{ width: 100 }}
                            size="xs"
                            min={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleSaveBudget(b, budgetAmounts[b.id]);
                            }}
                          />
                          <Tooltip label="Salvar este limite">
                            <ActionIcon color="teal" variant="subtle" size="xs" onClick={() => void handleSaveBudget(b, budgetAmounts[b.id])}>
                              <IconCheck size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Remover limite">
                            <ActionIcon color="red" variant="subtle" size="xs" onClick={() => void handleDeleteBudget(b)}>
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Group>
                    </Paper>
                  ))
                )}
              </Stack>

              <Paper p="xs" withBorder radius="xs" mt="md" style={{ backgroundColor: "var(--mantine-color-teal-0)" }}>
                <Text size="xs" fw={700} c="teal" mb="xs">
                  Adicionar Planejamento
                </Text>
                <Stack gap="xs">
                  <Select
                    label="Conta / Fonte"
                    size="xs"
                    data={accountOptions}
                    value={newBudgetAccountId}
                    onChange={setNewBudgetAccountId}
                    placeholder="Geral / qualquer conta"
                    clearable
                    searchable
                  />
                  <Select
                    label="Meio de pagamento"
                    size="xs"
                    data={pmOptions}
                    value={newBudgetPmId}
                    onChange={setNewBudgetPmId}
                    placeholder="Geral / qualquer meio"
                    clearable
                    searchable
                  />
                  <NumberInput
                    label="Valor planejado"
                    size="xs"
                    value={newBudgetAmount}
                    onChange={setNewBudgetAmount}
                    decimalScale={2}
                    thousandSeparator="."
                    decimalSeparator=","
                    prefix="R$ "
                    min={0.01}
                  />
                  <Button size="xs" color="teal" onClick={handleAddBudget} fullWidth>
                    Adicionar Limite
                  </Button>
                </Stack>
              </Paper>
            </Grid.Col>

            {/* Coluna 2: Lançamentos Realizados */}
            <Grid.Col span={6}>
              <Title order={5} mb="md" c="blue" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <IconWallet size={16} /> Lançamentos Realizados
              </Title>

              <Stack gap="md" style={{ maxHeight: 450, overflowY: "auto", paddingRight: 6 }}>
                {transactionsList.length === 0 ? (
                  <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
                    Nenhum lançamento registrado neste mês.
                  </Text>
                ) : (
                  (() => {
                    const groups: Record<string, typeof transactionsList> = {};
                    for (const tx of transactionsList) {
                      const sourceName = tx.creditCardId
                        ? `${creditCards.find(c => c.id === tx.creditCardId)?.name || "Cartão"}`
                        : tx.accountId
                        ? `${accounts.find(a => a.id === tx.accountId)?.name || "Conta"}`
                        : "Geral";

                      const pmName = tx.creditCardId
                        ? "Cartão de Crédito"
                        : (paymentMethods.find(pm => pm.id === tx.paymentMethodId)?.name || "Geral");

                      const key = `${sourceName} · ${pmName}`;
                      if (!groups[key]) {
                        groups[key] = [];
                      }
                      groups[key].push(tx);
                    }

                    return Object.entries(groups).map(([groupTitle, txs]) => (
                      <Card key={groupTitle} p="xs" withBorder radius="xs" style={{ backgroundColor: "var(--mantine-color-blue-0)" }}>
                        <Text size="xs" fw={700} c="blue" mb="xs" style={{ borderBottom: "1px solid var(--mantine-color-blue-1)", paddingBottom: 4 }}>
                          {groupTitle}
                        </Text>
                        <Stack gap="xs">
                          {txs.map((tx) => {
                            const dateParts = tx.eventDate.split("-");
                            const formattedDate = dateParts.length === 3
                              ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
                              : tx.eventDate;

                            return (
                              <Group key={tx.id} justify="space-between" wrap="nowrap" align="center">
                                <Stack gap={1} style={{ flex: 1 }}>
                                  <Text size="xs" fw={500}>{tx.description}</Text>
                                  <Text size="10px" c="dimmed">{formattedDate}</Text>
                                </Stack>
                                <Text size="xs" fw={700}>
                                  {formatMoney(moneyFromCents(tx.amountCents))}
                                </Text>
                              </Group>
                            );
                          })}
                        </Stack>
                      </Card>
                    ));
                  })()
                )}
              </Stack>
            </Grid.Col>
          </Grid>
        )}
      </Modal>
    </>
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
