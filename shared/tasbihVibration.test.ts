import { describe, expect, it, vi } from "vitest";
import { sendTasbihVibration } from "./tasbihVibration";

describe("sendTasbihVibration", () => {
  it("returns unsupported when no vibration API is available", () => {
    expect(sendTasbihVibration(null)).toBe("unsupported");
  });

  it("sends a perceptible short pulse by default", () => {
    const vibrate = vi.fn(() => true);
    expect(sendTasbihVibration({ vibrate })).toBe("sent");
    expect(vibrate).toHaveBeenCalledWith(28);
  });

  it("reports when the browser rejects the vibration request", () => {
    const vibrate = vi.fn(() => false);
    expect(sendTasbihVibration({ vibrate })).toBe("rejected");
  });

  it("does not let a browser exception break the counter", () => {
    const vibrate = vi.fn(() => {
      throw new Error("Vibration is unavailable");
    });
    expect(sendTasbihVibration({ vibrate })).toBe("rejected");
  });
});
