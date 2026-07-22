export const ALL_CATEGORIES = "Tümü";
export const DEMO_USER_ID = 1001;
export const DEFAULT_RECOMMENDATION_LIMIT = 5;
export const DEFAULT_ANALYTICS_DAYS = 30;
export const ANALYTICS_DAY_OPTIONS = [7, 30, 90];
export const DEFAULT_ANALYTICS_PERIOD = "last_30_days";
export const ANALYTICS_PERIOD_OPTIONS = [
  { value: "today", label: "Bugün" },
  { value: "last_7_days", label: "Son 7 gün" },
  { value: "last_30_days", label: "Son 30 gün" },
  { value: "all_time", label: "Tüm zamanlar" },
  { value: "custom", label: "Özel aralık" }
];

export const ANALYTICS_PERIOD_DAYS = {
  today: 1,
  last_7_days: 7,
  last_30_days: 30,
  all_time: DEFAULT_ANALYTICS_DAYS
};
