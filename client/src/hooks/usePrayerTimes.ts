import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDaysToDateKey,
  buildPrayerTimes,
  formatPrayerCountdown,
  getNextPrayer,
  getQiblaAngle,
  getZonedDateKey,
  isValidPrayerLocation,
  toAlAdhanDate,
  type PrayerLocation,
  type PrayerTime,
} from "@shared/prayer";

export type { PrayerLocation, PrayerTime } from "@shared/prayer";

export type LocationStatus = "ready" | "requesting" | "granted" | "denied" | "unsupported" | "error";

type AlAdhanResponse = {
  code: number;
  data: {
    timings: Record<string, string>;
    date: {
      gregorian?: { date?: string };
      hijri?: {
        day?: string;
        year?: string;
        weekday?: { ar?: string };
        month?: { ar?: string };
      };
    };
    meta: { timezone?: string };
  };
};

type DayData = {
  times: PrayerTime[];
  dateKey: string;
  timezone: string;
  hijriDate: string;
};

type PrayerData = {
  today: DayData;
  tomorrow: DayData;
};

type CachedPrayerData = {
  version: 1;
  location: PrayerLocation;
  method: string;
  school: string;
  data: PrayerData;
};

export const PRAYER_LOCATIONS: ReadonlyArray<PrayerLocation> = [
  { label: "المدينة المنورة", latitude: 24.5247, longitude: 39.5692 },
  { label: "مكة المكرمة", latitude: 21.3891, longitude: 39.8579 },
  { label: "الرياض", latitude: 24.7136, longitude: 46.6753 },
  { label: "جدة", latitude: 21.4858, longitude: 39.1925 },
  { label: "الدمام", latitude: 26.4207, longitude: 50.0888 },
  { label: "القاهرة", latitude: 30.0444, longitude: 31.2357 },
  { label: "الإسكندرية", latitude: 31.2001, longitude: 29.9187 },
  { label: "دبي", latitude: 25.2048, longitude: 55.2708 },
  { label: "القدس", latitude: 31.7683, longitude: 35.2137 },
  { label: "لندن", latitude: 51.5074, longitude: -0.1278 },
];

export const CALCULATION_METHODS = [
  { value: "4", label: "أم القرى — مكة" },
  { value: "5", label: "الهيئة المصرية العامة للمساحة" },
  { value: "3", label: "رابطة العالم الإسلامي" },
  { value: "2", label: "الجمعية الإسلامية لأمريكا الشمالية" },
] as const;

export const ASR_SCHOOLS = [
  { value: "0", label: "الجمهور (شافعي/مالكي/حنبلي)" },
  { value: "1", label: "حنفي" },
] as const;

const DEFAULT_LOCATION = PRAYER_LOCATIONS[0];
const LOCATION_KEY = "madini-prayer-location";
const METHOD_KEY = "madini-prayer-method";
const SCHOOL_KEY = "madini-prayer-school";
const CACHE_KEY = "madini-prayer-times-v1";
const REQUEST_TIMEOUT_MS = 12_000;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function notifyDataChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("madini-data-change"));
}

function readLocation(): PrayerLocation {
  if (!canUseStorage()) return DEFAULT_LOCATION;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCATION_KEY) ?? "null") as PrayerLocation | null;
    return parsed && isValidPrayerLocation(parsed) ? parsed : DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

function readChoice(key: string, permitted: readonly { value: string }[], fallback: string) {
  if (!canUseStorage()) return fallback;
  const stored = window.localStorage.getItem(key);
  return permitted.some((choice) => choice.value === stored) ? stored! : fallback;
}

function sameLocation(left: PrayerLocation, right: PrayerLocation) {
  return left.latitude === right.latitude && left.longitude === right.longitude;
}

function dateKeyFromResponse(response: AlAdhanResponse): string | null {
  const gregorian = response.data.date.gregorian?.date;
  const match = gregorian && /^(\d{2})-(\d{2})-(\d{4})$/.exec(gregorian);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  const fajr = response.data.timings.Fajr;
  return /^\d{4}-\d{2}-\d{2}T/.test(fajr ?? "") ? fajr.slice(0, 10) : null;
}

function hijriLabel(response: AlAdhanResponse) {
  const hijri = response.data.date.hijri;
  const pieces = [hijri?.weekday?.ar, hijri?.day, hijri?.month?.ar, hijri?.year].filter(Boolean);
  return pieces.length ? pieces.join(" ") : "التاريخ الهجري غير متاح";
}

function toDayData(response: AlAdhanResponse, expectedDateKey: string, timezone: string): DayData {
  const dateKey = dateKeyFromResponse(response);
  if (!dateKey || dateKey !== expectedDateKey) throw new Error("استجابة المواقيت لا تطابق اليوم المطلوب");
  return {
    times: buildPrayerTimes(response.data.timings, timezone),
    dateKey,
    timezone,
    hijriDate: hijriLabel(response),
  };
}

function readUsableCache(location: PrayerLocation, method: string, school: string): PrayerData | null {
  if (!canUseStorage()) return null;
  try {
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "null") as CachedPrayerData | null;
    if (!cached || cached.version !== 1 || cached.method !== method || cached.school !== school || !sameLocation(cached.location, location)) return null;
    const timezone = cached.data.today.timezone;
    const today = getZonedDateKey(Date.now(), timezone);
    return cached.data.today.dateKey === today && cached.data.tomorrow.dateKey === addDaysToDateKey(today, 1) ? cached.data : null;
  } catch {
    return null;
  }
}

function saveCache(location: PrayerLocation, method: string, school: string, data: PrayerData) {
  if (!canUseStorage()) return;
  const cache: CachedPrayerData = { version: 1, location, method, school, data };
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Cache failure (for example private browsing) must not prevent live prayer times.
  }
}

/** Live AlAdhan prayer times for a saved city, manual coordinates, or browser location. */
export function usePrayerTimes() {
  const [location, setLocationState] = useState<PrayerLocation>(readLocation);
  const [method, setMethodState] = useState(() => readChoice(METHOD_KEY, CALCULATION_METHODS, "4"));
  const [school, setSchoolState] = useState(() => readChoice(SCHOOL_KEY, ASR_SCHOOLS, "0"));
  const [data, setData] = useState<PrayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("ready");
  const [now, setNow] = useState(() => Date.now());
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const restoreSyncedPreferences = () => {
      setLocationState(readLocation());
      setMethodState(readChoice(METHOD_KEY, CALCULATION_METHODS, "4"));
      setSchoolState(readChoice(SCHOOL_KEY, ASR_SCHOOLS, "0"));
      setLocationStatus("ready");
    };
    window.addEventListener("madini-data-restored", restoreSyncedPreferences);
    return () => window.removeEventListener("madini-data-restored", restoreSyncedPreferences);
  }, []);

  const setLocation = useCallback((candidate: PrayerLocation) => {
    const normalized: PrayerLocation = {
      label: candidate.label.trim() || "موقع يدوي",
      latitude: Number(candidate.latitude),
      longitude: Number(candidate.longitude),
    };
    if (!isValidPrayerLocation(normalized)) {
      setError("أدخل إحداثيات صحيحة: خط العرض بين −90 و90 وخط الطول بين −180 و180.");
      return;
    }
    if (canUseStorage()) window.localStorage.setItem(LOCATION_KEY, JSON.stringify(normalized));
    setError(null);
    setLocationStatus("ready");
    setLocationState(normalized);
    notifyDataChange();
  }, []);

  const setMethod = useCallback((nextMethod: string) => {
    if (!CALCULATION_METHODS.some((methodOption) => methodOption.value === nextMethod)) return;
    if (canUseStorage()) window.localStorage.setItem(METHOD_KEY, nextMethod);
    setMethodState(nextMethod);
    notifyDataChange();
  }, []);

  const setSchool = useCallback((nextSchool: string) => {
    if (!ASR_SCHOOLS.some((schoolOption) => schoolOption.value === nextSchool)) return;
    if (canUseStorage()) window.localStorage.setItem(SCHOOL_KEY, nextSchool);
    setSchoolState(nextSchool);
    notifyDataChange();
  }, []);

  const load = useCallback(async (force = false) => {
    // Invalidate and abort before checking cache: a new cached location must
    // still win over any older live request that is about to resolve.
    const requestId = ++requestIdRef.current;
    controllerRef.current?.abort();
    const cached = !force && readUsableCache(location, method, school);
    if (cached) {
      setData(cached);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const isCurrent = () => requestId === requestIdRef.current;

    const fetchDay = async (dateKey: string): Promise<AlAdhanResponse> => {
      const params = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        method,
        school,
        iso8601: "true",
      });
      const response = await fetch(`https://api.aladhan.com/v1/timings/${toAlAdhanDate(dateKey)}?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error("تعذر الاتصال بخدمة المواقيت");
      const payload = (await response.json()) as AlAdhanResponse;
      if (payload.code !== 200 || !payload.data?.timings) throw new Error("تعذر الحصول على مواقيت صحيحة");
      return payload;
    };

    try {
      if (isCurrent()) {
        setLoading(true);
        setError(null);
      }
      // The first response reveals the place's IANA timezone. It is then used to
      // request today and tomorrow, avoiding the device timezone at date boundaries.
      const probe = await fetchDay(getZonedDateKey(Date.now(), "UTC"));
      const timezone = probe.data.meta.timezone;
      if (!timezone) throw new Error("لم تُرجع الخدمة المنطقة الزمنية للموقع");
      const todayKey = getZonedDateKey(Date.now(), timezone);
      const probeDateKey = dateKeyFromResponse(probe);
      const todayResponse = probeDateKey === todayKey ? probe : await fetchDay(todayKey);
      const tomorrowKey = addDaysToDateKey(todayKey, 1);
      const tomorrowResponse = await fetchDay(tomorrowKey);
      const freshData: PrayerData = {
        today: toDayData(todayResponse, todayKey, timezone),
        tomorrow: toDayData(tomorrowResponse, tomorrowKey, timezone),
      };
      if (!isCurrent()) return;
      setData(freshData);
      saveCache(location, method, school, freshData);
      setError(null);
    } catch (caught) {
      if (!isCurrent()) return;
      if ((caught as DOMException)?.name === "AbortError") {
        setError("انتهت مهلة طلب المواقيت. حاول التحديث مرة أخرى.");
      } else {
        setError("تعذر جلب مواقيت الصلاة الآن. تحقق من اتصالك ثم أعد المحاولة.");
      }
      setData(null); // Never substitute guessed or sample times.
    } finally {
      window.clearTimeout(timeout);
      if (isCurrent()) setLoading(false);
    }
  }, [location, method, school]);

  useEffect(() => {
    void load();
    return () => {
      requestIdRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!data || getZonedDateKey(now, data.today.timezone) === data.today.dateKey) return;
    void load(true);
  }, [data, load, now]);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      setError("لا يدعم هذا المتصفح تحديد الموقع. اختر مدينة أو أدخل الإحداثيات يدويًا.");
      return;
    }
    setLocationStatus("requesting");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: PrayerLocation = {
          label: "موقعي الحالي",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocation(next);
        setLocationStatus("granted");
      },
      (positionError) => {
        const denied = positionError.code === positionError.PERMISSION_DENIED;
        setLocationStatus(denied ? "denied" : "error");
        setError(denied ? "لم تسمح بالوصول للموقع. اختر مدينة أو أدخل الإحداثيات يدويًا." : "تعذر تحديد موقعك بدقة. حاول مرة أخرى أو أدخل الإحداثيات يدويًا.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 300_000 },
    );
  }, [setLocation]);

  const allTimes = useMemo(() => (data ? [...data.today.times, ...data.tomorrow.times] : []), [data]);
  const nextPrayer = useMemo(() => getNextPrayer(allTimes, now), [allTimes, now]);

  return {
    location,
    setLocation,
    method,
    setMethod,
    school,
    setSchool,
    requestLocation,
    refresh: () => load(true),
    loading,
    error,
    locationStatus,
    times: data?.today.times ?? [],
    nextPrayer,
    countdown: formatPrayerCountdown(nextPrayer?.timestamp ?? null, now),
    timezone: data?.today.timezone ?? null,
    hijriDate: data?.today.hijriDate ?? null,
    qiblaAngle: getQiblaAngle(location.latitude, location.longitude),
  };
}
