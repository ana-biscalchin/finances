import { Select, Badge, Box, type OptionsFilter, type ComboboxParsedItem, type ComboboxItem } from "@mantine/core";
import { useState } from "react";
import { buildCategoryGroups, renderCategoryOption, type SharedCategory } from "./transaction-ui";
import { getCategoryColor } from "@finances/domain";

const emptySelectValue = "__none__";

interface CategorySelectProps {
  /** Lista de categorias carregada da API */
  categories: SharedCategory[];
  /** Valor atual (subcategoryId ou emptySelectValue) */
  value: string;
  /** Chamado quando o valor muda */
  onChange: (value: string) => void;
  /** Label do campo (default: "Categoria") */
  label?: string;
  /** Placeholder quando nenhum item está selecionado */
  placeholder?: string;
  /** Texto da opção "nenhum" inserida no topo da lista */
  emptyOptionLabel?: string;
  /** Se true, adiciona opção vazia no topo. Default: true */
  includeEmpty?: boolean;
  /** Filtra apenas categorias com estas naturezas */
  filterNatures?: string[];
  /** Torna o campo obrigatório */
  required?: boolean;
  /** Desabilita o campo */
  disabled?: boolean;
  /** Tamanho Mantine do campo */
  size?: "xs" | "sm" | "md" | "lg";
  /** Variant Mantine */
  variant?: "default" | "filled" | "unstyled";
  /** Estilos extras passados para o Select interno */
  styles?: React.ComponentProps<typeof Select>["styles"];
  /** Propriedades extras do Combobox/Select interno */
  comboboxProps?: React.ComponentProps<typeof Select>["comboboxProps"];
  /** Chamado quando o dropdown fecha */
  onDropdownClose?: () => void;
}

/** Normaliza texto para comparação: sem acento, minúsculo, sem espaços extras */
function normalize(str: string | undefined | null): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filtro customizado para CategorySelect.
 * Retorna as opções que contenham o termo e ordena:
 * 1. Prefixo do nome da subcategoria
 * 2. Prefixo do nome da categoria pai (grupo)
 * 3. Substring em qualquer posição
 */
const categoryFilter: OptionsFilter = ({ options, search }) => {
  const q = normalize(search);
  if (!q) return options;

  const result: ComboboxParsedItem[] = [];

  for (const item of options) {
    if ("group" in item && "items" in item) {
      const scored: { opt: ComboboxItem; score: number }[] = [];

      for (const subOpt of item.items) {
        if (!subOpt.label) continue;
        const subName = normalize(subOpt.label);
        const catName = normalize(item.group);
        if (!subName.includes(q) && !catName.includes(q)) continue;

        let score = 3;
        if (subName.startsWith(q)) score = 1;
        else if (catName.startsWith(q)) score = 2;

        scored.push({ opt: subOpt, score });
      }

      scored.sort((a, b) => a.score - b.score);

      if (scored.length > 0) {
        result.push({
          group: item.group,
          items: scored.map((x) => x.opt),
        });
      }
    } else {
      const simpleItem = item as ComboboxItem;
      if (simpleItem.label && normalize(simpleItem.label).includes(q)) {
        result.push(simpleItem);
      }
    }
  }

  return result;
};

export function CategorySelect({
  categories,
  value,
  onChange,
  label = "Categoria",
  placeholder = "Selecione uma categoria",
  emptyOptionLabel = "Sem categoria",
  includeEmpty = true,
  filterNatures,
  required,
  disabled,
  size = "sm",
  variant = "default",
  styles,
  comboboxProps,
  onDropdownClose,
}: CategorySelectProps) {
  const [searchValue, setSearchValue] = useState("");

  const data = [
    ...(includeEmpty ? [{ value: emptySelectValue, label: emptyOptionLabel }] : []),
    ...buildCategoryGroups(categories, filterNatures),
  ];

  // Label amigável para mostrar no input quando há um valor selecionado
  const selectedLabel = (() => {
    for (const item of data) {
      if ("items" in item) {
        const found = item.items.find((i) => i.value === value);
        if (found) return found.label;
      } else if ("value" in item && item.value === value) {
        return item.label;
      }
    }
    return "";
  })();

  return (
    <Select
      label={label}
      placeholder={placeholder}
      data={data}
      value={value === emptySelectValue ? null : value}
      onChange={(val) => onChange(val ?? emptySelectValue)}
      searchable
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      onFocus={() => {
        // Limpa o searchValue ao focar para permitir digitação imediata
        setSearchValue("");
      }}
      onBlur={() => {
        // Restaura o label selecionado quando perde o foco (sem alterar o value)
        setSearchValue(selectedLabel ?? "");
      }}
      renderOption={renderCategoryOption}
      filter={categoryFilter}
      required={required}
      disabled={disabled}
      size={size}
      variant={variant}
      styles={styles}
      comboboxProps={{ withinPortal: true, ...comboboxProps }}
      onDropdownClose={onDropdownClose}
    />
  );
}

interface QuickCategoryEditProps {
  categories: SharedCategory[];
  value: string;
  onChange: (value: string) => void;
  filterNatures?: string[];
  emptyOptionLabel?: string;
}

export function QuickCategoryEdit({
  categories,
  value,
  onChange,
  filterNatures,
  emptyOptionLabel = "Sem categoria",
}: QuickCategoryEditProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Find subcategory name and parent category color
  const subcategory = categories
    .flatMap((c) =>
      c.subcategories.map((sub) => ({
        ...sub,
        categoryId: c.id,
      }))
    )
    .find((sub) => sub.id === value);

  const displayLabel = subcategory ? subcategory.name : emptyOptionLabel;
  const badgeColor = subcategory ? getCategoryColor(subcategory.categoryId) : "gray";

  if (isEditing) {
    return (
      <Box w={180}>
        <CategorySelect
          categories={categories}
          value={value}
          onChange={(val) => {
            onChange(val);
            setIsEditing(false);
          }}
          filterNatures={filterNatures}
          emptyOptionLabel={emptyOptionLabel}
          placeholder="Selecione..."
          label=""
          size="xs"
          variant="default"
          onDropdownClose={() => setIsEditing(false)}
        />
      </Box>
    );
  }

  return (
    <Badge
      variant="light"
      color={badgeColor}
      size="sm"
      role="button"
      tabIndex={0}
      title="Clique para editar a categoria"
      style={{ cursor: "pointer", textTransform: "none" }}
      onClick={() => setIsEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      {displayLabel}
    </Badge>
  );
}
