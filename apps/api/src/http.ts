import type { FastifyReply } from "fastify";

export class ValidationError extends Error {}

export class ConflictError extends Error {}

export function sendPayloadError(error: unknown, reply: FastifyReply, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const statusCode = error instanceof ConflictError ? 409 : 400;

  reply.log.warn({ err: error, statusCode }, message);
  reply.code(statusCode).send({ message });
  return null;
}

export function parseRequiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} é obrigatório.`);
  }

  return value.trim();
}

export function parseOptionalString(value: unknown, fieldName: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} deve ser um texto.`);
  }

  return value.trim();
}

export function parseOptionalInteger(value: unknown, fieldName: string) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ValidationError(`${fieldName} deve ser um inteiro.`);
  }

  return value;
}

export function parseRequiredInteger(value: unknown, fieldName: string) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ValidationError(`${fieldName} deve ser um inteiro.`);
  }

  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getBooleanQueryValue(query: unknown, key: string) {
  const value = (query as Record<string, unknown>)[key];

  return value === "true" || value === true;
}
