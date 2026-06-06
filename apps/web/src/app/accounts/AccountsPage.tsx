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
  Stack,
  Table,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { accountTypes, formatMoney, moneyFromCents, parseMoneyToCents } from "@finances/domain";
import { IconArchive, IconArchiveOff, IconEdit, IconPlus } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

type Account = {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  initialBalanceCents: number;
  isActive: boolean;
};

type AccountFormState = {
  name: string;
  type: string;
  institution: string;
  initialBalanceReais: number | string;
};

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const emptyForm: AccountFormState = {
  name: "",
  type: "checking",
  institution: "",
  initialBalanceReais: 0
};

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const activeTotal = useMemo(
    () =>
      accounts
        .filter((account) => account.isActive)
        .reduce((total, account) => total + account.initialBalanceCents, 0),
    [accounts]
  );

  async function loadAccounts() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/accounts?includeInactive=${includeInactive}`);

      if (!response.ok) {
        throw new Error("Não foi possível carregar as contas.");
      }

      setAccounts(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, [includeInactive]);

  function openCreateModal() {
    setEditingAccount(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  }

  function openEditModal(account: Account) {
    setEditingAccount(account);
    setForm({
      name: account.name,
      type: account.type,
      institution: account.institution ?? "",
      initialBalanceReais: account.initialBalanceCents / 100
    });
    setIsModalOpen(true);
  }

  async function saveAccount() {
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        name: form.name,
        type: form.type,
        institution: form.institution,
        initialBalanceCents: parseInitialBalanceToCents(form.initialBalanceReais)
      };
      const response = await fetch(
        editingAccount ? `${apiBaseUrl}/accounts/${editingAccount.id}` : `${apiBaseUrl}/accounts`,
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

      setIsModalOpen(false);
      await loadAccounts();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro inesperado.");
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveAccount(account: Account) {
    const confirmed = window.confirm(`Arquivar a conta "${account.name}"?`);

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/accounts/${account.id}/archive`, {
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível arquivar a conta."));
      }

      await loadAccounts();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Erro inesperado.");
    }
  }

  async function restoreAccount(account: Account) {
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/accounts/${account.id}/restore`, {
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, "Não foi possível restaurar a conta."));
      }

      await loadAccounts();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Erro inesperado.");
    }
  }

  return (
    <Stack gap="lg">
      <Paper withBorder p="xl" radius="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Contas</Title>
            <Text c="dimmed" mt={6}>
              Cadastre contas correntes, carteiras, benefícios e contas de investimento.
            </Text>
          </div>
          <Button leftSection={<IconPlus size={18} />} onClick={openCreateModal}>
            Nova conta
          </Button>
        </Group>
      </Paper>

      <Paper withBorder p="lg" radius="md">
        <Group justify="space-between">
          <div>
            <Text size="sm" c="dimmed">
              Saldo inicial ativo
            </Text>
            <Title order={3}>{formatMoney(moneyFromCents(activeTotal))}</Title>
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

      <Paper withBorder radius="md">
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
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nome</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Instituição</Table.Th>
                  <Table.Th>Saldo inicial</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Ações</Table.Th>
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
                    <Table.Td>
                      <Badge color={account.isActive ? "teal" : "gray"} variant="light">
                        {account.isActive ? "Ativa" : "Arquivada"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
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
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <Select
            label="Tipo"
            data={accountTypes}
            value={form.type}
            onChange={(value) => setForm((current) => ({ ...current, type: value ?? "checking" }))}
            required
          />
          <TextInput
            label="Instituição"
            placeholder="Banco, carteira ou benefício"
            value={form.institution}
            onChange={(event) =>
              setForm((current) => ({ ...current, institution: event.target.value }))
            }
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
          />
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
    </Stack>
  );
}

function getAccountTypeLabel(type: string) {
  return accountTypes.find((accountType) => accountType.value === type)?.label ?? type;
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

function parseInitialBalanceToCents(value: number | string) {
  if (typeof value === "number") {
    return moneyFromCents(Math.round(value * 100));
  }

  if (!value.trim()) {
    return 0;
  }

  return parseMoneyToCents(value);
}
