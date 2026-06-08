import {
  Alert,
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Drawer,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip
} from "@mantine/core";
import {
  formatMoney,
  getCategoryColor,
  moneyFromCents,
  parseMoneyToCents,
  transactionStatuses
} from "@finances/domain";
import {
  IconCreditCard,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconAlertCircle
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { formatBusinessDateForDisplay } from "../date-format";

import { CreditCardsPage } from "./CreditCardsPage";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type CreditCard = {
  id: string;
  name: string;
  institution: string | null;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string | null;
  limitCents: number | null;
  isActive: boolean;
};

type Bill = {
  id: string;
  creditCardId: string;
  billMonth: string;
  closingDate: string | null;
  dueDate: string;
  status: string;
  paidAt: string | null;
};

type CardTransaction = {
  id: string;
  type: string;
  description: string;
  amountCents: number;
  eventDate: string;
  subcategoryId: string | null;
  status: string;
  notes: string | null;
};

type CardTransactionEditForm = {
  description: string;
  amountReais: number | string;
  eventDate: string;
  subcategoryId: string;
  status: string;
  notes: string;
};

type Category = {
  id: string;
  nature: string;
  name: string;
  subcategories: Array<{
    id: string;
    name: string;
  }>;
};

type BillData = {
  bill: Bill;
  transactions: CardTransaction[];
  totalCents: number;
};

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);
const emptySelectValue = "__none__";

function getNextMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const nextDate = new Date(year, month, 1);
  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
}

const defaultSelectedMonth = getNextMonth(currentMonth);

export function BillsPage() {
  return (
    <Tabs defaultValue="faturas">
      <Tabs.List mb="lg">
        <Tabs.Tab value="faturas" leftSection={<IconCreditCard size={16} />}>
          Faturas
        </Tabs.Tab>
        <Tabs.Tab value="cartoes" leftSection={<IconEdit size={16} />}>
          Gerenciar cartões
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="faturas">
        <FaturasView />
      </Tabs.Panel>

      <Tabs.Panel value="cartoes">
        <CreditCardsPage />
      </Tabs.Panel>
    </Tabs>
  );
}

function FaturasView() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(defaultSelectedMonth);

  const [billData, setBillData] = useState<Record<string, BillData | null>>({});
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [loadingBills, setLoadingBills] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const activeCards = useMemo(() => cards.filter((c) => c.isActive), [cards]);

  async function loadCards() {
    setIsLoadingCards(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/credit-cards`);
      if (!res.ok) throw new Error("Não foi possível carregar os cartões.");
      setCards(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setIsLoadingCards(false);
    }
  }

  async function loadCategories() {
    try {
      const res = await fetch(`${apiBaseUrl}/categories?includeInactive=true`);
      if (!res.ok) throw new Error("Não foi possível carregar as categorias.");
      setCategories(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    }
  }

  async function loadBillForCard(cardId: string, month: string) {
    setLoadingBills((prev) => ({ ...prev, [cardId]: true }));
    try {
      const res = await fetch(`${apiBaseUrl}/credit-cards/${cardId}/bills?month=${month}`);
      if (!res.ok) throw new Error("Erro ao carregar fatura.");
      const data = (await res.json()) as BillData;
      setBillData((prev) => ({ ...prev, [cardId]: data }));
    } catch {
      setBillData((prev) => ({ ...prev, [cardId]: null }));
    } finally {
      setLoadingBills((prev) => ({ ...prev, [cardId]: false }));
    }
  }

  async function markAsPaid(cardId: string, billId: string) {
    if (!window.confirm("Marcar fatura como paga? Isso não cria lançamento duplicado.")) return;
    try {
      const res = await fetch(`${apiBaseUrl}/credit-cards/${cardId}/bills/${billId}/pay`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Erro ao marcar fatura como paga.");
      await loadBillForCard(cardId, selectedMonth);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    }
  }

  function handleNavigateMonth(direction: number) {
    const [year, month] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(year, month - 1 + direction, 1);
    const nextYear = nextDate.getFullYear();
    const nextMonthNum = String(nextDate.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${nextYear}-${nextMonthNum}`);
  }

  useEffect(() => {
    void loadCards();
    void loadCategories();
  }, []);

  useEffect(() => {
    for (const card of activeCards) {
      void loadBillForCard(card.id, selectedMonth);
    }
  }, [activeCards, selectedMonth]);

  return (
    <Stack gap="lg">
      {/* Month selector */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={700}>Mês da fatura</Text>
            <Group gap="xs">
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconChevronLeft size={16} />}
                onClick={() => handleNavigateMonth(-1)}
              >
                Mês anterior
              </Button>
              <Button
                size="xs"
                variant="subtle"
                rightSection={<IconChevronRight size={16} />}
                onClick={() => handleNavigateMonth(1)}
              >
                Próximo mês
              </Button>
            </Group>
          </Group>
          <SimpleGrid cols={{ base: 3, xs: 4, sm: 6, md: 12 }} spacing="xs">
            {getMonthOptions().map((month) => (
              <Button
                key={month.value}
                fullWidth
                size="xs"
                variant={selectedMonth === month.value ? "filled" : "light"}
                onClick={() => setSelectedMonth(month.value)}
              >
                {month.label}
              </Button>
            ))}
          </SimpleGrid>
        </Stack>
      </Paper>

      {error ? <Alert color="red" variant="light">{error}</Alert> : null}

      {isLoadingCards ? (
        <Group justify="center" p="xl">
          <Loader />
        </Group>
      ) : activeCards.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Stack align="center" gap="xs">
            <IconCreditCard size={40} opacity={0.3} />
            <Title order={4}>Nenhum cartão ativo</Title>
            <Text c="dimmed">
              Cadastre um cartão na aba "Gerenciar cartões" para ver as faturas aqui.
            </Text>
          </Stack>
        </Paper>
      ) : (
        activeCards.map((card) => (
          <CardBillPanel
            key={card.id}
            card={card}
            billData={billData[card.id] ?? null}
            isLoading={loadingBills[card.id] ?? false}
            selectedMonth={selectedMonth}
            categories={categories}
            onMarkAsPaid={(billId) => void markAsPaid(card.id, billId)}
            onReload={() => void loadBillForCard(card.id, selectedMonth)}
          />
        ))
      )}
    </Stack>
  );
}

function CardBillPanel({
  card,
  billData,
  isLoading,
  selectedMonth,
  categories,
  onMarkAsPaid,
  onReload
}: {
  card: CreditCard;
  billData: BillData | null;
  isLoading: boolean;
  selectedMonth: string;
  categories: Category[];
  onMarkAsPaid: (billId: string) => void;
  onReload: () => void;
}) {
  const [filterStatus, setFilterStatus] = useState<string>(emptySelectValue);
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>(emptySelectValue);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>(emptySelectValue);
  const [bulkSubcategoryId, setBulkSubcategoryId] = useState<string>(emptySelectValue);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<CardTransaction | null>(null);
  const [editForm, setEditForm] = useState<CardTransactionEditForm>(() => buildEditForm(null));
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isPaid = billData?.bill.status === "paid";
  const isClosed = billData?.bill.closingDate ? (today >= billData.bill.closingDate) : false;

  let statusLabel = "Aberta";
  let statusColor = "blue";

  if (isPaid) {
    statusLabel = "Paga";
    statusColor = "teal";
  } else if (isClosed) {
    statusLabel = "Fechada";
    statusColor = "orange";
  }

  const sourceTransactions = billData?.transactions ?? [];
  const transactions = useMemo(() => {
    return sourceTransactions.filter((transaction) => {
      if (filterStatus !== emptySelectValue && transaction.status !== filterStatus) {
        return false;
      }

      if (filterSubcategoryId !== emptySelectValue) {
        const desiredSubcategoryId = filterSubcategoryId === "__clear__" ? null : filterSubcategoryId;
        if (transaction.subcategoryId !== desiredSubcategoryId) {
          return false;
        }
      }

      return true;
    });
  }, [filterStatus, filterSubcategoryId, sourceTransactions]);
  const totalCents = billData?.totalCents ?? 0;
  const selectedTransactions = useMemo(
    () => sourceTransactions.filter((transaction) => selectedTransactionIds.has(transaction.id)),
    [selectedTransactionIds, sourceTransactions]
  );

  useEffect(() => {
    setSelectedTransactionIds(new Set());
    setPanelError(null);
  }, [billData?.bill.id, selectedMonth]);

  function openEditModal(transaction: CardTransaction) {
    setEditingTransaction(transaction);
    setEditForm(buildEditForm(transaction));
    setEditError(null);
  }

  function closeEditModal() {
    if (isSavingEdit) return;
    setEditingTransaction(null);
    setEditError(null);
  }

  function toggleTransactionSelection(transactionId: string) {
    setSelectedTransactionIds((current) => {
      const next = new Set(current);
      if (next.has(transactionId)) {
        next.delete(transactionId);
      } else {
        next.add(transactionId);
      }
      return next;
    });
  }

  function toggleSelectAllTransactions() {
    setSelectedTransactionIds((current) => {
      const visibleIds = transactions.map((transaction) => transaction.id);
      const allVisibleSelected =
        visibleIds.length > 0 && visibleIds.every((transactionId) => current.has(transactionId));

      if (allVisibleSelected) {
        const next = new Set(current);
        for (const transactionId of visibleIds) {
          next.delete(transactionId);
        }
        return next;
      }

      return new Set([...current, ...visibleIds]);
    });
  }

  async function updateCardTransaction(
    transaction: CardTransaction,
    changes: Partial<
      Pick<CardTransaction, "description" | "amountCents" | "eventDate" | "subcategoryId" | "status" | "notes">
    >
  ) {
    if (!billData) {
      throw new Error("Fatura não carregada.");
    }

    const response = await fetch(
      `${apiBaseUrl}/credit-cards/${card.id}/bills/${billData.bill.id}/transactions/${transaction.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: changes.description ?? transaction.description,
          amountCents: changes.amountCents ?? transaction.amountCents,
          eventDate: changes.eventDate ?? transaction.eventDate,
          subcategoryId:
            changes.subcategoryId === undefined ? transaction.subcategoryId : changes.subcategoryId,
          notes: changes.notes === undefined ? transaction.notes : changes.notes,
          status: changes.status ?? transaction.status
        })
      }
    );

    if (!response.ok) {
      throw new Error(await getResponseError(response, "Não foi possível atualizar a compra."));
    }
  }

  async function updateCategoryInline(transaction: CardTransaction, nextSubcategoryId: string) {
    const subcategoryId = nextSubcategoryId === emptySelectValue ? null : nextSubcategoryId;
    if (transaction.subcategoryId === subcategoryId) return;

    setPanelError(null);
    try {
      await updateCardTransaction(transaction, { subcategoryId });
      onReload();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Erro inesperado.");
      onReload();
    }
  }

  async function saveEditedTransaction() {
    if (!editingTransaction) return;

    const description = editForm.description.trim();
    const amountCents = parseCardTransactionAmount(editForm.amountReais);

    if (!description) {
      setEditError("Informe a descrição da compra.");
      return;
    }

    if (!editForm.eventDate) {
      setEditError("Informe a data da compra.");
      return;
    }

    if (amountCents <= 0) {
      setEditError("Informe um valor maior que zero.");
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);
    setPanelError(null);

    try {
      await updateCardTransaction(editingTransaction, {
        description,
        amountCents,
        eventDate: editForm.eventDate,
        subcategoryId: editForm.subcategoryId === emptySelectValue ? null : editForm.subcategoryId,
        status: editForm.status,
        notes: editForm.notes.trim() || null
      });
      setEditingTransaction(null);
      onReload();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function applyBulkEdits() {
    if (selectedTransactionIds.size === 0) {
      setPanelError("Selecione pelo menos uma compra para editar em massa.");
      return;
    }

    const hasStatusEdit = bulkStatus !== emptySelectValue;
    const hasCategoryEdit = bulkSubcategoryId !== emptySelectValue;

    if (!hasStatusEdit && !hasCategoryEdit) {
      setPanelError("Escolha status ou categoria para aplicar em massa.");
      return;
    }

    setIsBulkSaving(true);
    setPanelError(null);

    try {
      for (const transaction of selectedTransactions) {
        await updateCardTransaction(transaction, {
          status: hasStatusEdit ? bulkStatus : undefined,
          subcategoryId: hasCategoryEdit
            ? bulkSubcategoryId === "__clear__"
              ? null
              : bulkSubcategoryId
            : undefined
        });
      }

      setSelectedTransactionIds(new Set());
      setBulkStatus(emptySelectValue);
      setBulkSubcategoryId(emptySelectValue);
      onReload();
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Erro inesperado.");
      onReload();
    } finally {
      setIsBulkSaving(false);
    }
  }

  const allVisibleSelected =
    transactions.length > 0 && transactions.every((transaction) => selectedTransactionIds.has(transaction.id));
  const hasVisibleSelection = transactions.some((transaction) => selectedTransactionIds.has(transaction.id));

  return (
    <Paper withBorder radius="md">
      {/* Card header */}
      <Group
        px="xl"
        py="md"
        justify="space-between"
        style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}
      >
        <Group gap="sm">
          <IconCreditCard size={20} />
          <div>
            <Text fw={700}>{card.name}</Text>
            {card.institution && (
              <Text size="xs" c="dimmed">{card.institution}</Text>
            )}
          </div>
          {billData ? (
            <Badge variant="light" color={statusColor}>
              {statusLabel} — vence {formatBusinessDateForDisplay(billData.bill.dueDate)}
            </Badge>
          ) : null}
        </Group>

        <Group gap="sm">
          {billData && !isPaid ? (
            <Tooltip label="Marcar como paga (sem duplicar despesa)">
              <Button
                size="xs"
                leftSection={<IconCheck size={14} />}
                variant="light"
                color="teal"
                onClick={() => onMarkAsPaid(billData.bill.id)}
              >
                Marcar como paga
              </Button>
            </Tooltip>
          ) : null}
          <Text fw={700} c={totalCents > 0 ? "red" : "dimmed"}>
            {totalCents > 0 ? `− ${formatMoney(moneyFromCents(totalCents))}` : "R$ 0,00"}
          </Text>
        </Group>
      </Group>

      {/* Transactions */}
      {isLoading ? (
        <Group justify="center" p="xl">
          <Loader size="sm" />
        </Group>
      ) : sourceTransactions.length === 0 ? (
        <Group p="xl" gap="xs" c="dimmed">
          <IconAlertCircle size={16} />
          <Text size="sm">
            Nenhum lançamento com este cartão em {selectedMonth}.
            Use a tela de Lançamentos para registrar compras neste cartão.
          </Text>
        </Group>
      ) : (
        <Stack gap={0}>
          <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <Select
                label="Status"
                data={[{ value: emptySelectValue, label: "Todos" }, ...transactionStatuses]}
                value={filterStatus}
                onChange={(value) => setFilterStatus(value ?? emptySelectValue)}
              />
              <Select
                label="Categoria"
                data={[
                  { value: emptySelectValue, label: "Todas" },
                  { value: "__clear__", label: "Sem categoria" },
                  ...buildCategoryGroups(categories)
                ]}
                value={filterSubcategoryId}
                onChange={(value) => setFilterSubcategoryId(value ?? emptySelectValue)}
                searchable
                renderOption={renderCategoryOption}
              />
              <Group align="flex-end">
                <Button
                  fullWidth
                  variant="light"
                  onClick={() => {
                    setFilterStatus(emptySelectValue);
                    setFilterSubcategoryId(emptySelectValue);
                  }}
                >
                  Limpar filtros
                </Button>
              </Group>
            </SimpleGrid>
          </Box>

          {panelError ? (
            <Alert color="red" variant="light" m="md">
              {panelError}
            </Alert>
          ) : null}

          {selectedTransactionIds.size > 1 ? (
            <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
              <Stack gap="sm">
                <div>
                  <Text fw={700}>Edição em massa</Text>
                  <Text size="xs" c="dimmed">
                    {selectedTransactionIds.size} compras selecionadas
                  </Text>
                </div>
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                  <Select
                    label="Status"
                    data={[{ value: emptySelectValue, label: "Manter status atual" }, ...transactionStatuses]}
                    value={bulkStatus}
                    onChange={(value) => setBulkStatus(value ?? emptySelectValue)}
                  />
                  <Select
                    label="Categoria"
                    data={[
                      { value: emptySelectValue, label: "Manter categoria atual" },
                      { value: "__clear__", label: "Sem categoria" },
                      ...buildCategoryGroups(categories)
                    ]}
                    value={bulkSubcategoryId}
                    onChange={(value) => setBulkSubcategoryId(value ?? emptySelectValue)}
                    searchable
                    renderOption={renderCategoryOption}
                  />
                  <Group align="flex-end">
                    <Button
                      fullWidth
                      loading={isBulkSaving}
                      onClick={() => void applyBulkEdits()}
                    >
                      Aplicar
                    </Button>
                  </Group>
                </SimpleGrid>
              </Stack>
            </Box>
          ) : null}

          {transactions.length === 0 ? (
            <Group p="xl" gap="xs" c="dimmed">
              <IconAlertCircle size={16} />
              <Text size="sm">Nenhuma compra encontrada com os filtros atuais.</Text>
            </Group>
          ) : (
            <Table.ScrollContainer minWidth={860}>
              <Table verticalSpacing="xs" fz="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 44 }}>
                      <Checkbox
                        aria-label="Selecionar compras visíveis"
                        checked={allVisibleSelected}
                        indeterminate={hasVisibleSelection && !allVisibleSelected}
                        onChange={toggleSelectAllTransactions}
                      />
                    </Table.Th>
                    <Table.Th>Data</Table.Th>
                    <Table.Th>Descrição</Table.Th>
                    <Table.Th>Valor</Table.Th>
                    <Table.Th>Categoria</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Ações</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {transactions.map((transaction) => (
                    <Table.Tr key={transaction.id}>
                      <Table.Td>
                        <Checkbox
                          aria-label={`Selecionar compra ${transaction.description}`}
                          checked={selectedTransactionIds.has(transaction.id)}
                          onChange={() => toggleTransactionSelection(transaction.id)}
                        />
                      </Table.Td>
                      <Table.Td c="dimmed">{formatBusinessDateForDisplay(transaction.eventDate)}</Table.Td>
                      <Table.Td>
                        <Text fw={500}>{transaction.description}</Text>
                        {transaction.notes ? (
                          <Text size="xs" c="dimmed">{transaction.notes}</Text>
                        ) : null}
                      </Table.Td>
                      <Table.Td>
                        <Text fw={700} c="red">
                          − {formatMoney(moneyFromCents(transaction.amountCents))}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Select
                          size="xs"
                          variant="unstyled"
                          placeholder="Sem categoria"
                          data={[
                            { value: emptySelectValue, label: "Sem categoria" },
                            ...buildCategoryGroups(categories)
                          ]}
                          value={transaction.subcategoryId ?? emptySelectValue}
                          onChange={(value) =>
                            void updateCategoryInline(transaction, value ?? emptySelectValue)
                          }
                          searchable
                          styles={{
                            input: {
                              cursor: "pointer",
                              fontWeight: 500,
                              padding: 0,
                              minHeight: "unset",
                              height: "auto"
                            },
                            root: { minWidth: 170 }
                          }}
                          renderOption={renderCategoryOption}
                        />
                      </Table.Td>
                      <Table.Td>{renderStatusBadge(transaction.status)}</Table.Td>
                      <Table.Td>
                        <Tooltip label="Editar compra">
                          <ActionIcon
                            variant="subtle"
                            aria-label={`Editar compra ${transaction.description}`}
                            onClick={() => openEditModal(transaction)}
                          >
                            <IconEdit size={18} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Stack>
      )}
      <Drawer
        opened={editingTransaction !== null}
        onClose={closeEditModal}
        title="Editar compra do cartão"
        position="right"
        size="md"
        padding="lg"
      >
        <Stack gap="md" h="100%">
          {editError ? (
            <Alert color="red" variant="light">
              {editError}
            </Alert>
          ) : null}

          <TextInput
            label="Descrição"
            value={editForm.description}
            onChange={(event) =>
              setEditForm((current) => ({ ...current, description: event.currentTarget.value }))
            }
            required
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Data da compra"
              type="date"
              value={editForm.eventDate}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, eventDate: event.currentTarget.value }))
              }
              required
            />
            <NumberInput
              label="Valor"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              prefix="R$ "
              decimalSeparator=","
              thousandSeparator="."
              value={editForm.amountReais}
              onChange={(value) =>
                setEditForm((current) => ({ ...current, amountReais: value }))
              }
              required
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="Categoria"
              data={[
                { value: emptySelectValue, label: "Sem categoria" },
                ...buildCategoryGroups(categories)
              ]}
              value={editForm.subcategoryId}
              onChange={(value) =>
                setEditForm((current) => ({ ...current, subcategoryId: value ?? emptySelectValue }))
              }
              searchable
              renderOption={renderCategoryOption}
            />
            <Select
              label="Status"
              data={transactionStatuses}
              value={editForm.status}
              onChange={(value) =>
                setEditForm((current) => ({ ...current, status: value ?? "planned" }))
              }
              required
            />
          </SimpleGrid>

          <Textarea
            label="Observação"
            autosize
            minRows={2}
            value={editForm.notes}
            onChange={(event) =>
              setEditForm((current) => ({ ...current, notes: event.currentTarget.value }))
            }
          />

          <Group
            justify="flex-end"
            mt="auto"
            pt="md"
            pb="md"
            bg="var(--mantine-color-body)"
            style={{
              borderTop: "1px solid var(--mantine-color-gray-2)",
              position: "sticky",
              bottom: 0,
              zIndex: 10
            }}
          >
            <Button variant="subtle" onClick={closeEditModal} disabled={isSavingEdit}>
              Cancelar
            </Button>
            <Button onClick={() => void saveEditedTransaction()} loading={isSavingEdit}>
              Salvar
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </Paper>
  );
}

function getMonthOptions() {
  const now = new Date();
  const options = [];
  // Exibiremos de -3 meses ate +8 meses do mes atual
  for (let i = -3; i <= 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(d).replace(".", "");
    options.push({ value, label });
  }
  return options;
}

function renderStatusBadge(status: string) {
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

function buildEditForm(transaction: CardTransaction | null): CardTransactionEditForm {
  return {
    description: transaction?.description ?? "",
    amountReais: transaction ? moneyFromCents(transaction.amountCents) : 0,
    eventDate: transaction?.eventDate ?? today,
    subcategoryId: transaction?.subcategoryId ?? emptySelectValue,
    status: transaction?.status ?? "planned",
    notes: transaction?.notes ?? ""
  };
}

function parseCardTransactionAmount(value: number | string) {
  if (typeof value === "number") {
    return Math.round(value * 100);
  }

  return parseMoneyToCents(value);
}

function buildCategoryGroups(categories: Category[]) {
  return categories
    .filter((category) => category.nature === "expense")
    .map((category) => ({
      group: category.name,
      items: category.subcategories.map((sub) => ({
        value: sub.id,
        label: `${category.name} > ${sub.name}`,
        color: getCategoryColor(category.id)
      } as unknown as { value: string; label: string; color: string }))
    }))
    .filter((group) => group.items.length > 0);
}

function renderCategoryOption({
  option
}: {
  option: { label: string };
}) {
  const text = option.label.includes(" > ") ? option.label.split(" > ")[1] : option.label;
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

async function getResponseError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? fallback;
  } catch {
    return fallback;
  }
}
