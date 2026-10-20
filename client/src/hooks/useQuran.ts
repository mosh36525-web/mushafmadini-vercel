import { useEffect, useState } from "react";

export type Ayah = {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  page: number;
  hizbQuarter: number;
};
export type QuranSurah = {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
  revelationType: string;
  ayahs: Ayah[];
};
let cached: QuranSurah[] | null = null;
let pending: Promise<QuranSurah[]> | null = null;
function loadQuran() {
  if (cached) return Promise.resolve(cached);
  if (!pending)
    pending = fetch("/data/quran-uthmani.json")
      .then(response => {
        if (!response.ok) throw new Error("تعذر تحميل نص القرآن");
        return response.json();
      })
      .then((data: QuranSurah[]) => {
        if (
          !Array.isArray(data) ||
          data.length !== 114 ||
          data.reduce((total, surah) => total + surah.ayahs.length, 0) !== 6236
        )
          throw new Error("ملف القرآن غير مكتمل");
        cached = data;
        return data;
      })
      .finally(() => {
        pending = null;
      });
  return pending;
}
export function useQuran() {
  const [quran, setQuran] = useState<QuranSurah[]>(cached ?? []);
  const [error, setError] = useState("");
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    loadQuran()
      .then(data => {
        if (active) setQuran(data);
      })
      .catch(() => {
        if (active)
          setError("تعذر تحميل المصحف. تحقق من اتصالك ثم أعد المحاولة.");
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return {
    quran,
    error,
    loading: !quran.length && !error,
    retry: () => retry(value => value + 1),
  };
}
