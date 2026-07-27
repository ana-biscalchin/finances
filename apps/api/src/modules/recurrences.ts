import type { createDatabaseConnection } from "@finances/database";
import { recurrenceInputSchema, yearMonthSchema } from "@finances/domain";
import type { FastifyInstance } from "fastify";
import { requestContextFrom } from "../application/request-context.js";
import { z } from "zod";
import { createRecurrenceService } from "../application/recurrence-service.js";
import { ValidationError } from "../http.js";

type Connection = ReturnType<typeof createDatabaseConnection>;
const paramsSchema = z.object({ id: z.string().min(1) });
const querySchema = z.object({ month: yearMonthSchema.optional() });
const occurrenceSchema = z.object({ month: yearMonthSchema });
const recurrenceChangesSchema = z
  .object({
    kind: z.enum(["income", "expense"]).optional(),
    description: z.string().trim().min(1).optional(),
    amountCents: z.number().int().positive().optional(),
    subcategoryId: z.string().min(1).optional(),
    accountId: z.string().min(1).nullable().optional(),
    creditCardId: z.string().min(1).nullable().optional(),
    paymentMethodId: z.string().min(1).nullable().optional(),
    frequency: z.literal("monthly").optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    startMonth: yearMonthSchema.optional(),
    endMonth: yearMonthSchema.nullable().optional()
  })
  .strict();
const changeSchema = z.object({
  effectiveMonth: yearMonthSchema,
  changes: recurrenceChangesSchema
});
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ValidationError(result.error.issues[0]?.message ?? "Recorrência inválida.");
  return result.data;
}

export function registerRecurrenceRoutes(app: FastifyInstance, connection: Connection) {
  const serviceFor = (request: Parameters<typeof requestContextFrom>[0]) =>
    createRecurrenceService(connection, requestContextFrom(request).ownerId);
  app.get("/recurrences", async (request) => {
    const { month } = parse(querySchema, request.query);
    return month ? serviceFor(request).forecast(month) : serviceFor(request).list();
  });
  app.post("/recurrences", async (request, reply) =>
    reply.code(201).send(serviceFor(request).create(parse(recurrenceInputSchema, request.body)))
  );
  app.post("/recurrences/:id/pause", async (request) =>
    serviceFor(request).pause(parse(paramsSchema, request.params).id)
  );
  app.post("/recurrences/:id/resume", async (request) =>
    serviceFor(request).resume(parse(paramsSchema, request.params).id)
  );
  app.delete("/recurrences/:id", async (request) =>
    serviceFor(request).end(parse(paramsSchema, request.params).id)
  );
  app.post("/recurrences/:id/confirm-occurrence", async (request, reply) =>
    reply
      .code(201)
      .send(
        serviceFor(request).confirm(
          parse(paramsSchema, request.params).id,
          parse(occurrenceSchema, request.body).month
        )
      )
  );
  app.put("/recurrences/:id", async (request) => {
    const body = parse(changeSchema, request.body);
    return serviceFor(request).changeFrom(
      parse(paramsSchema, request.params).id,
      body.effectiveMonth,
      body.changes
    );
  });
}
