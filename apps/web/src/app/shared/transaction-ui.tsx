import { Badge, Text } from "@mantine/core";
import { getSubcategoryColor } from "@finances/domain";

export type SharedCategory = {
  id: string;
  nature: string;
  name: string;
  color?: string;
  subcategories: Array<{ id: string; name: string }>;
};

type CategoryOption = { value: string; label: string; color: string };

export function buildCategoryGroups(categories: SharedCategory[], filterNatures?: string[]) {
  let filtered = categories;
  if (filterNatures && filterNatures.length > 0) {
    filtered = categories.filter((c) => filterNatures.includes(c.nature));
  }

  return filtered
    .map((category) => ({
      group: category.name,
      items: category.subcategories.map<CategoryOption>((sub, index) => ({
        value: sub.id,
        label: sub.name,
        color: getSubcategoryColor(category.color ?? category.id, index)
      }))
    }))
    .filter((g) => g.items.length > 0);
}

export function formatCategoryPromptGroups(categories: SharedCategory[], filterNatures?: string[]) {
  const filtered =
    filterNatures && filterNatures.length > 0
      ? categories.filter((category) => filterNatures.includes(category.nature))
      : categories;

  return filtered
    .filter((category) => category.subcategories.length > 0)
    .map(
      (category) =>
        `   - ${category.name}: ${category.subcategories.map((sub) => sub.name).join(", ")}`
    )
    .join("\n");
}

export function renderCategoryOption({ option }: { option: { label: string; color?: string } }) {
  const text = option.label;
  const itemColor = option.color;

  if (typeof itemColor === "string") {
    return (
      <Badge variant="light" color={itemColor} size="md" fw={600} style={{ textTransform: "none" }}>
        {text}
      </Badge>
    );
  }

  return <Text size="sm">{text}</Text>;
}

export function renderStatusBadge(status: string) {
  const colors: Record<string, string> = {
    planned: "gray",
    confirmed: "blue",
    reconciled: "teal",
    canceled: "red"
  };
  const labels: Record<string, string> = {
    planned: "Previsto",
    confirmed: "Confirmado",
    reconciled: "Conciliado",
    canceled: "Cancelado"
  };

  return (
    <Badge color={colors[status] ?? "gray"} variant="light" size="sm">
      {labels[status] ?? status}
    </Badge>
  );
}

export function getAmountColor(type: string): string {
  if (type === "expense") return "red";
  if (type === "income" || type === "refund" || type === "chargeback") return "teal";
  return "gray";
}

export function getMonthOptions(offset = 0, count = 12) {
  const now = new Date();
  const options = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" })
      .format(d)
      .replace(".", "");
    options.push({ value, label });
  }
  return options;
}
