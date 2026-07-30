import { apiClient } from "../shared/api-client.js";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Drawer,
  Group,
  Loader,
  Modal,
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
import { accountTypes, formatMoney, moneyFromCents, parseMoneyToCents } from "@finances/domain";
import {
  IconArchive,
  IconArchiveOff,
  IconCreditCard,
  IconEdit,
  IconPlus,
  IconStar,
  IconStarFilled
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  accountSchema,
  accountsSchema,
  creditCardSchema,
  creditCardsSchema,
  paymentMethodSchema,
  type Account,
  type CreditCard,
  type PaymentMethod
} from "../shared/api-contracts";
import { getErrorMessage, getResponseError, reportClientError } from "../shared/errors";
import { emptySelectValue } from "../shared/payment-source-options";
import {
  buildAccountPayload,
  createAccountForm,
  setDefaultPaymentMethod,
  suggestPaymentMethods,
  togglePaymentMethod,
  type AccountFormState
} from "./account-form-state";
import { TransferDialog } from "./TransferDialog";

type CardFormState = {
  name: string;
  institution: string;
  closingDay: number | string;
  dueDay: number | string;
  paymentAccountId: string;
  limitReais: number | string;
};

const emptyForm = createAccountForm({ methods: [] });

const emptyCardForm: CardFormState = {
  name: "",
  institution: "",
  closingDay: 1,
  dueDay: 10,
  paymentAccountId: emptySelectValue,
  limitReais: ""
};

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCardsLoading, setIsCardsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeInactiveCards, setIncludeInactiveCards] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isCardDrawerOpen, setIsCardDrawerOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [form, setForm] = useState<AccountFormState>(emptyForm);
  const [cardForm, setCardForm] = useState<CardFormState>(emptyCardForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isCardSaving, setIsCardSaving] = useState(false);

  const accountOptions = useMemo(
    () => [
      { value: emptySelectValue, label: "Sem conta vinculada" },
      ...accounts
        .filter((account) => account.isActive)
        .map((account) => ({
          value: account.id,
          label: account.name
        }))
    ],
    [accounts]
  );
  const visibleCards = useMemo(
    () => (includeInactiveCards ? cards : cards.filter((card) => card.isActive)),
    [cards, includeInactiveCards]
  );
  const activeCards = useMemo(() => cards.filter((card) => card.isActive), [cards]);

  async function loadPaymentMethods() {
    const response = await apiClient.raw(`/payment-methods`);

    if (!response.ok) {
      throw new Error("Não foi possível carregar os meios de pagamento.");
    }

    setPaymentMethods(z.array(paymentMethodSchema).parse(await response.json()));
  }

  async function loadAccounts() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.raw(`/accounts?includeInactive=${includeInactive}`);

      if (!response.ok) {
        throw new Error("Não foi possível carregar as contas.");
      }

      setAccounts(accountsSchema.parse(await response.json()));
    } catch (loadError) {
      reportClientError("accounts.loadAccounts", loadError);
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCards() {
    setIsCardsLoading(true);
    setError(null);

    try {
      const response = await apiClient.raw(`/credit-cards?includeInactive=true`);

      if (!response.ok) {
        throw new Error("Não foi possível carregar os cartões.");
      }

      setCards(creditCardsSchema.parse(await response.json()));
    } catch (loadError) {
      reportClientError("accounts.loadCards", loadError);
      setError(getErrorMessage(loadError));
    } finally {
      setIsCardsLoading(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, [includeInactive]);

  useEffect(() => {
    void loadPaymentMethods().catch((loadError) => {
      reportClientError("accounts.loadReferences", loadError);
      setError(getErrorMessage(loadError));
    });
  }, []);

  useEffect(() => {
    void loadCards();
  }, []);

  function openCreateModal() {
    setEditingAccount(null);
    setForm(createAccountForm({ sortOrder: accounts.length, methods: paymentMethods }));
    setIsModalOpen(true);
  }

  function openEditModal(account: Account) {
    setEditingAccount(account);
    setForm({
      name: account.name,
      type: account.type,
      institution: account.institution ?? "",
      initialBalanceReais:
        account.initialBalanceCents === 0 ? "" : account.initialBalanceCents / 100,
      sortOrder: account.sortOrder,
      isPrimary: account.isPrimary,
      paymentMethods: account.paymentMethods
        .filter((item) => item.isActive)
        .map((item) => ({ paymentMethodId: item.paymentMethodId, isDefault: item.isDefault }))
    });
    setIsModalOpen(true);
  }

  function openCreateCardDrawer() {
    setEditingCard(null);
    setCardForm({
      ...emptyCardForm,
      paymentAccountId:
        accounts.find((account) => account.isPrimary && account.isActive)?.id ?? emptySelectValue
    });
    setIsCardDrawerOpen(true);
  }

  function openEditCardDrawer(card: CreditCard) {
    setEditingCard(card);
    setCardForm({
      name: card.name,
      institution: card.institution ?? "",
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      paymentAccountId: card.paymentAccountId ?? emptySelectValue,
      limitReais: card.limitCents != null ? card.limitCents / 100 : ""
    });
    setIsCardDrawerOpen(true);
  }

  async function saveAccount() {
    setIsSaving(true);
    setError(null);

    try {
      const payload = buildAccountPayload(form);
      const response = await apiClient.raw(
        editingAccount ? `/accounts/${editingAccount.id}` : `/accounts`,
        {
          method: editingAccount ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível salvar a conta."));
      }

      accountSchema.parse(await response.json());

      setIsModalOpen(false);
      await loadAccounts();
    } catch (saveError) {
      reportClientError("accounts.saveAccount", saveError);
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCard() {
    setIsCardSaving(true);
    setError(null);

    try {
      if (!cardForm.name.trim()) {
        throw new Error("Informe o nome do cartão.");
      }

      const closingDay = Number(cardForm.closingDay);
      const dueDay = Number(cardForm.dueDay);

      if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31) {
        throw new Error("Dia de fechamento inválido.");
      }

      if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
        throw new Error("Dia de vencimento inválido.");
      }

      const payload = {
        name: cardForm.name.trim(),
        institution: cardForm.institution.trim() || null,
        closingDay,
        dueDay,
        paymentAccountId: toNullableSelectValue(cardForm.paymentAccountId),
        limitCents: parseOptionalMoneyToCents(cardForm.limitReais)
      };
      const response = await apiClient.raw(
        editingCard ? `/credit-cards/${editingCard.id}` : `/credit-cards`,
        {
          method: editingCard ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível salvar o cartão."));
      }

      const savedCard = creditCardSchema.parse(await response.json());
      const shouldSetAsDefault = !editingCard && activeCards.length === 0 && savedCard?.id;

      if (shouldSetAsDefault) {
        await apiClient.raw(`/credit-cards/${savedCard.id}/set-default`, { method: "PATCH" });
      }

      setIsCardDrawerOpen(false);
      await loadCards();
    } catch (saveError) {
      reportClientError("accounts.saveCard", saveError);
      setError(getErrorMessage(saveError));
    } finally {
      setIsCardSaving(false);
    }
  }

  async function archiveAccount(account: Account) {
    const confirmed = window.confirm(`Arquivar a conta "${account.name}"?`);

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      const response = await apiClient.raw(`/accounts/${account.id}/archive`, {
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível arquivar a conta."));
      }

      await loadAccounts();
    } catch (archiveError) {
      reportClientError("accounts.archiveAccount", archiveError);
      setError(getErrorMessage(archiveError));
    }
  }

  async function restoreAccount(account: Account) {
    setError(null);

    try {
      const response = await apiClient.raw(`/accounts/${account.id}/restore`, {
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível restaurar a conta."));
      }

      await loadAccounts();
    } catch (restoreError) {
      reportClientError("accounts.restoreAccount", restoreError);
      setError(getErrorMessage(restoreError));
    }
  }

  async function archiveCard(card: CreditCard) {
    const confirmed = window.confirm(`Arquivar o cartão "${card.name}"?`);

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      const response = await apiClient.raw(`/credit-cards/${card.id}/archive`, {
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível arquivar o cartão."));
      }

      await loadCards();
    } catch (archiveError) {
      reportClientError("accounts.archiveCard", archiveError);
      setError(getErrorMessage(archiveError));
    }
  }

  async function restoreCard(card: CreditCard) {
    setError(null);

    try {
      const response = await apiClient.raw(`/credit-cards/${card.id}/restore`, {
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível restaurar o cartão."));
      }

      await loadCards();
    } catch (restoreError) {
      reportClientError("accounts.restoreCard", restoreError);
      setError(getErrorMessage(restoreError));
    }
  }

  async function setDefaultCard(card: CreditCard) {
    setError(null);

    try {
      const response = await apiClient.raw(`/credit-cards/${card.id}/set-default`, {
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error(
          await getResponseError(response, "Não foi possível definir o cartão padrão.")
        );
      }

      await loadCards();
    } catch (defaultError) {
      reportClientError("accounts.setDefaultCard", defaultError);
      setError(getErrorMessage(defaultError));
    }
  }

  return (
    <Stack gap="lg">
      <Paper withBorder p="xl" radius="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Contas</Title>
            <Text c="dimmed" mt={6}>
              Cadastre contas, carteiras, benefícios e cartões de crédito em um só lugar.
            </Text>
          </div>
          <Group gap="xs">
            <Button
              variant="light"
              leftSection={<IconCreditCard size={18} />}
              onClick={openCreateCardDrawer}
            >
              Novo cartão
            </Button>
            <Button leftSection={<IconPlus size={18} />} onClick={openCreateModal}>
              Nova conta
            </Button>
          </Group>
        </Group>
      </Paper>

      {error ? (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      ) : null}

      <Paper withBorder radius="md">
        <Group justify="space-between" p="lg" pb={0}>
          <div>
            <Title order={3}>Contas e carteiras</Title>
            <Text size="sm" c="dimmed">
              Onde existe saldo: conta corrente, dinheiro, benefícios e investimentos.
            </Text>
          </div>
          <Group gap="xs">
            <Button
              variant="light"
              onClick={() => setIsTransferOpen(true)}
              disabled={accounts.filter((account) => account.isActive).length < 2}
            >
              Transferir
            </Button>
            <Checkbox
              checked={includeInactive}
              label="Mostrar arquivadas"
              onChange={(event) => setIncludeInactive(event.currentTarget.checked)}
            />
            <Button size="sm" leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
              Nova conta
            </Button>
          </Group>
        </Group>
        {isLoading ? (
          <Group justify="center" p="xl">
            <Loader />
          </Group>
        ) : accounts.length === 0 ? (
          <Stack align="center" p="xl" gap="xs">
            <Title order={4}>Nenhuma conta cadastrada</Title>
            <Text c="dimmed">Crie a primeira conta para começar o controle financeiro.</Text>
            <Button mt="sm" leftSection={<IconPlus size={18} />} onClick={openCreateModal}>
              Criar conta
            </Button>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={860}>
            <Table verticalSpacing="sm" fz="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ minWidth: 150 }}>Nome</Table.Th>
                  <Table.Th style={{ width: 100 }}>Tipo</Table.Th>
                  <Table.Th style={{ width: 120 }}>Instituição</Table.Th>
                  <Table.Th style={{ width: 120 }}>Saldo inicial</Table.Th>
                  <Table.Th style={{ width: 120 }}>Saldo atual</Table.Th>
                  <Table.Th style={{ width: 80 }}>Ordem</Table.Th>
                  <Table.Th style={{ width: 150 }}>Padrões</Table.Th>
                  <Table.Th style={{ width: 100 }}>Status</Table.Th>
                  <Table.Th style={{ width: 112 }}>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {accounts.map((account) => (
                  <Table.Tr key={account.id}>
                    <Table.Td>
                      <Text fw={600}>{account.name}</Text>
                    </Table.Td>
                    <Table.Td>{getAccountTypeLabel(account.type)}</Table.Td>
                    <Table.Td>{account.institution || "-"}</Table.Td>
                    <Table.Td>{formatMoney(moneyFromCents(account.initialBalanceCents))}</Table.Td>
                    <Table.Td
                      fw={700}
                      c={
                        (account.currentBalanceCents ?? account.initialBalanceCents) < 0
                          ? "red"
                          : "teal"
                      }
                    >
                      {formatMoney(
                        moneyFromCents(account.currentBalanceCents ?? account.initialBalanceCents)
                      )}
                    </Table.Td>
                    <Table.Td>{account.sortOrder}</Table.Td>
                    <Table.Td>
                      <Stack gap={4}>
                        {account.isPrimary ? (
                          <Badge color="blue" variant="light">
                            Principal
                          </Badge>
                        ) : null}
                        <Text size="sm" c="dimmed">
                          {account.paymentMethods
                            .filter((item) => item.isActive)
                            .map((item) => item.method.name)
                            .join(", ") || "Sem formas associadas"}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={account.isActive ? "teal" : "gray"} variant="light">
                        {account.isActive ? "Ativa" : "Arquivada"}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>
                      <Group gap="xs" wrap="nowrap">
                        <ActionIcon
                          variant="subtle"
                          aria-label="Editar conta"
                          onClick={() => openEditModal(account)}
                        >
                          <IconEdit size={18} />
                        </ActionIcon>
                        {account.isActive ? (
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label="Arquivar conta"
                            title="Arquivar conta"
                            onClick={() => void archiveAccount(account)}
                          >
                            <IconArchive size={18} />
                          </ActionIcon>
                        ) : (
                          <ActionIcon
                            variant="subtle"
                            color="teal"
                            aria-label="Restaurar conta"
                            title="Restaurar conta"
                            onClick={() => void restoreAccount(account)}
                          >
                            <IconArchiveOff size={18} />
                          </ActionIcon>
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

      <Paper withBorder radius="md">
        <Group justify="space-between" p="lg" pb={0} align="flex-start">
          <div>
            <Title order={3}>Cartões de crédito</Title>
            <Text size="sm" c="dimmed">
              Cadastre cartões e vincule uma conta de pagamento para faturas.
            </Text>
          </div>
          <Group gap="xs">
            <Checkbox
              checked={includeInactiveCards}
              label="Mostrar arquivados"
              onChange={(event) => setIncludeInactiveCards(event.currentTarget.checked)}
            />
            <Button
              size="sm"
              leftSection={<IconCreditCard size={16} />}
              onClick={openCreateCardDrawer}
            >
              Novo cartão
            </Button>
          </Group>
        </Group>
        {isCardsLoading ? (
          <Group justify="center" p="xl">
            <Loader />
          </Group>
        ) : visibleCards.length === 0 ? (
          <Stack align="center" p="xl" gap="xs">
            <Title order={4}>Nenhum cartão cadastrado</Title>
            <Text c="dimmed">Crie um cartão para acompanhar compras e faturas.</Text>
            <Button
              mt="sm"
              leftSection={<IconCreditCard size={18} />}
              onClick={openCreateCardDrawer}
            >
              Criar cartão
            </Button>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm" fz="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ minWidth: 160 }}>Cartão</Table.Th>
                  <Table.Th style={{ width: 130 }}>Instituição</Table.Th>
                  <Table.Th style={{ width: 110 }}>Fechamento</Table.Th>
                  <Table.Th style={{ width: 110 }}>Vencimento</Table.Th>
                  <Table.Th style={{ width: 120 }}>Limite</Table.Th>
                  <Table.Th style={{ width: 160 }}>Conta de pagamento</Table.Th>
                  <Table.Th style={{ width: 100 }}>Status</Table.Th>
                  <Table.Th style={{ width: 136 }}>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visibleCards.map((card) => (
                  <Table.Tr key={card.id} opacity={card.isActive ? 1 : 0.55}>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <IconCreditCard size={16} />
                        <Text fw={600}>{card.name}</Text>
                        {card.isDefault ? (
                          <Badge color="yellow" variant="light" size="xs">
                            Padrão
                          </Badge>
                        ) : null}
                      </Group>
                    </Table.Td>
                    <Table.Td>{card.institution || "-"}</Table.Td>
                    <Table.Td>Dia {card.closingDay}</Table.Td>
                    <Table.Td>Dia {card.dueDay}</Table.Td>
                    <Table.Td>
                      {card.limitCents != null ? formatMoney(moneyFromCents(card.limitCents)) : "-"}
                    </Table.Td>
                    <Table.Td>{getAccountLabel(card.paymentAccountId, accounts)}</Table.Td>
                    <Table.Td>
                      <Badge color={card.isActive ? "teal" : "gray"} variant="light">
                        {card.isActive ? "Ativo" : "Arquivado"}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>
                      <Group gap="xs" wrap="nowrap">
                        {card.isActive ? (
                          <Tooltip label={card.isDefault ? "Cartão padrão" : "Definir como padrão"}>
                            <ActionIcon
                              variant="subtle"
                              color={card.isDefault ? "yellow" : "gray"}
                              aria-label="Definir cartão como padrão"
                              onClick={() => void setDefaultCard(card)}
                            >
                              {card.isDefault ? (
                                <IconStarFilled size={18} />
                              ) : (
                                <IconStar size={18} />
                              )}
                            </ActionIcon>
                          </Tooltip>
                        ) : null}
                        <ActionIcon
                          variant="subtle"
                          aria-label="Editar cartão"
                          onClick={() => openEditCardDrawer(card)}
                        >
                          <IconEdit size={18} />
                        </ActionIcon>
                        {card.isActive ? (
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label="Arquivar cartão"
                            title="Arquivar cartão"
                            onClick={() => void archiveCard(card)}
                          >
                            <IconArchive size={18} />
                          </ActionIcon>
                        ) : (
                          <ActionIcon
                            variant="subtle"
                            color="teal"
                            aria-label="Restaurar cartão"
                            title="Restaurar cartão"
                            onClick={() => void restoreCard(card)}
                          >
                            <IconArchiveOff size={18} />
                          </ActionIcon>
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

      <TransferDialog
        opened={isTransferOpen}
        accounts={accounts}
        onClose={() => setIsTransferOpen(false)}
        onCreated={() => void loadAccounts()}
      />

      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAccount ? "Editar conta" : "Nova conta"}
      >
        <Stack>
          <TextInput
            label="Nome"
            placeholder="Conta principal"
            value={form.name}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setForm((current) => ({ ...current, name: value }));
            }}
            required
          />
          <Select
            label="Tipo"
            data={accountTypes}
            value={form.type}
            onChange={(value) => {
              const type = value ?? "checking";
              setForm((current) => ({
                ...current,
                type,
                paymentMethods: suggestPaymentMethods(type, paymentMethods)
              }));
            }}
            required
          />
          <TextInput
            label="Instituição"
            placeholder="Banco, carteira ou benefício"
            value={form.institution}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setForm((current) => ({ ...current, institution: value }));
            }}
          />
          <NumberInput
            label="Saldo inicial"
            decimalScale={2}
            fixedDecimalScale
            thousandSeparator="."
            decimalSeparator=","
            prefix="R$ "
            value={form.initialBalanceReais}
            onChange={(value) => setForm((current) => ({ ...current, initialBalanceReais: value }))}
            onFocus={(e) => e.currentTarget.select()}
          />
          <NumberInput
            label="Ordem"
            min={0}
            value={form.sortOrder}
            onChange={(value) => setForm((current) => ({ ...current, sortOrder: value }))}
            onFocus={(e) => e.currentTarget.select()}
          />
          <Checkbox
            label="Usar como conta principal"
            description="Novos lançamentos começam por esta conta."
            checked={form.isPrimary}
            onChange={(event) => {
              const { checked } = event.currentTarget;
              setForm((current) => ({ ...current, isPrimary: checked }));
            }}
          />
          <Stack gap="xs">
            <Text fw={500} size="sm">
              Formas permitidas
            </Text>
            <Text size="xs" c="dimmed">
              Escolha as formas aceitas nesta conta e marque uma como padrão.
            </Text>
            {paymentMethods
              .filter((method) => method.isActive)
              .map((method) => {
                const selected = form.paymentMethods.some(
                  (item) => item.paymentMethodId === method.id
                );
                const isDefault = form.paymentMethods.some(
                  (item) => item.paymentMethodId === method.id && item.isDefault
                );
                return (
                  <Group key={method.id} justify="space-between">
                    <Checkbox
                      label={method.name}
                      checked={selected}
                      onChange={(event) => {
                        const { checked } = event.currentTarget;
                        setForm((current) => ({
                          ...current,
                          paymentMethods: togglePaymentMethod(
                            current.paymentMethods,
                            method.id,
                            checked
                          )
                        }));
                      }}
                    />
                    <Button
                      size="compact-xs"
                      variant={isDefault ? "filled" : "subtle"}
                      disabled={!selected}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          paymentMethods: setDefaultPaymentMethod(current.paymentMethods, method.id)
                        }))
                      }
                    >
                      {isDefault ? "Padrão" : "Tornar padrão"}
                    </Button>
                  </Group>
                );
              })}
          </Stack>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveAccount()} loading={isSaving}>
              Salvar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Drawer
        opened={isCardDrawerOpen}
        onClose={() => setIsCardDrawerOpen(false)}
        position="right"
        size="min(100vw, 480px)"
        title={editingCard ? "Editar cartão" : "Novo cartão"}
      >
        <Stack>
          <TextInput
            label="Nome do cartão"
            placeholder="Nubank, Inter, C6..."
            value={cardForm.name}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setCardForm((current) => ({ ...current, name: value }));
            }}
            required
          />
          <TextInput
            label="Instituição"
            placeholder="Banco ou emissor"
            value={cardForm.institution}
            onChange={(event) => {
              const { value } = event.currentTarget;
              setCardForm((current) => ({ ...current, institution: value }));
            }}
          />
          <Group grow>
            <NumberInput
              label="Dia de fechamento"
              min={1}
              max={31}
              value={cardForm.closingDay}
              onChange={(value) => setCardForm((current) => ({ ...current, closingDay: value }))}
              onFocus={(e) => e.currentTarget.select()}
              required
            />
            <NumberInput
              label="Dia de vencimento"
              min={1}
              max={31}
              value={cardForm.dueDay}
              onChange={(value) => setCardForm((current) => ({ ...current, dueDay: value }))}
              onFocus={(e) => e.currentTarget.select()}
              required
            />
          </Group>
          <Select
            label="Conta de pagamento"
            description="Usada como sugestão ao pagar a fatura."
            data={accountOptions}
            value={cardForm.paymentAccountId}
            onChange={(value) =>
              setCardForm((current) => ({
                ...current,
                paymentAccountId: value ?? emptySelectValue
              }))
            }
          />
          <NumberInput
            label="Limite"
            decimalScale={2}
            fixedDecimalScale
            thousandSeparator="."
            decimalSeparator=","
            prefix="R$ "
            min={0}
            value={cardForm.limitReais}
            onChange={(value) => setCardForm((current) => ({ ...current, limitReais: value }))}
            onFocus={(e) => e.currentTarget.select()}
          />
          {!editingCard && activeCards.length === 0 ? (
            <Alert color="teal" variant="light">
              O primeiro cartão ativo será marcado como padrão automaticamente.
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setIsCardDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveCard()} loading={isCardSaving}>
              Salvar cartão
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </Stack>
  );
}

function getAccountTypeLabel(type: string) {
  return accountTypes.find((accountType) => accountType.value === type)?.label ?? type;
}

function getAccountLabel(accountId: string | null, accounts: Account[]) {
  return accounts.find((account) => account.id === accountId)?.name ?? "-";
}

function toNullableSelectValue(value: string) {
  return value === emptySelectValue ? null : value;
}

function parseOptionalMoneyToCents(value: number | string) {
  if (typeof value === "number") {
    return value > 0 ? Math.round(value * 100) : null;
  }

  if (!value.trim()) {
    return null;
  }

  const cents = parseMoneyToCents(value);
  return cents > 0 ? cents : null;
}
