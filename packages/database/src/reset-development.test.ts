import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assertDevelopmentResetTarget, resetDevelopmentDatabase } from "./reset-development.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("guarded development database reset", () => {
  it("accepts an explicit confirmed database inside an approved root", () => {
    const root = mkdtempSync(resolve(tmpdir(), "finances-reset-"));
    directories.push(root);
    const databasePath = resolve(root, "uat.sqlite");

    expect(
      assertDevelopmentResetTarget({
        databasePath,
        allowedRoot: root,
        environment: "development",
        confirmation: "RESET"
      })
    ).toBe(databasePath);
  });

  it.each([
    ["production", "RESET", "development or UAT"],
    ["development", "", "confirmation"],
    ["development", "RESET", "approved root"]
  ])("rejects unsafe target (%s)", (environment, confirmation, message) => {
    const root = mkdtempSync(resolve(tmpdir(), "finances-reset-"));
    directories.push(root);
    const databasePath = message === "approved root" ? resolve(root, "..", "personal.sqlite") : resolve(root, "uat.sqlite");

    expect(() =>
      assertDevelopmentResetTarget({ databasePath, allowedRoot: root, environment, confirmation })
    ).toThrow(message);
  });

  it("refuses backup paths", () => {
    const root = mkdtempSync(resolve(tmpdir(), "finances-reset-"));
    directories.push(root);
    expect(() =>
      assertDevelopmentResetTarget({
        databasePath: resolve(root, "backups", "uat.sqlite"),
        allowedRoot: root,
        environment: "uat",
        confirmation: "RESET"
      })
    ).toThrow("backup");
  });

  it("removes sqlite files before rebuilding", async () => {
    const root = mkdtempSync(resolve(tmpdir(), "finances-reset-"));
    directories.push(root);
    const databasePath = resolve(root, "uat.sqlite");
    for (const suffix of ["", "-wal", "-shm"]) writeFileSync(`${databasePath}${suffix}`, "old");
    const rebuild = vi.fn(async () => writeFileSync(databasePath, "new"));

    await resetDevelopmentDatabase(
      { databasePath, allowedRoot: root, environment: "uat", confirmation: "RESET" },
      rebuild
    );

    expect(rebuild).toHaveBeenCalledOnce();
    expect(existsSync(`${databasePath}-wal`)).toBe(false);
    expect(existsSync(`${databasePath}-shm`)).toBe(false);
  });
});
