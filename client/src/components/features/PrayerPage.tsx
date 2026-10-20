import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  Compass,
  Info,
  LocateFixed,
  MapPin,
  Moon,
  Navigation,
  RotateCcw,
  Sun,
  Sunrise,
  Volume2,
} from "lucide-react";
import {
  ASR_SCHOOLS,
  CALCULATION_METHODS,
  PRAYER_LOCATIONS,
  usePrayerTimes,
} from "@/hooks/usePrayerTimes";
import { isValidPrayerLocation, type PrayerLocation, type PrayerTime } from "@shared/prayer";
import "./prayer.css";

type PrayerPageProps = {
  prayer: ReturnType<typeof usePrayerTimes>;
  onTasbih: () => void;
};

function PrayerIcon({ kind }: { kind: PrayerTime["icon"] }) {
  if (kind === "fajr" || kind === "isha") return <Moon size={17} />;
  if (kind === "sunrise") return <Sunrise size={18} />;
  return <Sun size={17} />;
}

function locationStatusCopy(status: ReturnType<typeof usePrayerTimes>["locationStatus"]) {
  if (status === "requesting") return "جارٍ طلب إذن الموقع…";
  if (status === "granted") return "تم استخدام موقعك الحالي";
  if (status === "denied") return "تم رفض إذن الموقع";
  if (status === "unsupported") return "تحديد الموقع غير مدعوم";
  if (status === "error") return "تعذر تحديد الموقع";
  return "مواقيت حسب الإحداثيات المختارة";
}

export function PrayerPage({ prayer, onTasbih }: PrayerPageProps) {
  const [manualLabel, setManualLabel] = useState("موقع يدوي");
  const [manualLatitude, setManualLatitude] = useState(String(prayer.location.latitude));
  const [manualLongitude, setManualLongitude] = useState(String(prayer.location.longitude));
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    setManualLatitude(String(prayer.location.latitude));
    setManualLongitude(String(prayer.location.longitude));
  }, [prayer.location.latitude, prayer.location.longitude]);

  const selectedLocation = PRAYER_LOCATIONS.find(
    (location) => location.latitude === prayer.location.latitude && location.longitude === prayer.location.longitude,
  );

  function chooseLocation(value: string) {
    const location = PRAYER_LOCATIONS.find((item) => item.label === value);
    if (location) prayer.setLocation(location);
  }

  function submitManualLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const location: PrayerLocation = {
      label: manualLabel.trim() || "موقع يدوي",
      latitude: Number(manualLatitude),
      longitude: Number(manualLongitude),
    };
    if (!isValidPrayerLocation(location)) {
      setManualError("تحقق من خط العرض (−90 إلى 90) وخط الطول (−180 إلى 180).");
      return;
    }
    setManualError(null);
    prayer.setLocation(location);
  }

  const qiblaDegrees = prayer.qiblaAngle === null ? null : Math.round(prayer.qiblaAngle);
  const qiblaRotation = prayer.qiblaAngle ?? 0;

  return (
    <div className="page-content prayer-page madini-prayer-page" dir="rtl">
      <section className="prayer-hero">
        <div>
          <span className="eyebrow">مواقيت الصلاة</span>
          <h1>صلاتك على موعد</h1>
          <p>{locationStatusCopy(prayer.locationStatus)}{prayer.timezone ? ` · ${prayer.timezone}` : ""}</p>
          <button className="location-button" type="button" onClick={prayer.requestLocation} disabled={prayer.locationStatus === "requesting"}>
            <LocateFixed size={16} /> {prayer.locationStatus === "requesting" ? "جارٍ تحديد الموقع" : "استخدم موقعي الحالي"}
          </button>
        </div>
        <div className="prayer-hero-orb" aria-hidden="true"><Sun size={38} /><span>اليوم</span></div>
      </section>

      <section className="prayer-toolbar" aria-label="إعدادات مواقيت الصلاة">
        <label className="city-select">
          <MapPin size={16} />
          <select value={selectedLocation?.label ?? "manual"} onChange={(event) => chooseLocation(event.target.value)} aria-label="المدينة">
            {PRAYER_LOCATIONS.map((location) => <option key={location.label} value={location.label}>{location.label}</option>)}
            <option value="manual">إحداثيات يدوية</option>
          </select>
        </label>
        <label className="prayer-select-label">طريقة الحساب
          <select value={prayer.method} onChange={(event) => prayer.setMethod(event.target.value)}>
            {CALCULATION_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
          </select>
        </label>
        <label className="prayer-select-label">مذهب العصر
          <select value={prayer.school} onChange={(event) => prayer.setSchool(event.target.value)}>
            {ASR_SCHOOLS.map((school) => <option key={school.value} value={school.value}>{school.label}</option>)}
          </select>
        </label>
        <span>{prayer.hijriDate ?? "جارٍ تحميل التاريخ الهجري…"}</span>
        <button className="icon-button subtle" type="button" onClick={prayer.refresh} disabled={prayer.loading} aria-label="تحديث المواقيت">
          <RotateCcw size={17} className={prayer.loading ? "is-spinning" : ""} />
        </button>
      </section>

      <details className="manual-location-panel" open={selectedLocation === undefined}>
        <summary>إدخال موقع يدوي</summary>
        <form onSubmit={submitManualLocation} noValidate>
          <label>اسم الموقع<input value={manualLabel} onChange={(event) => setManualLabel(event.target.value)} maxLength={60} /></label>
          <label>خط العرض<input inputMode="decimal" value={manualLatitude} onChange={(event) => setManualLatitude(event.target.value)} placeholder="24.5247" /></label>
          <label>خط الطول<input inputMode="decimal" value={manualLongitude} onChange={(event) => setManualLongitude(event.target.value)} placeholder="39.5692" /></label>
          <button className="outline-button" type="submit">تطبيق الإحداثيات</button>
        </form>
        {manualError && <p className="form-error" role="alert">{manualError}</p>}
      </details>

      {prayer.error && <div className="prayer-error" role="alert"><Info size={17} /><span>{prayer.error}</span><button type="button" onClick={prayer.refresh}>إعادة المحاولة</button></div>}

      {prayer.loading && prayer.times.length === 0 ? (
        <div className="prayer-loading" aria-live="polite">جارٍ جلب مواقيت اليوم ومواقيت الغد…</div>
      ) : (
        <div className="prayer-grid">
          {prayer.times.map((time) => {
            const isNext = prayer.nextPrayer?.timestamp === time.timestamp;
            return (
              <div key={`${time.key}-${time.timestamp}`} className={`prayer-time-card ${isNext ? "next" : ""}`}>
                <div className="prayer-card-top"><span className="prayer-icon"><PrayerIcon kind={time.icon} /></span><span>{isNext ? `القادمة خلال ${prayer.countdown}` : time.key === "Sunrise" ? "الشروق" : "اليوم"}</span></div>
                <h3>{time.name}</h3>
                <strong dir="ltr">{time.time}</strong>
                <div className="prayer-card-line" />
              </div>
            );
          })}
        </div>
      )}

      <section className="prayer-bottom-grid">
        <div className="qibla-card">
          <div>
            <span className="eyebrow">الاتجاه الجغرافي</span>
            <h2>اتجاه القبلة</h2>
            <p>{qiblaDegrees === null ? "أدخل إحداثيات صحيحة لحساب الاتجاه." : `${qiblaDegrees}° من الشمال الجغرافي باتجاه الكعبة.`}</p>
            <div className="qibla-note"><Navigation size={14} /> زاوية ثابتة للموقع وليست بوصلة حية أو قراءة من حساسات الجهاز.</div>
          </div>
          <div className="compass" aria-label={qiblaDegrees === null ? "اتجاه القبلة غير متاح" : `اتجاه القبلة ${qiblaDegrees} درجة من الشمال`}>
            <div className="compass-n">ش</div><span className="compass-e">غ</span><span className="compass-s">ج</span><span className="compass-w">ر</span>
            <div className="compass-needle" style={{ transform: `rotate(${qiblaRotation}deg)` }}><i /></div><div className="compass-center">ك</div>
          </div>
        </div>
        <div className="azkar-card">
          <span className="quick-icon amber"><Volume2 size={18} /></span><span className="eyebrow">ذكر اليوم</span>
          <h3>سبحان الله وبحمده</h3><p>مائة مرة · لا تفوّت أجرها</p>
          <button className="text-button" type="button" onClick={onTasbih}>ابدأ العداد <ArrowLeft size={15} /></button>
        </div>
      </section>

      <p className="prayer-disclaimer"><Info size={14} /> يتطلب تحديد الموقع إذنك ويعمل عادةً عبر اتصال HTTPS. تتأثر الدقة بإعدادات جهازك، وطريقة الحساب المختارة، وقد تختلف المواقيت عن مسجدك المحلي.</p>
    </div>
  );
}

export default PrayerPage;
