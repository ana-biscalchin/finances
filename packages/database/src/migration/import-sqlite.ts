import Database from "better-sqlite3";
import postgres from "postgres";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveDatabasePath } from "../connection.js";
import { normalizeMigrationOwnerUsername } from "../migration-owner.js";

export const importTableOrder = [
  "payment_methods",
  "accounts",
  "account_payment_methods",
  "categories",
  "subcategories",
  "credit_cards",
  "credit_card_bills",
  "account_transfers",
  "recurrence_rules",
  "installment_purchases",
  "monthly_budget_allocations",
  "reserve_goals",
  "reserve_movements",
  "transactions",
  "installments",
  "credit_card_bill_payments",
  "settings"
] as const;
type SourceRow = Record<string, unknown>;
export type ImportOptions = {
  sourcePath: string;
  destinationUrl: string;
  ownerUsername: string;
  dryRun?: boolean;
  failureAfterRows?: number;
};
export type ImportReport = {
  sourcePath: string;
  ownerUsername: string;
  dryRun: boolean;
  sourceFingerprint: string;
  tables: Record<string, { source: number; attempted: number }>;
  totals: { transactionRows: number; transactionAmountCents: number; transferRows: number; billRows: number };
};

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}
function sourceTables(db: Database.Database) {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
  return new Set(rows.map(({ name }) => name));
}
function sourceColumns(db: Database.Database, table: string) {
  return (db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as Array<{ name: string }>).map((row) => row.name);
}
function sourceRows(db: Database.Database, table: string) {
  return db.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all() as SourceRow[];
}
function fingerprint(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
function redactReport(report: ImportReport) {
  return JSON.stringify(report);
}

export function buildImportPlan(existingTables: string[], sourceTablesFound: string[]) {
  const existing = new Set(existingTables);
  const found = new Set(sourceTablesFound);
  return importTableOrder.filter((table) => existing.has(table) && found.has(table));
}

export async function importSqliteToPostgres(options: ImportOptions): Promise<ImportReport> {
  const ownerUsername = normalizeMigrationOwnerUsername(options.ownerUsername);
  const sourcePath = resolve(options.sourcePath);
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  const destination = postgres(options.destinationUrl, { prepare: false, max: 1, connect_timeout: 15 });
  let importedRows = 0;
  const report: ImportReport = {
    sourcePath,
    ownerUsername,
    dryRun: options.dryRun === true,
    sourceFingerprint: fingerprint(sourcePath),
    tables: {},
    totals: { transactionRows: 0, transactionAmountCents: 0, transferRows: 0, billRows: 0 }
  };
  try {
    const integrity = source.pragma("integrity_check") as Array<{ integrity_check?: string }>;
    if (integrity[0]?.integrity_check !== "ok") throw new Error("O SQLite de origem falhou no integrity_check.");
    const tableNames = buildImportPlan(
      (await destination`select table_name from information_schema.tables where table_schema = 'public'`).map((row) => String(row.table_name)),
      [...sourceTables(source)]
    );
    if (tableNames.length === 0) throw new Error("Nenhuma tabela financeira compatível foi encontrada na origem.");
    const ownerRows = await destination`select id from users where username = ${ownerUsername}`;
    if (ownerRows.length !== 1) throw new Error("A proprietária de destino não existe ou não é única.");
    const ownerId = String(ownerRows[0].id);
    const run = async (tx: typeof destination) => {
      for (const table of tableNames) {
        const rows = sourceRows(source, table);
        const columns = sourceColumns(source, table);
        const destinationRows = await tx`select column_name from information_schema.columns where table_schema = 'public' and table_name = ${table}`;
        const destinationColumns = new Set(destinationRows.map((row) => String(row.column_name)));
        const insertColumns = columns.filter((column) => destinationColumns.has(column));
        if (!insertColumns.includes("id")) throw new Error(`A tabela ${table} não possui chave id compatível.`);
        let attempted = 0;
        for (const original of rows) {
          const row = { ...original };
          if (destinationColumns.has("owner_id")) row.owner_id = ownerId;
          const values = insertColumns.map((column) => row[column]);
          if (!options.dryRun) {
            const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
            await tx.unsafe(`insert into ${quoteIdentifier(table)} (${insertColumns.map(quoteIdentifier).join(", ")}) values (${placeholders}) on conflict do nothing`, values as never[]);
          }
          attempted += 1;
          importedRows += 1;
          if (options.failureAfterRows !== undefined && importedRows >= options.failureAfterRows)
            throw new Error("Falha injetada após o limite de teste.");
          if (table === "transactions") {
            report.totals.transactionRows += 1;
            report.totals.transactionAmountCents += Number(row.amount_cents ?? 0);
          }
        }
        report.tables[table] = { source: rows.length, attempted };
        if (table === "account_transfers") report.totals.transferRows += rows.length;
        if (table === "credit_card_bills") report.totals.billRows += rows.length;
      }
    };
    if (options.dryRun) await run(destination);
    else await destination.begin(async (tx) => run(tx as unknown as typeof destination));
    console.log(redactReport(report));
    return report;
  } finally {
    source.close();
    await destination.end({ timeout: 5 });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sourcePath = process.env.SOURCE_DATABASE_PATH ?? resolveDatabasePath();
  const destinationUrl = process.env.DATABASE_URL;
  if (!destinationUrl) throw new Error("DATABASE_URL é obrigatório para a importação.");
  await importSqliteToPostgres({
    sourcePath,
    destinationUrl,
    ownerUsername: process.env.MIGRATION_OWNER_USERNAME ?? "",
    dryRun: process.env.MIGRATION_DRY_RUN === "true"
  });
}
