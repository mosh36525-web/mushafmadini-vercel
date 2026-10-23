import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVIEW_PLAN,
  markReviewTaskComplete,
  normalizeReviewCompletions,
  normalizeReviewPlan,
  removeReviewTaskCompletions,
} from "./reviewPlan";

const surahs = [
  { number: 1, ayahs: 7 },
  { number: 2, ayahs: 286 },
  { number: 18, ayahs: 110 },
];

describe("personal review plan", () => {
  it("uses the starter plan when saved input is not an array", () => {
    expect(normalizeReviewPlan(null, surahs)).toEqual(DEFAULT_REVIEW_PLAN);
  });

  it("keeps only valid surah verse ranges and unique ids", () => {
    expect(
      normalizeReviewPlan(
        [
          { id: "a", surahNumber: 2, fromVerse: 4, toVerse: 9 },
          { id: "a", surahNumber: 1, fromVerse: 1, toVerse: 7 },
          { id: "bad-range", surahNumber: 1, fromVerse: 4, toVerse: 8 },
          { id: "bad-surah", surahNumber: 114, fromVerse: 1, toVerse: 1 },
        ],
        surahs
      )
    ).toEqual([{ id: "a", surahNumber: 2, fromVerse: 4, toVerse: 9 }]);
  });

  it("records task completion once for the selected day", () => {
    const first = markReviewTaskComplete({}, "2026-10-23", "task-a");
    expect(markReviewTaskComplete(first, "2026-10-23", "task-a")).toEqual({
      "2026-10-23": ["task-a"],
    });
    expect(markReviewTaskComplete(first, "2026-10-24", "task-b")).toEqual({
      "2026-10-23": ["task-a"],
      "2026-10-24": ["task-b"],
    });
  });

  it("drops invalid dates and removes a deleted task from saved completions", () => {
    const normalized = normalizeReviewCompletions({
      "not-a-date": ["task-a"],
      "2026-10-23": ["task-a", "task-b", 9],
    });
    expect(removeReviewTaskCompletions(normalized, "task-a")).toEqual({
      "2026-10-23": ["task-b"],
    });
  });
});
