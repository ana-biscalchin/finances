import { describe, expect, it } from "vitest";

import { assertTransactionStatus, assertTransactionType } from "./transactions.js";

describe("transactions domain", () => {
  it("accepts supported transaction types and statuses", () => {
    expect(assertTransactionType("expense")).toBe("expense");
    expect(assertTransactionType("refund")).toBe("refund");
    expect(assertTransactionStatus("confirmed")).toBe("confirmed");
  });

  it("rejects unsupported transaction types and statuses", () => {
    expect(() => assertTransactionType("transfer")).toThrow("Tipo de lançamento inválido");
    expect(() => assertTransactionStatus("paid")).toThrow("Status de lançamento inválido");
  });
});
