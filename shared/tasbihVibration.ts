export type VibrationApi = {
  vibrate: (durationMs: number) => boolean;
};

export type VibrationResult = "sent" | "unsupported" | "rejected";

export function getTasbihVibrationApi(): VibrationApi | null {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return null;
  }
  return { vibrate: durationMs => navigator.vibrate(durationMs) };
}

export function sendTasbihVibration(
  api: VibrationApi | null | undefined,
  durationMs = 28
): VibrationResult {
  if (!api || typeof api.vibrate !== "function") return "unsupported";
  try {
    return api.vibrate(durationMs) ? "sent" : "rejected";
  } catch {
    return "rejected";
  }
}
