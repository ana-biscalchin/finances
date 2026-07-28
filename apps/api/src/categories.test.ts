import { categories, subcategories, users } from "@finances/database";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "./server.js";
import { createPostgresTestConnection, postgresTestsEnabled, removePostgresTestOwner, seedPostgresTestOwner } from "./test-support/postgres.js";

const describePostgres = postgresTestsEnabled ? describe : describe.skip;
describePostgres("categories API", () => {
  let app: ReturnType<typeof buildServer>;
  let connection: ReturnType<typeof createPostgresTestConnection>;
  beforeEach(async () => {
    connection = createPostgresTestConnection();
    await seedPostgresTestOwner(connection, "test-owner");
    app = buildServer({
      connection,
      logger: false,
      testOwnerId: "test-owner"
    });
  });
  afterEach(async () => {
    await app.close();
    await removePostgresTestOwner(connection, "test-owner");
    await connection.close();
  });

  it("creates and lists categories and subcategories", async () => {
    const category = (
      await app.inject({
        method: "POST",
        url: "/categories",
        payload: { nature: "expense", name: "Casa" }
      })
    ).json();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/subcategories",
          payload: { categoryId: category.id, name: "Moradia", behavior: "fixed" }
        })
      ).statusCode
    ).toBe(201);
    expect(
      (await app.inject({ method: "GET", url: "/categories" })).json()[0].subcategories
    ).toHaveLength(1);
  });

  it("moves transactions and planned expense lines when merging subcategories", async () => {
    const category = (
      await app.inject({
        method: "POST",
        url: "/categories",
        payload: { nature: "expense", name: "Casa" }
      })
    ).json();
    const source = (
      await app.inject({
        method: "POST",
        url: "/subcategories",
        payload: { categoryId: category.id, name: "Casa antiga", behavior: "fixed" }
      })
    ).json();
    const target = (
      await app.inject({
        method: "POST",
        url: "/subcategories",
        payload: { categoryId: category.id, name: "Moradia", behavior: "fixed" }
      })
    ).json();
    const account = (
      await app.inject({
        method: "POST",
        url: "/accounts",
        payload: { name: "Conta", type: "checking" }
      })
    ).json();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/planned-expenses",
          payload: {
            budgetMonth: "2026-07",
            subcategoryId: source.id,
            name: "Aluguel",
            amountCents: 180_000,
            accountId: account.id,
            creditCardId: null
          }
        })
      ).statusCode
    ).toBe(201);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/subcategories/${source.id}/merge`,
          payload: { targetSubcategoryId: target.id }
        })
      ).statusCode
    ).toBe(204);
    expect(
      (await app.inject({ method: "GET", url: "/monthly-overview?month=2026-07" })).json().items
    ).toEqual([expect.objectContaining({ subcategoryId: target.id, plannedCents: 180_000 })]);
  });

  it("does not enumerate or mutate categories owned by another identity", async () => {
    connection.db
      .insert(users)
      .values({
        id: "other-owner",
        username: "other",
        passwordHash: "test",
        passwordChangedAt: new Date().toISOString()
      })
      .run();
    connection.db
      .insert(categories)
      .values({ id: "other-category", ownerId: "other-owner", nature: "expense", name: "Casa" })
      .run();
    connection.db
      .insert(subcategories)
      .values({ id: "other-subcategory", categoryId: "other-category", name: "Privada" })
      .run();

    const created = await app.inject({
      method: "POST",
      url: "/categories",
      payload: { nature: "expense", name: "Casa" }
    });
    expect(created.statusCode).toBe(201);
    const listed = (
      await app.inject({ method: "GET", url: "/categories?includeInactive=true" })
    ).json();
    expect(listed.map((item: { id: string }) => item.id)).not.toContain("other-category");
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/categories/other-category",
          payload: { nature: "expense", name: "Invadida" }
        })
      ).statusCode
    ).toBe(404);
    expect(
      (await app.inject({ method: "PATCH", url: "/subcategories/other-subcategory/archive" }))
        .statusCode
    ).toBe(404);
    expect(
      connection.db
        .select()
        .from(categories)
        .all()
        .find((item) => item.id === "other-category")?.name
    ).toBe("Casa");
  });
});
