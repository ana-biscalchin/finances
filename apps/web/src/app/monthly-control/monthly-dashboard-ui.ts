type DashboardItem = {
  categorySortOrder: number;
  subcategorySortOrder: number;
  attention: "over" | "near_limit" | "unplanned" | "on_track" | "unused";
  abovePlannedCents: number;
  spentCents: number;
};

export function sortMonthlyItems<T extends DashboardItem>(items: T[]): T[] {
  return [...items].sort(
    (left, right) =>
      left.categorySortOrder - right.categorySortOrder ||
      left.subcategorySortOrder - right.subcategorySortOrder
  );
}

const attentionPriority: Record<DashboardItem["attention"], number> = {
  over: 0,
  unplanned: 1,
  near_limit: 2,
  on_track: 3,
  unused: 4
};

export function buildAttentionItems<T extends DashboardItem>(items: T[]): T[] {
  return items
    .filter((item) => ["over", "unplanned", "near_limit"].includes(item.attention))
    .sort(
      (left, right) =>
        attentionPriority[left.attention] - attentionPriority[right.attention] ||
        right.abovePlannedCents - left.abovePlannedCents ||
        right.spentCents - left.spentCents
    );
}
