import {
  AppShell,
  Badge,
  Box,
  Group,
  NavLink,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title
} from "@mantine/core";
import {
  IconBuildingBank,
  IconCalendarStats,
  IconChartBar,
  IconCreditCard,
  IconLayoutDashboard,
  IconListDetails,
  IconPigMoney,
  IconSettings,
  IconTags
} from "@tabler/icons-react";
import { useState } from "react";

import { AccountsPage } from "./accounts/AccountsPage";

type PageKey =
  | "dashboard"
  | "monthly-control"
  | "transactions"
  | "bills"
  | "accounts"
  | "categories"
  | "reserves"
  | "reports"
  | "settings";

const pages: Array<{
  key: PageKey;
  label: string;
  description: string;
  icon: typeof IconLayoutDashboard;
}> = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Leitura rápida do mês, saldos e próximos vencimentos.",
    icon: IconLayoutDashboard
  },
  {
    key: "monthly-control",
    label: "Controle mensal",
    description: "Orçado, comprometido, realizado e disponível por mês.",
    icon: IconCalendarStats
  },
  {
    key: "transactions",
    label: "Lançamentos",
    description: "Receitas, despesas, ajustes e histórico financeiro.",
    icon: IconListDetails
  },
  {
    key: "bills",
    label: "Faturas",
    description: "Cartoes, compras, parcelas e vencimentos.",
    icon: IconCreditCard
  },
  {
    key: "accounts",
    label: "Contas",
    description: "Contas, carteiras e locais onde o dinheiro passa.",
    icon: IconBuildingBank
  },
  {
    key: "categories",
    label: "Categorias",
    description: "Grupos, macros e micros gerenciaveis.",
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

export function App() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const currentPage = pages.find((page) => page.key === activePage) ?? pages[0];
  const CurrentIcon = currentPage.icon;
  const isAccountsPage = activePage === "accounts";

  return (
    <AppShell header={{ height: 64 }} navbar={{ width: 280, breakpoint: "sm" }} padding="lg">
      <AppShell.Header>
        <Group h="100%" px="lg" justify="space-between">
          <Box>
            <Title order={3}>Financas Pessoais</Title>
            <Text size="sm" c="dimmed">
              Web app local em desenvolvimento
            </Text>
          </Box>
          <Badge variant="light" color="teal">
            MVP planning
          </Badge>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap={4}>
          {pages.map((page) => {
            const Icon = page.icon;

            return (
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
      </AppShell.Navbar>

      <AppShell.Main>
        {isAccountsPage ? (
          <AccountsPage />
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
