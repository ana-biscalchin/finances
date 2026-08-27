import { describe, expect, it } from "vitest";

import { theme } from "./theme";

describe("category theme colors", () => {
  it("registers every custom category color as a complete Mantine color scale", () => {
    const customColorNames = [
      "navy",
      "turquoise",
      "emerald",
      "olive",
      "amber",
      "coral",
      "burgundy",
      "plum",
      "brown",
      "slate"
    ];

    for (const color of customColorNames) {
      expect(theme.colors?.[color]).toHaveLength(10);
    }
  });
});
