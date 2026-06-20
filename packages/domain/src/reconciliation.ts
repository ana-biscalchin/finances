import { isPositiveAccountType } from "./financial-classification.js";

export interface ImportedItem {
  date: string;
  description: string;
  amountCents: number;
}

export interface CandidateTransaction {
  id: string;
  type: string;
  description: string;
  amountCents: number;
  eventDate: string;
  accountId: string | null;
  creditCardId: string | null;
  status: string;
}

export function differenceInDays(d1: string, d2: string): number {
  const t1 = new Date(`${d1}T00:00:00.000Z`).getTime();
  const t2 = new Date(`${d2}T00:00:00.000Z`).getTime();
  return Math.round(Math.abs(t1 - t2) / (1000 * 60 * 60 * 24));
}

export function calculateMatchScore(
  item: ImportedItem,
  tx: CandidateTransaction,
  context: { accountId?: string | null; creditCardId?: string | null }
): number {
  // 1. Elegibilidade Básica
  if (tx.status === "canceled" || tx.status === "reconciled") {
    return 0;
  }

  // 2. Coerência de Direção de Dinheiro e Valor
  const itemAbs = Math.abs(item.amountCents);
  if (tx.amountCents !== itemAbs) {
    return 0;
  }

  const isItemPositive = item.amountCents > 0;
  const isTxPositive = isPositiveAccountType(tx.type);
  if (isItemPositive !== isTxPositive) {
    return 0;
  }

  // 3. Proximidade de Data (Máximo de 5 dias de diferença)
  let datePoints = 0;
  try {
    const diffDays = differenceInDays(item.date, tx.eventDate);
    if (diffDays === 0) datePoints = 40;
    else if (diffDays === 1) datePoints = 30;
    else if (diffDays <= 3) datePoints = 20;
    else if (diffDays <= 5) datePoints = 10;
    else return 0; // Data muito longe
  } catch {
    return 0; // Se houver falha de data, inválido
  }

  // 4. Vínculo de Conta/Cartão
  let accountPoints = 0;
  if (context.creditCardId && tx.creditCardId === context.creditCardId) {
    accountPoints = 40;
  } else if (context.accountId && tx.accountId === context.accountId) {
    accountPoints = 40;
  }

  // 5. Similaridade de Descrição
  let descPoints = 0;
  const cleanStr = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

  const s1 = cleanStr(item.description);
  const s2 = cleanStr(tx.description);

  if (s1 === s2 || s1.includes(s2) || s2.includes(s1)) {
    descPoints = 20;
  } else {
    // Intersecção de palavras
    const w1 = new Set(s1.split(/\s+/).filter((w) => w.length >= 3));
    const w2 = new Set(s2.split(/\s+/).filter((w) => w.length >= 3));
    let hasCommonWord = false;
    for (const w of w1) {
      if (w2.has(w)) {
        hasCommonWord = true;
        break;
      }
    }
    if (hasCommonWord) {
      descPoints = 10;
    }
  }

  return accountPoints + datePoints + descPoints;
}
