import { useCallback, useEffect, useState, type SetStateAction } from "react";

export function readSaved<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const decoded = JSON.parse(raw);
    if (Array.isArray(fallback) && !Array.isArray(decoded)) return fallback;
    if (
      fallback !== null &&
      !Array.isArray(fallback) &&
      (typeof decoded !== typeof fallback || decoded === null)
    )
      return fallback;
    if (typeof fallback === "number" && !Number.isFinite(decoded))
      return fallback;
    if (
      key === "madini-history" &&
      (!Array.isArray(decoded) ||
        decoded.some(
          item =>
            !item ||
            !Number.isInteger(item.surahNumber) ||
            item.surahNumber < 1 ||
            item.surahNumber > 114 ||
            typeof item.name !== "string" ||
            typeof item.reciter !== "string" ||
            typeof item.date !== "string"
        ))
    )
      return fallback;
    if (
      key === "madini-activity" &&
      (!Array.isArray(decoded) ||
        decoded.some(
          item => typeof item !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item)
        ))
    )
      return fallback;
    if (
      key === "madini-review-completed" &&
      (!Array.isArray(decoded) ||
        decoded.some(item => !Number.isInteger(item) || item < 1 || item > 114))
    )
      return fallback;
    if (
      (key === "madini-position" || key === "madini-bookmark-position") &&
      decoded !== null &&
      (!Number.isInteger(decoded.surahNumber) ||
        decoded.surahNumber < 1 ||
        decoded.surahNumber > 114 ||
        !Number.isInteger(decoded.verse) ||
        decoded.verse < 1 ||
        decoded.verse > 286)
    )
      return fallback;
    return decoded as T;
  } catch {
    return fallback;
  }
}

export function writeSaved(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    queueMicrotask(() =>
      window.dispatchEvent(new CustomEvent("madini-data-change"))
    );
  } catch {
    /* Private browsing or storage quota: retain the current in-memory state. */
  }
}

export function usePersistentState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readSaved(key, fallback));
  const update = useCallback(
    (next: SetStateAction<T>) => {
      setValue(current => {
        const result =
          typeof next === "function" ? (next as (old: T) => T)(current) : next;
        writeSaved(key, result);
        return result;
      });
    },
    [key]
  );
  useEffect(() => {
    const reload = () => setValue(readSaved(key, fallback));
    window.addEventListener("madini-data-restored", reload);
    window.addEventListener("madini-data-change", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("madini-data-restored", reload);
      window.removeEventListener("madini-data-change", reload);
      window.removeEventListener("storage", reload);
    };
  }, [key]);
  return [value, update] as const;
}
