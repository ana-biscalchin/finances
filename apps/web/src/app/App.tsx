import {
  ActionIcon,
  AppShell,
  Box,
  Group,
  NavLink,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip
} from "@mantine/core";
import {
  IconBuildingBank,
  IconCalendarStats,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconCreditCard,
  IconListDetails,
  IconPigMoney,
  IconSettings,
  IconTags
} from "@tabler/icons-react";
import { useState } from "react";

import { AccountsPage } from "./accounts/AccountsPage";
import { BillsPage } from "./cards/BillsPage";
import { CategoriesPage } from "./categories/CategoriesPage";
import { TransactionsPage } from "./transactions/TransactionsPage";
import { MonthlyOverviewPage } from "./monthly-control/MonthlyOverviewPage";
import { AccountsCashView } from "./monthly-control/AccountsCashView";
import { RecurrencesPage } from "./recurrences/RecurrencesPage";
import { ReportsPage } from "./reports/ReportsPage";
import { SettingsPage } from "./settings/SettingsPage";


type PageKey =
  | "monthly-control"
  | "cash-position"
  | "recurrences"
  | "patrimony"
  | "transactions"
  | "bills"
  | "accounts"
  | "categories"
  | "reserves"
  | "reports"
  | "settings";

export const pages: Array<{
  key: PageKey;
  label: string;
  description: string;
  icon: typeof IconCalendarStats;
}> = [
  {
    key: "monthly-control",
    label: "Visão do mês",
    description: "O que entrou, o que foi gasto e quanto ainda pode ser usado.",
    icon: IconCalendarStats
  },
  { key: "cash-position", label: "Dinheiro nas contas", description: "Saldos, pagamentos e risco de ficar negativo.", icon: IconBuildingBank },
  { key: "recurrences", label: "Recorrências", description: "Previsões mensais em conta e cartão.", icon: IconCalendarStats },
  { key: "patrimony", label: "Patrimônio · futuro", description: "Ativos, dívidas, reservas e evolução — módulo futuro.", icon: IconPigMoney },
  {
    key: "transactions",
    label: "Lançamentos",
    description: "Receitas, despesas, ajustes e histórico financeiro.",
    icon: IconListDetails
  },
  {
    key: "bills",
    label: "Faturas",
    description: "Compras, parcelas e vencimentos dos cartões.",
    icon: IconCreditCard
  },
  {
    key: "accounts",
    label: "Contas",
    description: "Contas, carteiras, benefícios e cartões de crédito.",
    icon: IconBuildingBank
  },
  {
    key: "categories",
    label: "Categorias",
    description: "Categorias e subcategorias gerenciáveis.",
    icon: IconTags
  },
  {
    key: "reserves",
    label: "Reservas",
    description: "Caixinhas, objetivos, aportes, resgates e rendimentos.",
    icon: IconPigMoney
  },
  {
    key: "reports",
    label: "Relatórios",
    description: "Gráficos explicativos sobre gastos, faturas e reservas.",
    icon: IconChartBar
  },
  {
    key: "settings",
    label: "Configurações",
    description: "Preferências, backups, importação e exportação.",
    icon: IconSettings
  }
];

const SIDEBAR_COLLAPSED_STORAGE_KEY = "layout-sidebar-collapsed";
const HEADER_HEIGHT = 44;
const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 56;

export function App() {
  const [activePage, setActivePage] = useState<PageKey>("monthly-control");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  });
  const currentPage = pages.find((page) => page.key === activePage) ?? pages[0];
  const CurrentIcon = currentPage.icon;
  const isAccountsPage = activePage === "accounts";
  const isBillsPage = activePage === "bills";
  const isCategoriesPage = activePage === "categories";
  const isTransactionsPage = activePage === "transactions";
  const isMonthlyControlPage = activePage === "monthly-control";
  const isReportsPage = activePage === "reports";

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const currentYear = today.slice(0, 4);

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [filterAccountId, setFilterAccountId] = useState<string>("");
  const [filterPaymentMethodId, setFilterPaymentMethodId] = useState<string>("");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("");

  const toggleSidebar = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <AppShell
      header={{ height: HEADER_HEIGHT }}
      navbar={{ width: isSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH, breakpoint: 0 }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>Carteira da Ana</Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p={0}>
        <Box
          h={`calc(100dvh - ${HEADER_HEIGHT}px)`}
          style={{
            position: "relative",
            width: "100%"
          }}
        >
          <Tooltip label={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"} position="right">
            <ActionIcon
              aria-label={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
              size={28}
              variant="subtle"
              onClick={toggleSidebar}
              style={{
                backgroundColor: "var(--mantine-color-body)",
                position: "absolute",
                right: -14,
                top: 16,
                zIndex: 2
              }}
            >
              {isSidebarCollapsed ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
            </ActionIcon>
          </Tooltip>
          <Box
            h="100%"
            p={isSidebarCollapsed ? 6 : "md"}
            style={{ boxSizing: "border-box", overflowX: "hidden", overflowY: "auto" }}
          >
            <Stack gap={isSidebarCollapsed ? 2 : 4} align={isSidebarCollapsed ? "center" : "stretch"}>
              {pages.map((page) => {
                const Icon = page.icon;

                return isSidebarCollapsed ? (
                  <Tooltip key={page.key} label={page.label} position="right">
                    <ActionIcon
                      aria-label={page.label}
                      color={page.key === activePage ? "teal" : "gray"}
                      size={36}
                      variant={page.key === activePage ? "light" : "subtle"}
                      onClick={() => setActivePage(page.key)}
                    >
                      <Icon size={18} />
                    </ActionIcon>
                  </Tooltip>
                ) : (
                  <NavLink
                    key={page.key}
                    active={page.key === activePage}
                    label={page.label}
                    leftSection={<Icon size={18} />}
                    onClick={() => setActivePage(page.key)}
                  />
                );
              })}
            </Stack>
          </Box>
        </Box>
      </AppShell.Navbar>

      <AppShell.Main>
        {isAccountsPage ? (
          <AccountsPage />
        ) : isBillsPage ? (
          <BillsPage />
        ) : isCategoriesPage ? (
          <CategoriesPage />
        ) : isTransactionsPage ? (
          <TransactionsPage />
        ) : isMonthlyControlPage ? (
          <MonthlyOverviewPage selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />
        ) : activePage === "cash-position" ? (
          <AccountsCashView selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />
        ) : activePage === "recurrences" ? (
          <RecurrencesPage selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />
        ) : isReportsPage ? (
          <ReportsPage
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            filterAccountId={filterAccountId}
            setFilterAccountId={setFilterAccountId}
            filterPaymentMethodId={filterPaymentMethodId}
            setFilterPaymentMethodId={setFilterPaymentMethodId}
            filterCategoryId={filterCategoryId}
            setFilterCategoryId={setFilterCategoryId}
          />
        ) : activePage === "settings" ? (
          <SettingsPage />
        ) : (
          <Paper withBorder p="xl" radius="md">
            <Group align="flex-start" gap="md">
              <ThemeIcon size={44} radius="md" variant="light" color="teal">
                <CurrentIcon size={24} />
              </ThemeIcon>
              <Box>
                <Title order={2}>{currentPage.label}</Title>
                <Text c="dimmed" mt={6}>
                  {currentPage.description}
                </Text>
              </Box>
            </Group>
          </Paper>
        )}
      </AppShell.Main>

    </AppShell>
  );
}
