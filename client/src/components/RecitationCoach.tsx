import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  LoaderCircle,
  Mic,
  MicOff,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  compareRecitation,
  compareRecitationPartial,
  type RecitationComparison,
} from "@/lib/recitationReview";

type WorkerResponse =
  | { type: "progress"; file?: string; progress?: number; status?: string }
  | { type: "ready" }
  | { type: "transcript"; requestId: number; text: string; isFinal: boolean }
  | {
      type: "error";
      stage: "load" | "transcribe";
      requestId?: number;
      isFinal?: boolean;
      message: string;
    };
type WorkerRequest =
  | { type: "load" }
  | {
      type: "transcribe";
      requestId: number;
      audioBuffer: ArrayBuffer;
      isFinal: boolean;
    };

const MAX_RECORDING_SECONDS = 180;
const LIVE_CHECK_INTERVAL_SECONDS = 8;
const FIRST_LIVE_CHECK_SECONDS = 8;
const TARGET_SAMPLE_RATE = 16_000;

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getFileLabel(path = "") {
  const filename = path.split("/").pop()?.replace(/\.onnx$/, "") ?? "ملفات النموذج";
  return filename.length > 27 ? `${filename.slice(0, 24)}…` : filename;
}

async function convertToMono16k(blob: Blob): Promise<Float32Array> {
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
    const outputFrames = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
    const offlineContext = new OfflineAudioContext(1, outputFrames, TARGET_SAMPLE_RATE);
    const source = offlineContext.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineContext.destination);
    source.start(0);
    const resampled = await offlineContext.startRendering();
    return resampled.getChannelData(0).slice();
  } finally {
    await audioContext.close();
  }
}

export default function RecitationCoach({
  referenceText,
  verseNumber,
}: {
  referenceText: string;
  verseNumber: number;
}) {
  const workerRef = useRef<Worker | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef(0);
  const requestIdRef = useRef(0);
  const referenceTextRef = useRef(referenceText);
  const isRecordingRef = useRef(false);
  const liveRequestPendingRef = useRef(false);
  const lastLiveCheckAtRef = useRef(0);

  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [modelFile, setModelFile] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [comparison, setComparison] = useState<RecitationComparison | null>(null);
  const [comparisonIsFinal, setComparisonIsFinal] = useState(false);
  const [error, setError] = useState("");

  function stopTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }

  function discardRecording() {
    stopTimer();
    isRecordingRef.current = false;
    liveRequestPendingRef.current = false;
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      if (recorder.state !== "inactive") recorder.stop();
      recorderRef.current = null;
    }
    stopTracks();
    chunksRef.current = [];
    setIsRecording(false);
  }

  function getWorker() {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(
      new URL("../workers/recitation.worker.ts", import.meta.url),
      { type: "module" }
    );
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        setModelLoading(true);
        setModelFile(getFileLabel(message.file));
        setModelProgress(
          typeof message.progress === "number"
            ? Math.max(0, Math.min(100, Math.round(message.progress)))
            : null
        );
      } else if (message.type === "ready") {
        setModelReady(true);
        setModelLoading(false);
        setModelProgress(100);
        setError("");
      } else if (message.type === "transcript") {
        if (message.requestId !== requestIdRef.current) return;
        liveRequestPendingRef.current = false;
        setIsTranscribing(false);
        const text = message.text.trim();
        if (!text) {
          if (message.isFinal) {
            setError("لم يتعرف النموذج على كلمات واضحة. جرّب القراءة بصوت أوضح.");
          }
          return;
        }
        setTranscript(text);
        setComparison(
          message.isFinal
            ? compareRecitation(referenceTextRef.current, text)
            : compareRecitationPartial(referenceTextRef.current, text)
        );
        setComparisonIsFinal(message.isFinal);
        setError("");
      } else if (message.type === "error") {
        if (
          message.stage === "transcribe" &&
          message.requestId !== requestIdRef.current
        ) {
          return;
        }
        if (message.stage === "transcribe") liveRequestPendingRef.current = false;
        setModelLoading(false);
        setIsTranscribing(false);
        setError(message.message);
      }
    };
    worker.onerror = () => {
      liveRequestPendingRef.current = false;
      setModelLoading(false);
      setIsTranscribing(false);
      setError("توقف محرك التسميع المحلي. حدّث الصفحة وحاول مرة أخرى.");
    };
    workerRef.current = worker;
    return worker;
  }

  useEffect(() => {
    referenceTextRef.current = referenceText;
    requestIdRef.current += 1;
    discardRecording();
    setIsTranscribing(false);
    setRecordingSeconds(0);
    setTranscript("");
    setComparison(null);
    setComparisonIsFinal(false);
    setError("");
  }, [referenceText, verseNumber]);

  useEffect(
    () => () => {
      stopTimer();
      isRecordingRef.current = false;
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      stopTracks();
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    []
  );

  function prepareModel() {
    if (modelReady || modelLoading) return;
    setError("");
    setModelLoading(true);
    setModelProgress(null);
    try {
      getWorker().postMessage({ type: "load" } satisfies WorkerRequest);
    } catch {
      setModelLoading(false);
      setError("تعذر تشغيل محرك التسميع المحلي في هذا المتصفح.");
    }
  }

  async function transcribeRecording(blob: Blob, isFinal: boolean) {
    if (!blob.size) {
      liveRequestPendingRef.current = false;
      if (isFinal) setError("لم يتم التقاط تسجيل. تحقق من الميكروفون وحاول مرة أخرى.");
      return;
    }
    setIsTranscribing(true);
    try {
      const audio = await convertToMono16k(blob);
      let energy = 0;
      for (let index = 0; index < audio.length; index += 1) {
        energy += audio[index] * audio[index];
      }
      const rms = audio.length ? Math.sqrt(energy / audio.length) : 0;
      if (rms < 0.003) {
        liveRequestPendingRef.current = false;
        setIsTranscribing(false);
        if (isFinal) setError("الصوت منخفض جدًا. قرّب الميكروفون وأعد المحاولة.");
        return;
      }
      const transferable = audio.buffer.slice(
        audio.byteOffset,
        audio.byteOffset + audio.byteLength
      ) as ArrayBuffer;
      const requestId = ++requestIdRef.current;
      getWorker().postMessage(
        { type: "transcribe", requestId, audioBuffer: transferable, isFinal } satisfies WorkerRequest,
        [transferable]
      );
    } catch {
      liveRequestPendingRef.current = false;
      setIsTranscribing(false);
      if (isFinal) setError("تعذر قراءة التسجيل على جهازك. أعد المحاولة بمتصفح حديث.");
    }
  }

  function queueLiveCheck(mimeType: string) {
    if (!isRecordingRef.current || liveRequestPendingRef.current) return;
    const elapsedSeconds = Math.floor(
      (Date.now() - recordingStartedAtRef.current) / 1000
    );
    const enoughTimeForFirstCheck = elapsedSeconds >= FIRST_LIVE_CHECK_SECONDS;
    const enoughTimeSinceLastCheck =
      elapsedSeconds - lastLiveCheckAtRef.current >= LIVE_CHECK_INTERVAL_SECONDS;
    if (!enoughTimeForFirstCheck || !enoughTimeSinceLastCheck) return;

    liveRequestPendingRef.current = true;
    lastLiveCheckAtRef.current = elapsedSeconds;
    const snapshot = new Blob(chunksRef.current, {
      type: mimeType || "audio/webm",
    });
    void transcribeRecording(snapshot, false);
  }

  async function startRecording() {
    if (!modelReady || isRecording || isTranscribing) return;
    setError("");
    setTranscript("");
    setComparison(null);
    setComparisonIsFinal(false);
    setRecordingSeconds(0);
    chunksRef.current = [];
    liveRequestPendingRef.current = false;
    lastLiveCheckAtRef.current = 0;

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("يحتاج الميكروفون إلى اتصال آمن HTTPS ومتصفح حديث.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("تسجيل الصوت غير مدعوم في هذا المتصفح.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4"].find(type =>
        MediaRecorder.isTypeSupported(type)
      );
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      recorderRef.current = recorder;
      recorder.ondataavailable = event => {
        if (event.data.size) chunksRef.current.push(event.data);
        queueLiveCheck(recorder.mimeType || "audio/webm");
      };
      recorder.onstop = () => {
        stopTimer();
        isRecordingRef.current = false;
        stopTracks();
        recorderRef.current = null;
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        void transcribeRecording(blob, true);
      };
      recorder.start(1000);
      recordingStartedAtRef.current = Date.now();
      isRecordingRef.current = true;
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        const seconds = Math.floor(
          (Date.now() - recordingStartedAtRef.current) / 1000
        );
        setRecordingSeconds(seconds);
        if (seconds >= MAX_RECORDING_SECONDS && recorder.state !== "inactive") {
          recorder.stop();
          setIsRecording(false);
        }
      }, 250);
    } catch (cause) {
      stopTracks();
      const permissionDenied =
        cause instanceof DOMException &&
        (cause.name === "NotAllowedError" || cause.name === "SecurityError");
      setError(
        permissionDenied
          ? "اسمح للموقع بالوصول إلى الميكروفون من إعدادات المتصفح ثم حاول مجددًا."
          : "تعذر فتح الميكروفون. تأكد من توصيله وعدم استخدامه في تطبيق آخر."
      );
    }
  }

  function stopRecording() {
    stopTimer();
    isRecordingRef.current = false;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    setIsRecording(false);
  }

  function retry() {
    requestIdRef.current += 1;
    if (isRecordingRef.current) discardRecording();
    liveRequestPendingRef.current = false;
    setIsTranscribing(false);
    setTranscript("");
    setComparison(null);
    setComparisonIsFinal(false);
    setError("");
    setRecordingSeconds(0);
  }

  return (
    <section className="recitation-coach" aria-label="التسميع المحلي ومراجعة الكلمات">
      <div className="recitation-coach-heading">
        <span className="recitation-local-emblem" aria-hidden="true">
          <span><Sparkles size={18} /></span>
        </span>
        <div className="recitation-title-copy">
          <strong>مساعد التسميع المحلي</strong>
          <small>متابعة الآية {verseNumber.toLocaleString("ar")} أثناء القراءة</small>
        </div>
        <span className={`recitation-status ${isRecording ? "is-recording" : modelReady ? "is-ready" : ""}`}>
          <i />
          {isRecording ? "متابعة مباشرة" : modelReady ? "على جهازك" : "خصوصية أولًا"}
        </span>
      </div>

      <div className="recitation-local-banner">
        <ShieldCheck size={16} />
        <p>
          صوتك لا يُرسل إلى الموقع أو لخدمة خارجية. يُنزّل النموذج مرة أولى
          (قرابة 100 ميغابايت) ثم تُجرى المعالجة محليًا ويُحفظ النموذج مؤقتًا في المتصفح.
        </p>
      </div>

      {!modelReady && (
        <div className="recitation-model-setup">
          <div className="recitation-model-copy">
            <span className="recitation-model-icon"><Download size={16} /></span>
            <div>
              <strong>{modelLoading ? "تجهيز محرك التلاوة" : "نموذج عربي محلي"}</strong>
              <small>
                {modelLoading
                  ? modelFile
                    ? `تحميل ${modelFile}`
                    : "يتم تنزيل الملفات للمرة الأولى…"
                  : "Whisper Tiny متعدد اللغات • تنزيل أول مرة فقط"}
              </small>
            </div>
          </div>
          {modelLoading && modelProgress !== null && (
            <div className="recitation-model-progress" aria-label={`تقدم تنزيل الملف ${modelProgress}%`}>
              <span style={{ width: `${modelProgress}%` }} />
            </div>
          )}
          <button
            type="button"
            className="recitation-prepare-button"
            onClick={prepareModel}
            disabled={modelLoading}
          >
            {modelLoading ? <LoaderCircle className="recitation-spinner" size={16} /> : <Download size={15} />}
            {modelLoading ? "لحظة، تجهيز النموذج…" : "تجهيز التسميع على جهازي"}
          </button>
        </div>
      )}

      {modelReady && (
        <div className="recitation-model-ready">
          <Check size={15} /> النموذج جاهز؛ الصوت يُحلّل محليًا أثناء التسميع
        </div>
      )}

      <div className="recitation-record-panel">
        <div className={`recitation-visualizer ${isRecording ? "active" : ""}`} aria-hidden="true">
          {[18, 29, 40, 24, 35, 48, 29, 42, 22, 34, 46, 26, 39, 19, 31].map((height, index) => (
            <i key={index} style={{ "--bar-height": `${height}%`, "--bar-delay": `${index * -0.08}s` } as React.CSSProperties} />
          ))}
        </div>
        <div className="recitation-record-info">
          <strong>
            {isRecording
              ? isTranscribing
                ? "نراجع الكلمات المنطوقة الآن"
                : "اقرأ الآية بهدوء"
              : isTranscribing
                ? "نحلّل التلاوة محليًا"
                : "جاهز لتسميع الآية؟"}
          </strong>
          <small>
            {isRecording
              ? `${formatDuration(recordingSeconds)} / ${formatDuration(MAX_RECORDING_SECONDS)} • مراجعة كل عدة ثوانٍ`
              : isTranscribing
                ? "قد يتأخر التحليل حسب سرعة جهازك"
                : modelReady
                  ? "اضغط وابدأ القراءة من حفظك"
                  : "جهّز النموذج المحلي أولًا"}
          </small>
        </div>
        {isTranscribing && <LoaderCircle className="recitation-spinner recitation-processing-icon" size={18} />}
        <button
          type="button"
          className={`recitation-record-button ${isRecording ? "recording" : ""}`}
          onClick={isRecording ? stopRecording : () => void startRecording()}
          disabled={!modelReady || (isTranscribing && !isRecording)}
          aria-pressed={isRecording}
        >
          {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
          {isRecording ? "أوقف وأكمل التصحيح" : "ابدأ التسميع"}
        </button>
      </div>

      {isRecording && (
        <div className="recitation-live-note" aria-live="polite">
          <span className="recitation-live-dot" />
          تظهر الملاحظات تدريجيًا بعد تحليل كل مقطع؛ قد تتغير قبل إيقاف التسجيل.
        </div>
      )}
      {error && <p className="recitation-error" role="status">{error}</p>}

      {transcript && (
        <div className="recitation-transcript" aria-live="polite">
          <span>{comparisonIsFinal ? "النص الذي تعرّف عليه النموذج" : "النص الملتقط حتى الآن • نتيجة مؤقتة"}</span>
          <p dir="rtl">{transcript}</p>
        </div>
      )}

      {comparison && comparison.words.length > 0 && (
        <div className={`recitation-result ${comparisonIsFinal ? "" : "is-live"}`} aria-live="polite">
          {comparisonIsFinal ? (
            <div className="recitation-score-row">
              <div>
                <strong>{comparison.score.toLocaleString("ar")}٪</strong>
                <span>تطابق لفظي تقريبي</span>
              </div>
              <p>
                {comparison.score >= 95
                  ? "مطابقة الكلمات عالية؛ أحسنت."
                  : comparison.score >= 70
                    ? "راجع الكلمات المظللة، ثم أعد التسميع إن أحببت."
                    : "قد تتأثر النتيجة بسرعة القراءة أو الضجيج أو أداء الجهاز."}
              </p>
            </div>
          ) : (
            <div className="recitation-live-heading">
              <span className="recitation-live-dot" />
              مراجعة مباشرة — العلامات الحالية للمقطع المنطوق فقط
            </div>
          )}
          <div className="recitation-word-list" dir="rtl">
            {comparison.words.map((word, index) => (
              <span
                key={`${index}-${word.expected}-${word.heard ?? ""}`}
                className={`recitation-word ${word.status}`}
                title={
                  word.status === "different"
                    ? `النص: ${word.expected} — الملتقط: ${word.heard}`
                    : word.status === "missing"
                      ? "لم يلتقط النموذج هذه الكلمة"
                      : word.status === "extra"
                        ? `كلمة إضافية التقطها النموذج: ${word.heard}`
                        : "مطابقة لفظية"
                }
              >
                {word.status === "extra" ? (
                  <><small>زائدة</small>{word.heard}</>
                ) : (
                  <>
                    {word.expected}
                    {word.status === "different" && <small>الملتقط: {word.heard}</small>}
                    {word.status === "missing" && <small>لم تُلتقط</small>}
                  </>
                )}
              </span>
            ))}
          </div>
          {comparisonIsFinal && (
            <>
              <div className="recitation-legend" aria-label="مفتاح ألوان المقارنة">
                <span className="correct">مطابقة</span>
                <span className="different">اختلاف</span>
                <span className="missing">ناقصة</span>
                <span className="extra">زائدة</span>
              </div>
              <button type="button" className="recitation-retry-button" onClick={retry}>
                <RotateCcw size={14} /> إعادة التسميع
              </button>
            </>
          )}
        </div>
      )}

      <p className="recitation-privacy">
        التنبيه قريب من المباشر وليس لحظيًا حرفًا بحرف، وقد يتأخر على الأجهزة الأبطأ. التفريغ والمقارنة لا يغادران المتصفح، لكن ملفات النموذج تُنزّل من مستودع عام أول مرة. لا تقيّم الميزة التجويد أو مخارج الحروف ولا تغني عن معلّم متقن.
      </p>
    </section>
  );
}
