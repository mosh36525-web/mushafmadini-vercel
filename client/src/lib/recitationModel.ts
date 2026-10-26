export type RecitationWorkerMessage =
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

export type RecitationWorkerRequest =
  | { type: "load" }
  | {
      type: "transcribe";
      requestId: number;
      audioBuffer: ArrayBuffer;
      isFinal: boolean;
    };

export type RecitationModelStatus = {
  ready: boolean;
  loading: boolean;
  progress: number | null;
  file: string;
  error: string;
};

const initialStatus: RecitationModelStatus = {
  ready: false,
  loading: false,
  progress: null,
  file: "",
  error: "",
};

let status: RecitationModelStatus = { ...initialStatus };
let worker: Worker | null = null;
let requestSequence = 0;
const statusListeners = new Set<(status: RecitationModelStatus) => void>();
const messageListeners = new Set<(message: RecitationWorkerMessage) => void>();

function notifyStatus() {
  const snapshot = { ...status };
  statusListeners.forEach(listener => listener(snapshot));
}

function createWorker() {
  if (worker) return worker;
  const instance = new Worker(
    new URL("../workers/recitation.worker.ts", import.meta.url),
    { type: "module" }
  );
  instance.onmessage = (event: MessageEvent<RecitationWorkerMessage>) => {
    const message = event.data;
    if (message.type === "progress") {
      status = {
        ...status,
        loading: true,
        error: "",
        file: message.file ?? status.file,
        progress:
          typeof message.progress === "number"
            ? Math.max(0, Math.min(100, Math.round(message.progress)))
            : null,
      };
      notifyStatus();
    } else if (message.type === "ready") {
      status = { ...status, ready: true, loading: false, progress: 100, error: "" };
      notifyStatus();
    } else if (message.type === "error" && message.stage === "load") {
      status = { ...status, ready: false, loading: false, error: message.message };
      notifyStatus();
    }
    messageListeners.forEach(listener => listener(message));
  };
  instance.onerror = () => {
    status = {
      ...status,
      ready: false,
      loading: false,
      error: "توقف محرك التسميع المحلي. تحقق من المتصفح ثم حاول مجددًا.",
    };
    notifyStatus();
    messageListeners.forEach(listener =>
      listener({ type: "error", stage: "load", message: status.error })
    );
  };
  worker = instance;
  return instance;
}

export function getRecitationModelStatus() {
  return { ...status };
}

export function nextRecitationRequestId() {
  requestSequence += 1;
  return requestSequence;
}

export function subscribeToRecitationModelStatus(
  listener: (status: RecitationModelStatus) => void
) {
  statusListeners.add(listener);
  listener({ ...status });
  return () => {
    statusListeners.delete(listener);
  };
}

export function subscribeToRecitationWorkerMessages(
  listener: (message: RecitationWorkerMessage) => void
) {
  messageListeners.add(listener);
  return () => {
    messageListeners.delete(listener);
  };
}

export function getRecitationWorker() {
  return createWorker();
}

export function preloadRecitationModel() {
  if (status.ready || status.loading) return;
  status = { ...status, loading: true, progress: null, error: "" };
  notifyStatus();
  try {
    createWorker().postMessage({ type: "load" } satisfies RecitationWorkerRequest);
  } catch {
    status = {
      ...status,
      loading: false,
      error: "تعذر تشغيل نموذج التسميع في هذا المتصفح.",
    };
    notifyStatus();
  }
}

export function cancelRecitationModelDownload() {
  if (!status.loading || status.ready) return;
  worker?.terminate();
  worker = null;
  status = { ...initialStatus };
  notifyStatus();
}
