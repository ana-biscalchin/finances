import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Loader,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Title
} from "@mantine/core";


import {
  IconAlertCircle,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconCreditCard,
  IconFilter,
  IconScale
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";


import { formatMoney, moneyFromCents } from "@finances/domain";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface ReportsPageProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  filterAccountId: string;
  setFilterAccountId: (id: string) => void;
  filterPaymentMethodId: string;
  setFilterPaymentMethodId: (id: string) => void;
  filterCategoryId: string;
  setFilterCategoryId: (id: string) => void;
}

interface AccountOption {
  id: string;
  name: string;
  institution: string | null;
}

interface PaymentMethodOption {
  id: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface DailyEvolutionItem {
  day: number;
  date: string;
  balance: number;
  totalSpent: number;
  dayIncome: number;
  dayExpenseInAccount: number;
}

interface CreditCardSummaryItem {
  cardId: string;
  cardName: string;
  institution: string | null;
  limitCents: number | null;
  billMonth: string;
  dueDate: string;
  closingDate: string;
  amountCents: number;
  status: "open" | "paid";
}

interface AnnualSummaryItem {
  month: string;
  monthLabel: string;
  incomeCents: number;
  expenseCents: number;
}

interface CategorySpentItem {
  categoryId: string;
  categoryName: string;
  amountCents: number;
}

export function ReportsPage({
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  filterAccountId,
  setFilterAccountId,
  filterPaymentMethodId,
  setFilterPaymentMethodId,
  filterCategoryId,
  setFilterCategoryId
}: ReportsPageProps) {
  const [timeframe, setTimeframe] = useState<string>("monthly");

  // Options states
  const [accountsList, setAccountsList] = useState<AccountOption[]>([]);
  const [paymentMethodsList, setPaymentMethodsList] = useState<PaymentMethodOption[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryOption[]>([]);

  // Reports data states
  const [dailyData, setDailyData] = useState<DailyEvolutionItem[]>([]);
  const [cardSummaries, setCardSummaries] = useState<CreditCardSummaryItem[]>([]);
  const [annualSummary, setAnnualSummary] = useState<AnnualSummaryItem[]>([]);
  const [categoriesSpent, setCategoriesSpent] = useState<CategorySpentItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch filter options once
  useEffect(() => {
    async function fetchOptions() {
      try {
        const [accRes, pmRes, catRes] = await Promise.all([
          fetch(`${apiBaseUrl}/accounts`),
          fetch(`${apiBaseUrl}/payment-methods`),
          fetch(`${apiBaseUrl}/categories`)
        ]);

        if (accRes.ok) setAccountsList(await accRes.json());
        if (pmRes.ok) setPaymentMethodsList(await pmRes.json());
        if (catRes.ok) setCategoriesList(await catRes.json());
      } catch (e) {
        console.error("Erro ao carregar opções de filtros:", e);
      }
    }
    void fetchOptions();
  }, []);

  // Fetch report data when timeframe, dates or filters change
  const loadReportData = async () => {
    setIsLoading(true);
    setError(null);

    const queryParams = new URLSearchParams();
    if (filterAccountId) queryParams.append("accountId", filterAccountId);
    if (filterPaymentMethodId) queryParams.append("paymentMethodId", filterPaymentMethodId);
    if (filterCategoryId) queryParams.append("categoryId", filterCategoryId);

    try {
      if (timeframe === "monthly") {
        queryParams.append("month", selectedMonth);
        const [dailyRes, cardRes] = await Promise.all([
          fetch(`${apiBaseUrl}/reports/daily-evolution?${queryParams.toString()}`),
          fetch(`${apiBaseUrl}/reports/credit-cards-summary?month=${selectedMonth}`)
        ]);

        if (!dailyRes.ok) throw new Error("Erro ao carregar evolução diária.");
        if (!cardRes.ok) throw new Error("Erro ao carregar faturas de cartão.");

        setDailyData(await dailyRes.json());
        setCardSummaries(await cardRes.json());
      } else {
        queryParams.append("year", selectedYear);
        const [annualRes, catRes] = await Promise.all([
          fetch(`${apiBaseUrl}/reports/annual-summary?${queryParams.toString()}`),
          fetch(`${apiBaseUrl}/reports/annual-categories?${queryParams.toString()}`)
        ]);

        if (!annualRes.ok) throw new Error("Erro ao carregar sumário anual.");
        if (!catRes.ok) throw new Error("Erro ao carregar despesas por categoria.");

        setAnnualSummary(await annualRes.json());
        setCategoriesSpent(await catRes.json());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado ao carregar dados.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadReportData();
  }, [
    timeframe,
    selectedMonth,
    selectedYear,
    filterAccountId,
    filterPaymentMethodId,
    filterCategoryId
  ]);

  // Navigate months (monthly view)
  const handleNavigateMonth = (direction: number) => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(year, month - 1 + direction, 1);
    const nextYear = nextDate.getFullYear();
    const nextMonthNum = String(nextDate.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${nextYear}-${nextMonthNum}`);
  };

  // Navigate years (annual view)
  const handleNavigateYear = (direction: number) => {
    const nextYear = Number(selectedYear) + direction;
    setSelectedYear(String(nextYear));
  };

  const getMonthOptions = () => {
    const now = new Date();
    const options = [];
    for (let i = -6; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" })
        .format(d)
        .replace(".", "");
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return options;
  };

  const getYearOptions = () => {
    const currentYearNum = new Date().getFullYear();
    const options = [];
    for (let i = -3; i <= 2; i++) {
      const yr = currentYearNum + i;
      options.push({ value: String(yr), label: String(yr) });
    }
    return options;
  };

  // Calculations for Monthly View Destaques
  const monthlySummary = useMemo(() => {
    if (dailyData.length === 0) return { income: 0, expense: 0, balance: 0 };
    let totalIncome = 0;
    let totalExpenseInAccount = 0;

    for (const day of dailyData) {
      totalIncome += day.dayIncome;
      totalExpenseInAccount += day.dayExpenseInAccount;
    }

    // Last day has cumulativeSpent
    const totalSpentAccumulated = dailyData[dailyData.length - 1].totalSpent;

    return {
      income: totalIncome,
      // totalSpentAccumulated is the true total spent (account + credit card)
      expense: totalSpentAccumulated,
      balance: totalIncome - totalExpenseInAccount
    };
  }, [dailyData]);

  // Calculations for Annual View Destaques
  const annualCalculations = useMemo(() => {
    if (annualSummary.length === 0) {
      return { totalIncome: 0, totalExpense: 0, avgIncome: 0, avgExpense: 0, savingsRate: 0 };
    }

    let totalIncome = 0;
    let totalExpense = 0;

    for (const m of annualSummary) {
      totalIncome += m.incomeCents;
      totalExpense += m.expenseCents;
    }

    const avgIncome = totalIncome / 12;
    const avgExpense = totalExpense / 12;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

    return {
      totalIncome,
      totalExpense,
      avgIncome,
      avgExpense,
      savingsRate
    };
  }, [annualSummary]);

  // Check if we should hide the balance line on monthly daily evolution
  // We hide balance if category or payment method is filtered, as balance is a global wallet state
  const shouldHideBalanceLine = !!(filterCategoryId || filterPaymentMethodId);

  // Formatter helpers for Recharts
  const formatChartCurrency = (value: number) => {
    return `R$ ${(value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatTooltipCurrency = (value: string | number | undefined | readonly (string | number)[]) => {
    const numericValue = typeof value === "number"
      ? value
      : Array.isArray(value)
        ? Number(value[0] || 0)
        : Number(value || 0);
    return formatMoney(moneyFromCents(numericValue));
  };



  return (
    <Stack gap="lg">
      {/* Header and Timeframe tabs */}
      <Paper withBorder p="xl" radius="md">
        <Group justify="space-between" align="center" wrap="nowrap">
          <div>
            <Title order={2}>Relatórios Analíticos</Title>
            <Text c="dimmed" mt={6}>
              Análise visual de fluxos de caixa, despesas por categoria e evolução financeira.
            </Text>
          </div>
          <Tabs value={timeframe} onChange={(val) => setTimeframe(val || "monthly")} variant="pills" color="teal">
            <Tabs.List>
              <Tabs.Tab value="monthly">Mensal</Tabs.Tab>
              <Tabs.Tab value="yearly">Anual</Tabs.Tab>
            </Tabs.List>
          </Tabs>
        </Group>
      </Paper>

      {/* Filters Toolbar */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Group gap="xs" align="center">
            <ThemeIcon variant="light" color="teal" size="sm">
              <IconFilter size={16} />
            </ThemeIcon>
            <Text fw={700} size="sm">Filtros de Análise</Text>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            {/* Period selector */}
            {timeframe === "monthly" ? (
              <Select
                label="Mês de Referência"
                placeholder="Selecione o mês"
                data={getMonthOptions()}
                value={selectedMonth}
                onChange={(val) => val && setSelectedMonth(val)}
                leftSection={<IconCalendar size={16} />}
              />
            ) : (
              <Select
                label="Ano de Referência"
                placeholder="Selecione o ano"
                data={getYearOptions()}
                value={selectedYear}
                onChange={(val) => val && setSelectedYear(val)}
                leftSection={<IconCalendar size={16} />}
              />
            )}

            {/* Account filter */}
            <Select
              label="Conta / Carteira"
              placeholder="Todas as contas"
              clearable
              data={[
                { value: "", label: "Todas as contas (Consolidado)" },
                ...accountsList.map((a) => ({
                  value: a.id,
                  label: a.institution ? `${a.name} (${a.institution})` : a.name
                }))
              ]}
              value={filterAccountId}
              onChange={(val) => setFilterAccountId(val || "")}
            />

            {/* Payment Method filter */}
            <Select
              label="Meio de Pagamento"
              placeholder="Todos os meios"
              clearable
              data={[
                { value: "", label: "Todos os meios" },
                ...paymentMethodsList.map((pm) => ({
                  value: pm.id,
                  label: pm.name
                }))
              ]}
              value={filterPaymentMethodId}
              onChange={(val) => setFilterPaymentMethodId(val || "")}
            />

            {/* Category filter */}
            <Select
              label="Categoria Macro"
              placeholder="Todas as categorias"
              clearable
              data={[
                { value: "", label: "Todas as categorias" },
                ...categoriesList.map((c) => ({
                  value: c.id,
                  label: c.name
                }))
              ]}
              value={filterCategoryId}
              onChange={(val) => setFilterCategoryId(val || "")}
            />
          </SimpleGrid>
        </Stack>
      </Paper>

      {/* Main Content Area */}
      {isLoading ? (
        <Group justify="center" p="xl" h={300}>
          <Loader size="lg" color="teal" />
          <Text size="sm" c="dimmed">Consolidando dados...</Text>
        </Group>
      ) : error ? (
        <Alert icon={<IconAlertCircle size={16} />} title="Erro" color="red" variant="light">
          {error}
        </Alert>
      ) : timeframe === "monthly" ? (
        /* =================== MONTHLY VIEW =================== */
        <Stack gap="lg">
          {/* Month Navigator Toolbar */}
          <Group justify="space-between" align="center">
            <Title order={3} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              Período:{" "}
              <Badge size="lg" color="teal" variant="light">
                {new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
                  .format(new Date(Number(selectedMonth.split("-")[0]), Number(selectedMonth.split("-")[1]) - 1))
                  .toUpperCase()}
              </Badge>
            </Title>
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

          {/* Destaques cards */}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Card withBorder padding="md" radius="md">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed" fw={700} tt="uppercase">Receitas Filtradas</Text>
                  <ThemeIcon color="teal" variant="light" size="sm">
                    <IconArrowUpRight size={16} />
                  </ThemeIcon>
                </Group>
                <div>
                  <Text size="xl" fw={700} c="teal">
                    {formatMoney(moneyFromCents(monthlySummary.income))}
                  </Text>
                  <Text size="xs" c="dimmed">Total de entradas realizadas</Text>
                </div>
              </Stack>
            </Card>

            <Card withBorder padding="md" radius="md">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed" fw={700} tt="uppercase">Despesas Filtradas</Text>
                  <ThemeIcon color="red" variant="light" size="sm">
                    <IconArrowDownLeft size={16} />
                  </ThemeIcon>
                </Group>
                <div>
                  <Text size="xl" fw={700} c="red">
                    {formatMoney(moneyFromCents(monthlySummary.expense))}
                  </Text>
                  <Text size="xs" c="dimmed">Gastos totais (realizados + previstos)</Text>
                </div>
              </Stack>
            </Card>

            <Card withBorder padding="md" radius="md">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed" fw={700} tt="uppercase">Fluxo Líquido Real</Text>
                  <ThemeIcon color={monthlySummary.balance >= 0 ? "teal" : "red"} variant="light" size="sm">
                    <IconScale size={16} />
                  </ThemeIcon>
                </Group>
                <div>
                  <Text size="xl" fw={700} c={monthlySummary.balance >= 0 ? "teal" : "red"}>
                    {formatMoney(moneyFromCents(monthlySummary.balance))}
                  </Text>
                  <Text size="xs" c="dimmed">Saldo líquido realizado em conta</Text>
                </div>
              </Stack>
            </Card>
          </SimpleGrid>

          {/* Chart 1: Daily Evolution */}
          <Paper withBorder p="md" radius="md">
            <Stack gap="xs">
              <Box>
                <Text fw={700}>Evolução Diária de Saldo e Gastos</Text>
                <Text size="xs" c="dimmed">
                  Curva diária de caixa líquido vs despesas cumulativas ao longo do mês.
                </Text>
              </Box>

              {shouldHideBalanceLine && (
                <Alert color="yellow" variant="light" p="xs">
                  A linha de saldo de caixa é ocultada ao aplicar filtros de Categoria ou Meio de Pagamento sem isolar uma Conta.
                </Alert>
              )}


              <Box h={320} mt="md">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--mantine-color-teal-5)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--mantine-color-teal-5)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      tickFormatter={formatChartCurrency}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={formatTooltipCurrency}
                      labelFormatter={(label) => `Dia ${label}`}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid var(--mantine-color-gray-3)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    {!shouldHideBalanceLine && (
                      <Area
                        type="monotone"
                        dataKey="balance"
                        name="Saldo Acumulado"
                        stroke="var(--mantine-color-teal-6)"
                        fillOpacity={1}
                        fill="url(#colorBalance)"
                        strokeWidth={2}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="totalSpent"
                      name="Gastos Acumulados"
                      stroke="var(--mantine-color-orange-6)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Stack>
          </Paper>

          {/* Cards for Grid (Category breakdown + Credit card bills + Payment Methods) */}
          <Grid gutter="md">
            {/* Category breakdown (Monthly) */}
            <Grid.Col span={12}>
              <Paper withBorder p="md" radius="md">
                <Stack gap="xs">
                  <Box>
                    <Text fw={700}>
                      {filterCategoryId ? "Subcategorias de Despesas" : "Composição de Despesas por Categoria"}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {filterCategoryId
                        ? "Distribuição de gastos entre subcategorias da categoria filtrada."
                        : "Maiores centros de despesas do mês por valor absoluto acumulado."}
                    </Text>
                  </Box>

                  {/* We call a localized component to fetch/prepare category horizontal charts for the month */}
                  <MonthlyCategoryChart
                    selectedMonth={selectedMonth}
                    filterAccountId={filterAccountId}
                    filterPaymentMethodId={filterPaymentMethodId}
                    filterCategoryId={filterCategoryId}
                    filterCategoryName={categoriesList.find((c) => c.id === filterCategoryId)?.name || ""}
                  />
                </Stack>
              </Paper>
            </Grid.Col>

            {/* Credit Card Bills Vencimentos */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper withBorder p="md" radius="md" h="100%">
                <Stack gap="xs" h="100%">
                  <Box style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <ThemeIcon variant="light" color="blue">
                      <IconCreditCard size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={700}>Próximos Vencimentos de Cartão</Text>
                      <Text size="xs" c="dimmed">Faturas ativas no mês e mês subsequente.</Text>
                    </div>
                  </Box>

                  <Box style={{ flexGrow: 1 }} mt="sm">
                    {cardSummaries.length === 0 ? (
                      <Box p="xl" style={{ textAlign: "center", border: "1px dashed var(--mantine-color-gray-3)", borderRadius: "8px" }}>
                        <Text c="dimmed" size="sm">Nenhuma fatura encontrada neste período.</Text>
                      </Box>
                    ) : (
                      <Stack gap="xs">
                        {cardSummaries.map((bill) => {
                          const limitCents = bill.limitCents ?? 0;
                          const pctUsed = limitCents > 0 ? (bill.amountCents / limitCents) * 100 : 0;
                          const isPaid = bill.status === "paid";
                          
                          // Format Dates nicely
                          const formattedDueDate = new Intl.DateTimeFormat("pt-BR", {
                            day: "2-digit",
                            month: "short"
                          }).format(new Date(bill.dueDate + "T00:00:00"));

                          return (
                            <Card key={`${bill.cardId}-${bill.billMonth}`} withBorder p="xs" radius="sm">
                              <Group justify="space-between" wrap="nowrap">
                                <Box>
                                  <Text size="sm" fw={700}>{bill.cardName}</Text>
                                  <Text size="xs" c="dimmed">Vence em: {formattedDueDate}</Text>
                                </Box>
                                <Stack gap={2} align="flex-end">
                                  <Text size="sm" fw={700} c={isPaid ? "teal" : "red"}>
                                    {formatMoney(moneyFromCents(bill.amountCents))}
                                  </Text>
                                  <Badge color={isPaid ? "teal" : "blue"} size="xs" variant="light">
                                    {isPaid ? "Paga" : "Aberta"}
                                  </Badge>
                                </Stack>
                              </Group>

                              {limitCents > 0 && (
                                <Stack gap={4} mt="xs">
                                  <Progress value={pctUsed} color={pctUsed > 80 ? "red" : "blue"} size="xs" />
                                  <Group justify="space-between">
                                    <Text size="10px" c="dimmed">Limite utilizado: {Math.round(pctUsed)}%</Text>
                                    <Text size="10px" c="dimmed">Total: {formatMoney(moneyFromCents(limitCents))}</Text>
                                  </Group>
                                </Stack>
                              )}
                            </Card>
                          );
                        })}
                      </Stack>
                    )}
                  </Box>
                </Stack>
              </Paper>
            </Grid.Col>

            {/* Payment Methods Participation */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper withBorder p="md" radius="md" h="100%">
                <Stack gap="xs" h="100%">
                  <Box style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <ThemeIcon variant="light" color="teal">
                      <IconScale size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={700}>Participação por Meio de Pagamento</Text>
                      <Text size="xs" c="dimmed">Proporção de gastos efetuados por meio de pagamento.</Text>
                    </div>
                  </Box>

                  <Box style={{ flexGrow: 1 }} mt="sm">
                    <PaymentMethodsParticipationChart
                      timeframe="monthly"
                      month={selectedMonth}
                      filterAccountId={filterAccountId}
                      filterCategoryId={filterCategoryId}
                    />
                  </Box>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Stack>
      ) : (
        /* =================== ANNUAL VIEW =================== */
        <Stack gap="lg">
          {/* Year Navigator Toolbar */}
          <Group justify="space-between" align="center">
            <Title order={3} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              Período Anual:{" "}
              <Badge size="lg" color="teal" variant="light">
                EXERCÍCIO {selectedYear}
              </Badge>
            </Title>
            <Group gap="xs">
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconChevronLeft size={16} />}
                onClick={() => handleNavigateYear(-1)}
              >
                Ano anterior
              </Button>
              <Button
                size="xs"
                variant="subtle"
                rightSection={<IconChevronRight size={16} />}
                onClick={() => handleNavigateYear(1)}
              >
                Próximo ano
              </Button>
            </Group>
          </Group>

          {/* Destaques cards */}
          <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="md">
            <Card withBorder padding="md" radius="md">
              <Stack gap="xs">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Média Mensal de Entradas</Text>
                <div>
                  <Text size="xl" fw={700} c="teal">
                    {formatMoney(moneyFromCents(Math.round(annualCalculations.avgIncome)))}
                  </Text>
                  <Text size="xs" c="dimmed">Total: {formatMoney(moneyFromCents(annualCalculations.totalIncome))}</Text>
                </div>
              </Stack>
            </Card>

            <Card withBorder padding="md" radius="md">
              <Stack gap="xs">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Média Mensal de Gastos</Text>
                <div>
                  <Text size="xl" fw={700} c="red">
                    {formatMoney(moneyFromCents(Math.round(annualCalculations.avgExpense)))}
                  </Text>
                  <Text size="xs" c="dimmed">Total: {formatMoney(moneyFromCents(annualCalculations.totalExpense))}</Text>
                </div>
              </Stack>
            </Card>

            <Card withBorder padding="md" radius="md">
              <Stack gap="xs">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Taxa de Poupança Anual</Text>
                <div>
                  <Text size="xl" fw={700} c={annualCalculations.savingsRate >= 0 ? "teal" : "red"}>
                    {annualCalculations.savingsRate.toFixed(1)}%
                  </Text>
                  <Text size="xs" c="dimmed">Percentual poupado da receita</Text>
                </div>
              </Stack>
            </Card>

            <Card withBorder padding="md" radius="md">
              <Stack gap="xs">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Saldo Líquido Anual</Text>
                <div>
                  <Text size="xl" fw={700} c={annualCalculations.totalIncome - annualCalculations.totalExpense >= 0 ? "teal" : "red"}>
                    {formatMoney(moneyFromCents(annualCalculations.totalIncome - annualCalculations.totalExpense))}
                  </Text>
                  <Text size="xs" c="dimmed">Diferença de caixa no ano</Text>
                </div>
              </Stack>
            </Card>
          </SimpleGrid>

          {/* Chart 1: Annual Column chart */}
          <Paper withBorder p="md" radius="md">
            <Stack gap="xs">
              <Box>
                <Text fw={700}>Evolução Anual de Receitas vs Despesas</Text>
                <Text size="xs" c="dimmed">Comparativo mensal entre entradas realizadas e saídas realizadas no ano.</Text>
              </Box>

              <Box h={320} mt="md">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={annualSummary} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={formatChartCurrency} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={formatTooltipCurrency}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid var(--mantine-color-gray-3)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="incomeCents" name="Receitas" fill="var(--mantine-color-teal-6)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenseCents" name="Despesas" fill="var(--mantine-color-red-6)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Stack>
          </Paper>

          {/* Section: Category breakdown + Payment Methods (Annual) */}
          <Grid gutter="md">
            {/* Chart 2: Annual Category Horizontal bar chart */}
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Paper withBorder p="md" radius="md" h="100%">
                <Stack gap="xs" h="100%">
                  <Box>
                    <Text fw={700}>
                      {filterCategoryId ? "Subcategorias de Despesas no Ano" : "Composição de Despesas no Ano por Categoria"}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {filterCategoryId
                        ? "Subcategorias mais expressivas no acumulado do ano."
                        : "Distribuição acumulada de gastos por centros de despesas no ano."}
                    </Text>
                  </Box>

                  <Box style={{ flexGrow: 1, minHeight: categoriesSpent.length === 0 ? 120 : categoriesSpent.length * 36 + 60 }} mt="md">
                    {categoriesSpent.length === 0 ? (
                      <Box p="xl" style={{ textAlign: "center" }}>
                        <Text c="dimmed" size="sm">Nenhuma despesa registrada para os filtros selecionados.</Text>
                      </Box>
                    ) : (
                      <ResponsiveContainer width="100%" height={categoriesSpent.length * 36 + 60}>
                        <BarChart
                          data={categoriesSpent}
                          layout="vertical"
                          margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tickFormatter={formatChartCurrency} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                          <YAxis
                            type="category"
                            dataKey="categoryName"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11 }}
                            width={130}
                          />
                          <Tooltip
                            formatter={formatTooltipCurrency}
                            contentStyle={{
                              borderRadius: "8px",
                              border: "1px solid var(--mantine-color-gray-3)",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                            }}
                          />
                          <Bar dataKey="amountCents" name="Total Gasto" fill="var(--mantine-color-red-6)" radius={[0, 4, 4, 0]} barSize={18}>
                            {categoriesSpent.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={`var(--mantine-color-red-${Math.min(9, Math.max(5, 9 - index))})`}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Box>
                </Stack>
              </Paper>
            </Grid.Col>

            {/* Chart 3: Annual Payment Methods Participation */}
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Paper withBorder p="md" radius="md" h="100%">
                <Stack gap="xs" h="100%">
                  <Box style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <ThemeIcon variant="light" color="teal">
                      <IconScale size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={700}>Participação por Meio de Pagamento no Ano</Text>
                      <Text size="xs" c="dimmed">Proporção acumulada de gastos efetuados por meio de pagamento no ano.</Text>
                    </div>
                  </Box>

                  <Box style={{ flexGrow: 1 }} mt="sm">
                    <PaymentMethodsParticipationChart
                      timeframe="annual"
                      year={selectedYear}
                      filterAccountId={filterAccountId}
                      filterCategoryId={filterCategoryId}
                    />
                  </Box>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Stack>
      )}
    </Stack>
  );
}

/* ======================================================================
   Monthly Category Chart Sub-component
   Fetches the tree data from '/controle-mensal' to render category sums
   for the selected month, reflecting any applied filters
   ====================================================================== */
interface ChartTreeNode {
  id: string;
  name: string;
  nature?: string;
  realized: number;
  committed: number;
  children?: ChartTreeNode[];
}

function findCategoryNode(nodes: ChartTreeNode[], name: string): ChartTreeNode | null {
  for (const node of nodes) {
    if (node.name.toLowerCase() === name.toLowerCase() && node.id.startsWith("cat-")) {
      return node;
    }
    if (node.children) {
      const found = findCategoryNode(node.children, name);
      if (found) return found;
    }
  }
  return null;
}

function findAllCategoryNodes(nodes: ChartTreeNode[]): ChartTreeNode[] {
  let list: ChartTreeNode[] = [];
  for (const node of nodes) {
    if (node.id.startsWith("cat-") && node.nature === "expense") {
      list.push(node);
    } else if (node.children) {
      list = list.concat(findAllCategoryNodes(node.children));
    }
  }
  return list;
}

function MonthlyCategoryChart({
  selectedMonth,
  filterAccountId,
  filterPaymentMethodId,
  filterCategoryId,
  filterCategoryName
}: {
  selectedMonth: string;
  filterAccountId: string;
  filterPaymentMethodId: string;
  filterCategoryId: string;
  filterCategoryName: string;
}) {
  const [data, setData] = useState<{ name: string; amountCents: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams({
          month: selectedMonth,
          groupBy: "category"
        });
        if (filterAccountId) queryParams.append("accountId", filterAccountId);
        if (filterPaymentMethodId) queryParams.append("paymentMethodId", filterPaymentMethodId);

        const res = await fetch(`${apiBaseUrl}/controle-mensal?${queryParams.toString()}`);
        if (!res.ok) throw new Error();
        const resData = await res.json();
        
        const tree: ChartTreeNode[] = resData.tree ?? [];
        
        if (filterCategoryId && filterCategoryName) {
          // Find that specific category in the tree using recursive deep search
          const targetNode = findCategoryNode(tree, filterCategoryName);
          if (targetNode && targetNode.children) {
            const list = targetNode.children.map((child) => ({
              name: child.name,
              amountCents: child.realized + child.committed
            }));
            setData(list.sort((a, b) => b.amountCents - a.amountCents));
          } else {
            setData([]);
          }
        } else {
          // If no category is selected, extract all macro-categories recursively
          const categoryNodes = findAllCategoryNodes(tree);
          if (categoryNodes.length > 0) {
            const list = categoryNodes.map((n) => ({
              name: n.name,
              amountCents: n.realized + n.committed
            }));
            setData(list.sort((a, b) => b.amountCents - a.amountCents));
          } else {
            setData([]);
          }
        }
      } catch (e) {
        console.error("Erro ao carregar despesas mensais por categoria:", e);
      } finally {
        setIsLoading(false);
      }
    }
    void loadData();
  }, [selectedMonth, filterAccountId, filterPaymentMethodId, filterCategoryId, filterCategoryName]);

  const formatChartCurrency = (value: number) => {
    return `R$ ${(value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatTooltipCurrency = (value: string | number | undefined | readonly (string | number)[]) => {
    const numericValue = typeof value === "number"
      ? value
      : Array.isArray(value)
        ? Number(value[0] || 0)
        : Number(value || 0);
    return formatMoney(moneyFromCents(numericValue));
  };


  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  if (data.length === 0) {
    return (
      <Box p="xl" style={{ textAlign: "center" }}>
        <Text c="dimmed" size="sm">Nenhum gasto registrado para esta composição.</Text>
      </Box>
    );
  }

  const totalSumCents = data.reduce((sum, item) => sum + item.amountCents, 0);

  const pieData = data.map((item) => ({
    name: item.name,
    value: item.amountCents,
    percentage: totalSumCents > 0 ? (item.amountCents / totalSumCents) * 100 : 0
  }));

  const getPieColor = (index: number) => {
    const colors = [
      "var(--mantine-color-red-6)",
      "var(--mantine-color-orange-5)",
      "var(--mantine-color-pink-5)",
      "var(--mantine-color-grape-5)",
      "var(--mantine-color-violet-5)",
      "var(--mantine-color-red-4)",
      "var(--mantine-color-orange-4)",
      "var(--mantine-color-pink-4)"
    ];
    return colors[index % colors.length];
  };

  const formatTooltipPie = (value: string | number | undefined | readonly (string | number)[]) => {
    const numericValue = typeof value === "number"
      ? value
      : Array.isArray(value)
        ? Number(value[0] || 0)
        : Number(value || 0);
    const percentage = totalSumCents > 0 ? ((numericValue / totalSumCents) * 100).toFixed(1) : "0";
    return [`${formatMoney(moneyFromCents(numericValue))} (${percentage}%)`, "Gasto"];
  };

  return (
    <Box mt="md">
      <Grid gutter="xl" align="center">
        {/* Coluna 1: Gráfico de Barras Horizontais */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Box style={{ minHeight: 250 }}>
            <ResponsiveContainer width="100%" height={Math.max(250, data.length * 36 + 40)}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={formatChartCurrency} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  width={120}
                />
                <Tooltip
                  formatter={formatTooltipCurrency}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid var(--mantine-color-gray-3)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                  }}
                />
                <Bar dataKey="amountCents" name="Total Gasto" fill="var(--mantine-color-red-6)" radius={[0, 4, 4, 0]} barSize={18}>
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`var(--mantine-color-red-${Math.min(9, Math.max(5, 9 - index))})`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Grid.Col>

        {/* Coluna 2: Gráfico de Rosca (Donut) */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="xs" align="center">
            <Box style={{ width: "100%", height: 200, position: "relative" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getPieColor(index)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatTooltipPie} />
                </PieChart>
              </ResponsiveContainer>
              
              <div style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
                pointerEvents: "none"
              }}>
                <Text size="10px" c="dimmed" style={{ textTransform: "uppercase" }}>Total</Text>
                <Text fw={700} size="sm" c="red.7">
                  {formatMoney(moneyFromCents(totalSumCents))}
                </Text>
              </div>
            </Box>

            {/* Custom percentage legend */}
            <SimpleGrid cols={2} spacing={8} style={{ width: "100%" }}>
              {pieData.slice(0, 6).map((item, index) => (
                <Group key={index} gap={6} wrap="nowrap">
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: getPieColor(index),
                    flexShrink: 0
                  }} />
                  <Text size="xs" truncate style={{ flexGrow: 1 }}>
                    {item.name}
                  </Text>
                  <Text size="xs" fw={600} c="dimmed" style={{ flexShrink: 0 }}>
                    {item.percentage.toFixed(0)}%
                  </Text>
                </Group>
              ))}
              {pieData.length > 6 && (
                <Text size="xs" c="dimmed" style={{ gridColumn: "span 2", textAlign: "center" }}>
                  + {pieData.length - 6} categorias adicionais
                </Text>
              )}
            </SimpleGrid>
          </Stack>
        </Grid.Col>
      </Grid>
    </Box>
  );
}

/* ======================================================================
   Payment Methods Participation Chart Sub-component
   Fetches data from '/reports/payment-methods-participation'
   ====================================================================== */
function PaymentMethodsParticipationChart({
  month,
  year,
  timeframe,
  filterAccountId,
  filterCategoryId
}: {
  month?: string;
  year?: string;
  timeframe: "monthly" | "annual";
  filterAccountId: string;
  filterCategoryId: string;
}) {
  const [data, setData] = useState<{ paymentMethodId: string; paymentMethodName: string; amountCents: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (timeframe === "monthly" && month) {
          queryParams.append("month", month);
        } else if (timeframe === "annual" && year) {
          queryParams.append("year", year);
        }
        if (filterAccountId) queryParams.append("accountId", filterAccountId);
        if (filterCategoryId) queryParams.append("categoryId", filterCategoryId);

        const res = await fetch(`${apiBaseUrl}/reports/payment-methods-participation?${queryParams.toString()}`);
        if (!res.ok) throw new Error();
        setData(await res.json());
      } catch (e) {
        console.error("Erro ao carregar participação por meios de pagamento:", e);
      } finally {
        setIsLoading(false);
      }
    }
    void loadData();
  }, [month, year, timeframe, filterAccountId, filterCategoryId]);

  const totalSumCents = data.reduce((sum, item) => sum + item.amountCents, 0);

  const pieData = data.map((item) => ({
    name: item.paymentMethodName,
    value: item.amountCents,
    percentage: totalSumCents > 0 ? (item.amountCents / totalSumCents) * 100 : 0
  }));

  const getPieColor = (index: number) => {
    const colors = [
      "var(--mantine-color-teal-6)",
      "var(--mantine-color-blue-5)",
      "var(--mantine-color-indigo-5)",
      "var(--mantine-color-cyan-5)",
      "var(--mantine-color-violet-5)",
      "var(--mantine-color-grape-5)"
    ];
    return colors[index % colors.length];
  };

  const formatTooltipPie = (value: string | number | undefined | readonly (string | number)[]) => {
    const numericValue = typeof value === "number"
      ? value
      : Array.isArray(value)
        ? Number(value[0] || 0)
        : Number(value || 0);
    const percentage = totalSumCents > 0 ? ((numericValue / totalSumCents) * 100).toFixed(1) : "0";
    return [`${formatMoney(moneyFromCents(numericValue))} (${percentage}%)`, "Gasto"];
  };

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  if (data.length === 0) {
    return (
      <Box p="xl" style={{ textAlign: "center" }}>
        <Text c="dimmed" size="sm">Nenhum gasto registrado para esta composição.</Text>
      </Box>
    );
  }

  return (
    <Stack gap="xs" align="center" style={{ width: "100%" }}>
      <Box style={{ width: "100%", height: 180, position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={65}
              paddingAngle={3}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getPieColor(index)} />
              ))}
            </Pie>
            <Tooltip formatter={formatTooltipPie} />
          </PieChart>
        </ResponsiveContainer>
        
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          pointerEvents: "none"
        }}>
          <Text size="10px" c="dimmed" style={{ textTransform: "uppercase" }}>Total</Text>
          <Text fw={700} size="xs" c="teal.7">
            {formatMoney(moneyFromCents(totalSumCents))}
          </Text>
        </div>
      </Box>

      <SimpleGrid cols={2} spacing="xs" style={{ width: "100%" }} mt="xs">
        {pieData.slice(0, 6).map((item, index) => (
          <Group key={index} gap={6} wrap="nowrap">
            <div style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: getPieColor(index),
              flexShrink: 0
            }} />
            <Text size="xs" truncate style={{ flexGrow: 1 }}>
              {item.name}
            </Text>
            <Text size="xs" fw={600} c="dimmed" style={{ flexShrink: 0 }}>
              {item.percentage.toFixed(0)}%
            </Text>
          </Group>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

