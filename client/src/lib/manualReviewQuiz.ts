import { normalizeArabic } from "@/lib/arabic";

export type FillQuizQuestion = {
  verseNumber: number;
  prefix: string;
  missingText: string;
  suffix: string;
};

type SourceAyah = { numberInSurah: number; text: string };

export function normalizeQuizAnswer(value: string) {
  return normalizeArabic(value)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isQuizAnswerCorrect(answer: string, expected: string) {
  const normalizedAnswer = normalizeQuizAnswer(answer);
  return normalizedAnswer.length > 0 && normalizedAnswer === normalizeQuizAnswer(expected);
}

export function buildFillQuizQuestions(
  ayahs: SourceAyah[],
  fromVerse: number,
  toVerse: number,
  random: () => number = Math.random
): FillQuizQuestion[] {
  return ayahs
    .filter(ayah => ayah.numberInSurah >= fromVerse && ayah.numberInSurah <= toVerse)
    .map(ayah => {
      const words = ayah.text.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) return null;
      const missingCount = Math.max(1, Math.min(3, Math.floor(words.length / 5) + 1));
      const possibleStarts = words.length - missingCount + 1;
      const safeRandom = Math.min(Math.max(random(), 0), 0.999999);
      const missingStart = Math.floor(safeRandom * possibleStarts);
      const missingEnd = missingStart + missingCount;
      return {
        verseNumber: ayah.numberInSurah,
        prefix: words.slice(0, missingStart).join(" "),
        missingText: words.slice(missingStart, missingEnd).join(" "),
        suffix: words.slice(missingEnd).join(" "),
      };
    })
    .filter((question): question is FillQuizQuestion => question !== null);
}
