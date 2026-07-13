import { detectCsvDelimiter, parseCsvRows } from "../shared/csv-utils.js";
export type SimpleImportRow = { tempId: string; eventDate: string; budgetMonth: string; description: string; amountCents: number; type: "income" | "expense"; accountId: string | null; paymentMethodId: string | null; creditCardId: string | null; subcategoryId: string | null; isDuplicate?: boolean; selected: boolean };
export function parseSimpleCsv(content: string): SimpleImportRow[] {
  const firstLine = content.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? ""; const delimiter = detectCsvDelimiter(firstLine); const rows = parseCsvRows(content.replace(/^\uFEFF/, ""), delimiter); if (rows.length < 2) return [];
  const headers = rows[0]!.map((item) => item.toLocaleLowerCase("pt-BR"));
  const index = (names: string[]) => headers.findIndex((header) => names.includes(header)); const dateIndex = index(["data", "date", "eventdate"]); const descriptionIndex = index(["descricao", "descrição", "description"]); const amountIndex = index(["valor", "amount", "amountcents"]);
  if (dateIndex < 0 || descriptionIndex < 0 || amountIndex < 0) throw new Error("CSV precisa conter data, descrição e valor.");
  return rows.slice(1).map((fields, rowIndex) => {
    const numeric = fields[amountIndex]!.replace(/[^0-9,.-]/g, ""); const decimal = numeric.includes(",") ? numeric.replaceAll(".", "").replace(",", ".") : numeric; const signed = Number(decimal); if (!Number.isFinite(signed)) throw new Error(`Valor inválido na linha ${rowIndex + 2}.`); const rawDate = fields[dateIndex]!; const eventDate = rawDate.includes("/") ? rawDate.split("/").reverse().join("-") : rawDate;
    return { tempId: `row-${rowIndex}`, eventDate, budgetMonth: eventDate.slice(0, 7), description: fields[descriptionIndex]!, amountCents: Math.round(Math.abs(signed) * 100), type: signed < 0 ? "expense" : "income", accountId: null, paymentMethodId: null, creditCardId: null, subcategoryId: null, selected: true };
  });
}
export const applyDuplicateSelection = (rows: SimpleImportRow[]) => rows.map((row) => ({ ...row, selected: !row.isDuplicate }));
