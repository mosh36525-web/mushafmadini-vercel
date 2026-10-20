import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  Heart,
  Search,
  Share2,
  SlidersHorizontal,
} from "lucide-react";
import {
  duaCategories,
  quranicDuas,
  type Dua,
  type DuaCategory,
} from "../../data/duas";
import "./devotional.css";

type DuaPageProps = {
  notify: (message: string) => void;
};

type ActionState = "copied" | "shared" | "failed" | undefined;

const FAVORITES_KEY = "madini-dua-favorites";

function normalizeArabic(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(FAVORITES_KEY) ?? "[]"
    ) as unknown;
    return Array.isArray(saved)
      ? saved.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites: Set<string>) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    window.dispatchEvent(new CustomEvent("madini-data-change"));
    return true;
  } catch {
    return false;
  }
}

function copyWithFallback(value: string) {
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
}

function duaToPlainText(dua: Dua) {
  return `${dua.text}\n${dua.reference}`;
}

export default function DuaPage({ notify }: DuaPageProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | DuaCategory>("all");
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(readFavorites())
  );
  const [fontSize, setFontSize] = useState(27);
  const [actionState, setActionState] = useState<Record<string, ActionState>>(
    {}
  );

  useEffect(() => {
    const refreshFavorites = () => setFavorites(new Set(readFavorites()));
    window.addEventListener("madini-data-restored", refreshFavorites);
    return () =>
      window.removeEventListener("madini-data-restored", refreshFavorites);
  }, []);

  const filteredDuas = useMemo(() => {
    const term = normalizeArabic(search);
    return quranicDuas.filter(dua => {
      const matchesCategory = category === "all" || dua.category === category;
      const searchable = normalizeArabic(
        `${dua.text} ${dua.reference} ${dua.category}`
      );
      return matchesCategory && (!term || searchable.includes(term));
    });
  }, [category, search]);

  function setFeedback(id: string, state: Exclude<ActionState, undefined>) {
    setActionState(current => ({ ...current, [id]: state }));
    window.setTimeout(() => {
      setActionState(current => ({ ...current, [id]: undefined }));
    }, 2200);
  }

  function toggleFavorite(id: string) {
    const next = new Set(favorites);
    const isFavorite = next.has(id);
    if (isFavorite) next.delete(id);
    else next.add(id);

    setFavorites(next);
    if (saveFavorites(next)) {
      notify(
        isFavorite ? "أُزيل الدعاء من المحفوظات" : "حُفظ الدعاء في المحفوظات"
      );
    } else {
      notify("تعذر حفظ المحفوظات محليًا على هذا الجهاز");
    }
  }

  async function copyDua(dua: Dua) {
    const plainText = duaToPlainText(dua);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(plainText);
      } else if (!copyWithFallback(plainText)) {
        throw new Error("copy unavailable");
      }
      setFeedback(dua.id, "copied");
      notify("تم نسخ الدعاء مع مرجعه");
    } catch {
      setFeedback(dua.id, "failed");
      notify("تعذر نسخ الدعاء من هذا المتصفح");
    }
  }

  async function shareDua(dua: Dua) {
    const plainText = duaToPlainText(dua);
    try {
      if (navigator.share) {
        await navigator.share({ title: "دعاء من القرآن", text: plainText });
        setFeedback(dua.id, "shared");
        notify("تمت مشاركة الدعاء");
        return;
      }

      await copyDua(dua);
      setFeedback(dua.id, "copied");
      notify("المشاركة غير متاحة؛ نُسخ الدعاء بدلًا من ذلك");
    } catch {
      setFeedback(dua.id, "failed");
      notify("تعذرت مشاركة الدعاء من هذا المتصفح");
    }
  }

  return (
    <main className="page-content devotional-page" dir="rtl">
      <section className="devotional-heading">
        <div>
          <span className="eyebrow">من القرآن الكريم</span>
          <h1>
            أدعية <em>قرآنية</em>
          </h1>
          <p>نصوص كاملة موثّقة بالسورة ورقم الآية؛ اختر ما تقرأه بقلب حاضر.</p>
        </div>
        <div className="devotional-heading-actions" aria-label="حجم نص الأدعية">
          <span>حجم النص</span>
          <button
            className="icon-button subtle"
            onClick={() => setFontSize(size => Math.max(21, size - 2))}
            aria-label="تصغير نص الأدعية"
          >
            أ−
          </button>
          <button
            className="icon-button subtle"
            onClick={() => setFontSize(size => Math.min(37, size + 2))}
            aria-label="تكبير نص الأدعية"
          >
            أ+
          </button>
        </div>
      </section>

      <section className="devotional-toolbar" aria-label="تصفية الأدعية">
        <label className="search-field devotional-search">
          <Search size={17} aria-hidden="true" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="ابحث في النص أو السورة"
            aria-label="البحث في الأدعية"
          />
        </label>
        <div
          className="dua-category-list"
          role="group"
          aria-label="تصنيف الأدعية"
        >
          <span className="toolbar-label">
            <SlidersHorizontal size={15} /> التصنيف
          </span>
          {duaCategories.map(item => (
            <button
              key={item.id}
              className={`dua-category ${category === item.id ? "active" : ""}`}
              onClick={() => setCategory(item.id)}
              aria-pressed={category === item.id}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <div className="devotional-summary">
        <span>
          {filteredDuas.length} {filteredDuas.length === 1 ? "دعاء" : "أدعية"}
        </span>
        <span className="summary-separator">•</span>
        <span>
          <Bookmark size={14} /> {favorites.size} محفوظ
        </span>
      </div>

      {filteredDuas.length ? (
        <section className="dua-grid" aria-live="polite">
          {filteredDuas.map(dua => {
            const isFavorite = favorites.has(dua.id);
            const status = actionState[dua.id];
            return (
              <article className="dua-card" key={dua.id}>
                <div className="dua-card-top">
                  <span className="dua-category-tag">{dua.category}</span>
                  <button
                    className={`icon-button subtle dua-favorite ${isFavorite ? "selected" : ""}`}
                    onClick={() => toggleFavorite(dua.id)}
                    aria-label={
                      isFavorite ? "إزالة من المحفوظات" : "حفظ الدعاء"
                    }
                    aria-pressed={isFavorite}
                  >
                    {isFavorite ? (
                      <BookmarkCheck size={18} />
                    ) : (
                      <Bookmark size={18} />
                    )}
                  </button>
                </div>
                <p className="dua-text" style={{ fontSize: `${fontSize}px` }}>
                  {dua.text}
                </p>
                <footer className="dua-card-footer">
                  <a
                    href={dua.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="dua-reference"
                  >
                    {dua.reference}
                  </a>
                  <div className="dua-actions">
                    <button
                      className="dua-action"
                      onClick={() => void copyDua(dua)}
                    >
                      {status === "copied" ? (
                        <Check size={16} />
                      ) : (
                        <Copy size={16} />
                      )}
                      <span>{status === "copied" ? "تم النسخ" : "نسخ"}</span>
                    </button>
                    <button
                      className="dua-action"
                      onClick={() => void shareDua(dua)}
                    >
                      {status === "shared" ? (
                        <Check size={16} />
                      ) : (
                        <Share2 size={16} />
                      )}
                      <span>
                        {status === "shared" ? "تمت المشاركة" : "مشاركة"}
                      </span>
                    </button>
                    {status === "failed" && (
                      <span className="dua-action-error" role="status">
                        تعذر الإجراء
                      </span>
                    )}
                  </div>
                </footer>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="devotional-empty" aria-live="polite">
          <Heart size={25} />
          <h2>لم نجد دعاءً بهذه التصفية</h2>
          <p>جرّب كلمة أخرى أو اعرض كل الأدعية.</p>
          <button
            className="outline-button"
            onClick={() => {
              setSearch("");
              setCategory("all");
            }}
          >
            عرض الكل
          </button>
        </section>
      )}
    </main>
  );
}
