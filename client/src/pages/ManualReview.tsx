import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Mic,
  RotateCcw,
  Square,
} from "lucide-react";
import { Link } from "wouter";
import { surahs } from "@/data/surahs";
import { useQuran } from "@/hooks/useQuran";
import "./ManualReview.css";

type ManualGrade = "mastered" | "hint" | "repeat";
type SavedReview = { grade: ManualGrade; reviewedAt: string };
type SavedReviews = Record<string, SavedReview>;

const STORAGE_KEY = "madini-manual-review-v1";
const VALID_GRADES = new Set<ManualGrade>(["mastered", "hint", "repeat"]);

function reviewKey(surahNumber: number, ayahNumber: number) {
  return `${surahNumber}:${ayahNumber}`;
}

function readSavedReviews(): SavedReviews {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, SavedReview] => {
        const value = entry[1] as Partial<SavedReview> | null;
        return Boolean(
          value &&
            typeof value === "object" &&
            VALID_GRADES.has(value.grade as ManualGrade) &&
            typeof value.reviewedAt === "string"
        );
      })
    );
  } catch {
    return {};
  }
}

const gradeLabels: Record<ManualGrade, string> = {
  mastered: "أتقنتها",
  hint: "احتجت تلميحًا",
  repeat: "أحتاج إعادتها",
};

export default function ManualReviewPage() {
  const { quran, loading, error, retry } = useQuran();
  const [surahNumber, setSurahNumber] = useState(1);
  const [fromInput, setFromInput] = useState("1");
  const [toInput, setToInput] = useState("7");
  const [sessionRange, setSessionRange] = useState<[number, number] | null>(null);
  const [activeVerse, setActiveVerse] = useState(1);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [rangeError, setRangeError] = useState("");
  const [savedReviews, setSavedReviews] = useState<SavedReviews>(readSavedReviews);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const selectedSurah = surahs.find(item => item.number === surahNumber) ?? surahs[0];
  const selectedQuranSurah = quran.find(item => item.number === surahNumber);
  const fromVerse = Number(fromInput);
  const toVerse = Number(toInput);
  const sessionStart = sessionRange?.[0] ?? fromVerse;
  const sessionEnd = sessionRange?.[1] ?? toVerse;
  const currentKey = reviewKey(surahNumber, activeVerse);
  const currentSavedReview = savedReviews[currentKey];
  const currentAyahText = selectedQuranSurah?.ayahs.find(
    ayah => ayah.numberInSurah === activeVerse
  )?.text;

  const rangeStats = useMemo(() => {
    if (!Number.isInteger(sessionStart) || !Number.isInteger(sessionEnd) || sessionEnd < sessionStart) {
      return { reviewed: 0, mastered: 0, hint: 0, repeat: 0, total: 0 };
    }
    let mastered = 0;
    let hint = 0;
    let repeat = 0;
    for (let verse = sessionStart; verse <= sessionEnd; verse += 1) {
      const grade = savedReviews[reviewKey(surahNumber, verse)]?.grade;
      if (grade === "mastered") mastered += 1;
      if (grade === "hint") hint += 1;
      if (grade === "repeat") repeat += 1;
    }
    return {
      reviewed: mastered + hint + repeat,
      mastered,
      hint,
      repeat,
      total: sessionEnd - sessionStart + 1,
    };
  }, [savedReviews, surahNumber, sessionStart, sessionEnd]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedReviews));
    } catch {
      // The session still works if browser storage is unavailable or full.
    }
  }, [savedReviews]);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!recordingUrl) return;
    return () => URL.revokeObjectURL(recordingUrl);
  }, [recordingUrl]);

  function clearRecording() {
    setRecordingUrl(null);
    setRecordingError("");
  }

  function handleSurahChange(nextSurahNumber: number) {
    const nextSurah = surahs.find(item => item.number === nextSurahNumber) ?? surahs[0];
    setSurahNumber(nextSurah.number);
    setFromInput("1");
    setToInput(String(Math.min(7, nextSurah.ayahs)));
    setSessionStarted(false);
    setSummaryVisible(false);
    setRangeError("");
    setRevealed(false);
    clearRecording();
  }

  function startSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (!Number.isInteger(fromVerse) || !Number.isInteger(toVerse)) {
      setRangeError("اكتب رقمَي آيتين صحيحين.");
      return;
    }
    if (fromVerse < 1 || toVerse < fromVerse || toVerse > selectedSurah.ayahs) {
      setRangeError(`اختر نطاقًا من 1 إلى ${selectedSurah.ayahs}، واجعل آية النهاية بعد البداية أو مساوية لها.`);
      return;
    }
    setRangeError("");
    setSessionRange([fromVerse, toVerse]);
    setActiveVerse(fromVerse);
    setSessionStarted(true);
    setSummaryVisible(false);
    setRevealed(false);
    clearRecording();
  }

  function goToVerse(nextVerse: number) {
    if (!sessionRange || nextVerse < sessionRange[0] || nextVerse > sessionRange[1]) return;
    setActiveVerse(nextVerse);
    setRevealed(false);
    clearRecording();
  }

  function gradeCurrentVerse(grade: ManualGrade) {
    if (isRecording || !sessionRange) return;
    setSavedReviews(current => ({
      ...current,
      [currentKey]: { grade, reviewedAt: new Date().toISOString() },
    }));
    clearRecording();
    if (activeVerse < sessionRange[1]) {
      setActiveVerse(activeVerse + 1);
      setRevealed(false);
      return;
    }
    setSessionStarted(false);
    setSummaryVisible(true);
  }

  async function startRecording() {
    setRecordingError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingError("التسجيل غير مدعوم في هذا المتصفح. يمكنك المتابعة بالمراجعة اليدوية من دون تسجيل.");
      return;
    }
    try {
      clearRecording();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size > 0) setRecordingUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
        if (streamRef.current === stream) streamRef.current = null;
        setIsRecording(false);
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsRecording(false);
      setRecordingError("لم نتمكن من تشغيل الميكروفون. راجع إذن المتصفح، أو أكمل المراجعة من دون تسجيل.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setIsRecording(false);
  }

  const progressPercent = rangeStats.total
    ? Math.round((rangeStats.reviewed / rangeStats.total) * 100)
    : 0;

  return (
    <main className="manual-review-page" dir="rtl">
      <div className="manual-review-wrap">
        <header className="manual-review-topbar">
          <Link href="/review" className="manual-review-back">
            <ArrowLeft size={16} /> العودة إلى خطة المراجعة
          </Link>
          <span className="manual-review-local-badge">
            <BookOpen size={15} /> مراجعة يدوية بلا AI
          </span>
          <Link href="/manual-review-test" className="manual-review-tests-link">
            اختبر حفظك <ChevronLeft size={15} />
          </Link>
        </header>

        <section className="manual-review-hero">
          <span className="manual-review-eyebrow">تسميعك على مهلك</span>
          <h1>راجع من حفظك، وقيّم نفسك</h1>
          <p>
            أخفِ الآيات، سمّع بصوتك، ثم اكشف النص وقيّم المحاولة. تقدمك يُحفظ على هذا الجهاز فقط.
          </p>
        </section>

        <form className="manual-review-picker" onSubmit={startSession}>
          <label>
            السورة
            <select
              value={surahNumber}
              onChange={event => handleSurahChange(Number(event.target.value))}
            >
              {surahs.map(item => (
                <option key={item.number} value={item.number}>
                  {item.number}. سورة {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            من الآية
            <input
              type="number"
              min="1"
              max={selectedSurah.ayahs}
              inputMode="numeric"
              value={fromInput}
              onChange={event => setFromInput(event.target.value)}
            />
          </label>
          <label>
            إلى الآية
            <input
              type="number"
              min="1"
              max={selectedSurah.ayahs}
              inputMode="numeric"
              value={toInput}
              onChange={event => setToInput(event.target.value)}
            />
          </label>
          <button className="manual-review-primary" type="submit" disabled={loading}>
            {loading ? "جارٍ تحميل المصحف..." : "ابدأ المراجعة"}
            <ChevronLeft size={17} />
          </button>
          {rangeError && <p className="manual-review-error" role="alert">{rangeError}</p>}
        </form>

        {error && (
          <div className="manual-review-error-card" role="alert">
            <span>{error}</span>
            <button type="button" onClick={retry}>إعادة المحاولة</button>
          </div>
        )}

        {sessionStarted && sessionRange && (
          <section className="manual-review-session" aria-labelledby="manual-session-title">
            <div className="manual-review-progress-row">
              <span>
                التقدم في هذا المقطع: {rangeStats.reviewed} من {rangeStats.total}
              </span>
              <strong>{progressPercent}٪</strong>
            </div>
            <div
              className="manual-review-progress-track"
              role="progressbar"
              aria-label="تقدم المراجعة"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${progressPercent}%` }} />
            </div>

            <div className="manual-review-session-heading">
              <div>
                <span className="manual-review-eyebrow">سورة {selectedSurah.name}</span>
                <h2 id="manual-session-title">الآية {activeVerse}</h2>
              </div>
              <span className="manual-review-step">
                {activeVerse - sessionRange[0] + 1} / {sessionRange[1] - sessionRange[0] + 1}
              </span>
            </div>

            <div className={`manual-review-ayah ${revealed ? "is-revealed" : "is-hidden"}`}>
              {revealed ? (
                <p>{currentAyahText || "تعذر العثور على نص الآية."}</p>
              ) : (
                <div className="manual-review-hidden-prompt">
                  <EyeOff size={23} />
                  <strong>الآية مخفية</strong>
                  <span>جرّب التسميع من حفظك قبل كشف النص</span>
                </div>
              )}
            </div>

            <div className="manual-review-reveal-row">
              <button
                type="button"
                className="manual-review-secondary"
                onClick={() => setRevealed(value => !value)}
              >
                {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                {revealed ? "أخفِ الآية" : "اكشف الآية"}
              </button>
              {currentSavedReview && (
                <span className={`manual-review-last-grade grade-${currentSavedReview.grade}`}>
                  آخر تقييم: {gradeLabels[currentSavedReview.grade]}
                </span>
              )}
            </div>

            <section className="manual-review-recorder" aria-label="تسجيل صوتي اختياري">
              <div className="manual-review-recorder-copy">
                <strong>اسمع تلاوتك بنفسك (اختياري)</strong>
                <span>التسجيل يبقى داخل المتصفح ولا يُرسل أو يُحفظ على الخادم.</span>
              </div>
              <button
                type="button"
                className={`manual-review-record-button ${isRecording ? "is-recording" : ""}`}
                onClick={isRecording ? stopRecording : startRecording}
                aria-label={isRecording ? "إيقاف التسجيل" : "بدء التسجيل"}
              >
                {isRecording ? <Square size={15} fill="currentColor" /> : <Mic size={16} />}
                {isRecording ? "إيقاف" : "سجّل صوتك"}
              </button>
              {recordingError && <p className="manual-review-error">{recordingError}</p>}
              {recordingUrl && !isRecording && (
                <audio className="manual-review-audio" controls src={recordingUrl}>
                  لا يدعم متصفحك تشغيل التسجيل.
                </audio>
              )}
            </section>

            <div className="manual-review-grade-area">
              <h3>بعد المحاولة، قيّم نفسك بصراحة</h3>
              <div className="manual-review-grade-buttons">
                <button
                  type="button"
                  className="grade-button grade-mastered"
                  onClick={() => gradeCurrentVerse("mastered")}
                  disabled={isRecording}
                >
                  <CheckCircle2 size={18} /> أتقنتها
                </button>
                <button
                  type="button"
                  className="grade-button grade-hint"
                  onClick={() => gradeCurrentVerse("hint")}
                  disabled={isRecording}
                >
                  احتجت تلميحًا
                </button>
                <button
                  type="button"
                  className="grade-button grade-repeat"
                  onClick={() => gradeCurrentVerse("repeat")}
                  disabled={isRecording}
                >
                  أحتاج إعادتها
                </button>
              </div>
              {isRecording && <p className="manual-review-small-note">أوقف التسجيل أولًا ثم اختر تقييمك.</p>}
            </div>

            <div className="manual-review-navigation">
              <button
                type="button"
                className="manual-review-secondary"
                onClick={() => goToVerse(activeVerse - 1)}
                disabled={activeVerse <= sessionRange[0] || isRecording}
              >
                <ChevronRight size={16} /> الآية السابقة
              </button>
              <button
                type="button"
                className="manual-review-secondary"
                onClick={() => goToVerse(activeVerse + 1)}
                disabled={activeVerse >= sessionRange[1] || isRecording}
              >
                الآية التالية دون تقييم <ChevronLeft size={16} />
              </button>
            </div>
          </section>
        )}

        {summaryVisible && sessionRange && (
          <section className="manual-review-summary" aria-live="polite">
            <div className="manual-review-summary-icon"><CheckCircle2 size={25} /></div>
            <span className="manual-review-eyebrow">أتممت هذا المقطع</span>
            <h2>بارك الله فيك على مراجعتك</h2>
            <p>سورة {selectedSurah.name}، الآيات {sessionRange[0]}–{sessionRange[1]}</p>
            <div className="manual-review-summary-stats">
              <span><strong>{rangeStats.mastered}</strong> أتقنتها</span>
              <span><strong>{rangeStats.hint}</strong> احتجت تلميحًا</span>
              <span><strong>{rangeStats.repeat}</strong> أعدها لاحقًا</span>
            </div>
            <div className="manual-review-summary-actions">
              <button
                type="button"
                className="manual-review-primary"
                onClick={() => {
                  setActiveVerse(sessionRange[0]);
                  setSessionStarted(true);
                  setSummaryVisible(false);
                  setRevealed(false);
                }}
              >
                <RotateCcw size={16} /> أراجع المقطع مرة أخرى
              </button>
              <button type="button" className="manual-review-secondary" onClick={() => setSummaryVisible(false)}>
                اختيار مقطع آخر
              </button>
            </div>
          </section>
        )}

        <footer className="manual-review-footer">
          <span>تقييمك ذاتي للتنظيم والمتابعة، وليس تصحيحًا آليًا للتلاوة.</span>
          <Link href="/review">العودة للخطة <ArrowLeft size={14} /></Link>
        </footer>
      </div>
    </main>
  );
}
