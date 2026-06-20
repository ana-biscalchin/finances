/**
 * Utilitários compartilhados de leitura de CSV.
 * Usados em TransactionsPage e BillsPage — não duplicar.
 */

export function parseCsvHeaderLine(headerLine: string): string[] {
  const delimiter = detectCsvDelimiter(headerLine);
  const fields: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i];
    if (char === '"') {
      if (insideQuotes && headerLine[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      fields.push(cleanCsvField(currentField));
      currentField = "";
    } else {
      currentField += char;
    }
  }

  fields.push(cleanCsvField(currentField));
  return fields;
}

export function detectCsvDelimiter(headerLine: string): "," | ";" | "\t" {
  const candidates = [",", ";", "\t"] as const;

  return candidates
    .map((delimiter) => ({
      delimiter,
      count: countDelimiterOutsideQuotes(headerLine, delimiter)
    }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function countDelimiterOutsideQuotes(line: string, delimiter: "," | ";" | "\t"): number {
  let count = 0;
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      count++;
    }
  }

  return count;
}

function cleanCsvField(value: string): string {
  return value.trim().replace(/^\uFEFF/, "");
}
