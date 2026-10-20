import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Vibrate,
} from "lucide-react";
import "./devotional.css";

type TasbihPageProps = {
  notify: (message: string) => void;
};

type TasbihData = {
  counts: Record<string, number>;
  targets: Record<string, number>;
  labels: Record<string, string>;
  daily: { date: string; total: number };
  vibration: boolean;
  lastCustom: string;
};

const TASBIH_STORAGE_KEY = "madini-tasbih-data";
const MAX_TARGET = 9999;
const presetDhikrs = [
  { id: "subhan-allah", label: "سبحان الله" },
  { id: "alhamdulillah", label: "الحمد لله" },
  { id: "allahu-akbar", label: "الله أكبر" },
  { id: "la-ilaha-illa-allah", label: "لا إله إلا الله" },
  { id: "subhan-allah-wa-bihamdih", label: "سبحان الله وبحمده" },
] as const;

function todayKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function createDefaultData(): TasbihData {
  return {
    counts: {},
    targets: {},
    labels: {},
    daily: { date: todayKey(), total: 0 },
    vibration: false,
    lastCustom: "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberRecord(value: unknown, min: number, max: number) {
  if (!isRecord(value)) return {} as Record<string, number>;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      typeof item === "number" && Number.isFinite(item)
        ? [[key, Math.max(min, Math.min(max, Math.floor(item)))]]
        : []
    )
  );
}

function stringRecord(value: unknown) {
  if (!isRecord(value)) return {} as Record<string, string>;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      typeof item === "string" && item.trim() ? [[key, item.trim()]] : []
    )
  );
}

function normalizeData(value: unknown): TasbihData {
  const fallback = createDefaultData();
  if (!isRecord(value)) return fallback;

  const rawDaily = isRecord(value.daily) ? value.daily : {};
  const savedDate =
    typeof rawDaily.date === "string" ? rawDaily.date : fallback.daily.date;
  const savedTotal =
    typeof rawDaily.total === "number" && Number.isFinite(rawDaily.total)
      ? Math.max(0, Math.floor(rawDaily.total))
      : 0;

  return {
    counts: numberRecord(value.counts, 0, Number.MAX_SAFE_INTEGER),
    targets: numberRecord(value.targets, 1, MAX_TARGET),
    labels: stringRecord(value.labels),
    daily:
      savedDate === fallback.daily.date
        ? { date: savedDate, total: savedTotal }
        : fallback.daily,
    vibration: value.vibration === true,
    lastCustom:
      typeof value.lastCustom === "string" ? value.lastCustom.trim() : "",
  };
}

function readTasbihData() {
  if (typeof window === "undefined") return createDefaultData();
  try {
    return normalizeData(
      JSON.parse(window.localStorage.getItem(TASBIH_STORAGE_KEY) ?? "{}")
    );
  } catch {
    return createDefaultData();
  }
}

function writeTasbihData(next: TasbihData) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(TASBIH_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("madini-data-change"));
    return true;
  } catch {
    return false;
  }
}

function customDhikrId(label: string) {
  return `custom:${label.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar")}`;
}

export default function TasbihPage({ notify }: TasbihPageProps) {
  const [data, setData] = useState<TasbihData>(readTasbihData);
  const dataRef = useRef(data);
  const [selectedId, setSelectedId] = useState<string>(presetDhikrs[0].id);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customDraft, setCustomDraft] = useState(data.lastCustom);
  const [targetDraft, setTargetDraft] = useState("33");
  const [showCustomTarget, setShowCustomTarget] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const vibrationSupported =
    typeof navigator !== "undefined" && "vibrate" in navigator;
  const preset = presetDhikrs.find(dhikr => dhikr.id === selectedId);
  const selectedLabel = preset?.label ?? data.labels[selectedId] ?? "ذكر مخصص";
  const count = data.counts[selectedId] ?? 0;
  const target = data.targets[selectedId] ?? 33;
  const progress = Math.min(100, Math.round((count / target) * 100));
  const remaining = Math.max(0, target - count);
  const isCustomTarget = target !== 33 && target !== 100;

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    const restore = () => {
      const next = readTasbihData();
      dataRef.current = next;
      setData(next);
      setCustomDraft(next.lastCustom);
      setTargetDraft(String(next.targets[selectedId] ?? 33));
      const restoredTarget = next.targets[selectedId] ?? 33;
      setShowCustomTarget(restoredTarget !== 33 && restoredTarget !== 100);
    };
    window.addEventListener("madini-data-restored", restore);
    return () => window.removeEventListener("madini-data-restored", restore);
  }, [selectedId]);

  useEffect(() => {
    const selectedTarget = data.targets[selectedId] ?? 33;
    setTargetDraft(String(selectedTarget));
    setShowCustomTarget(selectedTarget !== 33 && selectedTarget !== 100);
  }, [data.targets, selectedId]);

  function commit(change: (current: TasbihData) => TasbihData) {
    const current = normalizeData(dataRef.current);
    const next = change(current);
    dataRef.current = next;
    setData(next);
    if (!writeTasbihData(next)) {
      notify("تعذر حفظ التغيير محليًا على هذا الجهاز");
      return false;
    }
    return true;
  }

  function selectDhikr(id: string) {
    setSelectedId(id);
    setResetOpen(false);
  }

  function useCustomDhikr() {
    const label = customDraft.trim().replace(/\s+/g, " ");
    if (!label) {
      notify("اكتب الذكر الذي تريد عَدَّه أولًا");
      return;
    }
    const id = customDhikrId(label);
    commit(current => ({
      ...current,
      labels: { ...current.labels, [id]: label },
      lastCustom: label,
    }));
    setSelectedId(id);
    setShowCustomInput(true);
    setResetOpen(false);
  }

  function increase() {
    const targetAtTap = target;
    let reachedTarget = false;
    commit(current => {
      const previousCount = current.counts[selectedId] ?? 0;
      const nextCount = previousCount + 1;
      reachedTarget = nextCount === targetAtTap;
      return {
        ...current,
        counts: { ...current.counts, [selectedId]: nextCount },
        daily: { date: todayKey(), total: current.daily.total + 1 },
      };
    });

    if (data.vibration && vibrationSupported) {
      try {
        navigator.vibrate(12);
      } catch {
        // Some browsers expose vibration but do not allow it in the current context.
      }
    }
    if (reachedTarget) notify("أتممت هدفك الشخصي لهذا الذكر");
  }

  function undo() {
    if (count === 0) return;
    commit(current => ({
      ...current,
      counts: {
        ...current.counts,
        [selectedId]: Math.max(0, (current.counts[selectedId] ?? 0) - 1),
      },
      daily: { date: todayKey(), total: Math.max(0, current.daily.total - 1) },
    }));
  }

  function resetSelected() {
    commit(current => ({
      ...current,
      counts: { ...current.counts, [selectedId]: 0 },
    }));
    setResetOpen(false);
    notify("صُفِّر عداد هذا الذكر");
  }

  function chooseTarget(nextTarget: 33 | 100) {
    setShowCustomTarget(false);
    commit(current => ({
      ...current,
      targets: { ...current.targets, [selectedId]: nextTarget },
    }));
  }

  function saveCustomTarget() {
    const nextTarget = Number(targetDraft);
    if (
      !Number.isInteger(nextTarget) ||
      nextTarget < 1 ||
      nextTarget > MAX_TARGET
    ) {
      notify(`اكتب هدفًا صحيحًا بين 1 و${MAX_TARGET}`);
      return;
    }
    commit(current => ({
      ...current,
      targets: { ...current.targets, [selectedId]: nextTarget },
    }));
    setShowCustomTarget(false);
    notify("تم تعيين الهدف الشخصي");
  }

  return (
    <main className="page-content devotional-page tasbih-page" dir="rtl">
      <section className="devotional-heading tasbih-heading">
        <div>
          <span className="eyebrow">عداد محلي</span>
          <h1>
            مسبحة <em>هادئة</em>
          </h1>
          <p>
            اختر ذكرًا، واضبط هدفًا شخصيًا يناسب وقتك. يُحفظ التقدّم في هذا
            الجهاز فقط.
          </p>
        </div>
        <div className="tasbih-daily-total" aria-label="مجموع اليوم">
          <span>مجموع اليوم</span>
          <strong>{data.daily.total.toLocaleString("ar-SA")}</strong>
          <small>تحديث يومي</small>
        </div>
      </section>

      <section className="tasbih-layout">
        <div className="tasbih-main-card panel-glow">
          <div className="daily-pattern" aria-hidden="true" />
          <div className="tasbih-main-content">
            <span className="eyebrow">الذكر المختار</span>
            <h2>{selectedLabel}</h2>
            <p className="tasbih-keyboard-hint" id="tasbih-counter-hint">
              المس العداد للزيادة، أو اضغط مسافة بعد تركيزه.
            </p>

            <div
              className="tasbih-counter"
              role="button"
              tabIndex={0}
              aria-label={`زيادة عداد ${selectedLabel}. العدد الحالي ${count}`}
              aria-describedby="tasbih-counter-hint"
              onClick={increase}
              onKeyDown={event => {
                if (event.key === " " || event.key === "Spacebar") {
                  event.preventDefault();
                  increase();
                }
              }}
            >
              <span className="tasbih-counter-label">العدد</span>
              <strong>{count.toLocaleString("ar-SA")}</strong>
              <span className="tasbih-counter-tap">
                <Plus size={17} /> للمس والزيادة
              </span>
            </div>

            <div className="tasbih-progress-row">
              <div className="tasbih-progress" aria-hidden="true">
                <i style={{ width: `${progress}%` }} />
              </div>
              <span>
                {count >= target
                  ? "اكتمل الهدف الشخصي"
                  : `المتبقي ${remaining.toLocaleString("ar-SA")}`}
              </span>
            </div>

            <div className="tasbih-counter-actions">
              <button
                className="outline-button"
                onClick={undo}
                disabled={count === 0}
              >
                <Minus size={16} /> تراجع
              </button>
              <button
                className="text-button danger-button"
                onClick={() => setResetOpen(true)}
                disabled={count === 0}
              >
                <RotateCcw size={16} /> تصفير
              </button>
            </div>

            {resetOpen && (
              <div
                className="tasbih-inline-confirm"
                role="alertdialog"
                aria-label="تأكيد تصفير العداد"
              >
                <div>
                  <strong>تصفير عداد «{selectedLabel}»؟</strong>
                  <span>لا يغيّر هذا مجموع النقرات المسجّل لليوم.</span>
                </div>
                <div className="tasbih-confirm-actions">
                  <button
                    className="outline-button"
                    onClick={() => setResetOpen(false)}
                  >
                    إلغاء
                  </button>
                  <button className="primary-button" onClick={resetSelected}>
                    نعم، صفّر العداد
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="tasbih-settings-card">
          <div className="tasbih-settings-heading">
            <span className="quick-icon amber">
              <Sparkles size={19} />
            </span>
            <div>
              <span className="eyebrow">اختياراتك</span>
              <h2>الذكر والهدف</h2>
            </div>
          </div>
          <div
            className="tasbih-preset-list"
            role="group"
            aria-label="اختيار الذكر"
          >
            {presetDhikrs.map(dhikr => (
              <button
                key={dhikr.id}
                className={`tasbih-dhikr-choice ${selectedId === dhikr.id ? "active" : ""}`}
                onClick={() => selectDhikr(dhikr.id)}
                aria-pressed={selectedId === dhikr.id}
              >
                <span>{dhikr.label}</span>
                {selectedId === dhikr.id && <Check size={16} />}
              </button>
            ))}
          </div>

          <button
            className={`tasbih-custom-toggle ${showCustomInput ? "active" : ""}`}
            onClick={() => setShowCustomInput(shown => !shown)}
            aria-expanded={showCustomInput}
          >
            ذكر مخصص <ChevronLeft size={16} />
          </button>
          {showCustomInput && (
            <div className="tasbih-custom-entry">
              <label htmlFor="custom-dhikr">النص الذي تريد عَدَّه</label>
              <input
                id="custom-dhikr"
                value={customDraft}
                onChange={event => setCustomDraft(event.target.value)}
                placeholder="اكتب ذكرًا مخصصًا"
                maxLength={120}
              />
              <button className="wide-button" onClick={useCustomDhikr}>
                استخدام هذا الذكر
              </button>
            </div>
          )}

          <div className="tasbih-target-section">
            <span className="tasbih-label">هدفي الشخصي</span>
            <div
              className="tasbih-target-options"
              role="group"
              aria-label="اختيار الهدف الشخصي"
            >
              <button
                className={!isCustomTarget && target === 33 ? "active" : ""}
                onClick={() => chooseTarget(33)}
              >
                33
              </button>
              <button
                className={!isCustomTarget && target === 100 ? "active" : ""}
                onClick={() => chooseTarget(100)}
              >
                100
              </button>
              <button
                className={isCustomTarget || showCustomTarget ? "active" : ""}
                onClick={() => {
                  setTargetDraft(String(target));
                  setShowCustomTarget(true);
                }}
              >
                مخصص
              </button>
            </div>
            {(isCustomTarget || showCustomTarget) && (
              <div className="tasbih-target-custom">
                <input
                  type="number"
                  min="1"
                  max={MAX_TARGET}
                  inputMode="numeric"
                  value={targetDraft}
                  onChange={event => setTargetDraft(event.target.value)}
                  aria-label="قيمة الهدف الشخصي"
                />
                <button className="outline-button" onClick={saveCustomTarget}>
                  تعيين
                </button>
              </div>
            )}
            <p className="tasbih-disclaimer">
              الأهداف هنا شخصية لتنظيم العدّ، وليست تحديدًا لعدد شرعي أو لفضل
              مخصوص.
            </p>
          </div>

          <label
            className={`tasbih-vibration ${vibrationSupported ? "" : "unsupported"}`}
          >
            <input
              type="checkbox"
              checked={data.vibration}
              disabled={!vibrationSupported}
              onChange={event =>
                commit(current => ({
                  ...current,
                  vibration: event.target.checked,
                }))
              }
            />
            <Vibrate size={17} />
            <span>اهتزاز خفيف عند الزيادة</span>
            {!vibrationSupported && <small>غير مدعوم في هذا المتصفح</small>}
          </label>
        </aside>
      </section>
    </main>
  );
}
