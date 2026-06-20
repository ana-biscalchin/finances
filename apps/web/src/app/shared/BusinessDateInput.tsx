import {
  ActionIcon,
  Button,
  Group,
  Popover,
  SimpleGrid,
  Stack,
  Text,
  TextInput
} from "@mantine/core";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import {
  addMonthsToYearMonth,
  formatBusinessDateForDisplay,
  formatDayMonthInput,
  getMonthCalendarDays,
  parseFlexibleDateToIso
} from "../date-format";

type BusinessDateInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  referenceMonth: string;
  required?: boolean;
  disabled?: boolean;
};

const weekdays = ["D", "S", "T", "Q", "Q", "S", "S"];

function formatMonthTitle(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1)
  );
}

export function BusinessDateInput({
  label,
  value,
  onChange,
  referenceMonth,
  required,
  disabled
}: BusinessDateInputProps) {
  const [text, setText] = useState(() => formatBusinessDateForDisplay(value));
  const [opened, setOpened] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => value.slice(0, 7) || referenceMonth);

  useEffect(() => {
    setText(formatBusinessDateForDisplay(value));
    setCalendarMonth(value.slice(0, 7) || referenceMonth);
  }, [referenceMonth, value]);

  const calendarDays = useMemo(() => getMonthCalendarDays(calendarMonth), [calendarMonth]);

  function handleTextChange(nextValue: string) {
    const nextText = formatDayMonthInput(nextValue);
    const nextDate = parseFlexibleDateToIso(nextText, referenceMonth);

    setText(nextDate ? formatBusinessDateForDisplay(nextDate) : nextText);

    if (nextDate) {
      onChange(nextDate);
      setCalendarMonth(nextDate.slice(0, 7));
    }
  }

  function handleDateSelect(nextDate: string) {
    onChange(nextDate);
    setText(formatBusinessDateForDisplay(nextDate));
    setCalendarMonth(nextDate.slice(0, 7));
    setOpened(false);
  }

  return (
    <Group align="flex-end" gap="xs" wrap="nowrap">
      <TextInput
        label={label}
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        value={text}
        onChange={(event) => handleTextChange(event.currentTarget.value)}
        onBlur={() => setText(formatBusinessDateForDisplay(value))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            setOpened(true);
          }
        }}
        required={required}
        disabled={disabled}
        style={{ flex: 1 }}
      />
      <Popover
        opened={opened}
        onChange={setOpened}
        position="bottom-end"
        shadow="md"
        withArrow
        withinPortal
      >
        <Popover.Target>
          <ActionIcon
            size={36}
            variant="light"
            aria-label={`Escolher ${label.toLowerCase()}`}
            title={`Escolher ${label.toLowerCase()}`}
            disabled={disabled}
            onClick={() => setOpened((current) => !current)}
          >
            <IconCalendar size={18} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap="xs" w={280}>
            <Group justify="space-between" wrap="nowrap">
              <ActionIcon
                variant="subtle"
                aria-label="Mês anterior"
                onClick={() => setCalendarMonth((current) => addMonthsToYearMonth(current, -1))}
              >
                <IconChevronLeft size={18} />
              </ActionIcon>
              <Text fw={700} size="sm" tt="capitalize">
                {formatMonthTitle(calendarMonth)}
              </Text>
              <ActionIcon
                variant="subtle"
                aria-label="Próximo mês"
                onClick={() => setCalendarMonth((current) => addMonthsToYearMonth(current, 1))}
              >
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>

            <SimpleGrid cols={7} spacing={4}>
              {weekdays.map((weekday, index) => (
                <Text key={`${weekday}-${index}`} size="xs" ta="center" fw={700} c="dimmed">
                  {weekday}
                </Text>
              ))}
              {calendarDays.map((day) => (
                <Button
                  key={day.date}
                  size="compact-xs"
                  variant={day.date === value ? "filled" : "subtle"}
                  color={day.date === value ? "teal" : "gray"}
                  c={day.isCurrentMonth || day.date === value ? undefined : "dimmed"}
                  onClick={() => handleDateSelect(day.date)}
                  styles={{
                    root: {
                      aspectRatio: "1",
                      height: 32,
                      minHeight: 32,
                      padding: 0
                    }
                  }}
                >
                  {day.day}
                </Button>
              ))}
            </SimpleGrid>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
}
