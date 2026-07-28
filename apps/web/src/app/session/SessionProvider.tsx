import {
  Alert,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { IconAlertCircle, IconLock } from "@tabler/icons-react";
import { createContext, type FormEvent, type PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { ApiClientError } from "../shared/api-client";
import { sessionApi, type SessionState } from "./session-api";

type SessionContextValue = {
  state: Extract<SessionState, { authenticated: true }>;
  logout: () => Promise<void>;
};
const SessionContext = createContext<SessionContextValue | null>(null);

function LoginPage({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onLogin(username, password);
    } catch (cause) {
      setError(cause instanceof ApiClientError && cause.status === 401 ? "Usuário ou senha inválidos." : "Não foi possível acessar agora. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };
  return <Center mih="100dvh" px="md" bg="gray.0">
    <Container size={420} w="100%">
      <Paper withBorder shadow="sm" p="xl" radius="md">
        <form onSubmit={submit}>
        <Stack gap="md">
          <Group gap="sm"><IconLock size={24} color="var(--mantine-color-teal-7)" /><Title order={2}>Carteira da Ana</Title></Group>
          <Text c="dimmed">Entre para acessar seus dados financeiros.</Text>
          {error && <Alert icon={<IconAlertCircle size={18} />} color="red" role="alert">{error}</Alert>}
          <TextInput label="Usuário" value={username} onChange={(event) => setUsername(event.currentTarget.value)} autoComplete="username" required />
          <PasswordInput label="Senha" value={password} onChange={(event) => setPassword(event.currentTarget.value)} autoComplete="current-password" required />
          <Button type="submit" loading={submitting} fullWidth>Entrar</Button>
        </Stack>
        </form>
      </Paper>
    </Container>
  </Center>;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [expired, setExpired] = useState(false);
  const refresh = async () => {
    setUnavailable(false);
    try { setSession(await sessionApi.get()); } catch { setUnavailable(true); }
  };
  useEffect(() => {
    void refresh();
    const handleUnauthorized = () => { setExpired(true); setSession({ authenticated: false }); };
    window.addEventListener("finances:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("finances:unauthorized", handleUnauthorized);
  }, []);
  const login = async (username: string, password: string) => {
    const next = await sessionApi.login(username, password);
    setExpired(false);
    setSession(next);
  };
  const logout = async () => { await sessionApi.logout(); setSession({ authenticated: false }); };
  const value = useMemo(() => session?.authenticated ? { state: session, logout } : null, [session]);
  if (unavailable) return <Center mih="100dvh" px="md"><Stack align="center"><Title order={2}>Carteira indisponível</Title><Text c="dimmed">Não foi possível conectar ao serviço. Tente novamente.</Text><Button onClick={() => void refresh()}>Tentar novamente</Button></Stack></Center>;
  if (!session) return <Center mih="100dvh"><Loader aria-label="Carregando sessão" /> </Center>;
  if (!session.authenticated) return <LoginPage onLogin={login} />;
  return <SessionContext.Provider value={value}>{expired && <Alert color="yellow" title="Sessão expirada" withCloseButton onClose={() => setExpired(false)}>Entre novamente para continuar.</Alert>}{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession deve ser usado dentro de SessionProvider");
  return context;
}
