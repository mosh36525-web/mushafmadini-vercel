import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  getNextPrayer,
  getQiblaAngle,
  getZonedDateKey,
  type PrayerTime,
} from "./prayer";

const at = (key: PrayerTime["key"], timestamp: number): PrayerTime => ({
  key,
  timestamp,
  name: key,
  time: "00:00",
  icon: key === "Sunrise" ? "sunrise" : key === "Fajr" ? "fajr" : key === "Dhuhr" ? "dhuhr" : key === "Asr" ? "asr" : key === "Maghrib" ? "maghrib" : "isha",
});

describe("zoned calendar dates", () => {
  it("uses the prayer location timezone rather than the device calendar day", () => {
    const instant = new Date("2025-01-01T00:30:00.000Z");
    expect(getZonedDateKey(instant, "America/Los_Angeles")).toBe("2024-12-31");
    expect(getZonedDateKey(instant, "Asia/Riyadh")).toBe("2025-01-01");
    expect(addDaysToDateKey("2024-02-28", 1)).toBe("2024-02-29");
  });
});

describe("next prayer", () => {
  it("skips sunrise and chooses the earliest later obligatory prayer", () => {
    const now = Date.parse("2025-04-01T05:00:00.000Z");
    const next = getNextPrayer([
      at("Fajr", Date.parse("2025-04-01T04:30:00.000Z")),
      at("Sunrise", Date.parse("2025-04-01T05:20:00.000Z")),
      at("Dhuhr", Date.parse("2025-04-01T11:45:00.000Z")),
      at("Asr", Date.parse("2025-04-01T15:15:00.000Z")),
    ], now);
    expect(next?.key).toBe("Dhuhr");
  });
});

describe("Qibla geographic bearing", () => {
  it("returns a clockwise angle from north, without requiring a compass sensor", () => {
    const londonBearing = getQiblaAngle(51.5074, -0.1278);
    expect(londonBearing).not.toBeNull();
    expect(londonBearing!).toBeCloseTo(118.99, 1);
  });
});
