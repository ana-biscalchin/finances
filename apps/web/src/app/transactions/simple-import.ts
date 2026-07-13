import { detectCsvDelimiter, parseCsvHeaderLine } from "../shared/csv-utils.js";
export type SimpleImportRow = { tempId: string; eventDate: string; budgetMonth: string; description: string; amountCents: number; type: "income" | "expense"; accountId: string | null; subcategoryId: string | null; isDuplicate?: boolean; selected: boolean };
export function parseSimpleCsv(content: string): SimpleImportRow[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n").filter(Boolean); if (lines.length < 2) return [];
  const headers = parseCsvHeaderLine(lines[0]!).map((item) => item.toLocaleLowerCase("pt-BR")); const delimiter = detectCsvDelimiter(lines[0]!);
  const index = (names: string[]) => headers.findIndex((header) => names.includes(header)); const dateIndex = index(["data", "date", "eventdate"]); const descriptionIndex = index(["descricao", "descrição", "description"]); const amountIndex = index(["valor", "amount", "amountcents"]);
  if (dateIndex < 0 || descriptionIndex < 0 || amountIndex < 0) throw new Error("CSV precisa conter data, descrição e valor.");
  return lines.slice(1).map((line, rowIndex) => {
    const fields = line.split(delimiter).map((item) => item.replace(/^"|"$/g, "").trim()); const raw = fields[amountIndex]!.replace(/[^0-9,.-]/g, "").replace(".", "").replace(",", "."); const signed = Number(raw); const rawDate = fields[dateIndex]!; const eventDate = rawDate.includes("/") ? rawDate.split("/").reverse().join("-") : rawDate;
    return { tempId: `row-${rowIndex}`, eventDate, budgetMonth: eventDate.slice(0, 7), description: fields[descriptionIndex]!, amountCents: Math.round(Math.abs(signed) * 100), type: signed < 0 ? "expense" : "income", accountId: null, subcategoryId: null, selected: true };
  });
}
export const applyDuplicateSelection = (rows: SimpleImportRow[]) => rows.map((row) => ({ ...row, selected: !row.isDuplicate }));
