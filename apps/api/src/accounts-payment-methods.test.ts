import {
  accountPaymentMethods,
  accounts,
  createDatabaseConnection,
  paymentMethods
} from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");

describe("account payment method associations", () => {
  let directory: string;
  let connection: ReturnType<typeof createDatabaseConnection>;
  let app: ReturnType<typeof buildServer>;

  beforeEach(() => {
    directory = mkdtempSync(resolve(tmpdir(), "finances-account-methods-"));
    connection = createDatabaseConnection(resolve(directory, "test.sqlite"));
    migrate(connection.db, { migrationsFolder });
    connection.db.insert(paymentMethods).values([
      { id: "pm-pix", name: "Pix", kind: "instant_transfer" },
      { id: "pm-debit", name: "Débito", kind: "debit_card" }
    ]).run();
    app = buildServer({ connection, logger: false });
  });

  afterEach(async () => {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("creates and returns an account with independently configured methods", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta principal",
        type: "checking",
        initialBalanceCents: 100_000,
        paymentMethods: [
          { paymentMethodId: "pm-pix", isDefault: true },
          { paymentMethodId: "pm-debit", isDefault: false }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().paymentMethods).toEqual([
      expect.objectContaining({ paymentMethodId: "pm-pix", isDefault: true }),
      expect.objectContaining({ paymentMethodId: "pm-debit", isDefault: false })
    ]);
    const listed = await app.inject({ method: "GET", url: "/accounts" });
    expect(listed.json()[0].paymentMethods).toHaveLength(2);
  });

  it("rejects duplicate defaults and rolls back account creation", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Inválida",
        type: "checking",
        paymentMethods: [
          { paymentMethodId: "pm-pix", isDefault: true },
          { paymentMethodId: "pm-debit", isDefault: true }
        ]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(connection.db.select().from(accounts).all()).toEqual([]);
    expect(connection.db.select().from(accountPaymentMethods).all()).toEqual([]);
  });

  it("rejects inactive or missing payment methods", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Inválida",
        type: "benefit",
        paymentMethods: [{ paymentMethodId: "missing", isDefault: true }]
      }
    });
    expect(response.statusCode).toBe(400);
  });
});
