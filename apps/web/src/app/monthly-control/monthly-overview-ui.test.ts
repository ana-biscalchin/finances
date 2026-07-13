import { describe, expect, it, vi } from "vitest";
import { canSaveBudget } from "./InlineBudgetAmount.js";
describe("monthly overview interactions", () => {
  it("requires confirmation only when removing an existing budget", () => {
    const confirm = vi.fn().mockReturnValue(false);
    expect(canSaveBudget(10_000, 0, confirm)).toBe(false); expect(confirm).toHaveBeenCalledOnce();
    expect(canSaveBudget(10_000, 20_000, confirm)).toBe(true); expect(confirm).toHaveBeenCalledOnce();
  });
});
