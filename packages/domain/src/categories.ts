export const categoryNatures = [
  { value: "income", label: "Receita" },
  { value: "expense", label: "Despesa" },
  { value: "transfer", label: "Transferência" }
] as const;

export type CategoryNature = (typeof categoryNatures)[number]["value"];

export function isCategoryNature(value: string): value is CategoryNature {
  return categoryNatures.some((nature) => nature.value === value);
}

export function assertCategoryNature(value: string): CategoryNature {
  if (!isCategoryNature(value)) {
    throw new Error(`Natureza de categoria inválida: ${value}`);
  }

  return value;
}

export const categoryColors: Record<string, string> = {
  "cat-trabalho": "green",
  "cat-rendimentos": "teal",
  "cat-outras-receitas": "lime",
  "cat-transferencias": "gray",
  "cat-moradia": "blue",
  "cat-alimentacao": "orange",
  "cat-transporte": "yellow",
  "cat-saude": "red",
  "cat-lazer": "pink",
  "cat-gastos-shuri": "violet",
  "cat-educacao": "cyan",
  "cat-servicos": "grape",
  "cat-aportes": "indigo"
};

export function getCategoryColor(categoryId: string | null | undefined): string {
  if (!categoryId) return "gray";
  return categoryColors[categoryId] ?? "gray";
}
