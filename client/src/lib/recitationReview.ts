export type RecitationWordResult = {
  expected: string;
  heard?: string;
  status: "correct" | "different" | "missing" | "extra";
};

export type RecitationComparison = {
  score: number;
  correctCount: number;
  referenceCount: number;
  words: RecitationWordResult[];
};

function words(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[^\u0621-\u063a\u0641-\u064a\u0660-\u0669a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/** Aligns recognized words with the verse while ignoring Arabic diacritics and stop marks. */
export function compareRecitation(
  referenceText: string,
  spokenText: string
): RecitationComparison {
  const reference = words(referenceText);
  const spoken = words(spokenText);
  const rows = reference.length + 1;
  const columns = spoken.length + 1;
  const costs = new Uint16Array(rows * columns);
  const actions = new Uint8Array(rows * columns);

  // 0 = match/substitute, 1 = missing reference word, 2 = extra spoken word.
  for (let i = reference.length - 1; i >= 0; i -= 1) {
    const index = i * columns + spoken.length;
    costs[index] = reference.length - i;
    actions[index] = 1;
  }
  for (let j = spoken.length - 1; j >= 0; j -= 1) {
    const index = reference.length * columns + j;
    costs[index] = spoken.length - j;
    actions[index] = 2;
  }

  for (let i = reference.length - 1; i >= 0; i -= 1) {
    for (let j = spoken.length - 1; j >= 0; j -= 1) {
      const index = i * columns + j;
      const substitution =
        costs[(i + 1) * columns + j + 1] +
        (reference[i] === spoken[j] ? 0 : 1);
      const missing = costs[(i + 1) * columns + j] + 1;
      const extra = costs[i * columns + j + 1] + 1;
      const best = Math.min(substitution, missing, extra);
      costs[index] = best;
      // Preserve a later exact word match when a skip and substitution tie.
      if (
        missing === best &&
        reference[i] !== spoken[j] &&
        reference[i + 1] === spoken[j]
      ) {
        actions[index] = 1;
      } else if (
        extra === best &&
        reference[i] !== spoken[j] &&
        reference[i] === spoken[j + 1]
      ) {
        actions[index] = 2;
      } else if (substitution === best) actions[index] = 0;
      else if (missing === best) actions[index] = 1;
      else actions[index] = 2;
    }
  }

  const aligned: RecitationWordResult[] = [];
  let i = 0;
  let j = 0;
  while (i < reference.length || j < spoken.length) {
    if (i >= reference.length) {
      aligned.push({ expected: "", heard: spoken[j], status: "extra" });
      j += 1;
      continue;
    }
    if (j >= spoken.length) {
      aligned.push({ expected: reference[i], status: "missing" });
      i += 1;
      continue;
    }

    const action = actions[i * columns + j];
    if (action === 0) {
      const matches = reference[i] === spoken[j];
      aligned.push({
        expected: reference[i],
        heard: matches ? undefined : spoken[j],
        status: matches ? "correct" : "different",
      });
      i += 1;
      j += 1;
    } else if (action === 1) {
      aligned.push({ expected: reference[i], status: "missing" });
      i += 1;
    } else {
      aligned.push({ expected: "", heard: spoken[j], status: "extra" });
      j += 1;
    }
  }

  const correctCount = aligned.filter(word => word.status === "correct").length;
  const denominator = Math.max(reference.length, spoken.length);
  return {
    score: denominator ? Math.round((correctCount / denominator) * 100) : 0,
    correctCount,
    referenceCount: reference.length,
    words: aligned,
  };
}
