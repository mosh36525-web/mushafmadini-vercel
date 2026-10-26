import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  Eye,
  EyeOff,
  RotateCcw,
  Shuffle,
  Type,
} from "lucide-react";
import { Link } from "wouter";
import { surahs } from "@/data/surahs";
import { useQuran } from "@/hooks/useQuran";
import {
  buildFillQuizQuestions,
  isQuizAnswerCorrect,
  type FillQuizQuestion,
} from "@/lib/manualReviewQuiz";
import "./ManualReviewTests.css";

type QuizMode = "recitation" | "fill";
type ManualGrade = "mastered" | "hint" | "repeat";

const reviewStorageKey = "madini-manual-review-v1";

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function saveSelfGrade(surahNumber: number, verseNumber: number, grade: ManualGrade) {
  try {
    const raw = window.localStorage.getItem(reviewStorageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const current = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
    window.localStorage.setItem(
      reviewStorageKey,
      JSON.stringify({
        ...current,
        [`${surahNumber}:${verseNumber}`]: {
          grade,
          reviewedAt: new Date().toISOString(),
        },
      })
    );
  } catch {
    // The quiz remains usable when browser storage is unavailable.
  }
}

const gradeLabels: Record<ManualGrade, string> = {
  mastered: "أتقنتها",
  hint: "احتجت تلميحًا",
  repeat: "أعيدها لاحقًا",
};

export default function ManualReviewTestsPage() {
  const { quran, loading, error, retry } = useQuran();
  const [mode, setMode] = useState<QuizMode>("recitation");
  const [surahNumber, setSurahNumber] = useState(1);
  const [fromInput, setFromInput] = useState("1");
  const [toInput, setToInput] = useState("7");
  const [rangeError, setRangeError] = useState("");
  const [quizActive, setQuizActive] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [range, setRange] = useState<[number, number] | null>(null);

  const [recitationOrder, setRecitationOrder] = useState<number[]>([]);
  const [recitationIndex, setRecitationIndex] = useState(0);
  const [recitationGrades, setRecitationGrades] = useState<ManualGrade[]>([]);
  const [revealed, setRevealed] = useState(false);

  const [fillQuestions, setFillQuestions] = useState<FillQuizQuestion[]>([]);
  const [fillIndex, setFillIndex] = useState(0);
  const [fillAnswer, setFillAnswer] = useState("");
  const [fillChecked, setFillChecked] = useState<boolean | null>(null);
  const [fillError, setFillError] = useState("");
  const [fillCorrectCount, setFillCorrectCount] = useState(0);

  const selectedSurah = surahs.find(item => item.number === surahNumber) ?? surahs[0];
  const selectedQuranSurah = quran.find(item => item.number === surahNumber);
  const fromVerse = Number(fromInput);
  const toVerse = Number(toInput);
  const currentRecitationVerse = recitationOrder[recitationIndex];
  const currentFillQuestion = fillQuestions[fillIndex];
  const currentVerseText = selectedQuranSurah?.ayahs.find(
    ayah => ayah.numberInSurah === currentRecitationVerse
  )?.text;

  const recitationStats = useMemo(() => recitationGrades.reduce(
    (totals, grade) => ({ ...totals, [grade]: totals[grade] + 1 }),
    { mastered: 0, hint: 0, repeat: 0 }
  ), [recitationGrades]);

  function resetRun() {
    setQuizActive(false);
    setQuizComplete(false);
    setRangeError("");
    setRevealed(false);
    setRecitationOrder([]);
    setRecitationIndex(0);
    setRecitationGrades([]);
    setFillQuestions([]);
    setFillIndex(0);
    setFillAnswer("");
    setFillChecked(null);
    setFillError("");
    setFillCorrectCount(0);
  }

  function changeMode(nextMode: QuizMode) {
    if (quizActive) return;
    resetRun();
    setMode(nextMode);
  }

  function changeSurah(nextNumber: number) {
    const nextSurah = surahs.find(item => item.number === nextNumber) ?? surahs[0];
    setSurahNumber(nextSurah.number);
    setFromInput("1");
    setToInput(String(Math.min(7, nextSurah.ayahs)));
    setRangeError("");
    resetRun();
  }

  function startQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (!Number.isInteger(fromVerse) || !Number.isInteger(toVerse)) {
      setRangeError("اكتب رقمَي آيتين صحيحين.");
      return;
    }
    if (fromVerse < 1 || toVerse < fromVerse || toVerse > selectedSurah.ayahs) {
      setRangeError(`اختر نطاقًا صحيحًا من 1 إلى ${selectedSurah.ayahs}.`);
      return;
    }
    if (!selectedQuranSurah) {
      setRangeError("لم يتم تحميل نص السورة بعد. أعد المحاولة بعد اكتمال التحميل.");
      return;
    }

    setRange([fromVerse, toVerse]);
    setRangeError("");
    setQuizComplete(false);
    setRevealed(false);
    if (mode === "recitation") {
      const order = shuffle(
        Array.from({ length: toVerse - fromVerse + 1 }, (_, index) => fromVerse + index)
      );
      setRecitationOrder(order);
      setRecitationIndex(0);
      setRecitationGrades([]);
      setQuizActive(true);
      return;
    }

    const questions = shuffle(
      buildFillQuizQuestions(selectedQuranSurah.ayahs, fromVerse, toVerse)
    );
    if (!questions.length) {
      setRangeError("لم نعثر على آيات في النطاق المختار.");
      return;
    }
    setFillQuestions(questions);
    setFillIndex(0);
    setFillAnswer("");
    setFillChecked(null);
    setFillError("");
    setFillCorrectCount(0);
    setQuizActive(true);
  }

  function recordRecitationGrade(grade: ManualGrade) {
    if (currentRecitationVerse === undefined) return;
    saveSelfGrade(surahNumber, currentRecitationVerse, grade);
    const nextGrades = [...recitationGrades, grade];
    setRecitationGrades(nextGrades);
    setRevealed(false);
    if (recitationIndex + 1 < recitationOrder.length) {
      setRecitationIndex(recitationIndex + 1);
      return;
    }
    setQuizActive(false);
    setQuizComplete(true);
  }

  function checkFillAnswer() {
    if (!currentFillQuestion) return;
    if (!fillAnswer.trim()) {
      setFillError("اكتب إجابتك أولًا ثم اضغط تحقق.");
      return;
    }
    const correct = isQuizAnswerCorrect(fillAnswer, currentFillQuestion.missingText);
    setFillChecked(correct);
    setFillError("");
    setFillCorrectCount(count => count + (correct ? 1 : 0));
    saveSelfGrade(
      surahNumber,
      currentFillQuestion.verseNumber,
      correct ? "mastered" : "repeat"
    );
  }

  function advanceFillQuestion() {
    if (fillIndex + 1 < fillQuestions.length) {
      setFillIndex(fillIndex + 1);
      setFillAnswer("");
      setFillChecked(null);
      setFillError("");
      return;
    }
    setQuizActive(false);
    setQuizComplete(true);
  }

  const questionTotal = mode === "recitation" ? recitationOrder.length : fillQuestions.length;
  const questionIndex = mode === "recitation" ? recitationIndex : fillIndex;
  const fillPercent = fillQuestions.length
    ? Math.round((fillCorrectCount / fillQuestions.length) * 100)
    : 0;

  return (
    <main className="manual-review-tests-page" dir="rtl">
      <div className="manual-review-tests-wrap">
        <header className="manual-review-tests-topbar">
          <Link href="/manual-review" className="manual-review-tests-back">
            <ArrowLeft size={16} /> العودة للمراجعة اليدوية
          </Link>
          <span className="manual-review-tests-badge">اختبارات بلا AI</span>
        </header>

        <section className="manual-review-tests-hero">
          <span className="manual-review-tests-eyebrow">اختبر حفظك</span>
          <h1>اختبارات على مقطعك</h1>
          <p>اختر نوع الاختبار والسورة. التقييم وحساب الإجابات يجريان محليًا في المتصفح دون إرسال الصوت أو النص للخادم.</p>
        </section>

        {!quizActive && !quizComplete && (
          <>
            <div className="manual-review-test-modes" role="group" aria-label="اختيار نوع الاختبار">
              <button
                type="button"
                className={mode === "recitation" ? "is-active" : ""}
                aria-pressed={mode === "recitation"}
                onClick={() => changeMode("recitation")}
              >
                <Shuffle size={18} />
                <span><strong>تسميع عشوائي</strong><small>أخفِ الآية وسمّعها من حفظك</small></span>
              </button>
              <button
                type="button"
                className={mode === "fill" ? "is-active" : ""}
                aria-pressed={mode === "fill"}
                onClick={() => changeMode("fill")}
              >
                <Type size={18} />
                <span><strong>أكمل الآية</strong><small>اكتب الكلمات المحذوفة</small></span>
              </button>
            </div>

            <form className="manual-review-test-picker" onSubmit={startQuiz}>
              <label>
                السورة
                <select value={surahNumber} onChange={event => changeSurah(Number(event.target.value))}>
                  {surahs.map(item => (
                    <option key={item.number} value={item.number}>
                      {item.number}. سورة {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                من الآية
                <input type="number" min="1" max={selectedSurah.ayahs} value={fromInput} inputMode="numeric" onChange={event => setFromInput(event.target.value)} />
              </label>
              <label>
                إلى الآية
                <input type="number" min="1" max={selectedSurah.ayahs} value={toInput} inputMode="numeric" onChange={event => setToInput(event.target.value)} />
              </label>
              <button className="manual-review-test-primary" type="submit" disabled={loading}>
                {loading ? "جارٍ تحميل المصحف..." : mode === "recitation" ? "ابدأ الاختبار العشوائي" : "ابدأ اختبار إكمال الآية"}
                <ChevronLeft size={17} />
              </button>
              {rangeError && <p className="manual-review-test-error" role="alert">{rangeError}</p>}
            </form>
          </>
        )}

        {error && (
          <div className="manual-review-test-error-card" role="alert">
            <span>{error}</span>
            <button type="button" onClick={retry}>إعادة تحميل المصحف</button>
          </div>
        )}

        {quizActive && mode === "recitation" && currentRecitationVerse !== undefined && (
          <section className="manual-review-test-card">
            <div className="manual-review-test-progress">
              <span>السؤال {recitationIndex + 1} من {recitationOrder.length}</span>
              <span>ترتيب عشوائي · سورة {selectedSurah.name}</span>
            </div>
            <div className="manual-review-test-progress-track">
              <span style={{ width: `${Math.round(((recitationIndex + 1) / recitationOrder.length) * 100)}%` }} />
            </div>
            <div className="manual-review-test-question-head">
              <span className="manual-review-tests-eyebrow">تسميع من الحفظ</span>
              <h2>الآية {currentRecitationVerse}</h2>
            </div>
            <div className={`manual-review-test-verse ${revealed ? "is-open" : ""}`}>
              {revealed ? (
                <p>{currentVerseText || "تعذر تحميل نص الآية."}</p>
              ) : (
                <div><EyeOff size={23} /><strong>الآية مخفية</strong><span>سمّعها بصوتك ثم اكشف النص</span></div>
              )}
            </div>
            <button type="button" className="manual-review-test-secondary reveal-test-answer" onClick={() => setRevealed(value => !value)}>
              {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
              {revealed ? "إخفاء الآية" : "كشف الآية"}
            </button>
            <div className="manual-review-test-grade">
              <h3>كيف كانت محاولتك؟ قيّم نفسك</h3>
              <div>
                <button type="button" className="test-grade-mastered" onClick={() => recordRecitationGrade("mastered")}>أتقنتها</button>
                <button type="button" className="test-grade-hint" onClick={() => recordRecitationGrade("hint")}>احتجت تلميحًا</button>
                <button type="button" className="test-grade-repeat" onClick={() => recordRecitationGrade("repeat")}>أعيدها</button>
              </div>
            </div>
          </section>
        )}

        {quizActive && mode === "fill" && currentFillQuestion && (
          <section className="manual-review-test-card">
            <div className="manual-review-test-progress">
              <span>السؤال {fillIndex + 1} من {fillQuestions.length}</span>
              <span>أكمل الكلمات الناقصة · الآية {currentFillQuestion.verseNumber}</span>
            </div>
            <div className="manual-review-test-progress-track">
              <span style={{ width: `${Math.round(((fillIndex + 1) / fillQuestions.length) * 100)}%` }} />
            </div>
            <div className="manual-review-test-question-head">
              <span className="manual-review-tests-eyebrow">سورة {selectedSurah.name}</span>
              <h2>اكتب الكلمات الناقصة</h2>
            </div>
            <div className="manual-review-fill-verse">
              {currentFillQuestion.prefix && <span>{currentFillQuestion.prefix} </span>}
              <span className="manual-review-fill-blank" aria-label="مكان الكلمات المحذوفة">ــــــــــــــــــ</span>
              {currentFillQuestion.suffix && <span> {currentFillQuestion.suffix}</span>}
            </div>
            <form
              className="manual-review-fill-form"
              onSubmit={event => {
                event.preventDefault();
                if (fillChecked === null) checkFillAnswer();
                else advanceFillQuestion();
              }}
            >
              <label htmlFor="manual-fill-answer">إجابتك</label>
              <input
                id="manual-fill-answer"
                type="text"
                dir="rtl"
                autoComplete="off"
                value={fillAnswer}
                disabled={fillChecked !== null}
                placeholder="اكتب الكلمات المحذوفة هنا"
                onChange={event => setFillAnswer(event.target.value)}
              />
              {fillError && <p className="manual-review-test-error" role="alert">{fillError}</p>}
              {fillChecked !== null && (
                <div className={`manual-review-fill-feedback ${fillChecked ? "is-correct" : "is-wrong"}`} role="status">
                  <strong>{fillChecked ? "إجابة صحيحة" : "ليست مطابقة تمامًا"}</strong>
                  <span>الكلمات الصحيحة: {currentFillQuestion.missingText}</span>
                </div>
              )}
              <button className="manual-review-test-primary" type="submit">
                {fillChecked === null ? "تحقق من الإجابة" : fillIndex + 1 < fillQuestions.length ? "السؤال التالي" : "عرض النتيجة"}
                <ChevronLeft size={17} />
              </button>
            </form>
            <p className="manual-review-test-note">تُتجاهل الحركات والتشكيل وتُوحّد أشكال الألف عند المقارنة. لا يقيّم الاختبار التجويد أو الوقف والابتداء.</p>
          </section>
        )}

        {quizComplete && range && mode === "recitation" && (
          <section className="manual-review-test-results" aria-live="polite">
            <div className="manual-review-test-result-icon"><CheckCircle2 size={25} /></div>
            <span className="manual-review-tests-eyebrow">انتهى الاختبار</span>
            <h2>أحسنت، أكملت الأسئلة</h2>
            <p>سورة {selectedSurah.name} · الآيات {range[0]}–{range[1]} بترتيب عشوائي</p>
            <div className="manual-review-test-result-stats">
              <span><strong>{recitationStats.mastered}</strong> أتقنتها</span>
              <span><strong>{recitationStats.hint}</strong> احتجت تلميحًا</span>
              <span><strong>{recitationStats.repeat}</strong> أعدها</span>
            </div>
            <button className="manual-review-test-primary" type="button" onClick={resetRun}><RotateCcw size={16} /> اختبار جديد</button>
          </section>
        )}

        {quizComplete && range && mode === "fill" && (
          <section className="manual-review-test-results" aria-live="polite">
            <div className="manual-review-test-result-icon"><CheckCircle2 size={25} /></div>
            <span className="manual-review-tests-eyebrow">انتهى اختبار الكتابة</span>
            <h2>{fillCorrectCount} من {fillQuestions.length} إجابة صحيحة</h2>
            <p>نسبة الإجابات المطابقة بعد تطبيع التشكيل: {fillPercent}٪</p>
            <div className="manual-review-test-result-stats">
              <span><strong>{fillCorrectCount}</strong> صحيح</span>
              <span><strong>{fillQuestions.length - fillCorrectCount}</strong> يحتاج مراجعة</span>
              <span><strong>{range[0]}–{range[1]}</strong> نطاق الاختبار</span>
            </div>
            <button className="manual-review-test-primary" type="button" onClick={resetRun}><RotateCcw size={16} /> اختبار جديد</button>
          </section>
        )}

        {loading && <p className="manual-review-test-loading">جارٍ تحميل نص المصحف المحلي...</p>}
        <footer className="manual-review-tests-footer">
          <span>اختبار التسميع يعتمد على تقييمك الشخصي، واختبار الكتابة يقارن النص محليًا دون AI.</span>
          <Link href="/manual-review">العودة للمراجعة اليدوية <ArrowLeft size={14} /></Link>
        </footer>
      </div>
    </main>
  );
}
