import { describe, expect, it } from "vitest";
import { applyDuplicateSelection, parseSimpleCsv } from "./simple-import.js";

describe("simple CSV import", () => {
  it("auto-detects standard columns and leaves categories optional", () => {
    const rows = parseSimpleCsv("data;descrição;valor\n10/07/2026;Mercado;-12,50");
    expect(rows[0]).toEqual(expect.objectContaining({
      eventDate: "2026-07-10", type: "expense", amountCents: 1250, subcategoryId: null
    }));
  });

  it("parses quoted delimiters, escaped quotes, multiline descriptions, and decimal dots", () => {
    const rows = parseSimpleCsv(`date;description;amount
2026-07-10;"Mercado; ""bairro""
semanal";123.45`);
    expect(rows[0]).toEqual(expect.objectContaining({
      description: 'Mercado; "bairro"\nsemanal', amountCents: 12345
    }));
  });

  it("starts duplicates unselected", () => {
    const duplicate = { ...parseSimpleCsv("data,description,amount\n2026-07-10,Test,10")[0]!, isDuplicate: true };
    expect(applyDuplicateSelection([duplicate])[0]?.selected).toBe(false);
  });
});
