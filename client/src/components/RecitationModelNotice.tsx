import { Check, Download, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  cancelRecitationModelDownload,
  getRecitationModelStatus,
  preloadRecitationModel,
  subscribeToRecitationModelStatus,
  type RecitationModelStatus,
} from "@/lib/recitationModel";

function fileLabel(path: string) {
  const name = path.split("/").pop()?.replace(/\.onnx$/, "") ?? "ملفات النموذج";
  return name.length > 32 ? `${name.slice(0, 29)}…` : name;
}

export default function RecitationModelNotice() {
  const [status, setStatus] = useState<RecitationModelStatus>(getRecitationModelStatus());
  const [showReady, setShowReady] = useState(false);

  useEffect(() => subscribeToRecitationModelStatus(setStatus), []);

  useEffect(() => {
    if (!status.ready) {
      setShowReady(false);
      return;
    }
    setShowReady(true);
    const timer = window.setTimeout(() => setShowReady(false), 5000);
    return () => window.clearTimeout(timer);
  }, [status.ready]);

  if (!status.loading && !status.error && !(status.ready && showReady)) return null;

  return (
    <aside className="recitation-preload-notice" dir="rtl" role="status" aria-live="polite">
      <span className={`recitation-preload-icon ${status.error ? "has-error" : status.ready ? "is-ready" : ""}`}>
        {status.loading ? (
          <LoaderCircle className="recitation-spinner" size={18} />
        ) : status.error ? (
          <Download size={18} />
        ) : (
          <Check size={18} />
        )}
      </span>
      <div className="recitation-preload-copy">
        <strong>
          {status.error
            ? "تعذر تجهيز نموذج التسميع"
            : status.ready
              ? "نموذج التسميع جاهز"
              : "نجهّز نموذج التسميع في الخلفية"}
        </strong>
        <small>
          {status.error
            ? status.error
            : status.ready
              ? "سيُعالج الصوت محليًا عند استخدام المراجعة."
              : `التنزيل الأول يقارب 45 ميغابايت${status.file ? ` • ${fileLabel(status.file)}` : ""}. صوتك لا يُرفع.`}
        </small>
        {status.loading && status.progress !== null && (
          <div
            className="recitation-preload-progress"
            role="progressbar"
            aria-label={`تقدم تنزيل ملف النموذج ${status.progress}%`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={status.progress}
          >
            <span style={{ width: `${status.progress}%` }} />
          </div>
        )}
      </div>
      {status.loading && (
        <button
          type="button"
          className="recitation-preload-action"
          onClick={cancelRecitationModelDownload}
          aria-label="إيقاف تنزيل نموذج التسميع"
          title="إيقاف التنزيل"
        >
          <X size={17} />
        </button>
      )}
      {status.error && (
        <button
          type="button"
          className="recitation-preload-retry"
          onClick={preloadRecitationModel}
        >
          إعادة المحاولة
        </button>
      )}
    </aside>
  );
}
