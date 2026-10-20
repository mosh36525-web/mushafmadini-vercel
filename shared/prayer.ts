export type PrayerKey = "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

export type PrayerLocation = {
  label: string;
  latitude: number;
  longitude: number;
};

export type PrayerTime = {
  name: string;
  time: string;
  icon: "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";
  key: PrayerKey;
  timestamp: number;
};

export const PRAYER_DEFINITIONS: ReadonlyArray<{
  key: PrayerKey;
  name: string;
  icon: PrayerTime["icon"];
}> = [
  { key: "Fajr", name: "الفجر", icon: "fajr" },
  { key: "Sunrise", name: "الشروق", icon: "sunrise" },
  { key: "Dhuhr", name: "الظهر", icon: "dhuhr" },
  { key: "Asr", name: "العصر", icon: "asr" },
  { key: "Maghrib", name: "المغرب", icon: "maghrib" },
  { key: "Isha", name: "العشاء", icon: "isha" },
];

const KAABA = { latitude: 21.422487, longitude: 39.826206 };

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return { year: value("year"), month: value("month"), day: value("day") };
}

/** Returns an ISO calendar day in the supplied IANA timezone, never the device's local day. */
export function getZonedDateKey(date: Date | number, timeZone: string): string {
  const input = typeof date === "number" ? new Date(date) : date;
  try {
    const { year, month, day } = dateParts(input, timeZone);
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // A malformed IANA name should not make date calculations crash the UI.
  }
  return input.toISOString().slice(0, 10);
}

/** Changes YYYY-MM-DD by whole calendar days without involving the current device timezone. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error("Invalid calendar date");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

/** Converts YYYY-MM-DD to AlAdhan's DD-MM-YYYY URL date format. */
export function toAlAdhanDate(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error("Invalid calendar date");
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function isValidPrayerLocation(location: PrayerLocation): boolean {
  return (
    typeof location.label === "string" &&
    location.label.trim().length > 0 &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

/**
 * Builds display values from AlAdhan `iso8601=true` timings. ISO offsets are
 * intentionally parsed into epoch timestamps before comparison.
 */
export function buildPrayerTimes(timings: Record<string, string>, timeZone: string): PrayerTime[] {
  return PRAYER_DEFINITIONS.map((definition) => {
    const isoTime = timings[definition.key];
    const timestamp = Date.parse(isoTime);
    if (!isoTime || !Number.isFinite(timestamp)) {
      throw new Error(`Missing or invalid ${definition.key} prayer time`);
    }
    const time = new Intl.DateTimeFormat("ar-SA", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(timestamp));
    return { ...definition, time, timestamp };
  });
}

/** Finds the next obligatory prayer; sunrise is shown but is never a next prayer. */
export function getNextPrayer(times: readonly PrayerTime[], now = Date.now()): PrayerTime | null {
  return (
    [...times]
      .filter((prayer) => prayer.key !== "Sunrise" && Number.isFinite(prayer.timestamp) && prayer.timestamp > now)
      .sort((left, right) => left.timestamp - right.timestamp)[0] ?? null
  );
}

export function formatPrayerCountdown(targetTimestamp: number | null, now = Date.now()): string {
  if (!targetTimestamp || !Number.isFinite(targetTimestamp)) return "—";
  const totalSeconds = Math.max(0, Math.floor((targetTimestamp - now) / 1000));
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const degrees = (radiansValue: number) => (radiansValue * 180) / Math.PI;

/** Initial great-circle bearing to the Kaaba, clockwise from geographic north. */
export function getQiblaAngle(latitude: number, longitude: number): number | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  const phi1 = radians(latitude);
  const phi2 = radians(KAABA.latitude);
  const deltaLambda = radians(KAABA.longitude - longitude);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}
