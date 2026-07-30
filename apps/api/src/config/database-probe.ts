import postgres from "postgres";

import type { ApiConfig } from "./environment.js";

export type DatabaseProbe = {
  check(): Promise<void>;
  close(): Promise<void>;
};

export function createDatabaseProbe(config: ApiConfig): DatabaseProbe {
  if (config.database.dialect === "sqlite") {
    return {
      check: async () => undefined,
      close: async () => undefined
    };
  }

  const sql = postgres(config.database.url, {
    max: config.database.poolMax,
    connect_timeout: config.database.connectTimeoutSeconds,
    idle_timeout: 20,
    ssl: "require",
    prepare: false
  });

  return {
    check: async () => {
      await sql`select 1`;
    },
    close: async () => {
      await sql.end({ timeout: 5 });
    }
  };
}
