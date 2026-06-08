import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  Paper,
  Popover,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  Tooltip
} from "@mantine/core";
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconCopy,
  IconWallet
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { formatMoney, moneyFromCents } from "@finances/domain";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface TreeNode {
  id: string;
  name: string;
  nature: "income" | "expense" | "mixed";
  budgeted: number;
  realized: number;
  committed: number;
  available: number;
  children?: TreeNode[];
}

interface SummaryData {
  income: { budgeted: number; realized: number; committed: number };
  expense: { budgeted: number; realized: number; committed: number };
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
  committedInflow: number;
  committedOutflow: number;
  realizedBalance: number;
  projectedBalance: number;
}

interface RowData {
  id: string;
  name: string;
  nature: "income" | "expense" | "mixed";
  budgeted: number;
  realized: number;
  committed: number;
  available: number;
  level: number;
  parentId: string | null;
  hasChildren: boolean;
  subcategoryId?: string;
  paymentMethodId?: string | null;
}

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);

export function ControleMensalPage() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [groupBy, setGroupBy] = useState<"category" | "payment-method">("category");
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [accountSummaries, setAccountSummaries] = useState<AccountMonthlySummary[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  async function loadData() {
    setIsLoading(true);
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
      setIsLoading(false);
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

  function handleNavigateMonth(direction: number) {
    const [year, month] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(year, month - 1 + direction, 1);
    const nextYear = nextDate.getFullYear();
    const nextMonthNum = String(nextDate.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${nextYear}-${nextMonthNum}`);
  }

  function getMonthOptions() {
    const now = new Date();
    const options = [];
    for (let i = -3; i <= 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" })
        .format(d)
        .replace(".", "");
      options.push({ value, label });
    }
    return options;
  }

  useEffect(() => {
    void loadData();
  }, [selectedMonth, groupBy]);

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [id]: prev[id] === false ? true : false // default is true, so false means collapsed
    }));
  };

  const getLeafDetails = (id: string): { subcategoryId: string; paymentMethodId: string | null } | null => {
    if (groupBy === "payment-method") {
      const match = id.match(/^pm-(.+)-sub-(.+)$/);
      if (match) {
        return {
          subcategoryId: match[2],
          paymentMethodId: null
        };
      }
    } else {
      if (id.startsWith("sub-")) {
        return {
          subcategoryId: id.slice(4),
          paymentMethodId: null
        };
      }
    }
    return null;
  };

  const flatRows = useMemo(() => {
    const list: RowData[] = [];
    const flatten = (nodes: TreeNode[], level = 0, parentId: string | null = null) => {
      for (const node of nodes) {
        const leafDetails = getLeafDetails(node.id);
        const isLeaf = !node.children || node.children.length === 0;

        list.push({
          id: node.id,
          name: node.name,
          nature: node.nature,
          budgeted: node.budgeted,
          realized: node.realized,
          committed: node.committed,
          available: node.available,
          level,
          parentId,
          hasChildren: !isLeaf,
          subcategoryId: leafDetails?.subcategoryId,
          paymentMethodId: leafDetails?.paymentMethodId
        });

        const isExpanded = expandedNodes[node.id] !== false; // default is expanded
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
  const totalAccountPending = accountSummaries.reduce(
    (total, account) =>
      total + account.committedInflow - account.committedOutflow,
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

      {/* Month Selector */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={700}>Mês de referência</Text>
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

      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
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
                Orçado: {formatMoney(moneyFromCents(totalIncomeBudgeted))}
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
                Limite orçado: {formatMoney(moneyFromCents(totalExpenseBudgeted))}
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

      {/* Account Balances */}
      <Paper withBorder radius="md">
        <Group
          justify="space-between"
          align="center"
          px="md"
          py="xs"
          style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}
        >
          <div>
            <Text fw={700}>Saldos por conta</Text>
            <Text size="xs" c="dimmed">
              Fluxo de caixa do mês por data do lançamento.
            </Text>
          </div>
          <Badge color={totalAccountProjectedBalance >= 0 ? "teal" : "red"} variant="light">
            Projetado: {formatMoney(moneyFromCents(totalAccountProjectedBalance))}
          </Badge>
        </Group>

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
            <SimpleGrid cols={{ base: 1, sm: 4 }} spacing={0}>
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
                  Pendente no mês
                </Text>
                <Text fw={700} c={totalAccountPending >= 0 ? "teal" : "red"}>
                  {formatMoney(moneyFromCents(totalAccountPending))}
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
                    <Table.Th style={{ textAlign: "right" }}>Pendente</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Saldo projetado</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {accountSummaries.map((account) => {
                    const pending = account.committedInflow - account.committedOutflow;
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
                          {account.committedInflow > 0 ? (
                            <Text size="xs" c="dimmed">
                              + {formatMoney(moneyFromCents(account.committedInflow))} previsto
                            </Text>
                          ) : null}
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <Text size="sm" c={account.realizedOutflow > 0 ? "red" : "dimmed"}>
                            {formatMoney(moneyFromCents(account.realizedOutflow))}
                          </Text>
                          {account.committedOutflow > 0 ? (
                            <Text size="xs" c="dimmed">
                              + {formatMoney(moneyFromCents(account.committedOutflow))} previsto
                            </Text>
                          ) : null}
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <Text size="sm" fw={600} c={pending >= 0 ? "teal" : "red"}>
                            {formatMoney(moneyFromCents(pending))}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <Text size="sm" fw={700} c={account.projectedBalance >= 0 ? "teal" : "red"}>
                            {formatMoney(moneyFromCents(account.projectedBalance))}
                          </Text>
                          <Text size="xs" c="dimmed">
                            realizado: {formatMoney(moneyFromCents(account.realizedBalance))}
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
      </Paper>

      {/* Main Aggregated Table */}
      <Paper withBorder radius="md">
        <Group justify="space-between" align="center" px="md" py="xs" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
          <Text fw={700}>Detalhamento do orçamento</Text>
          <SegmentedControl
            size="xs"
            value={groupBy}
            onChange={(val) => setGroupBy(val as "category" | "payment-method")}
            data={[
              { label: "Por Categoria", value: "category" },
              { label: "Por Meio de Pagamento", value: "payment-method" }
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
                  <Table.Th style={{ textAlign: "right" }}>Orçado (Limite)</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Realizado</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Comprometido</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Disponível / Diferença</Table.Th>
                  <Table.Th style={{ width: "15%" }}>Uso</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {flatRows.map((row) => {
                  const isExpanded = expandedNodes[row.id] !== false;
                  const totalUsed = row.realized + row.committed;
                  const pct = row.budgeted > 0 ? (totalUsed / row.budgeted) * 100 : 0;
                  const isIncome = row.nature === "income";
                  const isOver = !isIncome && totalUsed > row.budgeted;
                  const isIncomeBelowTarget = isIncome && row.budgeted > 0 && totalUsed < row.budgeted;

                  let progressColor = isIncome ? "teal" : "teal";
                  if (isOver || isIncomeBelowTarget) progressColor = "red";
                  else if (!isIncome && pct > 80) progressColor = "yellow";

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
                                onClick={() => toggleNode(row.id)}
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
                            {row.level === 0 && groupBy === "payment-method" ? (
                              <IconWallet size={16} opacity={0.6} />
                            ) : null}
                            {row.name}
                          </Text>
                        </Group>
                      </Table.Td>

                      {/* Budgeted */}
                      <Table.Td style={{ textAlign: "right" }}>
                        <BudgetCell
                          initialCents={row.budgeted}
                          subcategoryId={row.subcategoryId}
                          paymentMethodId={row.paymentMethodId}
                          selectedMonth={selectedMonth}
                          onSave={loadData}
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
                      <Table.Td>
                        {row.budgeted > 0 ? (
                          <Group gap="xs" wrap="nowrap">
                            <Progress
                              value={Math.min(pct, 100)}
                              color={progressColor}
                              size="sm"
                              style={{ flexGrow: 1 }}
                            />
                            <Text
                              size="xs"
                              fw={700}
                              c={isOver || isIncomeBelowTarget ? "red" : isIncome ? "teal" : "dimmed"}
                            >
                              {Math.round(pct)}%
                            </Text>
                          </Group>
                        ) : (
                          "—"
                        )}
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
  );
}

function BudgetCell({
  initialCents,
  subcategoryId,
  paymentMethodId,
  selectedMonth,
  onSave
}: {
  initialCents: number;
  subcategoryId?: string;
  paymentMethodId?: string | null;
  selectedMonth: string;
  onSave: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const [value, setValue] = useState<number>(initialCents / 100);

  useEffect(() => {
    setValue(initialCents / 100);
  }, [initialCents]);

  if (!subcategoryId) {
    return (
      <Text size="sm" fw={600}>
        {initialCents > 0 ? formatMoney(moneyFromCents(initialCents)) : "—"}
      </Text>
    );
  }

  const handleSave = async () => {
    try {
      const amountCents = Math.round(value * 100);
      const res = await fetch(`${apiBaseUrl}/budgets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetMonth: selectedMonth,
          subcategoryId,
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
              size="xs"
              value={value}
              onChange={(val) => setValue(Number(val))}
              decimalScale={2}
              fixedDecimalScale
              prefix="R$ "
              w={120}
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
