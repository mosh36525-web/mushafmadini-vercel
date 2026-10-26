import { useMemo, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  Eye,
  EyeOff,
  ListChecks,
  RotateCcw,
  Shuffle,
  Type,
} from "lucide-react";
import { surahs } from "@/data/surahs";
import { useQuran } from "@/hooks/useQuran";
import {
  buildNextVerseQuizQuestions,
  buildFillQuizQuestions,
  isQuizAnswerCorrect,
  type FillQuizQuestion,
  type NextVerseQuizQuestion,
} from "@/lib/manualReviewQuiz";
import "./ManualReviewTests.css";

type QuizMode = "recitation" | "fill" | "next";
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

export default function ManualReviewTestsPage({ embedded = false }: { embedded?: boolean }) {
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
  const [nextQuestions, setNextQuestions] = useState<NextVerseQuizQuestion[]>([]);
  const [nextIndex, setNextIndex] = useState(0);
  const [nextSelected, setNextSelected] = useState<number | null>(null);
  const [nextChecked, setNextChecked] = useState<boolean | null>(null);
  const [nextError, setNextError] = useState("");
  const [nextCorrectCount, setNextCorrectCount] = useState(0);

  const selectedSurah = surahs.find(item => item.number === surahNumber) ?? surahs[0];
  const selectedQuranSurah = quran.find(item => item.number === surahNumber);
  const fromVerse = Number(fromInput);
  const toVerse = Number(toInput);
  const currentRecitationVerse = recitationOrder[recitationIndex];
  const currentFillQuestion = fillQuestions[fillIndex];
  const currentNextQuestion = nextQuestions[nextIndex];
  const currentVerseText = selectedQuranSurah?.ayahs.find(
    ayah => ayah.numberInSurah === currentRecitationVerse
  )?.text;
  const currentNextVerseText = selectedQuranSurah?.ayahs.find(
    ayah => ayah.numberInSurah === currentNextQuestion?.promptVerse
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
    setNextQuestions([]);
    setNextIndex(0);
    setNextSelected(null);
    setNextChecked(null);
    setNextError("");
    setNextCorrectCount(0);
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

    if (mode === "next") {
      const questions = buildNextVerseQuizQuestions(fromVerse, toVerse);
      if (!questions.length) {
        setRangeError("اختبار اختيار الآية التالية يحتاج إلى ثلاث آيات متتابعة على الأقل.");
        return;
      }
      setNextQuestions(questions);
      setNextIndex(0);
      setNextSelected(null);
      setNextChecked(null);
      setNextError("");
      setNextCorrectCount(0);
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

  function checkNextAnswer() {
    if (!currentNextQuestion) return;
    if (nextSelected === null) {
      setNextError("اختر الآية التي تعتقد أنها التالية.");
      return;
    }
    const correct = nextSelected === currentNextQuestion.correctVerse;
    setNextChecked(correct);
    setNextError("");
    setNextCorrectCount(count => count + (correct ? 1 : 0));
    saveSelfGrade(
      surahNumber,
      currentNextQuestion.correctVerse,
      correct ? "mastered" : "repeat"
    );
  }

  function advanceNextQuestion() {
    if (nextIndex + 1 < nextQuestions.length) {
      setNextIndex(nextIndex + 1);
      setNextSelected(null);
      setNextChecked(null);
      setNextError("");
      return;
    }
    setQuizActive(false);
    setQuizComplete(true);
  }

  function previewVerse(verseNumber: number) {
    const text = selectedQuranSurah?.ayahs.find(ayah => ayah.numberInSurah === verseNumber)?.text;
    if (!text) return "تعذر تحميل نص الآية";
    const words = text.trim().split(/\s+/);
    return `${words.slice(0, 6).join(" ")}${words.length > 6 ? " …" : ""}`;
  }

  const fillPercent = fillQuestions.length
    ? Math.round((fillCorrectCount / fillQuestions.length) * 100)
    : 0;

  return (
    <section
      className={`manual-review-tests-page ${embedded ? "is-embedded" : ""}`}
      dir="rtl"
      aria-label="اختبارات الحفظ"
    >
      <div className="manual-review-tests-wrap">
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
              <button
                type="button"
                className={mode === "next" ? "is-active" : ""}
                aria-pressed={mode === "next"}
                onClick={() => changeMode("next")}
              >
                <ListChecks size={18} />
                <span><strong>اختر الآية التالية</strong><small>تدرّب على تسلسل الآيات</small></span>
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
                {loading
                  ? "جارٍ تحميل المصحف..."
                  : mode === "recitation"
                    ? "ابدأ الاختبار العشوائي"
                    : mode === "fill"
                      ? "ابدأ اختبار إكمال الآية"
                      : "ابدأ اختبار الآية التالية"}
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

        {quizActive && mode === "next" && currentNextQuestion && (
          <section className="manual-review-test-card">
            <div className="manual-review-test-progress">
              <span>السؤال {nextIndex + 1} من {nextQuestions.length}</span>
              <span>سورة {selectedSurah.name} · ترتيب الآيات</span>
            </div>
            <div className="manual-review-test-progress-track">
              <span style={{ width: `${Math.round(((nextIndex + 1) / nextQuestions.length) * 100)}%` }} />
            </div>
            <div className="manual-review-test-question-head">
              <span className="manual-review-tests-eyebrow">ما الآية التي تأتي بعدها؟</span>
              <h2>بعد الآية {currentNextQuestion.promptVerse}</h2>
            </div>
            <div className="manual-review-next-prompt">
              <p>{currentNextVerseText || "تعذر تحميل نص الآية."}</p>
            </div>
            <div className="manual-review-next-choices" role="group" aria-label="اختر الآية التالية">
              {currentNextQuestion.choices.map(verseNumber => {
                const isCorrectOption = verseNumber === currentNextQuestion.correctVerse;
                const isSelected = verseNumber === nextSelected;
                const resultClass = nextChecked !== null
                  ? isCorrectOption ? "is-correct" : isSelected ? "is-wrong" : ""
                  : isSelected ? "is-selected" : "";
                return (
                  <button
                    type="button"
                    key={verseNumber}
                    className={`manual-review-next-choice ${resultClass}`}
                    aria-pressed={isSelected}
                    disabled={nextChecked !== null}
                    onClick={() => setNextSelected(verseNumber)}
                  >
                    <strong>الآية {verseNumber}</strong>
                    <span>{previewVerse(verseNumber)}</span>
                  </button>
                );
              })}
            </div>
            {nextError && <p className="manual-review-test-error" role="alert">{nextError}</p>}
            {nextChecked !== null && (
              <div className={`manual-review-next-feedback ${nextChecked ? "is-correct" : "is-wrong"}`} role="status">
                {nextChecked
                  ? "إجابة صحيحة، أحسنت."
                  : `الإجابة الصحيحة هي الآية ${currentNextQuestion.correctVerse}.`}
              </div>
            )}
            <button
              type="button"
              className="manual-review-test-primary manual-review-next-submit"
              onClick={nextChecked === null ? checkNextAnswer : advanceNextQuestion}
            >
              {nextChecked === null
                ? "تحقق من الإجابة"
                : nextIndex + 1 < nextQuestions.length
                  ? "السؤال التالي"
                  : "عرض النتيجة"}
              <ChevronLeft size={17} />
            </button>
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

        {quizComplete && range && mode === "next" && (
          <section className="manual-review-test-results" aria-live="polite">
            <div className="manual-review-test-result-icon"><CheckCircle2 size={25} /></div>
            <span className="manual-review-tests-eyebrow">انتهى اختبار ترتيب الآيات</span>
            <h2>{nextCorrectCount} من {nextQuestions.length} إجابات صحيحة</h2>
            <p>
              نسبة الإجابة الصحيحة: {nextQuestions.length ? Math.round((nextCorrectCount / nextQuestions.length) * 100) : 0}٪
              · الآيات {range[0]}–{range[1]}
            </p>
            <div className="manual-review-test-result-stats">
              <span><strong>{nextCorrectCount}</strong> صحيح</span>
              <span><strong>{nextQuestions.length - nextCorrectCount}</strong> للمراجعة</span>
              <span><strong>{nextQuestions.length}</strong> سؤالًا</span>
            </div>
            <button className="manual-review-test-primary" type="button" onClick={resetRun}>
              <RotateCcw size={16} /> اختبار جديد
            </button>
          </section>
        )}

        {loading && <p className="manual-review-test-loading">جارٍ تحميل نص المصحف المحلي...</p>}
      </div>
    </section>
  );
}
