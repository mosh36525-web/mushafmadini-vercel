import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeArabic } from "../client/src/lib/arabic";

const quran = JSON.parse(
  readFileSync(
    new URL("../client/public/data/quran-uthmani.json", import.meta.url),
    "utf8"
  )
);
describe("سلامة المصحف المرفق", () => {
  it("يتضمن 114 سورة و6236 آية مرقمة بالتتابع", () => {
    expect(quran).toHaveLength(114);
    expect(
      quran.reduce((total: number, item: any) => total + item.ayahs.length, 0)
    ).toBe(6236);
    quran.forEach((surah: any, index: number) => {
      expect(surah.number).toBe(index + 1);
      surah.ayahs.forEach((ayah: any, verse: number) => {
        expect(ayah.numberInSurah).toBe(verse + 1);
        expect(typeof ayah.text).toBe("string");
        expect(ayah.text.length).toBeGreaterThan(1);
        expect(ayah.page).toBeGreaterThanOrEqual(1);
        expect(ayah.page).toBeLessThanOrEqual(604);
      });
    });
  });
  it("يحفظ ترقيم الفاتحة الصحيح بما فيه البسملة", () => {
    expect(quran[0].ayahs).toHaveLength(7);
    expect(normalizeArabic(quran[0].ayahs[0].text)).toContain("بسم الله");
    expect(normalizeArabic(quran[0].ayahs[6].text)).toContain("غير المغضوب");
  });
  it("البحث العربي يتجاهل التشكيل وهمزات الألف", () => {
    expect(normalizeArabic("ٱلْبَقَرَةِ")).toBe(normalizeArabic("البقرة"));
    expect(normalizeArabic("آل عمران")).toBe(normalizeArabic("ال عمران"));
  });
});
