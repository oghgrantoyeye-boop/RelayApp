/** Disclosure levels, from most to least detail. */
export const LEVELS = ["full", "summary", "status", "headline", "none"] as const;
export type Level = (typeof LEVELS)[number];

const RANK: Record<Level, number> = { full: 4, summary: 3, status: 2, headline: 1, none: 0 };

export const LEVEL_LABEL: Record<Level, string> = {
  full: "Full detail",
  summary: "Summary",
  status: "Status only",
  headline: "Headline",
  none: "Not shared",
};

export const rank = (l: Level) => RANK[l];
export const moreDetailed = (a: Level, b: Level): Level => (RANK[a] >= RANK[b] ? a : b);
export const lessDetailed = (a: Level, b: Level): Level => (RANK[a] <= RANK[b] ? a : b);
