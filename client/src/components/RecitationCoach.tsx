import { useEffect, useRef, useState } from "react";
import { Check, Mic, MicOff, RotateCcw, Sparkles } from "lucide-react";
import {
  compareRecitation,
  type RecitationComparison,
} from "@/lib/recitationReview";

type SpeechResult = { 0: { transcript: string }; length: number };
type SpeechResultEvent = { results: ArrayLike<SpeechResult> };
type SpeechErrorEvent = { error: string };
type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const speechErrors: Record<string, string> = {
  "not-allowed": "اسمح للمتصفح باستخدام الميكروفون ثم حاول مرة أخرى.",
  "service-not-allowed": "خدمة التعرف الصوتي غير متاحة في هذا المتصفح.",
  "no-speech": "لم نلتقط صوتًا؛ جرّب الاقتراب من الميكروفون.",
  network: "تعذر الاتصال بخدمة التعرف الصوتي. تحقق من الإنترنت.",
  "language-not-supported": "التعرف على العربية غير مدعوم في هذا المتصفح.",
  aborted: "تم إيقاف التسجيل.",
};

export default function RecitationCoach({
  referenceText,
  verseNumber,
}: {
  referenceText: string;
  verseNumber: number;
}) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [comparison, setComparison] = useState<RecitationComparison | null>(null);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onend = null;
        recognition.abort();
      }
    },
    []
  );

  function startRecording() {
    const browserWindow = window as SpeechWindow;
    const Recognition =
      browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("التعرف الصوتي غير متاح هنا. استخدم Chrome أو متصفحًا يدعمه.");
      return;
    }

    setTranscript("");
    setComparison(null);
    setError("");
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "ar-SA";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = event => {
      const text = Array.from(event.results)
        .map(result => result[0]?.transcript ?? "")
        .filter(Boolean)
        .join(" ");
      setTranscript(text.trim());
    };
    recognition.onerror = event => {
      setError(speechErrors[event.error] ?? "حدث خطأ أثناء التعرف على الصوت.");
      setIsRecording(false);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) setIsRecording(false);
    };

    try {
      recognition.start();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
      setError("تعذر بدء الميكروفون. تحقق من إذن المتصفح ثم أعد المحاولة.");
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }

  function analyzeRecitation() {
    if (!referenceText.trim() || !transcript.trim()) return;
    setComparison(compareRecitation(referenceText, transcript));
  }

  function retry() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setTranscript("");
    setComparison(null);
    setError("");
    setIsRecording(false);
  }

  return (
    <section className="recitation-coach" aria-label="التسميع والتصحيح اللفظي">
      <div className="recitation-coach-heading">
        <span className="quick-icon sage"><Sparkles size={17} /></span>
        <div>
          <strong>مساعد التسميع</strong>
          <small>الآية {verseNumber.toLocaleString("ar")}</small>
        </div>
        <span className={`recitation-status ${isRecording ? "is-recording" : ""}`}>
          <i /> {isRecording ? "يسمع الآن" : "جاهز"}
        </span>
      </div>

      <p className="recitation-coach-note">
        اقرأ الآية بصوت واضح، ثم اعرض الكلمات المطابقة والمواضع التي تحتاج مراجعة.
      </p>

      <div className="recitation-controls">
        <button
          type="button"
          className={`recitation-record-button ${isRecording ? "recording" : ""}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!referenceText.trim()}
        >
          {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
          {isRecording ? "إيقاف التسجيل" : "ابدأ التسميع"}
        </button>
        <button
          type="button"
          className="outline-button recitation-analyze-button"
          onClick={analyzeRecitation}
          disabled={!transcript.trim() || isRecording}
        >
          حلّل التسميع <Check size={15} />
        </button>
        {transcript && !isRecording && (
          <button
            type="button"
            className="icon-button subtle recitation-retry-button"
            onClick={retry}
            aria-label="مسح المحاولة وإعادة التسميع"
            title="إعادة المحاولة"
          >
            <RotateCcw size={15} />
          </button>
        )}
      </div>

      {error && <p className="recitation-error" role="status">{error}</p>}

      {transcript && (
        <div className="recitation-transcript" aria-live="polite">
          <span>النص الذي التقطه المتصفح</span>
          <p dir="rtl">{transcript}</p>
        </div>
      )}

      {comparison && (
        <div className="recitation-result" aria-live="polite">
          <div className="recitation-score-row">
            <div>
              <strong>{comparison.score.toLocaleString("ar")}٪</strong>
              <span>تطابق الكلمات</span>
            </div>
            <p>
              {comparison.score >= 95
                ? "رائع، الكلمات الملتقطة مطابقة بدرجة عالية."
                : comparison.score >= 70
                  ? "أحسنت؛ راجع الكلمات المظللة ثم أعد المحاولة."
                  : "راجع النص المسموع؛ قد يؤثر الضجيج أو التعرف الصوتي على النتيجة."}
            </p>
          </div>
          <div className="recitation-word-list" dir="rtl">
            {comparison.words.map((word, index) => (
              <span
                key={`${index}-${word.expected}-${word.heard ?? ""}`}
                className={`recitation-word ${word.status}`}
                title={
                  word.status === "different"
                    ? `المتوقع: ${word.expected} — الملتقط: ${word.heard}`
                    : word.status === "missing"
                      ? "لم يلتقط المتصفح هذه الكلمة"
                      : word.status === "extra"
                        ? `كلمة زائدة التقطها المتصفح: ${word.heard}`
                        : "مطابقة لفظية"
                }
              >
                {word.status === "extra" ? (
                  <><small>زائد</small>{word.heard}</>
                ) : (
                  <>
                    {word.expected}
                    {word.status === "different" && <small>سمعت: {word.heard}</small>}
                    {word.status === "missing" && <small>غير ملتقطة</small>}
                  </>
                )}
              </span>
            ))}
          </div>
          <div className="recitation-legend" aria-label="مفتاح ألوان المقارنة">
            <span className="correct">مطابقة</span>
            <span className="different">اختلاف</span>
            <span className="missing">ناقصة</span>
            <span className="extra">زائدة</span>
          </div>
        </div>
      )}

      <p className="recitation-privacy">
        يستخدم الموقع خدمة التعرّف الصوتي المتاحة في متصفحك ولا يحفظ التسجيل. النتيجة مقارنة نصية تقريبية، ولا تقيّم التجويد أو مخارج الحروف؛ راجع تلاوتك مع معلّم متقن.
      </p>
    </section>
  );
}
