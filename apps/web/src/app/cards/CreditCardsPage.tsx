import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip
} from "@mantine/core";
import { formatMoney, moneyFromCents } from "@finances/domain";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCreditCard,
  IconEdit,
  IconEraser,
  IconPlus,
  IconArchive,
  IconRestore,
  IconStar,
  IconStarFilled
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const emptySelectValue = "__none__";

type CreditCard = {
  id: string;
  name: string;
  institution: string | null;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string | null;
  limitCents: number | null;
  isDefault: boolean;
  isActive: boolean;
};

type Account = {
  id: string;
  name: string;
  isActive: boolean;
};

type CardFormState = {
  name: string;
  institution: string;
  closingDay: number | string;
  dueDay: number | string;
  paymentAccountId: string;
  limitCents: number | string;
};

const emptyForm: CardFormState = {
  name: "",
  institution: "",
  closingDay: 1,
  dueDay: 10,
  paymentAccountId: emptySelectValue,
  limitCents: ""
};

export function CreditCardsPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [form, setForm] = useState<CardFormState>(emptyForm);
  const [showInactive, setShowInactive] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const accountOptions = useMemo(
    () => [
      { value: emptySelectValue, label: "Sem conta vinculada" },
      ...accounts.map((a) => ({ value: a.id, label: a.name }))
    ],
    [accounts]
  );

  const visibleCards = useMemo(
    () => (showInactive ? cards : cards.filter((c) => c.isActive)),
    [cards, showInactive]
  );

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [cardsRes, accountsRes] = await Promise.all([
        fetch(`${apiBaseUrl}/credit-cards?includeInactive=true`),
        fetch(`${apiBaseUrl}/accounts`)
      ]);
      if (!cardsRes.ok || !accountsRes.ok) throw new Error("Erro ao carregar dados.");
      setCards(await cardsRes.json());
      setAccounts(await accountsRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!isDrawerOpen) return;
    window.setTimeout(() => nameInputRef.current?.focus(), 120);
  }, [isDrawerOpen, editingCard]);

  function openCreateDrawer() {
    setEditingCard(null);
    setDrawerError(null);
    setForm(emptyForm);
    setIsDrawerOpen(true);
  }

  function openEditDrawer(card: CreditCard) {
    setEditingCard(card);
    setDrawerError(null);
    setForm({
      name: card.name,
      institution: card.institution ?? "",
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      paymentAccountId: card.paymentAccountId ?? emptySelectValue,
      limitCents: card.limitCents != null ? card.limitCents / 100 : ""
    });
    setIsDrawerOpen(true);
  }

  function discardDraft() {
    setEditingCard(null);
    setDrawerError(null);
    setForm(emptyForm);
    window.setTimeout(() => nameInputRef.current?.focus(), 120);
  }

  async function saveCard() {
    setIsSaving(true);
    setDrawerError(null);
    try {
      if (!form.name.trim()) throw new Error("Informe o nome do cartão.");
      const closingDay = Number(form.closingDay);
      const dueDay = Number(form.dueDay);
      if (!closingDay || closingDay < 1 || closingDay > 31) throw new Error("Dia de fechamento inválido (1–31).");
      if (!dueDay || dueDay < 1 || dueDay > 31) throw new Error("Dia de vencimento inválido (1–31).");

      const body = {
        name: form.name.trim(),
        institution: form.institution.trim() || null,
        closingDay,
        dueDay,
        paymentAccountId: form.paymentAccountId === emptySelectValue ? null : form.paymentAccountId,
        limitCents: Number(form.limitCents) > 0 ? Math.round(Number(form.limitCents) * 100) : null
      };

      const url = editingCard
        ? `${apiBaseUrl}/credit-cards/${editingCard.id}`
        : `${apiBaseUrl}/credit-cards`;
      const method = editingCard ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? "Erro ao salvar cartão.");
      }

      setEditingCard(null);
      setForm(emptyForm);
      setIsDrawerOpen(false);
      await loadData();
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveCard(card: CreditCard) {
    if (!window.confirm(`Arquivar o cartão "${card.name}"?`)) return;
    try {
      await fetch(`${apiBaseUrl}/credit-cards/${card.id}/archive`, { method: "PATCH" });
      await loadData();
    } catch {
      setError("Erro ao arquivar cartão.");
    }
  }

  async function restoreCard(card: CreditCard) {
    try {
      await fetch(`${apiBaseUrl}/credit-cards/${card.id}/restore`, { method: "PATCH" });
      await loadData();
    } catch {
      setError("Erro ao restaurar cartão.");
    }
  }

  async function setDefaultCard(card: CreditCard) {
    try {
      await fetch(`${apiBaseUrl}/credit-cards/${card.id}/set-default`, { method: "PATCH" });
      await loadData();
    } catch {
      setError("Erro ao definir cartão padrão.");
    }
  }

  return (
    <Stack gap="lg">
      {/* Header */}
      <Paper withBorder p="xl" radius="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <div>
            <Title order={2}>Cartões de crédito</Title>
            <Text c="dimmed" mt={6}>
              Cadastre cartões, acompanhe faturas e lançamentos por mês de vencimento.
            </Text>
          </div>
          <Group gap="xs">
            <Button
              variant="light"
              size="sm"
              onClick={() => setShowInactive((v) => !v)}
            >
              {showInactive ? "Ocultar arquivados" : "Ver arquivados"}
            </Button>
            <Button leftSection={<IconPlus size={18} />} onClick={openCreateDrawer}>
              Novo cartão
            </Button>
          </Group>
        </Group>
      </Paper>

      {error ? (
        <Alert color="red" variant="light">{error}</Alert>
      ) : null}

      {/* Card list */}
      <Paper withBorder radius="md">
        {isLoading ? (
          <Group justify="center" p="xl">
            <Loader />
          </Group>
        ) : visibleCards.length === 0 ? (
          <Stack align="center" p="xl" gap="xs">
            <Title order={4}>Nenhum cartão cadastrado</Title>
            <Text c="dimmed">Cadastre o primeiro cartão para acompanhe faturas.</Text>
            <Button mt="sm" leftSection={<IconPlus size={18} />} onClick={openCreateDrawer}>
              Criar cartão
            </Button>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={640}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Cartão</Table.Th>
                  <Table.Th>Instituição</Table.Th>
                  <Table.Th>Fechamento</Table.Th>
                  <Table.Th>Vencimento</Table.Th>
                  <Table.Th>Limite</Table.Th>
                  <Table.Th>Conta</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visibleCards.map((card) => (
                  <Table.Tr key={card.id} opacity={card.isActive ? 1 : 0.5}>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <IconCreditCard size={16} />
                        <Text fw={600}>{card.name}</Text>
                        {card.isDefault && (
                          <Badge variant="filled" color="yellow" size="xs">
                            Padrão
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>{card.institution ?? "—"}</Table.Td>
                    <Table.Td>dia {card.closingDay}</Table.Td>
                    <Table.Td>dia {card.dueDay}</Table.Td>
                    <Table.Td>
                      {card.limitCents != null
                        ? formatMoney(moneyFromCents(card.limitCents))
                        : "—"}
                    </Table.Td>
                    <Table.Td>
                      {accounts.find((a) => a.id === card.paymentAccountId)?.name ?? "—"}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={card.isActive ? "teal" : "gray"}>
                        {card.isActive ? "Ativo" : "Arquivado"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {card.isActive && (
                          <Tooltip label={card.isDefault ? "Cartão padrão" : "Definir como padrão"}>
                            <ActionIcon
                              variant="subtle"
                              color={card.isDefault ? "yellow" : "gray"}
                              onClick={() => void setDefaultCard(card)}
                              aria-label="Definir cartão como padrão"
                            >
                              {card.isDefault ? <IconStarFilled size={18} /> : <IconStar size={18} />}
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <ActionIcon
                          variant="subtle"
                          aria-label="Editar cartão"
                          onClick={() => openEditDrawer(card)}
                        >
                          <IconEdit size={18} />
                        </ActionIcon>
                        {card.isActive ? (
                          <Tooltip label="Arquivar cartão">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label="Arquivar cartão"
                              onClick={() => void archiveCard(card)}
                            >
                              <IconArchive size={18} />
                            </ActionIcon>
                          </Tooltip>
                        ) : (
                          <Tooltip label="Restaurar cartão">
                            <ActionIcon
                              variant="subtle"
                              color="teal"
                              aria-label="Restaurar cartão"
                              onClick={() => void restoreCard(card)}
                            >
                              <IconRestore size={18} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}

      </Paper>

      {/* Create / Edit Drawer */}
      <Drawer
        opened={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        position="right"
        size="min(100vw, 480px)"
        withCloseButton={false}
        title={
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <Tooltip label="Fechar">
              <ActionIcon
                variant="subtle"
                aria-label="Fechar painel"
                onClick={() => setIsDrawerOpen(false)}
              >
                <IconChevronRight size={20} />
              </ActionIcon>
            </Tooltip>
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text size="xs" tt="uppercase" fw={700} c="teal">
                Cartão de crédito
              </Text>
              <Title order={3} style={{ overflowWrap: "anywhere" }}>
                {editingCard ? "Editar cartão" : "Novo cartão"}
              </Title>
              <Text size="sm" c="dimmed">
                {editingCard ? "Atualize os dados e salve." : "Preencha os dados do cartão."}
              </Text>
            </Stack>
          </Group>
        }
      >
        <Stack mih="calc(100vh - 170px)" pb={0}>
          {drawerError ? (
            <Alert color="red" variant="light">{drawerError}</Alert>
          ) : null}

          <TextInput
            ref={nameInputRef}
            label="Nome do cartão"
            placeholder="Ex: Nubank, Inter Gold..."
            value={form.name}
            onChange={(e) => {
              const { value } = e.currentTarget;
              setForm((f) => ({ ...f, name: value }));
            }}
            required
          />
          <TextInput
            label="Instituição"
            placeholder="Ex: Nubank, Bradesco..."
            value={form.institution}
            onChange={(e) => {
              const { value } = e.currentTarget;
              setForm((f) => ({ ...f, institution: value }));
            }}
          />
          <Group grow>
            <NumberInput
              label="Dia de fechamento"
              min={1}
              max={31}
              value={form.closingDay}
              onChange={(v) => setForm((f) => ({ ...f, closingDay: v }))}
              onFocus={(e) => e.currentTarget.select()}
              required
            />
            <NumberInput
              label="Dia de vencimento"
              min={1}
              max={31}
              value={form.dueDay}
              onChange={(v) => setForm((f) => ({ ...f, dueDay: v }))}
              onFocus={(e) => e.currentTarget.select()}
              required
            />
          </Group>
          <Select
            label="Conta de pagamento"
            data={accountOptions}
            value={form.paymentAccountId}
            onChange={(v) => setForm((f) => ({ ...f, paymentAccountId: v ?? emptySelectValue }))}
          />
          <NumberInput
            label="Limite"
            decimalScale={2}
            fixedDecimalScale
            thousandSeparator="."
            decimalSeparator=","
            prefix="R$ "
            min={0}
            step={0.01}
            value={form.limitCents}
            onChange={(v) => setForm((f) => ({ ...f, limitCents: v }))}
            onFocus={(e) => e.currentTarget.select()}
          />

          <Group justify="flex-end">
            <Button onClick={() => void saveCard()} loading={isSaving}>
              Salvar
            </Button>
          </Group>
        </Stack>

        <Group
          justify="space-between"
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
          <Text size="xs" c="dimmed">Rascunho</Text>
          <Tooltip label="Limpar formulário">
            <ActionIcon
              size="lg"
              variant="subtle"
              color="gray"
              aria-label="Limpar formulário"
              onClick={discardDraft}
            >
              <IconEraser size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Drawer>

      {!isDrawerOpen ? (
        <Box
          style={{
            position: "fixed",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 100
          }}
        >
          <Tooltip label="Novo cartão">
            <ActionIcon
              size="xl"
              radius={0}
              variant="filled"
              aria-label="Novo cartão"
              onClick={openCreateDrawer}
            >
              <IconChevronLeft size={24} />
            </ActionIcon>
          </Tooltip>
        </Box>
      ) : null}
    </Stack>
  );
}
