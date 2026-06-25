export async function getResponseError(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.clone().json();
    if (
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string" &&
      body.message.trim()
    ) {
      return body.message;
    }
  } catch {
    try {
      const text = await response.clone().text();
      if (text.trim()) return text.trim();
    } catch {
      return fallback;
    }
  }

  return fallback;
}

export function getErrorMessage(error: unknown, fallback = "Erro inesperado."): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function reportClientError(context: string, error: unknown) {
  if (import.meta.env.DEV) {
    console.error(`[financas] ${context}`, error);
  }
}
