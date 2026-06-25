import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  ThemeIcon,
  TextInput,
  Title,
  Tooltip
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconDatabase,
  IconDownload,
  IconTrash,
  IconHistory,
  IconCheck,
  IconRefresh,
  IconBrandGoogle,
  IconCloudUpload,
  IconCloudDownload
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { getErrorMessage, getResponseError, reportClientError } from "../shared/errors";

type BackupFile = {
  name: string;
  sizeBytes: number;
  createdAt: string;
  type: "manual" | "pre_restore";
};

type GDriveBackup = {
  id: string;
  name: string;
  size: number;
  createdAt: string;
};

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function SettingsPage() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Restore Modal State
  const [restoreTarget, setRestoreTarget] = useState<BackupFile | null>(null);
  const [confirmText, setConfirmText] = useState("");

  // Google Drive Settings State
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleSyncEnabled, setGoogleSyncEnabled] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleAccountEmail, setGoogleAccountEmail] = useState("");
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Cloud Backups List
  const [gdriveBackups, setGdriveBackups] = useState<GDriveBackup[]>([]);
  const [isLoadingGDriveBackups, setIsLoadingGDriveBackups] = useState(false);

  // Per-file cloud action loaders
  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});

  async function loadBackups() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/backups`);
      if (!response.ok) {
        throw new Error("Não foi possível carregar o histórico de backups.");
      }
      setBackups(await response.json());
    } catch (loadError) {
      reportClientError("settings.loadBackups", loadError);
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSettings() {
    setIsLoadingSettings(true);
    try {
      const res = await fetch(`${apiBaseUrl}/settings`);
      if (res.ok) {
        const data = await res.json();
        setGoogleClientId(data.googleClientId);
        setGoogleClientSecret(data.googleClientSecret);
        setGoogleSyncEnabled(data.googleSyncEnabled);
        setGoogleConnected(data.googleConnected);
        setGoogleAccountEmail(data.googleAccountEmail);
      }
    } catch (err) {
      reportClientError("settings.loadSettings", err);
    } finally {
      setIsLoadingSettings(false);
    }
  }

  async function loadGDriveBackups() {
    if (!googleConnected) return;
    setIsLoadingGDriveBackups(true);
    try {
      const res = await fetch(`${apiBaseUrl}/backups/gdrive`);
      if (res.ok) {
        setGdriveBackups(await res.json());
      }
    } catch (err) {
      reportClientError("settings.loadGDriveBackups", err);
    } finally {
      setIsLoadingGDriveBackups(false);
    }
  }

  // Parse redirect outcome query parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleAuth = params.get("googleAuth");
    const message = params.get("message");
    if (googleAuth === "success") {
      setSuccessMessage("Conectado ao Google Drive com sucesso!");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (googleAuth === "error") {
      setError(message || "Falha ao conectar com o Google Drive.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    void loadBackups();
    void loadSettings();
  }, []);

  useEffect(() => {
    if (googleConnected) {
      void loadGDriveBackups();
    }
  }, [googleConnected]);

  async function createBackup() {
    setIsCreating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/backups/create`, {
        method: "POST"
      });
      if (!response.ok) {
        throw new Error(await getResponseError(response, "Falha ao gerar o backup."));
      }
      const data = await response.json();
      setSuccessMessage(`Backup "${data.name}" criado com sucesso!`);
      
      // Auto-Sync to Google Drive if active
      if (googleSyncEnabled && googleConnected) {
        try {
          await fetch(`${apiBaseUrl}/backups/${data.name}/upload-gdrive`, { method: "POST" });
          setSuccessMessage(`Backup "${data.name}" criado localmente e sincronizado no Google Drive!`);
          void loadGDriveBackups();
        } catch {
          setSuccessMessage(`Backup "${data.name}" criado localmente, mas falhou ao sincronizar no Google Drive.`);
        }
      }

      await loadBackups();
    } catch (createError) {
      reportClientError("settings.createBackup", createError);
      setError(getErrorMessage(createError));
    } finally {
      setIsCreating(false);
    }
  }

  async function deleteBackup(name: string) {
    if (!window.confirm(`Excluir permanentemente o backup "${name}"?`)) {
      return;
    }
    setIsDeleting(name);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/backups/${name}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error(await getResponseError(response, "Falha ao excluir o backup."));
      }
      setSuccessMessage("Backup excluído com sucesso.");
      await loadBackups();
    } catch (deleteError) {
      reportClientError("settings.deleteBackup", deleteError);
      setError(getErrorMessage(deleteError));
    } finally {
      setIsDeleting(null);
    }
  }

  async function handleRestore() {
    if (!restoreTarget) return;

    setIsRestoring(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`${apiBaseUrl}/backups/${restoreTarget.name}/restore`, {
        method: "POST"
      });
      
      if (!response.ok) {
        throw new Error(await getResponseError(response, "Falha ao restaurar o banco de dados."));
      }
      
      setSuccessMessage("Restaurado com sucesso! Os dados ativos foram atualizados.");
      setRestoreTarget(null);
      setConfirmText("");
      await loadBackups();
    } catch (restoreError) {
      reportClientError("settings.handleRestore", restoreError);
      setError(getErrorMessage(restoreError));
    } finally {
      setIsRestoring(false);
    }
  }

  async function saveSettings() {
    setIsSavingSettings(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleClientId,
          googleClientSecret,
          googleSyncEnabled
        })
      });
      if (!res.ok) {
        throw new Error(await getResponseError(res, "Falha ao salvar configurações."));
      }
      setSuccessMessage("Configurações salvas com sucesso!");
      await loadSettings();
    } catch (err) {
      reportClientError("settings.saveSettings", err);
      setError(getErrorMessage(err));
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function connectGoogleDrive() {
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/google/url`, { method: "POST" });
      if (!res.ok) {
        throw new Error(await getResponseError(res, "Não foi possível gerar a URL de autorização do Google."));
      }
      const data = await res.json();
      window.location.href = data.url;
    } catch (err) {
      reportClientError("settings.connectGoogleDrive", err);
      setError(getErrorMessage(err));
    }
  }

  async function disconnectGoogleDrive() {
    if (!window.confirm("Desconectar sua conta do Google Drive?")) return;
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/google/disconnect`, { method: "POST" });
      if (!res.ok) {
        throw new Error("Falha ao desconectar.");
      }
      setSuccessMessage("Google Drive desconectado com sucesso.");
      setGdriveBackups([]);
      await loadSettings();
    } catch (err) {
      reportClientError("settings.disconnectGoogleDrive", err);
      setError(getErrorMessage(err));
    }
  }

  async function uploadToGDrive(name: string) {
    setIsUploading((prev) => ({ ...prev, [name]: true }));
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/backups/${name}/upload-gdrive`, { method: "POST" });
      if (!res.ok) {
        throw new Error(await getResponseError(res, "Falha ao enviar backup para o Google Drive."));
      }
      setSuccessMessage(`Backup "${name}" enviado com sucesso para o Google Drive!`);
      void loadGDriveBackups();
    } catch (err) {
      reportClientError("settings.uploadToGDrive", err);
      setError(getErrorMessage(err));
    } finally {
      setIsUploading((prev) => ({ ...prev, [name]: false }));
    }
  }

  async function downloadFromGDrive(id: string, name: string) {
    setIsDownloading((prev) => ({ ...prev, [id]: true }));
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/backups/gdrive/${id}/download`, { method: "POST" });
      if (!res.ok) {
        throw new Error(await getResponseError(res, "Falha ao baixar backup do Google Drive."));
      }
      setSuccessMessage(`Backup "${name}" baixado com sucesso!`);
      await loadBackups();
    } catch (err) {
      reportClientError("settings.downloadFromGDrive", err);
      setError(getErrorMessage(err));
    } finally {
      setIsDownloading((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <Stack gap="lg">
      <Paper withBorder p="xl" radius="md">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={2}>Configurações</Title>
            <Text c="dimmed" mt={6}>
              Gerencie backups, preferências e integridade dos dados do aplicativo.
            </Text>
          </Box>
        </Group>
      </Paper>

      {error && (
        <Alert color="red" variant="light" title="Erro" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert
          color="teal"
          variant="light"
          title="Sucesso"
          icon={<IconCheck size={18} />}
          withCloseButton
          onClose={() => setSuccessMessage(null)}
        >
          {successMessage}
        </Alert>
      )}

      <Tabs defaultValue="backups">
        <Tabs.List mb="md">
          <Tabs.Tab value="backups" leftSection={<IconDatabase size={16} />}>
            Backups Locais
          </Tabs.Tab>
          <Tabs.Tab value="gdrive" leftSection={<IconBrandGoogle size={16} />}>
            Google Drive
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="backups">
          <Stack gap="md">
            <Card withBorder radius="md" p="md">
              <Group justify="space-between" align="center">
                <Group gap="md">
                  <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                    <IconDatabase size={20} />
                  </ThemeIcon>
                  <Box>
                    <Text fw={600}>Banco de Dados Ativo</Text>
                    <Text size="xs" c="dimmed">
                      SQLite local: <span style={{ fontFamily: "monospace" }}>data/financas.sqlite</span>
                    </Text>
                  </Box>
                </Group>
                <Button
                  leftSection={isCreating ? <Loader size={14} color="white" /> : <IconDownload size={16} />}
                  onClick={createBackup}
                  disabled={isCreating || isRestoring}
                >
                  Criar Backup Manual
                </Button>
              </Group>
            </Card>

            <Paper withBorder radius="md">
              <Group justify="space-between" p="lg" pb="xs">
                <Box>
                  <Title order={3}>Backups Disponíveis</Title>
                  <Text size="sm" c="dimmed">
                    Lista de backups gerados manualmente e pontos de segurança automáticos (pré-restauração).
                  </Text>
                </Box>
                <Button
                  variant="subtle"
                  leftSection={<IconRefresh size={16} />}
                  onClick={loadBackups}
                  disabled={isLoading}
                >
                  Atualizar Lista
                </Button>
              </Group>

              {isLoading ? (
                <Group justify="center" p="xl">
                  <Loader />
                </Group>
              ) : backups.length === 0 ? (
                <Stack align="center" p="xl" gap="xs">
                  <Text c="dimmed">Nenhum backup encontrado em data/backups/.</Text>
                  <Button variant="light" mt="sm" onClick={createBackup} disabled={isCreating}>
                    Criar Primeiro Backup
                  </Button>
                </Stack>
              ) : (
                <Table.ScrollContainer minWidth={600}>
                  <Table verticalSpacing="sm" fz="sm" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Arquivo</Table.Th>
                        <Table.Th style={{ width: 140 }}>Tipo</Table.Th>
                        <Table.Th style={{ width: 180 }}>Data de Criação</Table.Th>
                        <Table.Th style={{ width: 120 }}>Tamanho</Table.Th>
                        <Table.Th style={{ width: 150, textAlign: "right" }}>Ações</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {backups.map((backup) => (
                        <Table.Tr key={backup.name}>
                          <Table.Td style={{ fontFamily: "monospace" }}>{backup.name}</Table.Td>
                          <Table.Td>
                            {backup.type === "pre_restore" ? (
                              <Badge color="orange" variant="light">
                                Pré-restauração
                              </Badge>
                            ) : (
                              <Badge color="blue" variant="light">
                                Manual
                              </Badge>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {new Date(backup.createdAt).toLocaleString("pt-BR")}
                          </Table.Td>
                          <Table.Td>{formatBytes(backup.sizeBytes)}</Table.Td>
                          <Table.Td>
                            <Group gap="xs" justify="flex-end">
                              {googleConnected && (
                                <Tooltip label="Enviar para o Google Drive">
                                  <ActionIcon
                                    variant="subtle"
                                    color="blue"
                                    onClick={() => void uploadToGDrive(backup.name)}
                                    disabled={
                                      isCreating ||
                                      isRestoring ||
                                      isUploading[backup.name]
                                    }
                                  >
                                    {isUploading[backup.name] ? (
                                      <Loader size={14} />
                                    ) : (
                                      <IconCloudUpload size={18} />
                                    )}
                                  </ActionIcon>
                                </Tooltip>
                              )}
                              <Tooltip label="Restaurar este backup">
                                <ActionIcon
                                  variant="subtle"
                                  color="teal"
                                  onClick={() => {
                                    setRestoreTarget(backup);
                                    setConfirmText("");
                                  }}
                                  disabled={isCreating || isRestoring}
                                >
                                  <IconHistory size={18} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Excluir backup">
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  onClick={() => void deleteBackup(backup.name)}
                                  disabled={
                                    isCreating ||
                                    isRestoring ||
                                    isDeleting === backup.name
                                  }
                                >
                                  {isDeleting === backup.name ? (
                                    <Loader size={14} color="red" />
                                  ) : (
                                    <IconTrash size={18} />
                                  )}
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Paper>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="gdrive">
          <Stack gap="md">
            <Card withBorder radius="md" p="md">
              <Stack gap="md">
                <Group gap="md">
                  <ThemeIcon size="lg" radius="md" variant="light" color="teal">
                    <IconBrandGoogle size={20} />
                  </ThemeIcon>
                  <Box>
                    <Text fw={600}>Configurações do Google Drive</Text>
                    <Text size="xs" c="dimmed">
                      Armazene seus backups de forma segura e automatizada na sua conta do Google Drive.
                    </Text>
                  </Box>
                </Group>

                <Alert color="blue" variant="light" icon={<IconAlertTriangle size={18} />}>
                  <Text size="xs">
                    Para habilitar o salvamento em nuvem, você deve inserir o <strong>Google OAuth Client ID</strong> e o <strong>Client Secret</strong> de um projeto configurado no Google Cloud Console com acesso à API do Google Drive (Authorized Redirect URI: <code>http://localhost:3000/auth/google/callback</code>).
                  </Text>
                </Alert>

                <Group grow align="flex-end">
                  <TextInput
                    label="Client ID do Google"
                    placeholder="Cole o Client ID da API do Google"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.currentTarget.value)}
                    disabled={isSavingSettings}
                  />
                  <TextInput
                    label="Client Secret do Google"
                    placeholder="Cole o Client Secret da API do Google"
                    type="password"
                    value={googleClientSecret}
                    onChange={(e) => setGoogleClientSecret(e.currentTarget.value)}
                    disabled={isSavingSettings}
                  />
                </Group>

                <Group justify="space-between">
                  <Switch
                    label="Sincronização Automática (Auto-Sync)"
                    description="Faz o upload automático do backup para o Drive sempre que um backup local for criado"
                    checked={googleSyncEnabled}
                    onChange={(e) => setGoogleSyncEnabled(e.currentTarget.checked)}
                    disabled={isSavingSettings}
                  />
                  <Button
                    onClick={saveSettings}
                    loading={isSavingSettings}
                    disabled={isLoadingSettings}
                  >
                    Salvar Configurações
                  </Button>
                </Group>
              </Stack>
            </Card>

            <Card withBorder radius="md" p="md">
              <Stack gap="xs">
                <Text fw={600} size="sm">Status da Conexão</Text>
                
                {isLoadingSettings ? (
                  <Loader size="sm" />
                ) : googleConnected ? (
                  <Group justify="space-between" align="center">
                    <Group gap="xs">
                      <Badge color="teal" variant="filled">
                        Conectado
                      </Badge>
                      <Text size="sm" fw={500}>
                        {googleAccountEmail || "Google Drive Ativo"}
                      </Text>
                    </Group>
                    <Button
                      variant="outline"
                      color="red"
                      onClick={disconnectGoogleDrive}
                    >
                      Desconectar Conta
                    </Button>
                  </Group>
                ) : (
                  <Group justify="space-between" align="center">
                    <Group gap="xs">
                      <Badge color="red" variant="filled">
                        Desconectado
                      </Badge>
                      <Text size="xs" c="dimmed">
                        Defina o Client ID e Secret e clique no botão para autorizar o acesso.
                      </Text>
                    </Group>
                    <Button
                      color="teal"
                      onClick={connectGoogleDrive}
                      disabled={!googleClientId || !googleClientSecret}
                    >
                      Conectar Conta Google
                    </Button>
                  </Group>
                )}
              </Stack>
            </Card>

            {googleConnected && (
              <Paper withBorder radius="md">
                <Group justify="space-between" p="lg" pb="xs">
                  <Box>
                    <Title order={3}>Arquivos de Backup na Nuvem</Title>
                    <Text size="sm" c="dimmed">
                      Backups armazenados na pasta "Finanças Pessoais" no seu Google Drive.
                    </Text>
                  </Box>
                  <Button
                    variant="subtle"
                    leftSection={<IconRefresh size={16} />}
                    onClick={loadGDriveBackups}
                    disabled={isLoadingGDriveBackups}
                  >
                    Atualizar Nuvem
                  </Button>
                </Group>

                {isLoadingGDriveBackups ? (
                  <Group justify="center" p="xl">
                    <Loader />
                  </Group>
                ) : gdriveBackups.length === 0 ? (
                  <Stack align="center" p="xl" gap="xs">
                    <Text c="dimmed">Nenhum backup encontrado no Google Drive.</Text>
                  </Stack>
                ) : (
                  <Table.ScrollContainer minWidth={600}>
                    <Table verticalSpacing="sm" fz="sm" highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Arquivo na Nuvem</Table.Th>
                          <Table.Th style={{ width: 200 }}>Data de Envio</Table.Th>
                          <Table.Th style={{ width: 140 }}>Tamanho</Table.Th>
                          <Table.Th style={{ width: 120, textAlign: "right" }}>Ações</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {gdriveBackups.map((gfile) => (
                          <Table.Tr key={gfile.id}>
                            <Table.Td style={{ fontFamily: "monospace" }}>{gfile.name}</Table.Td>
                            <Table.Td>
                              {new Date(gfile.createdAt).toLocaleString("pt-BR")}
                            </Table.Td>
                            <Table.Td>{formatBytes(gfile.size)}</Table.Td>
                            <Table.Td>
                              <Group gap="xs" justify="flex-end">
                                <Tooltip label="Baixar para backups locais">
                                  <ActionIcon
                                    variant="subtle"
                                    color="blue"
                                    onClick={() => void downloadFromGDrive(gfile.id, gfile.name)}
                                    disabled={isDownloading[gfile.id]}
                                  >
                                    {isDownloading[gfile.id] ? (
                                      <Loader size={14} />
                                    ) : (
                                      <IconCloudDownload size={18} />
                                    )}
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                )}
              </Paper>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Restore Safety Modal */}
      <Modal
        opened={!!restoreTarget}
        onClose={() => {
          if (!isRestoring) {
            setRestoreTarget(null);
            setConfirmText("");
          }
        }}
        title={
          <Group gap="xs">
            <IconAlertTriangle color="orange" size={24} />
            <Text fw={700} size="lg">Restaurar Banco de Dados?</Text>
          </Group>
        }
        size="md"
        closeOnClickOutside={!isRestoring}
        closeOnEscape={!isRestoring}
        withCloseButton={!isRestoring}
      >
        <Stack gap="md">
          <Text size="sm">
            Você está prestes a restaurar o banco de dados para o estado do backup:
          </Text>
          
          <Paper withBorder p="sm" bg="gray.0" radius="sm">
            <Text size="xs" style={{ fontFamily: "monospace" }}>
              <strong>Arquivo:</strong> {restoreTarget?.name}
            </Text>
            <Text size="xs" mt={4}>
              <strong>Criado em:</strong>{" "}
              {restoreTarget && new Date(restoreTarget.createdAt).toLocaleString("pt-BR")}
            </Text>
          </Paper>

          <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />}>
            <Text size="xs" fw={600}>
              Atenção: Todos os dados inseridos ou modificados após esta data serão substituídos!
            </Text>
            <Text size="xs" mt={4}>
              Por segurança, um backup automático do estado atual será criado antes da restauração,
              permitindo recuperar o estado imediatamente anterior se necessário.
            </Text>
          </Alert>

          <TextInput
            label={
              <Text size="xs">
                Para confirmar, digite <strong>RESTAURAR</strong> abaixo:
              </Text>
            }
            placeholder="Digite RESTAURAR"
            value={confirmText}
            onChange={(e) => setConfirmText(e.currentTarget.value)}
            disabled={isRestoring}
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setRestoreTarget(null);
                setConfirmText("");
              }}
              disabled={isRestoring}
            >
              Cancelar
            </Button>
            <Button
              color="red"
              disabled={confirmText !== "RESTAURAR" || isRestoring}
              onClick={handleRestore}
              leftSection={isRestoring && <Loader size={14} color="white" />}
            >
              {isRestoring ? "Restaurando..." : "Confirmar Restauração"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
