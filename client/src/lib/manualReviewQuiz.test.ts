import { describe, expect, it } from "vitest";
import {
  buildFillQuizQuestions,
  isQuizAnswerCorrect,
  normalizeQuizAnswer,
} from "./manualReviewQuiz";

describe("manual Quran fill quiz", () => {
  it("normalizes Arabic diacritics and common alif forms", () => {
    expect(normalizeQuizAnswer("أَنَّ اللَّهَ غَفُورٌ"))
      .toBe(normalizeQuizAnswer("ان الله غفور"));
  });

  it("ignores punctuation and extra whitespace", () => {
    expect(isQuizAnswerCorrect("  وَاللَّهُ،  سَمِيعٌ عَلِيمٌ! ", "والله سميع عليم")).toBe(true);
  });

  it("does not accept an empty or incomplete answer", () => {
    expect(isQuizAnswerCorrect("   ", "الحمد لله رب العالمين")).toBe(false);
    expect(isQuizAnswerCorrect("الحمد لله", "الحمد لله رب العالمين")).toBe(false);
  });

  it("builds one random blank per verse within the selected range", () => {
    const questions = buildFillQuizQuestions(
      [
        { numberInSurah: 1, text: "كلمة ثانية ثالثة رابعة" },
        { numberInSurah: 4, text: "خارج النطاق" },
        { numberInSurah: 3, text: "آية خامسة سادسة" },
      ],
      1,
      3,
      () => 0
    );
    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({ verseNumber: 1, prefix: "", missingText: "كلمة", suffix: "ثانية ثالثة رابعة" });
    expect(questions[1]).toMatchObject({ verseNumber: 3, prefix: "", missingText: "آية", suffix: "خامسة سادسة" });
  });

  it("handles a one-word verse without producing an empty blank", () => {
    expect(buildFillQuizQuestions([{ numberInSurah: 5, text: "الرحمن" }], 5, 5, () => 0))
      .toEqual([{ verseNumber: 5, prefix: "", missingText: "الرحمن", suffix: "" }]);
  });
});
