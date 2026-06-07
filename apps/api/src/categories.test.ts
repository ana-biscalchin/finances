import { createDatabaseConnection } from "@finances/database";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

const migrationsFolder = resolve(process.cwd(), "../../packages/database/drizzle");

describe("categories API", () => {
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

  it("creates, lists, updates, archives and restores category hierarchy", async () => {
    const groupResponse = await app.inject({
      method: "POST",
      url: "/category-groups",
      payload: {
        name: "Variáveis",
        nature: "expense"
      }
    });

    expect(groupResponse.statusCode).toBe(201);
    const group = groupResponse.json<{ id: string }>();

    const macroResponse = await app.inject({
      method: "POST",
      url: "/category-macros",
      payload: {
        groupId: group.id,
        name: "Alimentação"
      }
    });

    expect(macroResponse.statusCode).toBe(201);
    const macro = macroResponse.json<{ id: string }>();

    const microResponse = await app.inject({
      method: "POST",
      url: "/category-micros",
      payload: {
        macroId: macro.id,
        name: "Mercado"
      }
    });

    expect(microResponse.statusCode).toBe(201);
    const micro = microResponse.json<{ id: string }>();

    const updateMicroResponse = await app.inject({
      method: "PUT",
      url: `/category-micros/${micro.id}`,
      payload: {
        macroId: macro.id,
        name: "Supermercado"
      }
    });

    expect(updateMicroResponse.statusCode).toBe(200);
    expect(updateMicroResponse.json()).toMatchObject({
      id: micro.id,
      name: "Supermercado"
    });

    const listResponse = await app.inject({ method: "GET", url: "/categories" });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject([
      {
        id: group.id,
        macros: [
          {
            id: macro.id,
            micros: [
              {
                id: micro.id,
                name: "Supermercado"
              }
            ]
          }
        ]
      }
    ]);

    const archiveResponse = await app.inject({
      method: "PATCH",
      url: `/category-micros/${micro.id}/archive`
    });

    expect(archiveResponse.statusCode).toBe(204);

    const activeListResponse = await app.inject({ method: "GET", url: "/categories" });
    expect(activeListResponse.json()[0].macros[0].micros).toHaveLength(0);

    const inactiveListResponse = await app.inject({
      method: "GET",
      url: "/categories?includeInactive=true"
    });
    expect(inactiveListResponse.json()[0].macros[0].micros).toMatchObject([
      {
        id: micro.id,
        isActive: false
      }
    ]);

    const restoreResponse = await app.inject({
      method: "PATCH",
      url: `/category-micros/${micro.id}/restore`
    });

    expect(restoreResponse.statusCode).toBe(204);
  });

  it("validates category payloads and duplicate names", async () => {
    const invalidGroupResponse = await app.inject({
      method: "POST",
      url: "/category-groups",
      payload: {
        name: "Teste",
        nature: "invalid"
      }
    });

    expect(invalidGroupResponse.statusCode).toBe(400);

    await app.inject({
      method: "POST",
      url: "/category-groups",
      payload: {
        name: "Fixas",
        nature: "expense"
      }
    });

    const duplicateResponse = await app.inject({
      method: "POST",
      url: "/category-groups",
      payload: {
        name: "Fixas",
        nature: "expense"
      }
    });

    expect(duplicateResponse.statusCode).toBe(409);
    expect(duplicateResponse.json()).toMatchObject({
      message: "Já existe um grupo com essa natureza e nome."
    });
  });

  it("treats names that differ only by accents as duplicates", async () => {
    const groupResponse = await app.inject({
      method: "POST",
      url: "/category-groups",
      payload: {
        name: "Variaveis",
        nature: "expense"
      }
    });
    const group = groupResponse.json<{ id: string }>();

    const duplicateGroupResponse = await app.inject({
      method: "POST",
      url: "/category-groups",
      payload: {
        name: "Variáveis",
        nature: "expense"
      }
    });

    expect(duplicateGroupResponse.statusCode).toBe(409);
    expect(duplicateGroupResponse.json()).toMatchObject({
      message: "Já existe um grupo com essa natureza e nome."
    });

    await app.inject({
      method: "POST",
      url: "/category-macros",
      payload: {
        groupId: group.id,
        name: "Alimentacao"
      }
    });

    const duplicateMacroResponse = await app.inject({
      method: "POST",
      url: "/category-macros",
      payload: {
        groupId: group.id,
        name: "Alimentação"
      }
    });

    expect(duplicateMacroResponse.statusCode).toBe(409);
    expect(duplicateMacroResponse.json()).toMatchObject({
      message: "Já existe uma macro com esse nome nesse grupo."
    });

    const macro = (
      await app.inject({
        method: "GET",
        url: "/categories"
      })
    ).json<Array<{ macros: Array<{ id: string }> }>>()[0].macros[0];

    await app.inject({
      method: "POST",
      url: "/category-micros",
      payload: {
        macroId: macro.id,
        name: "Cafe"
      }
    });

    const duplicateMicroResponse = await app.inject({
      method: "POST",
      url: "/category-micros",
      payload: {
        macroId: macro.id,
        name: "Café"
      }
    });

    expect(duplicateMicroResponse.statusCode).toBe(409);
    expect(duplicateMicroResponse.json()).toMatchObject({
      message: "Já existe uma micro com esse nome nessa macro."
    });
  });

  it("returns not found when category resource does not exist", async () => {
    const updateResponse = await app.inject({
      method: "PUT",
      url: "/category-groups/unknown",
      payload: {
        name: "Teste",
        nature: "expense"
      }
    });

    expect(updateResponse.statusCode).toBe(404);

    const archiveResponse = await app.inject({
      method: "PATCH",
      url: "/category-macros/unknown/archive"
    });

    expect(archiveResponse.statusCode).toBe(404);
  });
});
