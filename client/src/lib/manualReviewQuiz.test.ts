import { describe, expect, it } from "vitest";
import {
  buildFillQuizQuestions,
  buildNextVerseQuizQuestions,
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

  it("requires at least three verses for next-verse choices", () => {
    expect(buildNextVerseQuizQuestions(4, 5, () => 0)).toEqual([]);
    expect(buildNextVerseQuizQuestions(5, 4, () => 0)).toEqual([]);
  });

  it("builds shuffled next-verse questions with a unique correct choice", () => {
    const questions = buildNextVerseQuizQuestions(1, 4, () => 0);
    expect(questions).toHaveLength(3);
    for (const question of questions) {
      expect(question.correctVerse).toBe(question.promptVerse + 1);
      expect(question.choices).toContain(question.correctVerse);
      expect(new Set(question.choices).size).toBe(question.choices.length);
      expect(question.choices.length).toBe(4);
    }
  });
});
