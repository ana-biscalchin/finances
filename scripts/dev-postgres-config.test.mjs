import assert from "node:assert/strict";
import test from "node:test";

import { resolveLocalDatabaseUrl } from "./dev-postgres-config.mjs";

test("uses the isolated local PostgreSQL database by default", () => {
  assert.equal(
    resolveLocalDatabaseUrl({}),
    "postgresql://finances:finances@127.0.0.1:55432/finances_dev"
  );
});

test("allows an explicit local database override", () => {
  assert.equal(
    resolveLocalDatabaseUrl({
      LOCAL_DATABASE_URL: "postgresql://local:test@127.0.0.1:55433/custom"
    }),
    "postgresql://local:test@127.0.0.1:55433/custom"
  );
});
