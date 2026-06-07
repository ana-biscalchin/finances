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
import { categoryNatures } from "@finances/domain";
import { IconArchive, IconArchiveOff, IconEdit, IconPlus } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type CategoryMicro = {
  id: string;
  macroId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type CategoryMacro = {
  id: string;
  groupId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  micros: CategoryMicro[];
};

type CategoryGroup = {
  id: string;
  nature: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  macros: CategoryMacro[];
};

type ModalState =
  | { type: "group"; mode: "create"; value: GroupFormState }
  | { type: "group"; mode: "edit"; id: string; value: GroupFormState }
  | { type: "macro"; mode: "create"; value: MacroFormState }
  | { type: "macro"; mode: "edit"; id: string; value: MacroFormState }
  | { type: "micro"; mode: "create"; value: MicroFormState }
  | { type: "micro"; mode: "edit"; id: string; value: MicroFormState };

type GroupFormState = {
  name: string;
  nature: string;
  sortOrder: number | string;
};

type MacroFormState = {
  groupId: string;
  name: string;
  sortOrder: number | string;
};

type MicroFormState = {
  macroId: string;
  name: string;
  sortOrder: number | string;
};

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const macroColors = ["teal", "blue", "violet", "grape", "pink", "red", "orange", "yellow", "lime"];

export function CategoriesPage() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedMacroId, setSelectedMacroId] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const visibleMacros = selectedGroup?.macros ?? [];
  const selectedMacro =
    visibleMacros.find((macro) => macro.id === selectedMacroId) ??
    groups.flatMap((group) => group.macros).find((macro) => macro.id === selectedMacroId) ??
    null;
  const visibleMicros = selectedMacro?.micros ?? [];
  const allMacros = useMemo(() => groups.flatMap((group) => group.macros), [groups]);

  async function loadCategories(preferredSelection?: {
    groupId?: string | null;
    macroId?: string | null;
  }) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/categories?includeInactive=${includeInactive}`);

      if (!response.ok) {
        throw new Error("Não foi possível carregar as categorias.");
      }

      const nextGroups = (await response.json()) as CategoryGroup[];
      setGroups(nextGroups);

      const nextSelectedGroup =
        nextGroups.find((group) => group.id === preferredSelection?.groupId) ??
        nextGroups.find((group) => group.id === selectedGroupId) ??
        nextGroups[0] ??
        null;
      setSelectedGroupId(nextSelectedGroup?.id ?? null);

      const nextSelectedMacro =
        nextSelectedGroup?.macros.find((macro) => macro.id === preferredSelection?.macroId) ??
        nextSelectedGroup?.macros.find((macro) => macro.id === selectedMacroId) ??
        nextSelectedGroup?.macros[0] ??
        null;
      setSelectedMacroId(nextSelectedMacro?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, [includeInactive]);

  function openCreateGroupModal() {
    setModal({
      type: "group",
      mode: "create",
      value: { name: "", nature: "expense", sortOrder: groups.length }
    });
  }

  function openCreateMacroModal() {
    if (!selectedGroup) {
      return;
    }

    setModal({
      type: "macro",
      mode: "create",
      value: { groupId: selectedGroup.id, name: "", sortOrder: visibleMacros.length }
    });
  }

  function openCreateMicroModal() {
    if (!selectedMacro) {
      return;
    }

    setModal({
      type: "micro",
      mode: "create",
      value: { macroId: selectedMacro.id, name: "", sortOrder: visibleMicros.length }
    });
  }

  async function saveCategory() {
    if (!modal) {
      return;
    }

    setError(null);

    try {
      const duplicateMessage = getDuplicateMessage(modal, groups);

      if (duplicateMessage) {
        setError(duplicateMessage);
        return;
      }

      setIsSaving(true);

      const response = await fetch(getSaveUrl(modal), {
        method: modal.mode === "create" ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildPayload(modal))
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível salvar a categoria."));
      }

      const saved = (await response.json()) as Partial<
        CategoryGroup & CategoryMacro & CategoryMicro
      >;
      setModal(null);
      await loadCategories(getPreferredSelection(modal, saved));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro inesperado.");
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveResource(resource: "group" | "macro" | "micro", id: string) {
    const confirmed = window.confirm("Arquivar este item de categoria?");

    if (!confirmed) {
      return;
    }

    await updateResourceStatus(resource, id, "archive");
  }

  async function restoreResource(resource: "group" | "macro" | "micro", id: string) {
    await updateResourceStatus(resource, id, "restore");
  }

  async function updateResourceStatus(
    resource: "group" | "macro" | "micro",
    id: string,
    action: "archive" | "restore"
  ) {
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/${getResourcePath(resource)}s/${id}/${action}`, {
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "Não foi possível atualizar a categoria.")
        );
      }

      await loadCategories();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Erro inesperado.");
    }
  }

  return (
    <Stack gap="lg">
      <Paper withBorder p="xl" radius="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Categorias</Title>
            <Text c="dimmed" mt={6}>
              Gerencie grupos, macros e micros sem perder histórico dos lançamentos.
            </Text>
          </div>
          <Checkbox
            checked={includeInactive}
            label="Mostrar arquivadas"
            onChange={(event) => setIncludeInactive(event.currentTarget.checked)}
          />
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
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          <CategoryPanel
            title="Grupos"
            actionLabel="Novo grupo"
            onCreate={openCreateGroupModal}
            isCreateDisabled={false}
          >
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Tbody>
                {groups.map((group) => (
                  <Table.Tr
                    key={group.id}
                    bg={group.id === selectedGroupId ? "teal.0" : undefined}
                    onClick={() => {
                      setSelectedGroupId(group.id);
                      setSelectedMacroId(group.macros[0]?.id ?? null);
                    }}
                  >
                    <Table.Td>
                      <Text fw={600}>{group.name}</Text>
                      <Text size="xs" c="dimmed">
                        {getNatureLabel(group.nature)}
                      </Text>
                    </Table.Td>
                    <Table.Td>{renderStatusBadge(group.isActive)}</Table.Td>
                    <Table.Td>
                      <ActionGroup
                        isActive={group.isActive}
                        onEdit={() =>
                          setModal({
                            type: "group",
                            mode: "edit",
                            id: group.id,
                            value: {
                              name: group.name,
                              nature: group.nature,
                              sortOrder: group.sortOrder
                            }
                          })
                        }
                        onArchive={() => void archiveResource("group", group.id)}
                        onRestore={() => void restoreResource("group", group.id)}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </CategoryPanel>

          <CategoryPanel
            title={selectedGroup ? `Macros de ${selectedGroup.name}` : "Macros"}
            actionLabel="Nova macro"
            onCreate={openCreateMacroModal}
            isCreateDisabled={!selectedGroup}
          >
            {selectedGroup ? (
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Tbody>
                  {visibleMacros.map((macro, macroIndex) => (
                    <Table.Tr
                      key={macro.id}
                      bg={
                        macro.id === selectedMacroId ? `${getMacroColor(macroIndex)}.0` : undefined
                      }
                      onClick={() => setSelectedMacroId(macro.id)}
                    >
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Badge
                            color={getMacroColor(macroIndex)}
                            variant="filled"
                            w={12}
                            h={12}
                            p={0}
                          />
                          <Text fw={600}>{macro.name}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>{renderStatusBadge(macro.isActive)}</Table.Td>
                      <Table.Td>
                        <ActionGroup
                          isActive={macro.isActive}
                          onEdit={() =>
                            setModal({
                              type: "macro",
                              mode: "edit",
                              id: macro.id,
                              value: {
                                groupId: macro.groupId,
                                name: macro.name,
                                sortOrder: macro.sortOrder
                              }
                            })
                          }
                          onArchive={() => void archiveResource("macro", macro.id)}
                          onRestore={() => void restoreResource("macro", macro.id)}
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <EmptyMessage text="Selecione um grupo para ver as macros." />
            )}
          </CategoryPanel>

          <CategoryPanel
            title={selectedMacro ? `Micros de ${selectedMacro.name}` : "Micros"}
            actionLabel="Nova micro"
            onCreate={openCreateMicroModal}
            isCreateDisabled={!selectedMacro}
          >
            {selectedMacro ? (
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Tbody>
                  {visibleMicros.map((micro) => (
                    <Table.Tr
                      key={micro.id}
                      bg={`${getSelectedMacroColor(selectedMacro, visibleMacros)}.0`}
                    >
                      <Table.Td>
                        <Badge
                          color={getSelectedMacroColor(selectedMacro, visibleMacros)}
                          variant="light"
                        >
                          {micro.name}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{renderStatusBadge(micro.isActive)}</Table.Td>
                      <Table.Td>
                        <ActionGroup
                          isActive={micro.isActive}
                          onEdit={() =>
                            setModal({
                              type: "micro",
                              mode: "edit",
                              id: micro.id,
                              value: {
                                macroId: micro.macroId,
                                name: micro.name,
                                sortOrder: micro.sortOrder
                              }
                            })
                          }
                          onArchive={() => void archiveResource("micro", micro.id)}
                          onRestore={() => void restoreResource("micro", micro.id)}
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <EmptyMessage text="Selecione uma macro para ver as micros." />
            )}
          </CategoryPanel>
        </SimpleGrid>
      )}

      <CategoryModal
        modal={modal}
        groups={groups}
        macros={allMacros}
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
  onRestore
}: {
  isActive: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  return (
    <Group gap={4} justify="flex-end" onClick={(event) => event.stopPropagation()}>
      <ActionIcon variant="subtle" aria-label="Editar" title="Editar" onClick={onEdit}>
        <IconEdit size={17} />
      </ActionIcon>
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
  groups,
  macros,
  onChange,
  onClose,
  onSave,
  isSaving
}: {
  modal: ModalState | null;
  groups: CategoryGroup[];
  macros: CategoryMacro[];
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
          {modal.type === "group" ? (
            <>
              <TextInput
                label="Nome"
                value={modal.value.name}
                onChange={(event) =>
                  onChange({ ...modal, value: { ...modal.value, name: event.target.value } })
                }
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

          {modal.type === "macro" ? (
            <>
              <Select
                label="Grupo"
                data={groups.map((group) => ({ value: group.id, label: group.name }))}
                value={modal.value.groupId}
                onChange={(value) =>
                  onChange({ ...modal, value: { ...modal.value, groupId: value ?? "" } })
                }
                required
              />
              <TextInput
                label="Nome"
                value={modal.value.name}
                onChange={(event) =>
                  onChange({ ...modal, value: { ...modal.value, name: event.target.value } })
                }
                required
              />
              <SortOrderInput modal={modal} onChange={onChange} />
            </>
          ) : null}

          {modal.type === "micro" ? (
            <>
              <Select
                label="Macro"
                data={macros.map((macro) => ({ value: macro.id, label: macro.name }))}
                value={modal.value.macroId}
                onChange={(value) =>
                  onChange({ ...modal, value: { ...modal.value, macroId: value ?? "" } })
                }
                required
              />
              <TextInput
                label="Nome"
                value={modal.value.name}
                onChange={(event) =>
                  onChange({ ...modal, value: { ...modal.value, name: event.target.value } })
                }
                required
              />
              <SortOrderInput modal={modal} onChange={onChange} />
            </>
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
  if (modal.type === "group") {
    return { ...modal, value: { ...modal.value, sortOrder } };
  }

  if (modal.type === "macro") {
    return { ...modal, value: { ...modal.value, sortOrder } };
  }

  return { ...modal, value: { ...modal.value, sortOrder } };
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
    <Badge color={isActive ? "teal" : "gray"} variant="light">
      {isActive ? "Ativa" : "Arquivada"}
    </Badge>
  );
}

function getMacroColor(index: number) {
  return macroColors[index % macroColors.length];
}

function getSelectedMacroColor(selectedMacro: CategoryMacro | null, macros: CategoryMacro[]) {
  if (!selectedMacro) {
    return "gray";
  }

  const index = macros.findIndex((macro) => macro.id === selectedMacro.id);

  return getMacroColor(Math.max(index, 0));
}

function getModalTitle(modal: ModalState) {
  const action = modal.mode === "create" ? "Nova" : "Editar";

  if (modal.type === "group") {
    return `${action} grupo`;
  }

  if (modal.type === "macro") {
    return `${action} macro`;
  }

  return `${action} micro`;
}

function getSaveUrl(modal: ModalState) {
  const resourcePath = getResourcePath(modal.type);

  if (modal.mode === "create") {
    return `${apiBaseUrl}/${resourcePath}s`;
  }

  return `${apiBaseUrl}/${resourcePath}s/${modal.id}`;
}

function getResourcePath(resource: "group" | "macro" | "micro") {
  if (resource === "group") {
    return "category-group";
  }

  if (resource === "macro") {
    return "category-macro";
  }

  return "category-micro";
}

function buildPayload(modal: ModalState) {
  return {
    ...modal.value,
    sortOrder: parseSortOrder(modal.value.sortOrder)
  };
}

function getPreferredSelection(
  modal: ModalState,
  saved: Partial<CategoryGroup & CategoryMacro & CategoryMicro>
) {
  if (modal.type === "group") {
    return { groupId: saved.id ?? null, macroId: null };
  }

  if (modal.type === "macro") {
    return { groupId: saved.groupId ?? null, macroId: saved.id ?? null };
  }

  return { groupId: null, macroId: saved.macroId ?? null };
}

function getDuplicateMessage(modal: ModalState, groups: CategoryGroup[]) {
  if (modal.type === "group") {
    const duplicate = groups.find(
      (group) =>
        group.id !== getModalId(modal) &&
        group.nature === modal.value.nature &&
        normalizeCategoryName(group.name) === normalizeCategoryName(modal.value.name)
    );

    return duplicate ? "Já existe um grupo com essa natureza e nome." : null;
  }

  if (modal.type === "macro") {
    const group = groups.find((candidate) => candidate.id === modal.value.groupId);
    const duplicate = group?.macros.find(
      (macro) =>
        macro.id !== getModalId(modal) &&
        normalizeCategoryName(macro.name) === normalizeCategoryName(modal.value.name)
    );

    return duplicate ? "Já existe uma macro com esse nome nesse grupo." : null;
  }

  const macro = groups
    .flatMap((group) => group.macros)
    .find((candidate) => candidate.id === modal.value.macroId);
  const duplicate = macro?.micros.find(
    (micro) =>
      micro.id !== getModalId(modal) &&
      normalizeCategoryName(micro.name) === normalizeCategoryName(modal.value.name)
  );

  return duplicate ? "Já existe uma micro com esse nome nessa macro." : null;
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
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : Math.round(value);
  }

  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error("Ordem inválida.");
  }

  return parsed;
}

function getNatureLabel(nature: string) {
  return categoryNatures.find((categoryNature) => categoryNature.value === nature)?.label ?? nature;
}

async function getResponseError(response: Response, fallback: string) {
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
