import {
  Select,
  MultiSelect,
  Badge,
  Box,
  Stack,
  Text,
  type OptionsFilter,
  type ComboboxParsedItem,
  type ComboboxItem
} from "@mantine/core";
import { useState } from "react";
import { buildCategoryGroups, renderCategoryOption, type SharedCategory } from "./transaction-ui";
import { getSubcategoryColor } from "@finances/domain";

const emptySelectValue = "__none__";

interface CategorySelectProps {
  categories: SharedCategory[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  emptyOptionLabel?: string;
  includeEmpty?: boolean;
  filterNatures?: string[];
  required?: boolean;
  disabled?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "default" | "filled" | "unstyled";
  styles?: React.ComponentProps<typeof Select>["styles"];
  comboboxProps?: React.ComponentProps<typeof Select>["comboboxProps"];
  onDropdownClose?: () => void;
  extraOptions?: Array<{ value: string; label: string }>;
}

interface CategoryMultiSelectProps {
  categories: SharedCategory[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  filterNatures?: string[];
  disabled?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  extraOptions?: Array<{ value: string; label: string }>;
}

function normalize(str: string | undefined | null): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

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
          items: scored.map((x) => x.opt)
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
  extraOptions = []
}: CategorySelectProps) {
  const [searchValue, setSearchValue] = useState("");

  const data = [
    ...(includeEmpty ? [{ value: emptySelectValue, label: emptyOptionLabel }] : []),
    ...extraOptions,
    ...buildCategoryGroups(categories, filterNatures)
  ];

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
        setSearchValue("");
      }}
      onBlur={() => {
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

export function CategoryMultiSelect({
  categories,
  value,
  onChange,
  label = "Categorias",
  placeholder = "Todas",
  filterNatures,
  disabled,
  size = "sm",
  extraOptions = []
}: CategoryMultiSelectProps) {
  const data = [...extraOptions, ...buildCategoryGroups(categories, filterNatures)];

  return (
    <MultiSelect
      label={label}
      placeholder={value.length === 0 ? placeholder : undefined}
      data={data}
      value={value}
      onChange={onChange}
      searchable
      clearable
      hidePickedOptions
      renderOption={renderCategoryOption}
      filter={categoryFilter}
      disabled={disabled}
      size={size}
      comboboxProps={{ withinPortal: true }}
    />
  );
}

interface QuickCategoryEditProps {
  categories: SharedCategory[];
  value: string;
  onChange: (value: string) => void;
  filterNatures?: string[];
  emptyOptionLabel?: string;
  disabled?: boolean;
}

export function QuickCategoryEdit({
  categories,
  value,
  onChange,
  filterNatures,
  emptyOptionLabel = "Sem categoria",
  disabled
}: QuickCategoryEditProps) {
  const [isEditing, setIsEditing] = useState(false);

  const subcategory = categories
    .flatMap((c) =>
      c.subcategories.map((sub, index) => ({
        ...sub,
        categoryId: c.id,
        categoryName: c.name,
        categoryColor: c.color,
        subcategoryIndex: index
      }))
    )
    .find((sub) => sub.id === value);

  const displayLabel = subcategory ? subcategory.name : emptyOptionLabel;
  const badgeColor = subcategory
    ? getSubcategoryColor(
        subcategory.categoryColor ?? subcategory.categoryId,
        subcategory.subcategoryIndex
      )
    : "gray";
  const categoryLabel = subcategory?.categoryName ?? "Sem categoria";

  if (disabled) {
    return (
      <Stack gap={3} style={{ maxWidth: "100%" }}>
        <Text size="sm" fw={600} truncate="end">
          {displayLabel}
        </Text>
        <Badge
          variant="light"
          color={badgeColor}
          size="xs"
          style={{ alignSelf: "flex-start", maxWidth: "100%", textTransform: "none" }}
        >
          {categoryLabel}
        </Badge>
      </Stack>
    );
  }

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
    <Stack
      gap={3}
      role="button"
      tabIndex={0}
      title="Clique para editar a categoria"
      style={{
        cursor: "pointer",
        maxWidth: "100%"
      }}
      onClick={() => setIsEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      <Text size="sm" fw={600} truncate="end">
        {displayLabel}
      </Text>
      <Badge
        variant="light"
        color={badgeColor}
        size="xs"
        style={{ alignSelf: "flex-start", maxWidth: "100%", textTransform: "none" }}
      >
        {categoryLabel}
      </Badge>
    </Stack>
  );
}
