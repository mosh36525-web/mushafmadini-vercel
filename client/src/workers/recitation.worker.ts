import { env, pipeline } from "@huggingface/transformers";

type IncomingMessage =
  | { type: "load" }
  | {
      type: "transcribe";
      requestId: number;
      audioBuffer: ArrayBuffer;
      isFinal: boolean;
    };
type OutgoingMessage =
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
type WorkerScope = {
  onmessage: ((event: MessageEvent<IncomingMessage>) => void) | null;
  postMessage: (message: OutgoingMessage) => void;
};
type ProgressInfo = {
  file?: string;
  progress?: number;
  status?: string;
};
type Transcriber = (
  audio: Float32Array,
  options: {
    language: string;
    task: "transcribe";
    chunk_length_s?: number;
    stride_length_s?: number;
  }
) => Promise<{ text?: string } | Array<{ text?: string }>>;

const workerScope = self as unknown as WorkerScope;
// Tarteel Quran-tuned Whisper Tiny; Transformers.js-compatible Q8 ONNX export.
// Source fine-tune and ONNX conversion are both published under Apache-2.0.
const MODEL_ID = "Sharjeelbaig/whisper-tiny-ar-quran-onnx";
const SAMPLE_RATE = 16_000;
let transcriber: Transcriber | null = null;
let loadPromise: Promise<Transcriber> | null = null;
let inferenceQueue = Promise.resolve();

env.allowRemoteModels = true;
env.useBrowserCache = true;
env.useWasmCache = true;

async function loadModel(): Promise<Transcriber> {
  if (transcriber) return transcriber;
  if (!loadPromise) {
    loadPromise = pipeline("automatic-speech-recognition", MODEL_ID, {
      dtype: "q8",
      progress_callback: (info: ProgressInfo) => {
        workerScope.postMessage({
          type: "progress",
          file: info.file,
          progress: info.progress,
          status: info.status,
        });
      },
    }).then(result => {
      transcriber = result as unknown as Transcriber;
      return transcriber;
    });
  }
  try {
    return await loadPromise;
  } catch (error) {
    loadPromise = null;
    throw error;
  }
}

async function runTranscription(message: Extract<IncomingMessage, { type: "transcribe" }>) {
  try {
    const model = await loadModel();
    const audio = new Float32Array(message.audioBuffer);
    const options: Parameters<Transcriber>[1] = {
      language: "arabic",
      task: "transcribe",
    };
    if (audio.length / SAMPLE_RATE > 30) {
      options.chunk_length_s = 30;
      options.stride_length_s = 5;
    }
    const result = await model(audio, options);
    const firstResult = Array.isArray(result) ? result[0] : result;
    workerScope.postMessage({
      type: "transcript",
      requestId: message.requestId,
      text: firstResult?.text?.trim() ?? "",
      isFinal: message.isFinal,
    });
  } catch {
    workerScope.postMessage({
      type: "error",
      stage: "transcribe",
      requestId: message.requestId,
      isFinal: message.isFinal,
      message: message.isFinal
        ? "تعذر إكمال تحليل التلاوة على هذا الجهاز. جرّب مقطعًا أقصر أو جهازًا أسرع."
        : "تأخر التحليل المحلي لهذه اللقطة؛ يستمر التسجيل ويمكن مراجعة النتيجة عند الإيقاف.",
    });
  }
}

workerScope.onmessage = event => {
  const message = event.data;
  if (message.type === "load") {
    void loadModel()
      .then(() => workerScope.postMessage({ type: "ready" }))
      .catch(() => {
        workerScope.postMessage({
          type: "error",
          stage: "load",
          message:
            "تعذر تحميل نموذج التسميع المحلي. تحقق من اتصال الإنترنت والمساحة المتاحة ثم حاول مجددًا.",
        });
      });
    return;
  }

  inferenceQueue = inferenceQueue.then(() => runTranscription(message));
};
