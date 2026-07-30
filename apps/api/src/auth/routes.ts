import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { ApiConfig } from "../config/environment.js";
import type { AuthenticatedUser, SessionService } from "./session-service.js";

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(512)
});
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(512),
  newPassword: z.string().min(12).max(512)
});

declare module "fastify" {
  interface FastifyRequest {
    authenticatedUser?: AuthenticatedUser;
  }
}

export function sessionCookieOptions(config: ApiConfig) {
  return {
    path: "/",
    httpOnly: true,
    secure: config.environment === "production",
    sameSite: "lax" as const,
    maxAge: config.auth.absoluteTtlSeconds
  };
}
export function isTrustedMutationOrigin(request: FastifyRequest, config: ApiConfig) {
  const origin = request.headers.origin;
  return !origin || origin === config.publicUrl || config.corsOrigins.includes(origin);
}
export function registerSessionRoutes(
  app: FastifyInstance,
  service: SessionService,
  config: ApiConfig
) {
  const failedAttempts = new Map<string, number>();
  app.addHook("preHandler", async (request, reply) => {
    if (
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      !isTrustedMutationOrigin(request, config)
    )
      return reply.code(403).send({ message: "Origem não permitida." });
  });
  app.get("/session", async (request) => {
    const user = await service.resolve(request.cookies[config.auth.cookieName]);
    return user ? { authenticated: true, user } : { authenticated: false };
  });
  app.post(
    "/session/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = credentialsSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(401).send({ message: "Usuário ou senha inválidos." });
      const key = `${request.ip}:${parsed.data.username.toLocaleLowerCase("pt-BR")}`;
      const authenticated = await service.authenticate(parsed.data.username, parsed.data.password);
      if (!authenticated) {
        const attempts = (failedAttempts.get(key) ?? 0) + 1;
        failedAttempts.set(key, attempts);
        await new Promise((resolve) => setTimeout(resolve, Math.min(attempts * 100, 1_000)));
        return reply.code(401).send({ message: "Usuário ou senha inválidos." });
      }
      failedAttempts.delete(key);
      reply.setCookie(config.auth.cookieName, authenticated.token, sessionCookieOptions(config));
      return { authenticated: true, user: authenticated.user };
    }
  );
  app.post("/session/logout", async (request, reply) => {
    await service.revoke(request.cookies[config.auth.cookieName]);
    reply.clearCookie(config.auth.cookieName, sessionCookieOptions(config));
    return reply.code(204).send();
  });
  app.post("/session/change-password", async (request, reply) => {
    const user = await service.resolve(request.cookies[config.auth.cookieName]);
    if (!user) return reply.code(401).send({ message: "Autenticação necessária." });
    const parsed = passwordChangeSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ message: "A nova senha deve ter ao menos 12 caracteres." });
    const replacement = await service.changePassword(
      user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );
    if (!replacement) return reply.code(400).send({ message: "Não foi possível alterar a senha." });
    reply.setCookie(config.auth.cookieName, replacement, sessionCookieOptions(config));
    return { authenticated: true, user };
  });
}
