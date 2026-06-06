import { createDatabaseConnection } from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");

describe("accounts API", () => {
  let tempDir: string;
  let databasePath: string;
  let app: ReturnType<typeof buildServer>;

  beforeEach(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), "finances-api-test-"));
    databasePath = resolve(tempDir, "test.sqlite");

    const connection = createDatabaseConnection(databasePath);
    migrate(connection.db, { migrationsFolder });
    connection.sqlite.close();

    app = buildServer({ databasePath, logger: false });
  });

  afterEach(async () => {
    await app.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates, lists, updates, archives and restores accounts", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta Corrente",
        type: "checking",
        institution: "Banco Teste",
        initialBalanceCents: 12345
      }
    });

    expect(createResponse.statusCode).toBe(201);

    const created = createResponse.json<{
      id: string;
      name: string;
      type: string;
      institution: string;
      initialBalanceCents: number;
    }>();

    expect(created).toMatchObject({
      name: "Conta Corrente",
      type: "checking",
      institution: "Banco Teste",
      initialBalanceCents: 12345
    });

    const listResponse = await app.inject({ method: "GET", url: "/accounts" });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toHaveLength(1);

    const updateResponse = await app.inject({
      method: "PUT",
      url: `/accounts/${created.id}`,
      payload: {
        name: "Conta Principal",
        type: "checking",
        institution: "Banco Teste",
        initialBalanceCents: 20000
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      id: created.id,
      name: "Conta Principal",
      initialBalanceCents: 20000
    });

    const archiveResponse = await app.inject({
      method: "PATCH",
      url: `/accounts/${created.id}/archive`
    });

    expect(archiveResponse.statusCode).toBe(204);

    const activeAccountsResponse = await app.inject({ method: "GET", url: "/accounts" });
    expect(activeAccountsResponse.json()).toHaveLength(0);

    const allAccountsResponse = await app.inject({
      method: "GET",
      url: "/accounts?includeInactive=true"
    });

    expect(allAccountsResponse.json()).toMatchObject([
      {
        id: created.id,
        isActive: false
      }
    ]);

    const restoreResponse = await app.inject({
      method: "PATCH",
      url: `/accounts/${created.id}/restore`
    });

    expect(restoreResponse.statusCode).toBe(204);

    const restoredAccountsResponse = await app.inject({ method: "GET", url: "/accounts" });
    expect(restoredAccountsResponse.json()).toMatchObject([
      {
        id: created.id,
        isActive: true
      }
    ]);
  });

  it("returns bad request for invalid account payloads", async () => {
    const missingNameResponse = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "",
        type: "checking",
        initialBalanceCents: 0
      }
    });

    expect(missingNameResponse.statusCode).toBe(400);
    expect(missingNameResponse.json()).toMatchObject({
      message: "name é obrigatório."
    });

    const invalidTypeResponse = await app.inject({
      method: "POST",
      url: "/accounts",
      payload: {
        name: "Conta inválida",
        type: "invalid",
        initialBalanceCents: 0
      }
    });

    expect(invalidTypeResponse.statusCode).toBe(400);
    expect(invalidTypeResponse.json()).toMatchObject({
      message: "Tipo de conta inválido: invalid"
    });
  });

  it("returns not found when account does not exist", async () => {
    const getResponse = await app.inject({
      method: "GET",
      url: "/accounts/unknown"
    });

    expect(getResponse.statusCode).toBe(404);

    const restoreResponse = await app.inject({
      method: "PATCH",
      url: "/accounts/unknown/restore"
    });

    expect(restoreResponse.statusCode).toBe(404);
  });
});
