const DEFAULT_LOCAL_DATABASE_URL =
  "postgresql://finances:finances@127.0.0.1:55432/finances_dev";

export function resolveLocalDatabaseUrl(environment) {
  return environment.LOCAL_DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL;
}
