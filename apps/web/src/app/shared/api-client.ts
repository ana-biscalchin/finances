import type { ZodType } from "zod";
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
  }
}
export function createApiClient(
  options: { baseUrl?: string; fetcher?: Fetcher; timeoutMs?: number; getRetries?: number } = {}
) {
  const baseUrl = options.baseUrl ?? import.meta.env.VITE_API_URL ?? "http://localhost:3000";
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const getRetries = options.getRetries ?? 1;
  async function request<T>(
    method: string,
    path: string,
    schema: ZodType<T>,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    const attempts = method === "GET" ? getRetries + 1 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetcher(`${baseUrl}${path}`, {
          method,
          signal: controller.signal,
          headers:
            body === undefined
              ? extraHeaders
              : { "Content-Type": "application/json", ...extraHeaders },
          body: body === undefined ? undefined : JSON.stringify(body)
        });
        if (!response.ok) {
          if (method === "GET" && response.status >= 500 && attempt + 1 < attempts) continue;
          throw new ApiClientError(
            (await response.text()) || `HTTP ${response.status}`,
            response.status
          );
        }
        const parsed = schema.safeParse(
          response.status === 204 ? undefined : await response.json()
        );
        if (!parsed.success)
          throw new ApiClientError(
            `Resposta inválida da API: ${parsed.error.issues[0]?.message ?? "contrato incompatível"}`
          );
        return parsed.data;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          throw new ApiClientError("A API excedeu o tempo limite.");
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
    throw new ApiClientError("Falha transitória na API.");
  }
  return {
    get: <T>(path: string, schema: ZodType<T>) => request("GET", path, schema),
    post: <T>(path: string, body: unknown, schema: ZodType<T>, headers?: Record<string, string>) =>
      request("POST", path, schema, body, headers),
    put: <T>(path: string, body: unknown, schema: ZodType<T>) => request("PUT", path, schema, body),
    patch: <T>(path: string, body: unknown, schema: ZodType<T>) =>
      request("PATCH", path, schema, body),
    delete: <T>(path: string, schema: ZodType<T>) => request("DELETE", path, schema)
  };
}
export const apiClient = createApiClient();
