/** Converts zero-based stored order into a one-based position for the interface. */
export function toDisplayPosition(sortOrder: number): number {
  return sortOrder + 1;
}

/** Converts a one-based interface position back into zero-based stored order. */
export function fromDisplayPosition(value: number | string): number | undefined {
  if (typeof value === "string" && !value.trim()) return undefined;

  const position = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(position)) {
    throw new Error("Posição inválida.");
  }

  if (position < 1) {
    throw new Error("Posição deve começar em 1.");
  }

  return position - 1;
}
