import type { FastifyRequest } from "fastify";

export type RequestContext = {
  ownerId: string;
  userId: string;
  requestId: string;
};

export function requestContextFrom(request: FastifyRequest): RequestContext {
  if (!request.requestContext) {
    const error = new Error("Autenticação necessária.") as Error & { statusCode: number };
    error.statusCode = 401;
    throw error;
  }
  return request.requestContext;
}

declare module "fastify" {
  interface FastifyRequest {
    requestContext?: RequestContext;
  }
}
