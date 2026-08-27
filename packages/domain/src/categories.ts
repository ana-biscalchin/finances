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

/** Controlled category color palette exposed to API and UI consumers. */
export const categoryColorOptions = [
  { value: "blue", label: "Azul" },
  { value: "cyan", label: "Ciano" },
  { value: "teal", label: "Verde-azulado" },
  { value: "green", label: "Verde" },
  { value: "lime", label: "Lima" },
  { value: "yellow", label: "Amarelo" },
  { value: "orange", label: "Laranja" },
  { value: "red", label: "Vermelho" },
  { value: "pink", label: "Rosa" },
  { value: "grape", label: "Uva" },
  { value: "violet", label: "Violeta" },
  { value: "indigo", label: "Índigo" },
  { value: "navy", label: "Azul-marinho" },
  { value: "turquoise", label: "Turquesa" },
  { value: "emerald", label: "Esmeralda" },
  { value: "olive", label: "Oliva" },
  { value: "amber", label: "Âmbar" },
  { value: "coral", label: "Coral" },
  { value: "burgundy", label: "Bordô" },
  { value: "plum", label: "Ameixa" },
  { value: "brown", label: "Marrom" },
  { value: "slate", label: "Ardósia" },
  { value: "gray", label: "Cinza" }
] as const;

/** A supported parent-category color name. */
export type CategoryColor = (typeof categoryColorOptions)[number]["value"];

/** Returns whether a value belongs to the controlled category palette. */
export function isCategoryColor(value: string): value is CategoryColor {
  return categoryColorOptions.some((color) => color.value === value);
}

/**
 * Validates and returns a category color.
 * @throws If the color is outside the controlled palette.
 */
export function assertCategoryColor(value: string): CategoryColor {
  if (!isCategoryColor(value)) {
    throw new Error(`Cor de categoria inválida: ${value}`);
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

/** Resolves a persisted color or the legacy color associated with a seeded category ID. */
export function getCategoryColor(colorOrCategoryId: string | null | undefined): CategoryColor {
  if (!colorOrCategoryId) return "gray";
  if (isCategoryColor(colorOrCategoryId)) return colorOrCategoryId;
  return (categoryColors[colorOrCategoryId] as CategoryColor | undefined) ?? "gray";
}

/** Resolves the darker shade used to display a parent category on a light background. */
export function getCategoryDisplayColor(colorOrCategoryId: string | null | undefined): string {
  return `${getCategoryColor(colorOrCategoryId)}.7`;
}

/**
 * Derives a contrasting, stable shade from a parent color and the subcategory display index.
 * @param index - Zero-based position after subcategories are sorted for display.
 */
export function getSubcategoryColor(
  colorOrCategoryId: string | null | undefined,
  index: number
): string {
  const color = getCategoryColor(colorOrCategoryId);
  const shades = [7, 8, 6] as const;
  const normalizedIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  return `${color}.${shades[normalizedIndex % shades.length]}`;
}
