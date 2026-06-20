/**
 * Utilitários compartilhados de UI para lançamentos financeiros.
 * Usados em TransactionsPage e BillsPage — não duplicar.
 */
import { Badge, Text } from "@mantine/core";
import { getCategoryColor } from "@finances/domain";

/** Tipo mínimo de categoria compartilhado entre as páginas. */
export type SharedCategory = {
  id: string;
  nature: string;
  name: string;
  subcategories: Array<{ id: string; name: string }>;
};

/**
 * Monta as opções agrupadas de categoria para uso em <Select>.
 * @param categories - lista de categorias
 * @param filterNatures - se fornecido, filtra só as categorias com essa natureza
 */
export function buildCategoryGroups(
  categories: SharedCategory[],
  filterNatures?: string[]
) {
  let filtered = categories;
  if (filterNatures && filterNatures.length > 0) {
    filtered = categories.filter((c) => filterNatures.includes(c.nature));
  }

  return filtered
    .map((category) => ({
      group: category.name,
      items: category.subcategories.map(
        (sub) =>
          ({
            value: sub.id,
            label: sub.name,
            color: getCategoryColor(category.id)
          }) as unknown as { value: string; label: string; color: string }
      )
    }))
    .filter((g) => g.items.length > 0);
}

/**
 * Renderiza a opção de categoria para o renderOption do <Select> do Mantine.
 * Use: `renderOption={renderCategoryOption}`
 */
export function renderCategoryOption({ option }: { option: { label: string } }) {
  const text = option.label;
  const itemColor = (option as { color?: unknown }).color;

  if (typeof itemColor === "string") {
    return (
      <Badge variant="light" color={itemColor} size="md" fw={600} style={{ textTransform: "none" }}>
        {text}
      </Badge>
    );
  }

  return <Text size="sm">{text}</Text>;
}

/** Badge colorido para o status de um lançamento. */
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

/** Cor Mantine para o tipo de lançamento (income/expense/refund). */
export function getAmountColor(type: string): string {
  if (type === "expense") return "red";
  if (type === "income" || type === "refund" || type === "chargeback") return "teal";
  return "gray";
}

/**
 * Extrai a mensagem de erro de uma Response da API.
 * Retorna o fallback se não conseguir parsear.
 */
export async function getResponseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string") {
      return body.message;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

/** Gera opções de mês no formato { value: "YYYY-MM", label: "jan 25" }
 *  @param offset - deslocamento a partir do mês atual (negativo = passado, positivo = futuro)
 *  @param count - quantidade de meses a gerar a partir do offset
 */
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
