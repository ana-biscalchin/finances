import { apiClient } from "../shared/api-client.js";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { categoryNatures, getCategoryColor } from "@finances/domain";
import {
  IconArchive,
  IconArchiveOff,
  IconEdit,
  IconPlus,
  IconArrowsJoin
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { getErrorMessage, getResponseError, reportClientError } from "../shared/errors";

type Subcategory = {
  id: string;
  categoryId: string;
  name: string;
  behavior: string;
  sortOrder: number;
  isActive: boolean;
};

type Category = {
  id: string;
  nature: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  subcategories: Subcategory[];
};

type ModalState =
  | { type: "category"; mode: "create"; value: CategoryFormState }
  | { type: "category"; mode: "edit"; id: string; value: CategoryFormState }
  | { type: "subcategory"; mode: "create"; value: SubcategoryFormState }
  | { type: "subcategory"; mode: "edit"; id: string; value: SubcategoryFormState }
  | { type: "subcategory"; mode: "merge"; id: string; targetSubcategoryId: string };

type CategoryFormState = {
  name: string;
  nature: string;
  sortOrder: number | string;
};

type SubcategoryFormState = {
  categoryId: string;
  name: string;
  behavior: string;
  sortOrder: number | string;
};

const behaviors = [
  { value: "fixed", label: "Fixo" },
  { value: "variable", label: "Variável" },
  { value: "extra", label: "Extra" }
];

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>("all");

  const filteredCategories =
    activeTab === "all" ? categories : categories.filter((c) => c.nature === activeTab);
  const selectedCategory = filteredCategories.find((c) => c.id === selectedCategoryId) ?? null;
  const visibleSubcategories = selectedCategory?.subcategories ?? [];

  async function loadCategories(preferredSelection?: { categoryId?: string | null }) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.raw(`/categories?includeInactive=${includeInactive}`);

      if (!response.ok) {
        throw new Error("Não foi possível carregar as categorias.");
      }

      const nextCategories = (await response.json()) as Category[];
      setCategories(nextCategories);

      const nextSelectedCategory =
        nextCategories.find((c) => c.id === preferredSelection?.categoryId) ??
        nextCategories.find((c) => c.id === selectedCategoryId) ??
        nextCategories[0] ??
        null;
      setSelectedCategoryId(nextSelectedCategory?.id ?? null);
    } catch (loadError) {
      reportClientError("categories.load", loadError);
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, [includeInactive]);

  function openCreateCategoryModal() {
    setModal({
      type: "category",
      mode: "create",
      value: { name: "", nature: "expense", sortOrder: categories.length }
    });
  }

  function openCreateSubcategoryModal() {
    if (!selectedCategory) {
      return;
    }

    setModal({
      type: "subcategory",
      mode: "create",
      value: {
        categoryId: selectedCategory.id,
        name: "",
        behavior: "variable",
        sortOrder: visibleSubcategories.length
      }
    });
  }

  async function saveCategory() {
    if (!modal) {
      return;
    }

    setError(null);

    try {
      const duplicateMessage = getDuplicateMessage(modal, categories);

      if (duplicateMessage) {
        setError(duplicateMessage);
        return;
      }

      setIsSaving(true);

      let response: Response;

      if (modal.mode === "merge") {
        response = await apiClient.raw(`/subcategories/${modal.id}/merge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetSubcategoryId: modal.targetSubcategoryId })
        });
      } else {
        response = await apiClient.raw(getSaveUrl(modal), {
          method: modal.mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(modal))
        });
      }

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível salvar a categoria."));
      }

      const saved =
        modal.mode === "merge" ? {} : ((await response.json()) as Partial<Category & Subcategory>);
      setModal(null);
      await loadCategories(
        modal.mode === "merge" ? undefined : getPreferredSelection(modal, saved)
      );
    } catch (saveError) {
      reportClientError("categories.save", saveError);
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveResource(resource: "category" | "subcategory", id: string) {
    const confirmed = window.confirm("Arquivar este item de categoria?");

    if (!confirmed) {
      return;
    }

    await updateResourceStatus(resource, id, "archive");
  }

  async function restoreResource(resource: "category" | "subcategory", id: string) {
    await updateResourceStatus(resource, id, "restore");
  }

  async function updateResourceStatus(
    resource: "category" | "subcategory",
    id: string,
    action: "archive" | "restore"
  ) {
    setError(null);

    try {
      const response = await apiClient.raw(
        `/${resource === "category" ? "categories" : "subcategories"}/${id}/${action}`,
        {
          method: "PATCH"
        }
      );

      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "Não foi possível atualizar a categoria.")
        );
      }

      await loadCategories();
    } catch (statusError) {
      reportClientError("categories.updateStatus", statusError);
      setError(getErrorMessage(statusError));
    }
  }

  return (
    <Stack gap="lg">
      <Paper withBorder p="xl" radius="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Categorias</Title>
            <Text c="dimmed" mt={6}>
              Gerencie categorias e subcategorias sem perder histórico dos lançamentos.
            </Text>
          </div>
          <Checkbox
            checked={includeInactive}
            label="Mostrar arquivadas"
            onChange={(event) => setIncludeInactive(event.currentTarget.checked)}
          />
        </Group>

        <Group gap="sm" mt="xl">
          <Button
            variant={activeTab === "all" ? "filled" : "light"}
            onClick={() => setActiveTab("all")}
            radius="xl"
            color="blue"
          >
            Todos
          </Button>
          {categoryNatures.map((n) => {
            const isActive = activeTab === n.value;
            const color = n.value === "income" ? "teal" : n.value === "expense" ? "red" : "gray";
            return (
              <Button
                key={n.value}
                variant={isActive ? "filled" : "light"}
                color={isActive ? color : "gray"}
                onClick={() => setActiveTab(n.value)}
                radius="xl"
              >
                {n.label}
              </Button>
            );
          })}
        </Group>
      </Paper>

      {error ? (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      ) : null}

      {isLoading ? (
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <CategoryPanel
            title="Categorias Pai"
            actionLabel="Nova categoria"
            onCreate={openCreateCategoryModal}
            isCreateDisabled={false}
          >
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Tbody>
                {filteredCategories.map((category) => (
                  <Table.Tr
                    key={category.id}
                    bg={category.id === selectedCategoryId ? "teal.0" : undefined}
                    onClick={() => {
                      setSelectedCategoryId(category.id);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Badge size="xs" circle color={getCategoryColor(category.id)} />
                        <div>
                          <Text fw={600}>{category.name}</Text>
                          <Text size="xs" c="dimmed">
                            {getNatureLabel(category.nature)}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>{renderStatusBadge(category.isActive)}</Table.Td>
                    <Table.Td>
                      <ActionGroup
                        isActive={category.isActive}
                        onEdit={() =>
                          setModal({
                            type: "category",
                            mode: "edit",
                            id: category.id,
                            value: {
                              name: category.name,
                              nature: category.nature,
                              sortOrder: category.sortOrder
                            }
                          })
                        }
                        onArchive={() => void archiveResource("category", category.id)}
                        onRestore={() => void restoreResource("category", category.id)}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </CategoryPanel>

          <CategoryPanel
            title={selectedCategory ? `Subcategorias de ${selectedCategory.name}` : "Subcategorias"}
            actionLabel="Nova subcategoria"
            onCreate={openCreateSubcategoryModal}
            isCreateDisabled={!selectedCategory}
          >
            {selectedCategory ? (
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Tbody>
                  {visibleSubcategories.map((sub) => (
                    <Table.Tr key={sub.id}>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Badge
                            color={getCategoryColor(selectedCategory.id)}
                            variant="light"
                            size="md"
                            fw={600}
                            style={{ textTransform: "none" }}
                          >
                            {sub.name}
                          </Badge>
                          <Badge size="xs" color={getBehaviorColor(sub.behavior)} variant="outline">
                            {getBehaviorLabel(sub.behavior)}
                          </Badge>
                        </Group>
                      </Table.Td>
                      <Table.Td>{renderStatusBadge(sub.isActive)}</Table.Td>
                      <Table.Td>
                        <ActionGroup
                          isActive={sub.isActive}
                          onEdit={() =>
                            setModal({
                              type: "subcategory",
                              mode: "edit",
                              id: sub.id,
                              value: {
                                categoryId: sub.categoryId,
                                name: sub.name,
                                behavior: sub.behavior,
                                sortOrder: sub.sortOrder
                              }
                            })
                          }
                          onArchive={() => void archiveResource("subcategory", sub.id)}
                          onRestore={() => void restoreResource("subcategory", sub.id)}
                          onMerge={() =>
                            setModal({
                              type: "subcategory",
                              mode: "merge",
                              id: sub.id,
                              targetSubcategoryId: ""
                            })
                          }
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <EmptyMessage text="Selecione uma categoria para ver as subcategorias." />
            )}
          </CategoryPanel>
        </SimpleGrid>
      )}

      <CategoryModal
        modal={modal}
        categories={categories}
        onChange={setModal}
        onClose={() => setModal(null)}
        onSave={() => void saveCategory()}
        isSaving={isSaving}
      />
    </Stack>
  );
}

function CategoryPanel({
  title,
  actionLabel,
  children,
  isCreateDisabled,
  onCreate
}: {
  title: string;
  actionLabel: string;
  children: ReactNode;
  isCreateDisabled: boolean;
  onCreate: () => void;
}) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={4}>{title}</Title>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={onCreate}
            disabled={isCreateDisabled}
          >
            {actionLabel}
          </Button>
        </Group>
        {children}
      </Stack>
    </Paper>
  );
}

function ActionGroup({
  isActive,
  onEdit,
  onArchive,
  onRestore,
  onMerge
}: {
  isActive: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onMerge?: () => void;
}) {
  return (
    <Group gap={4} justify="flex-end" onClick={(event) => event.stopPropagation()}>
      <ActionIcon variant="subtle" aria-label="Editar" title="Editar" onClick={onEdit}>
        <IconEdit size={17} />
      </ActionIcon>
      {onMerge ? (
        <ActionIcon variant="subtle" aria-label="Fundir com outra" title="Fundir" onClick={onMerge}>
          <IconArrowsJoin size={17} />
        </ActionIcon>
      ) : null}
      {isActive ? (
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label="Arquivar"
          title="Arquivar"
          onClick={onArchive}
        >
          <IconArchive size={17} />
        </ActionIcon>
      ) : (
        <ActionIcon
          variant="subtle"
          color="teal"
          aria-label="Restaurar"
          title="Restaurar"
          onClick={onRestore}
        >
          <IconArchiveOff size={17} />
        </ActionIcon>
      )}
    </Group>
  );
}

function CategoryModal({
  modal,
  categories,
  onChange,
  onClose,
  onSave,
  isSaving
}: {
  modal: ModalState | null;
  categories: Category[];
  onChange: (modal: ModalState | null) => void;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const title = modal ? getModalTitle(modal) : "";

  return (
    <Modal opened={modal !== null} onClose={onClose} title={title}>
      {modal ? (
        <Stack>
          {modal.type === "category" ? (
            <>
              <TextInput
                label="Nome"
                value={modal.value.name}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  onChange({ ...modal, value: { ...modal.value, name: value } });
                }}
                required
              />
              <Select
                label="Natureza"
                data={categoryNatures}
                value={modal.value.nature}
                onChange={(value) =>
                  onChange({ ...modal, value: { ...modal.value, nature: value ?? "expense" } })
                }
                required
              />
              <SortOrderInput modal={modal} onChange={onChange} />
            </>
          ) : null}

          {modal.type === "subcategory" && modal.mode !== "merge" ? (
            <>
              <Select
                label="Categoria Pai"
                data={categories.map((c) => ({ value: c.id, label: c.name }))}
                value={modal.value.categoryId}
                onChange={(value) =>
                  onChange({ ...modal, value: { ...modal.value, categoryId: value ?? "" } })
                }
                required
              />
              <TextInput
                label="Nome"
                value={modal.value.name}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  onChange({ ...modal, value: { ...modal.value, name: value } });
                }}
                required
              />
              <Select
                label="Comportamento (Tag)"
                data={behaviors}
                value={modal.value.behavior}
                onChange={(value) =>
                  onChange({ ...modal, value: { ...modal.value, behavior: value ?? "variable" } })
                }
                required
              />
              <SortOrderInput modal={modal} onChange={onChange} />
            </>
          ) : null}

          {modal.type === "subcategory" && modal.mode === "merge" ? (
            <Stack gap="md">
              <Alert color="orange" title="Atenção">
                Todos os lançamentos desta subcategoria serão transferidos para o destino escolhido.
                A atual será arquivada.
              </Alert>
              <Select
                label="Subcategoria Destino"
                placeholder="Selecione o destino"
                searchable
                data={categories
                  .flatMap((c) => ({
                    group: c.name,
                    items: c.subcategories
                      .filter((sub) => sub.id !== modal.id)
                      .map((sub) => ({ value: sub.id, label: sub.name }))
                  }))
                  .filter((group) => group.items.length > 0)}
                value={modal.targetSubcategoryId}
                onChange={(value) => onChange({ ...modal, targetSubcategoryId: value ?? "" })}
                required
              />
            </Stack>
          ) : null}

          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={onSave} loading={isSaving}>
              Salvar
            </Button>
          </Group>
        </Stack>
      ) : null}
    </Modal>
  );
}

function SortOrderInput({
  modal,
  onChange
}: {
  modal: ModalState;
  onChange: (modal: ModalState | null) => void;
}) {
  if (modal.mode === "merge") return null;

  return (
    <NumberInput
      label="Ordem"
      min={0}
      value={modal.value.sortOrder}
      onChange={(value) => onChange(updateModalSortOrder(modal, value))}
    />
  );
}

function updateModalSortOrder(modal: ModalState, sortOrder: number | string): ModalState {
  if (modal.mode === "merge") return modal;

  return { ...modal, value: { ...modal.value, sortOrder } } as ModalState;
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <Text c="dimmed" size="sm">
      {text}
    </Text>
  );
}

function renderStatusBadge(isActive: boolean) {
  return (
    <Badge color={isActive ? "teal" : "gray"} variant="light" size="sm">
      {isActive ? "Ativa" : "Arquivada"}
    </Badge>
  );
}

function getBehaviorLabel(behavior: string) {
  return behaviors.find((b) => b.value === behavior)?.label ?? behavior;
}

function getBehaviorColor(behavior: string) {
  if (behavior === "fixed") return "blue";
  if (behavior === "extra") return "orange";
  return "grape";
}

function getModalTitle(modal: ModalState) {
  if (modal.mode === "merge") return "Fundir subcategoria";

  const action = modal.mode === "create" ? "Nova" : "Editar";
  return modal.type === "category" ? `${action} categoria pai` : `${action} subcategoria`;
}

function getSaveUrl(modal: ModalState) {
  const resourcePath = modal.type === "category" ? "categories" : "subcategories";
  if (modal.mode === "create") return `/${resourcePath}`;
  return `/${resourcePath}/${modal.id}`;
}

function buildPayload(modal: ModalState) {
  if (modal.mode === "merge") return { targetSubcategoryId: modal.targetSubcategoryId };
  return { ...modal.value, sortOrder: parseSortOrder(modal.value.sortOrder) };
}

function getPreferredSelection(modal: ModalState, saved: Partial<Category & Subcategory>) {
  if (modal.type === "category") return { categoryId: saved.id ?? null };
  return { categoryId: saved.categoryId ?? null };
}

function getDuplicateMessage(modal: ModalState, categories: Category[]) {
  if (modal.mode === "merge") {
    return !modal.targetSubcategoryId ? "Selecione o destino." : null;
  }

  if (modal.type === "category") {
    const duplicate = categories.find(
      (c) =>
        c.id !== getModalId(modal) &&
        c.nature === modal.value.nature &&
        normalizeCategoryName(c.name) === normalizeCategoryName(modal.value.name)
    );
    return duplicate ? "Já existe uma categoria com essa natureza e nome." : null;
  }

  const category = categories.find((c) => c.id === modal.value.categoryId);
  const duplicate = category?.subcategories.find(
    (sub) =>
      sub.id !== getModalId(modal) &&
      normalizeCategoryName(sub.name) === normalizeCategoryName(modal.value.name)
  );

  return duplicate ? "Já existe uma subcategoria com esse nome nesta categoria." : null;
}

function getModalId(modal: ModalState) {
  return modal.mode === "edit" ? modal.id : null;
}

function normalizeCategoryName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseSortOrder(value: number | string) {
  if (typeof value === "number") return Number.isInteger(value) ? value : Math.round(value);
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error("Ordem inválida.");
  return parsed;
}

function getNatureLabel(nature: string) {
  return categoryNatures.find((n) => n.value === nature)?.label ?? nature;
}
