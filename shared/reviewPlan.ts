export type ReviewPlanSurah = {
  number: number;
  ayahs: number;
};

export type ReviewPlanItem = {
  id: string;
  surahNumber: number;
  fromVerse: number;
  toVerse: number;
};

export type ReviewCompletionsByDay = Record<string, string[]>;

export const MAX_REVIEW_PLAN_ITEMS = 30;
export const DEFAULT_REVIEW_PLAN: ReviewPlanItem[] = [
  { id: "default-fatiha", surahNumber: 1, fromVerse: 1, toVerse: 7 },
  { id: "default-baqarah", surahNumber: 2, fromVerse: 1, toVerse: 5 },
  { id: "default-kahf", surahNumber: 18, fromVerse: 1, toVerse: 10 },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeReviewPlan(
  value: unknown,
  surahs: readonly ReviewPlanSurah[]
): ReviewPlanItem[] {
  if (!Array.isArray(value)) return DEFAULT_REVIEW_PLAN;
  const seenIds = new Set<string>();
  const result: ReviewPlanItem[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const surahNumber = item.surahNumber;
    const fromVerse = item.fromVerse;
    const toVerse = item.toVerse;
    if (
      typeof item.id !== "string" ||
      !item.id.trim() ||
      item.id.length > 120 ||
      seenIds.has(item.id) ||
      typeof surahNumber !== "number" ||
      !Number.isInteger(surahNumber) ||
      typeof fromVerse !== "number" ||
      !Number.isInteger(fromVerse) ||
      typeof toVerse !== "number" ||
      !Number.isInteger(toVerse)
    ) {
      continue;
    }

    const surah = surahs.find(item => item.number === surahNumber);
    if (
      !surah ||
      fromVerse < 1 ||
      toVerse < fromVerse ||
      toVerse > surah.ayahs
    ) {
      continue;
    }

    seenIds.add(item.id);
    result.push({
      id: item.id,
      surahNumber,
      fromVerse,
      toVerse,
    });
    if (result.length >= MAX_REVIEW_PLAN_ITEMS) break;
  }

  return result;
}

export function normalizeReviewCompletions(
  value: unknown
): ReviewCompletionsByDay {
  if (!isRecord(value)) return {};
  const result: ReviewCompletionsByDay = {};
  for (const [date, ids] of Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).slice(-30)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(ids)) continue;
    result[date] = Array.from(
      new Set(ids.filter((id): id is string => typeof id === "string" && id.length <= 120))
    ).slice(0, MAX_REVIEW_PLAN_ITEMS);
  }
  return result;
}

export function markReviewTaskComplete(
  value: unknown,
  date: string,
  taskId: string
): ReviewCompletionsByDay {
  const current = normalizeReviewCompletions(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !taskId || taskId.length > 120)
    return current;
  const completed = new Set(current[date] ?? []);
  completed.add(taskId);
  return normalizeReviewCompletions({
    ...current,
    [date]: [...completed],
  });
}

export function removeReviewTaskCompletions(
  value: unknown,
  taskId: string
): ReviewCompletionsByDay {
  const current = normalizeReviewCompletions(value);
  return Object.fromEntries(
    Object.entries(current).map(([date, ids]) => [
      date,
      ids.filter(id => id !== taskId),
    ])
  );
}
