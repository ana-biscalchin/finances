import { Box, Button, Group, Paper, Popover, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import { useState } from "react";

type MonthOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type MonthSelectorProps = {
  selectedMonth: string;
  onChange: (month: string) => void;
  title?: string;
  minMonth?: string | null;
};

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(new Date(year, month - 1, 1))
    .replace(".", "");
}

export function MonthSelector({
  selectedMonth,
  onChange,
  title,
  minMonth
}: MonthSelectorProps) {
  const [yearSelectorOpened, setYearSelectorOpened] = useState(false);

  const selectedYear = selectedMonth.slice(0, 4);
  const currentYear = Number(getCurrentMonth().slice(0, 4));
  const selectedYearNumber = Number(selectedYear);
  const oldestYear = minMonth ? Number(minMonth.slice(0, 4)) : Math.min(currentYear, selectedYearNumber);
  const endYear = Math.max(currentYear + 1, selectedYearNumber);

  const yearOptions = Array.from({ length: endYear - oldestYear + 1 }, (_, index) => {
    const year = String(oldestYear + index);
    return { value: year, label: year };
  });

  const monthOptions: MonthOption[] = Array.from({ length: 12 }, (_, index) => {
    const value = `${selectedYear}-${String(index + 1).padStart(2, "0")}`;
    return {
      value,
      label: formatMonthLabel(value),
      disabled: minMonth ? value < minMonth : false
    };
  });

  function handleSelectYear(year: string | null) {
    if (!year) return;

    const month = selectedMonth.slice(5, 7);
    const nextMonth = `${year}-${month}`;
    onChange(minMonth && nextMonth < minMonth ? minMonth : nextMonth);
    setYearSelectorOpened(false);
  }

  return (
    <Paper withBorder p="xs" radius="md">
      <Stack gap={6}>
        <Group justify="flex-start" align="center" gap="xs">
          {title ? <Text fw={700}>{title}</Text> : null}
          <Box
            onMouseEnter={() => setYearSelectorOpened(true)}
            onMouseLeave={() => setYearSelectorOpened(false)}
            style={{ display: "inline-block" }}
          >
            <Popover
              opened={yearSelectorOpened}
              onChange={setYearSelectorOpened}
              position="bottom"
              withArrow
              shadow="md"
              withinPortal={false}
            >
              <Popover.Target>
                <Button
                  variant="subtle"
                  size="compact-sm"
                  fw={800}
                  onClick={() => setYearSelectorOpened((opened) => !opened)}
                >
                  {selectedYear}
                </Button>
              </Popover.Target>
              <Popover.Dropdown p="xs">
                <Select
                  size="xs"
                  w={120}
                  aria-label="Ano de referência"
                  data={yearOptions}
                  value={selectedYear}
                  allowDeselect={false}
                  onChange={handleSelectYear}
                />
              </Popover.Dropdown>
            </Popover>
          </Box>
        </Group>
        <SimpleGrid cols={{ base: 3, xs: 4, sm: 6, md: 12 }} spacing="xs">
          {monthOptions.map((month) => (
            <Button
              key={month.value}
              fullWidth
              size="xs"
              variant={selectedMonth === month.value ? "filled" : "light"}
              disabled={month.disabled}
              onClick={() => onChange(month.value)}
            >
              {month.label}
            </Button>
          ))}
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}
