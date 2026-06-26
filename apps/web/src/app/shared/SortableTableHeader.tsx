import { Group, Table, Text, UnstyledButton } from "@mantine/core";
import { IconArrowsSort, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import type { CSSProperties } from "react";

type SortDirection = "asc" | "desc";

type SortableTableHeaderProps = {
  label: string;
  column: string;
  sortColumn: string;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
  style?: CSSProperties;
  align?: "left" | "right";
};

export function SortableTableHeader({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
  style,
  align = "left"
}: SortableTableHeaderProps) {
  const isActive = sortColumn === column;
  const Icon = isActive
    ? sortDirection === "asc"
      ? IconChevronUp
      : IconChevronDown
    : IconArrowsSort;

  return (
    <Table.Th style={style}>
      <UnstyledButton
        onClick={() => onSort(column)}
        style={{
          width: "100%",
          display: "block",
          color: isActive ? "var(--mantine-color-teal-7)" : "inherit"
        }}
      >
        <Group gap={4} justify={align === "right" ? "flex-end" : "flex-start"} wrap="nowrap">
          <Text size="sm" fw={700}>
            {label}
          </Text>
          <Icon size={14} stroke={1.8} />
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}
