import { describe, expect, it } from "vitest";
import { compareRecitation, compareRecitationPartial } from "./recitationReview";

describe("compareRecitation", () => {
  it("ignores Arabic diacritics and normalizes alif and yaa", () => {
    const result = compareRecitation("الرَّحْمَٰنِ الرَّحِيمِ", "الرحمن الرحيم");
    expect(result.score).toBe(100);
    expect(result.correctCount).toBe(2);
    expect(result.words.every(word => word.status === "correct")).toBe(true);
  });

  it("identifies a changed, missing, and extra word", () => {
    const result = compareRecitation("بسم الله الرحمن الرحيم", "بسم الله الرحيم زيادة");
    expect(result.words).toEqual([
      { expected: "بسم", heard: undefined, status: "correct" },
      { expected: "الله", heard: undefined, status: "correct" },
      { expected: "الرحمن", status: "missing" },
      { expected: "الرحيم", heard: undefined, status: "correct" },
      { expected: "", heard: "زيادة", status: "extra" },
    ]);
  });

  it("returns an empty comparison for empty input", () => {
    expect(compareRecitation("", "")).toEqual({
      score: 0,
      correctCount: 0,
      referenceCount: 0,
      words: [],
    });
  });

  it("does not mark future verse words as missing during live recitation", () => {
    const result = compareRecitationPartial(
      "الحمد لله رب العالمين الرحمن الرحيم",
      "الحمد لله رب العالمين"
    );
    expect(result.words.map(word => word.expected)).toEqual(["الحمد", "لله"]);
    expect(result.words.some(word => word.status === "missing")).toBe(false);
  });
});
