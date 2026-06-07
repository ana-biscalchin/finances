export const categoryNatures = [
  { value: "income", label: "Receita" },
  { value: "expense", label: "Despesa" },
  { value: "reserve", label: "Reserva" },
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
