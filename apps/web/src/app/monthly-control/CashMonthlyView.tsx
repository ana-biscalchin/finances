import {
  Alert,
  Badge,
  Box,
  Card,
  Collapse,
  Group,
  HoverCard,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconChevronDown,
  IconChevronUp,
  IconCreditCard,
  IconInfoCircle,
  IconTrendingDown,
  IconTrendingUp,
  IconWallet,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { formatMoney, moneyFromCents } from "@finances/domain";

import { formatBusinessDateForDisplay } from "../date-format";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

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

interface CashSummary {
  openingBalance: number;
  realizedInflow: number;
  realizedOutflow: number;
  realizedBalance: number;
  projectedBalance: number;
}

interface BillCommitment {
  billId: string;
  cardId: string;
  cardName: string;
  billMonth: string;
  dueDate: string;
  status: string;
  totalCents: number;
}

interface CashData {
  view: "cash";
  cashSummary: CashSummary;
  accountSummaries: AccountMonthlySummary[];
  billCommitments: BillCommitment[];
  budgetSimulation?: {
    cashSummary: CashSummary & { simulatedProjectedBalance: number };
    accountSummaries: (AccountMonthlySummary & {
      simulatedOutflow: number;
      simulatedInflow: number;
      simulatedProjectedBalance: number;
    })[];
    simulatedCardBills: {
      cardId: string;
      cardName: string;
      billMonth: string;
      currentOpenBillCents: number;
      simulatedRemainingBudgetCents: number;
      projectedTotalBillCents: number;
    }[];
  };
}

function getBillStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case "paid": return { label: "Paga", color: "teal" };
    case "open": return { label: "Aberta", color: "blue" };
    default: return { label: status, color: "gray" };
  }
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

function formatMonthName(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
}

interface CashMonthlyViewProps {
  selectedMonth: string;
}

export function CashMonthlyView({ selectedMonth }: CashMonthlyViewProps) {
  const [data, setData] = useState<CashData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [useBudgetSimulation, setUseBudgetSimulation] = useState(() => {
    return localStorage.getItem("controle-mensal-use-budget-simulation") === "true";
  });

  const [summaryCollapsed, setSummaryCollapsed] = useState(() => {
    return localStorage.getItem("controle-mensal-cash-summary-collapsed") === "true";
  });
  const [balancesCollapsed, setBalancesCollapsed] = useState(() => {
    return localStorage.getItem("controle-mensal-cash-balances-collapsed") === "true";
  });

  const handleToggleSimulation = (val: boolean) => {
    setUseBudgetSimulation(val);
    localStorage.setItem("controle-mensal-use-budget-simulation", String(val));
  };

  const handleToggleSummary = () => {
    setSummaryCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("controle-mensal-cash-summary-collapsed", String(next));
      return next;
    });
  };

  const handleToggleBalances = () => {
    setBalancesCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("controle-mensal-cash-balances-collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`${apiBaseUrl}/controle-mensal?month=${selectedMonth}&view=cash`)
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao carregar visão de caixa.");
        return res.json() as Promise<CashData>;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setIsLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erro inesperado.");
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [selectedMonth]);

  if (isLoading) {
    return (
      <Group justify="center" p="xl">
        <Loader />
      </Group>
    );
  }

  if (error || !data) {
    return (
      <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} title="Erro">
        {error ?? "Dados não disponíveis."}
      </Alert>
    );
  }

  const { cashSummary, accountSummaries, billCommitments, budgetSimulation } = data;
  const pendingBills = billCommitments.filter((b) => b.status !== "paid");
  const totalPendingBills = pendingBills.reduce((s, b) => s + b.totalCents, 0);

  const activeCashSummary = useBudgetSimulation && budgetSimulation
    ? budgetSimulation.cashSummary
    : { ...cashSummary, simulatedProjectedBalance: cashSummary.projectedBalance };
  const projectedBillMonthLabel = budgetSimulation?.simulatedCardBills[0]?.billMonth
    ? formatMonthName(budgetSimulation.simulatedCardBills[0].billMonth)
    : "próximo mês";

  return (
    <Stack gap="lg">
      {/* Simulador de Caixa */}
      <Paper withBorder radius="md" p="md" style={{ backgroundColor: "var(--mantine-color-blue-0)", borderColor: "var(--mantine-color-blue-2)" }}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={700} size="sm" c="blue.9">
              Simulador de Saldo por Orçamentos
            </Text>
            <Text size="xs" c="blue.8">
              Projete o saldo final das contas e a fatura dos cartões considerando os limites de orçamento restantes (o que ainda não foi gasto no mês).
            </Text>
          </Stack>
          <Switch
            label="Simular Orçamentos"
            checked={useBudgetSimulation}
            onChange={(event) => handleToggleSimulation(event.currentTarget.checked)}
            color="blue"
            size="md"
          />
        </Group>
      </Paper>

      {/* Alerta de Saldo Negativo Proativo */}
      {useBudgetSimulation && budgetSimulation && (() => {
        const negativeAccounts = budgetSimulation.accountSummaries.filter(
          (acc) => acc.simulatedProjectedBalance < 0
        );
        if (negativeAccounts.length > 0) {
          return (
            <Alert
              color="red"
              variant="filled"
              icon={<IconAlertCircle size={18} />}
              title="Alerta: Projeção de Saldo Negativo"
              radius="md"
            >
              Com base nos limites de orçamento definidos, as seguintes contas correntes podem terminar o mês no vermelho:{" "}
              <strong>
                {negativeAccounts.map((a) => `${a.name} (${formatMoney(moneyFromCents(a.simulatedProjectedBalance))})`).join(", ")}
              </strong>
              . Recomendamos readequar seus orçamentos ou transferir parte dos limites para o Cartão de Crédito.
            </Alert>
          );
        }
        return null;
      })()}

      {/* Resumo consolidado */}
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
            <Text fw={700}>Resumo de caixa</Text>
            <Text size="xs" c="dimmed">
              Consolidado de entradas, saídas e projeção de saldo no mês.
            </Text>
          </div>
          <Group gap="xs">
            {summaryCollapsed ? <IconChevronDown size={20} /> : <IconChevronUp size={20} />}
          </Group>
        </Group>
        <Collapse in={!summaryCollapsed}>
          <Box p="md">
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
              <Card withBorder padding="md" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed" fw={700} tt="uppercase">Saldo inicial</Text>
                    <ThemeIcon variant="light" color="gray" size="sm">
                      <IconWallet size={14} />
                    </ThemeIcon>
                  </Group>
                  <Text size="xl" fw={700} c={cashSummary.openingBalance >= 0 ? "teal" : "red"}>
                    {formatMoney(moneyFromCents(cashSummary.openingBalance))}
                  </Text>
                  <Text size="xs" c="dimmed">Saldo acumulado até o início do mês</Text>
                </Stack>
              </Card>

              <Card withBorder padding="md" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed" fw={700} tt="uppercase">Entradas reais</Text>
                    <ThemeIcon variant="light" color="teal" size="sm">
                      <IconTrendingUp size={14} />
                    </ThemeIcon>
                  </Group>
                  <Text size="xl" fw={700} c="teal">
                    {formatMoney(moneyFromCents(cashSummary.realizedInflow))}
                  </Text>
                </Stack>
              </Card>

              <Card withBorder padding="md" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed" fw={700} tt="uppercase">Saídas reais</Text>
                    <ThemeIcon variant="light" color="red" size="sm">
                      <IconTrendingDown size={14} />
                    </ThemeIcon>
                  </Group>
                  <Text size="xl" fw={700} c="red">
                    {formatMoney(moneyFromCents(cashSummary.realizedOutflow))}
                  </Text>
                </Stack>
              </Card>

              <Card withBorder padding="md" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed" fw={700} tt="uppercase">Saldo projetado</Text>
                    <Badge
                      color={activeCashSummary.simulatedProjectedBalance >= 0 ? "teal" : "red"}
                      variant="light"
                      size="sm"
                    >
                      {activeCashSummary.simulatedProjectedBalance >= 0 ? "Positivo" : "Negativo"}
                    </Badge>
                  </Group>
                  <Text size="xl" fw={700} c={activeCashSummary.simulatedProjectedBalance >= 0 ? "teal" : "red"}>
                    {formatMoney(moneyFromCents(activeCashSummary.simulatedProjectedBalance))}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {useBudgetSimulation ? "Simulado por orçamento" : `Projetado real: ${formatMoney(moneyFromCents(cashSummary.projectedBalance))}`}
                  </Text>
                </Stack>
              </Card>
            </SimpleGrid>
          </Box>
        </Collapse>
      </Paper>

      {/* Detalhe por conta */}
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
            <Text fw={700}>Fluxo por conta</Text>
            <Text size="xs" c="dimmed">Entradas e saídas reais por conta bancária no mês.</Text>
          </div>
          <Group gap="xs">
            <Badge color={activeCashSummary.simulatedProjectedBalance >= 0 ? "teal" : "red"} variant="light">
              Projetado: {formatMoney(moneyFromCents(activeCashSummary.simulatedProjectedBalance))}
            </Badge>
            {balancesCollapsed ? <IconChevronDown size={20} /> : <IconChevronUp size={20} />}
          </Group>
        </Group>

        <Collapse in={!balancesCollapsed}>
          {accountSummaries.length === 0 ? (
            <Box p="xl" style={{ textAlign: "center" }}>
              <Text c="dimmed">Nenhuma conta com movimentação neste mês.</Text>
            </Box>
          ) : (
            <Table.ScrollContainer minWidth={800}>
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Conta</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Saldo inicial</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Entradas</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Saídas</Table.Th>
                    {useBudgetSimulation && <Table.Th style={{ textAlign: "right" }}>Orç. Pendente</Table.Th>}
                    <Table.Th style={{ textAlign: "right" }}>Saldo realizado</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Projetado</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {accountSummaries.map((account) => {
                    
                    const simAcc = useBudgetSimulation && budgetSimulation
                      ? budgetSimulation.accountSummaries.find(a => a.id === account.id)
                      : null;

                    // simulatedOutflow = budget still unspent that will leave this account
                    const pendingBudgetOutflow = simAcc ? simAcc.simulatedOutflow : 0;
                    const pendingBudgetInflow  = simAcc ? simAcc.simulatedInflow  : 0;

                    const projectedVal = simAcc 
                      ? simAcc.simulatedProjectedBalance 
                      : account.projectedBalance;

                    return (
                      <Table.Tr key={account.id}>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap" align="flex-start">
                            <ThemeIcon
                              variant="light"
                              color={projectedVal >= 0 ? "teal" : "red"}
                              size="sm"
                              mt={3}
                            >
                              <IconWallet size={14} />
                            </ThemeIcon>
                            <div>
                              <Text fw={600} size="sm">{account.name}</Text>
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
                        {useBudgetSimulation && (
                          <Table.Td style={{ textAlign: "right" }}>
                            {pendingBudgetOutflow === 0 && pendingBudgetInflow === 0 ? (
                              <Text size="sm" c="dimmed">—</Text>
                            ) : (
                              <Stack gap={2} align="flex-end">
                                {pendingBudgetOutflow > 0 && (
                                  <Text size="sm" fw={600} c="orange">
                                    -{formatMoney(moneyFromCents(pendingBudgetOutflow))}
                                  </Text>
                                )}
                                {pendingBudgetInflow > 0 && (
                                  <Text size="xs" c="teal">
                                    +{formatMoney(moneyFromCents(pendingBudgetInflow))}
                                  </Text>
                                )}
                              </Stack>
                            )}
                          </Table.Td>
                        )}
                        <Table.Td style={{ textAlign: "right" }}>
                          <Text size="sm" fw={600} c={account.realizedBalance >= 0 ? "teal" : "red"}>
                            {formatMoney(moneyFromCents(account.realizedBalance))}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <HoverCard width={320} shadow="md" withArrow openDelay={100} position="left">
                            <HoverCard.Target>
                              <Group gap={4} justify="flex-end" style={{ cursor: "help", display: "inline-flex" }} wrap="nowrap">
                                <Text size="sm" fw={700} c={projectedVal >= 0 ? "teal" : "red"}>
                                  {formatMoney(moneyFromCents(projectedVal))}
                                </Text>
                                <IconInfoCircle size={14} style={{ opacity: 0.6 }} />
                                {projectedVal < 0 && (
                                  <IconAlertTriangle size={14} color="var(--mantine-color-red-6)" />
                                )}
                              </Group>
                            </HoverCard.Target>
                            <HoverCard.Dropdown p="sm">
                              <Stack gap="xs" style={{ textAlign: "left" }}>
                                <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                                  Detalhamento da Projeção {useBudgetSimulation ? "(Simulada)" : ""}
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

                                {useBudgetSimulation && pendingBudgetInflow > 0 && (
                                  <Group justify="space-between" wrap="nowrap">
                                    <Text size="xs">(+) Receitas orçadas pendentes:</Text>
                                    <Text size="xs" fw={600} c="teal">
                                      +{formatMoney(moneyFromCents(pendingBudgetInflow))}
                                    </Text>
                                  </Group>
                                )}

                                {useBudgetSimulation && pendingBudgetOutflow > 0 && (
                                  <Group justify="space-between" wrap="nowrap">
                                    <Text size="xs">(-) Despesas orçadas pendentes:</Text>
                                    <Text size="xs" fw={600} c="red">
                                      -{formatMoney(moneyFromCents(pendingBudgetOutflow))}
                                    </Text>
                                  </Group>
                                )}

                                <Group justify="space-between" wrap="nowrap" pt="xs" style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}>
                                  <Text size="xs" fw={700}>Saldo projetado final:</Text>
                                  <Text size="xs" fw={700} c={projectedVal >= 0 ? "teal" : "red"}>
                                    {formatMoney(moneyFromCents(projectedVal))}
                                  </Text>
                                </Group>

                                {projectedVal < 0 && (
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
          )}
        </Collapse>
      </Paper>

      {/* Faturas com vencimento no mês */}
      <Paper withBorder radius="md">
        <Group
          justify="space-between"
          align="center"
          px="md"
          py="xs"
          style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}
        >
          <div>
            <Text fw={700}>Faturas com vencimento no mês</Text>
            <Text size="xs" c="dimmed">
              Compromissos de caixa com cartões de crédito.
            </Text>
          </div>
          {totalPendingBills > 0 && (
            <Badge color="orange" variant="light">
              Pendente: {formatMoney(moneyFromCents(totalPendingBills))}
            </Badge>
          )}
        </Group>

        {billCommitments.length === 0 ? (
          <Box p="xl" style={{ textAlign: "center" }}>
            <Text c="dimmed">Nenhuma fatura com vencimento neste mês.</Text>
          </Box>
        ) : (
          <Table.ScrollContainer minWidth={600}>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Cartão</Table.Th>
                  <Table.Th>Mês da fatura</Table.Th>
                  <Table.Th>Vencimento</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {billCommitments.map((bill) => {
                  const { label, color } = getBillStatusLabel(bill.status);
                  return (
                    <Table.Tr key={bill.billId}>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <ThemeIcon variant="light" color="grape" size="sm">
                            <IconCreditCard size={14} />
                          </ThemeIcon>
                          <Text size="sm" fw={600}>{bill.cardName}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{bill.billMonth}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatBusinessDateForDisplay(bill.dueDate)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={color} variant="light" size="sm">{label}</Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "right" }}>
                        <Text
                          size="sm"
                          fw={700}
                          c={bill.status === "paid" ? "teal" : "orange"}
                        >
                          {formatMoney(moneyFromCents(bill.totalCents))}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      {/* Projeção de Faturas Futuras (Simulador) */}
      {useBudgetSimulation && budgetSimulation && budgetSimulation.simulatedCardBills && (
        <Paper withBorder radius="md">
          <Group
            justify="space-between"
            align="center"
            px="md"
            py="xs"
            style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}
          >
            <div>
              <Text fw={700}>Projeção de faturas de {projectedBillMonthLabel}</Text>
              <Text size="xs" c="dimmed">
                Estimativa da próxima fatura considerando compras já lançadas nesse mês de fatura e limites de orçamento restantes no cartão.
              </Text>
            </div>
          </Group>
          <Table.ScrollContainer minWidth={600}>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Cartão</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Já lançado na fatura</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Orçamento Mapeado Restante</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Total Projetado da Fatura</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {budgetSimulation.simulatedCardBills.map((bill) => (
                  <Table.Tr key={bill.cardId}>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <ThemeIcon variant="light" color="grape" size="sm">
                          <IconCreditCard size={14} />
                        </ThemeIcon>
                        <Text size="sm" fw={600}>{bill.cardName}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Text size="sm">{formatMoney(moneyFromCents(bill.currentOpenBillCents))}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Text size="sm" c="orange">
                        + {formatMoney(moneyFromCents(bill.simulatedRemainingBudgetCents))}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Text size="sm" fw={700} c="orange">
                        {formatMoney(moneyFromCents(bill.projectedTotalBillCents))}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}
    </Stack>
  );
}
