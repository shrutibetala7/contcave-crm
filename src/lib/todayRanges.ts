/**
 * Change Brief v1.1 §C — the Today screen's range toggle. Kept in its own
 * dependency-free module: dashboardToday.ts pulls in the Mongo driver
 * (server-only), and TodayFilters.tsx (a Client Component) needs these
 * constants without dragging that import into the browser bundle.
 */
export const TODAY_RANGES = { week: 7, "14d": 14, "30d": 30 } as const;
export type TodayRange = keyof typeof TODAY_RANGES;
