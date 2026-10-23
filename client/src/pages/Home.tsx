import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Compass,
  Eye,
  EyeOff,
  Flame,
  Headphones,
  Home as HomeIcon,
  ListMusic,
  LocateFixed,
  LockKeyhole,
  LogIn,
  MapPin,
  Menu,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  Search,
  Settings2,
  SkipBack,
  SkipForward,
  Sparkles,
  Sun,
  Timer,
  UserRound,
  Volume2,
  X,
} from "lucide-react";

import { surahs } from "@/data/surahs";
import { useQuran } from "@/hooks/useQuran";
import {
  usePersistentState,
  readSaved,
  writeSaved,
} from "@/hooks/usePersistentState";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import PrayerPage from "@/components/features/PrayerPage";
import DuaPage from "@/components/features/DuaPage";
import TasbihPage from "@/components/features/TasbihPage";
import AccountPage from "@/components/features/AccountPage";
import { trpc } from "@/lib/trpc";
import { normalizeArabic } from "@/lib/arabic";
import { useAccountSync } from "@/hooks/useAccountSync";
import "./enhancements.css";

type View =
  | "home"
  | "mushaf"
  | "review"
  | "prayer"
  | "duas"
  | "tasbih"
  | "account";

type Reciter = {
  name: string;
  shortName: string;
  style: string;
  url: string;
};

const reciters: Reciter[] = [
  {
    name: "مشاري راشد العفاسي",
    shortName: "مشاري العفاسي",
    style: "مرتل",
    url: "https://server8.mp3quran.net/afs/001.mp3",
  },
  {
    name: "عبد الباسط عبد الصمد",
    shortName: "عبد الباسط",
    style: "مجود",
    url: "https://server7.mp3quran.net/basit/001.mp3",
  },
  {
    name: "ماهر المعيقلي",
    shortName: "ماهر المعيقلي",
    style: "مرتل",
    url: "https://server12.mp3quran.net/maher/001.mp3",
  },
  {
    name: "ياسر الدوسري",
    shortName: "ياسر الدوسري",
    style: "مرتل",
    url: "https://server11.mp3quran.net/yasser/001.mp3",
  },
];

const reviewItems = [
  { id: 1, title: "سورة الفاتحة", meta: "الآيات 1 – 7", state: "مكتمل" },
  { id: 2, title: "سورة البقرة", meta: "الآيات 1 – 5", state: "قيد المراجعة" },
  { id: 3, title: "سورة الكهف", meta: "الآيات 1 – 10", state: "لم تبدأ" },
];

const navItems: {
  id: View;
  label: string;
  shortLabel: string;
  icon: typeof HomeIcon;
}[] = [
  { id: "home", label: "الرئيسية", shortLabel: "الرئيسية", icon: HomeIcon },
  { id: "mushaf", label: "المصحف", shortLabel: "المصحف", icon: BookOpen },
  {
    id: "review",
    label: "المراجعة",
    shortLabel: "المراجعة",
    icon: CalendarCheck2,
  },
  { id: "prayer", label: "الصلاة", shortLabel: "الصلاة", icon: Clock3 },
  { id: "duas", label: "الأدعية", shortLabel: "الأدعية", icon: BookOpen },
  { id: "tasbih", label: "السبحة", shortLabel: "السبحة", icon: Circle },
  { id: "account", label: "حسابي", shortLabel: "حسابي", icon: UserRound },
];

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

function getInitialView(): View {
  if (typeof window === "undefined") return "home";
  if (window.location.pathname === "/mushaf") return "mushaf";
  if (window.location.pathname === "/review") return "review";
  if (window.location.pathname === "/prayer") return "prayer";
  if (window.location.pathname === "/duas") return "duas";
  if (window.location.pathname === "/tasbih") return "tasbih";
  if (window.location.pathname === "/account") return "account";
  return "home";
}

function ArabicLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`brand-mark ${compact ? "brand-mark-compact" : ""}`}
      aria-label="المصحف المديني"
    >
      <div className="brand-seal">
        <span>م</span>
      </div>
      {!compact && (
        <div className="brand-copy">
          <strong>المصحف المديني</strong>
          <small>وردك في صحبةٍ هادئة</small>
        </div>
      )}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function PrayerIcon({ kind }: { kind: string }) {
  if (kind === "fajr") return <Moon size={17} />;
  if (kind === "sunrise") return <Sun size={17} />;
  if (kind === "dhuhr") return <Sun size={18} />;
  if (kind === "asr") return <Sun size={17} />;
  if (kind === "maghrib") return <Moon size={17} />;
  return <Moon size={17} />;
}

export default function Home() {
  const [view, setView] = useState<View>(() => getInitialView());
  const accountSync = useAccountSync();
  const [darkMode, setDarkMode] = usePersistentState("madini-dark", true);
  const [reciterIndex, setReciterIndex] = usePersistentState(
    "madini-reciter",
    0
  );
  const selectedReciter = reciters[reciterIndex] ?? reciters[0];
  const setSelectedReciter = (reciter: Reciter) =>
    setReciterIndex(reciters.indexOf(reciter));
  const [isReciterOpen, setIsReciterOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isSurahListOpen, setIsSurahListOpen] = useState(true);
  const [position, setPosition] = usePersistentState("madini-position", {
    surahNumber: 1,
    verse: 1,
  });
  const selectedSurah =
    surahs.find(item => item.number === position?.surahNumber) ?? surahs[0];
  const activeVerse = Math.max(
    1,
    Math.min(selectedSurah.ayahs, Number(position?.verse) || 1)
  );
  const setActiveVerse = (verse: number) =>
    setPosition({ surahNumber: selectedSurah.number, verse });
  const setSelectedSurah = (surah: (typeof surahs)[number]) => {
    pauseAudio();
    setPosition({ surahNumber: surah.number, verse: 1 });
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    if (window.matchMedia("(max-width: 800px)").matches) {
      setIsSurahListOpen(false);
      window.requestAnimationFrame(() =>
        mushafReaderRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      );
    }
  };
  const {
    quran,
    loading: quranLoading,
    error: quranError,
    retry: retryQuran,
  } = useQuran();
  const currentQuranSurah = quran.find(
    item => item.number === selectedSurah.number
  );
  const verses = currentQuranSurah?.ayahs.map(ayah => ayah.text) ?? [];
  const ayahMetadata = currentQuranSurah?.ayahs[activeVerse - 1];
  const pageSize = 20;
  const verseChunk = Math.floor((activeVerse - 1) / pageSize);
  const visibleAyahs =
    currentQuranSurah?.ayahs.slice(
      verseChunk * pageSize,
      (verseChunk + 1) * pageSize
    ) ?? [];
  const [search, setSearch] = useState("");
  const [bookmarked, setBookmarked] = usePersistentState(
    "madini-bookmarked",
    false
  );
  const [savedBookmark, setSavedBookmark] = usePersistentState<{
    surahNumber: number;
    verse: number;
  } | null>("madini-bookmark-position", null);
  const [fontSize, setFontSize] = usePersistentState("madini-font-size", 29);
  const [isTestMode, setIsTestMode] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [completedReviewIds, setCompletedReviewIds] = usePersistentState<
    number[]
  >("madini-review-completed", []);
  const completedReview = completedReviewIds.includes(selectedSurah.number);
  const setCompletedReview = (_done: boolean) =>
    setCompletedReviewIds(ids => [...new Set([...ids, selectedSurah.number])]);
  const reviewTasks = reviewItems.map(item => ({
    ...item,
    state: completedReviewIds.includes(item.id === 3 ? 18 : item.id)
      ? "مكتمل"
      : "لم تبدأ",
  }));
  const reviewPercent = Math.round(
    (reviewTasks.filter(item => item.state === "مكتمل").length /
      reviewTasks.length) *
      100
  );
  const [activity, setActivity] = usePersistentState<string[]>(
    "madini-activity",
    []
  );
  const [history, setHistory] = usePersistentState<
    { surahNumber: number; name: string; reciter: string; date: string }[]
  >("madini-history", []);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reminders, setReminders] = usePersistentState(
    "madini-reminders",
    false
  );
  const today = new Date().toLocaleDateString("en-CA");
  const dailyDate = new Intl.DateTimeFormat("ar", {
    dateStyle: "full",
    calendar: "islamic-umalqura",
  }).format(new Date());
  const featuredVerse = useMemo(() => {
    const choices = quran.flatMap(surah =>
      surah.ayahs
        .filter(ayah => ayah.text.length <= 220)
        .map(ayah => ({
          surahNumber: surah.number,
          surahName: surahs.find(item => item.number === surah.number)?.name ?? surah.name,
          verseNumber: ayah.numberInSurah,
          text: ayah.text,
        }))
    );
    if (!choices.length) return null;
    const dayNumber = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000);
    const index = ((dayNumber % choices.length) + choices.length) % choices.length;
    return choices[index] ?? null;
  }, [quran, today]);
  const prayer = usePrayerTimes();
  const prayerTimes = prayer.times;
  const nextPrayer = prayer.nextPrayer;
  const selectedCity = prayer.location.label;
  const account = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 60000,
  });
  const userName = account.data?.name || "زائر كريم";
  let streak = 0;
  const cursor = new Date();
  if (!activity.includes(today)) cursor.setDate(cursor.getDate() - 1);
  while (activity.includes(cursor.toLocaleDateString("en-CA"))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const completion = Math.round((activeVerse / selectedSurah.ayahs) * 100);
  const [toast, setToast] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const mushafReaderRef = useRef<HTMLElement | null>(null);
  const quranSearchRef = useRef<HTMLInputElement>(null);
  const notifiedPrayers = useRef(new Set<number>());

  const filteredSurahs = useMemo(() => {
    const term = normalizeArabic(search);
    if (!term) return surahs;
    return surahs.filter(
      surah =>
        normalizeArabic(surah.name).includes(term) ||
        surah.english.toLowerCase().includes(term) ||
        String(surah.number) === term
    );
  }, [search]);

  useEffect(() => {
    if (view !== "mushaf" || quranLoading || quranError) return;
    if (!activity.includes(today))
      setActivity(dates => [...dates, today].slice(-400));
  }, [
    view,
    activeVerse,
    selectedSurah.number,
    quranLoading,
    quranError,
    today,
  ]);

  useEffect(() => {
    if (!reminders) return;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      for (const time of prayerTimes) {
        if (
          time.key === "Sunrise" ||
          now < time.timestamp ||
          now - time.timestamp > 60000
        )
          continue;
        const tag = `madini-notified-${time.timestamp}`;
        if (notifiedPrayers.current.has(time.timestamp)) continue;
        try {
          if (sessionStorage.getItem(tag)) continue;
        } catch {
          /* Storage may be disabled. */
        }
        notifiedPrayers.current.add(time.timestamp);
        try {
          sessionStorage.setItem(tag, "true");
        } catch {
          /* In-memory deduplication remains active. */
        }
        setToast(`حان وقت صلاة ${time.name}`);
        try {
          if ("Notification" in window && Notification.permission === "granted")
            new Notification("المصحف المديني", {
              body: `حان وقت صلاة ${time.name}`,
              icon: "/favicon.svg",
            });
        } catch {
          /* Some mobile browsers allow permission but require push for system notifications. */
        }
      }
    };
    const timer = window.setInterval(check, 15000);
    check();
    return () => window.clearInterval(timer);
  }, [prayerTimes, reminders]);

  async function toggleReminders() {
    if (reminders) {
      setReminders(false);
      return;
    }
    try {
      if ("Notification" in window && Notification.permission === "default")
        await Notification.requestPermission();
    } catch {
      /* The optional in-page reminder still works. */
    }
    setReminders(true);
    setToast("تم تفعيل التذكير أثناء فتح التطبيق؛ إغلاقه يوقف التذكيرات");
  }

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime || 0);
      setProgress(
        audio.duration ? (audio.currentTime / audio.duration) * 100 : 0
      );
    };
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    const onError = () => {
      setIsPlaying(false);
      setToast("تعذر تحميل التلاوة. جرّب قارئًا آخر أو تحقق من الاتصال.");
    };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [selectedReciter, selectedSurah.number]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${selectedSurah.name} · الآية ${activeVerse}`,
      artist: selectedReciter.name,
      album: "المصحف المديني",
    });
    navigator.mediaSession.setActionHandler("play", () => void playAudio());
    navigator.mediaSession.setActionHandler("pause", () => pauseAudio());
    navigator.mediaSession.setActionHandler("seekbackward", () => seekBy(-10));
    navigator.mediaSession.setActionHandler("seekforward", () => seekBy(10));
    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("seekbackward", null);
        navigator.mediaSession.setActionHandler("seekforward", null);
      } catch {
        // Some browsers expose Media Session partially.
      }
    };
  }, [selectedReciter, selectedSurah, activeVerse]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onPopState = () => setView(getInitialView());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  async function playAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setIsPlaying(true);
      setHistory(items =>
        [
          {
            surahNumber: selectedSurah.number,
            name: selectedSurah.name,
            reciter: selectedReciter.shortName,
            date: new Date().toISOString(),
          },
          ...items,
        ].slice(0, 30)
      );
      if ("mediaSession" in navigator)
        navigator.mediaSession.playbackState = "playing";
    } catch {
      setToast("اضغط تشغيل لبدء التلاوة من جهازك");
    }
  }

  function pauseAudio() {
    audioRef.current?.pause();
    setIsPlaying(false);
    if ("mediaSession" in navigator)
      navigator.mediaSession.playbackState = "paused";
  }

  function toggleAudio() {
    if (isPlaying) pauseAudio();
    else void playAudio();
  }

  function seekBy(amount: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(
      0,
      Math.min(audio.duration || duration, audio.currentTime + amount)
    );
    setCurrentTime(audio.currentTime);
  }

  function updateProgress(value: number) {
    const audio = audioRef.current;
    const nextTime = ((audio?.duration || duration) * value) / 100;
    if (audio) audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    setProgress(value);
  }

  function chooseReciter(reciter: Reciter) {
    pauseAudio();
    setSelectedReciter(reciter);
    setIsReciterOpen(false);
    setToast(`تم اختيار تلاوة ${reciter.shortName}`);
  }

  function saveBookmark() {
    const samePosition =
      savedBookmark?.surahNumber === selectedSurah.number &&
      savedBookmark?.verse === activeVerse;
    const next = !bookmarked || !samePosition;
    setBookmarked(next);
    setSavedBookmark(
      next
        ? {
            surahNumber: selectedSurah.number,
            verse: activeVerse,
          }
        : null
    );
    setToast(next ? "تم حفظ موضع القراءة" : "أزيلت العلامة المرجعية");
  }

  function startReview() {
    selectView("review");
    setIsTestMode(true);
    setRevealed(false);
  }

  function selectView(nextView: View) {
    setView(nextView);
    window.history.pushState(
      {},
      "",
      nextView === "home" ? "/" : `/${nextView}`
    );
  }

  function openQuranSearch() {
    selectView("mushaf");
    window.requestAnimationFrame(() => quranSearchRef.current?.focus());
  }

  return (
    <div className="app-shell">
      <audio
        ref={audioRef}
        src={selectedReciter.url.replace(
          "001.mp3",
          `${String(selectedSurah.number).padStart(3, "0")}.mp3`
        )}
        preload="none"
      />
      <aside className="sidebar">
        <ArabicLogo />
        <div className="sidebar-rule" />
        <nav className="side-nav" aria-label="التنقل الرئيسي">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${view === item.id ? "active" : ""}`}
                onClick={() => selectView(item.id)}
                aria-current={view === item.id ? "page" : undefined}
              >
                <Icon size={19} strokeWidth={view === item.id ? 2.2 : 1.7} />
                <span>{item.label}</span>
                {view === item.id && <i />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="side-utility"
            onClick={() => selectView("account")}
          >
            <Settings2 size={17} />
            <span>الإعدادات</span>
          </button>
          <button
            className="side-utility"
            onClick={() => selectView("account")}
          >
            <UserRound size={17} />
            <span>حسابي</span>
          </button>
          <div className="sidebar-profile">
            <div className="avatar">م</div>
            <div>
              <strong>{userName}</strong>
              <small>
                {account.data ? "حسابك متصل" : "وردك محفوظ على جهازك"}
              </small>
            </div>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-logo">
            <ArabicLogo compact />
          </div>
          <div className="breadcrumbs">
            <span>المصحف المديني</span>
            <ChevronLeft size={14} />
            <strong>
              {view === "home"
                ? "لوحة الورد"
                : navItems.find(item => item.id === view)?.label}
            </strong>
          </div>
          <div className="topbar-actions">
            {view !== "home" && (
              <button
                className="topbar-home-button"
                onClick={() => selectView("home")}
                aria-label="العودة إلى الصفحة الرئيسية"
                title="العودة إلى الصفحة الرئيسية"
              >
                <HomeIcon size={17} />
                <span>الرئيسية</span>
              </button>
            )}
            <button
              className="icon-button muted"
              onClick={openQuranSearch}
              aria-label="البحث عن سورة"
              title="البحث عن سورة"
            >
              <Search size={18} />
            </button>
            <button
              className="icon-button muted"
              onClick={() => setDarkMode(current => !current)}
              aria-label={darkMode ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
              aria-pressed={darkMode}
              title={darkMode ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {!account.data && view !== "account" ? (
              <button
                className="topbar-login-button"
                onClick={() => selectView("account")}
                aria-label="تسجيل الدخول أو إنشاء حساب"
              >
                <LogIn size={16} />
                <span>تسجيل الدخول</span>
              </button>
            ) : account.data ? (
              <button className="user-chip" onClick={() => selectView("account")}>
                <div className="avatar small">م</div>
                <span>{userName}</span>
                <ChevronDown size={15} />
              </button>
            ) : null}
          </div>
        </header>

        <div className="mobile-tabs">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={view === item.id ? "active" : ""}
                onClick={() => selectView(item.id)}
                aria-current={view === item.id ? "page" : undefined}
              >
                <Icon size={17} />
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {view === "home" && (
          <div className="page-content">
            <section className="welcome-row">
              <div>
                <span className="eyebrow">{dailyDate}</span>
                <h1>
                  السلام عليكم، <em>{account.data?.name || "يا كريم"}</em>
                </h1>
                <p>اقترب قليلًا من كتاب الله اليوم. وردك ينتظرك.</p>
              </div>
              <div className="streak-pill">
                <Flame size={17} fill="currentColor" />
                <span>
                  <strong>{streak.toLocaleString("ar")}</strong> يومًا متتاليًا
                </span>
              </div>
            </section>

            <section className="featured-verse-card" aria-labelledby="featured-verse-title">
              <div className="featured-verse-topline">
                <span className="featured-verse-label" id="featured-verse-title"><Sparkles size={16} /> آية اليوم</span>
                <span className="featured-verse-date">{dailyDate}</span>
              </div>
              {featuredVerse ? (
                <>
                  <blockquote className="featured-verse-text">{featuredVerse.text}</blockquote>
                  <div className="featured-verse-footer">
                    <cite className="featured-verse-reference">سورة {featuredVerse.surahName} <span>·</span> الآية {featuredVerse.verseNumber.toLocaleString("ar")}</cite>
                    <button
                      className="featured-verse-action"
                      onClick={() => {
                        setPosition({ surahNumber: featuredVerse.surahNumber, verse: featuredVerse.verseNumber });
                        selectView("mushaf");
                      }}
                    >
                      اقرأها في المصحف <ArrowLeft size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <p className="featured-verse-loading" role="status">
                  {quranError ? "تعذر تحميل آية اليوم؛ تحقق من اتصالك بالإنترنت." : "جارٍ تحضير آية اليوم…"}
                </p>
              )}
            </section>

            <section className="hero-grid">
              <div className="daily-card panel-glow">
                <div className="daily-pattern" />
                <div className="daily-card-top">
                  <span className="gold-dot" /> <span>وردك اليومي</span>
                  <button
                    className="kebab"
                    aria-label="إعدادات الورد"
                    onClick={() => selectView("account")}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </div>
                <div className="daily-card-body">
                  <div className="daily-copy">
                    <span className="eyebrow">أكمل من حيث توقفت</span>
                    <h2>{selectedSurah.name}</h2>
                    <p>
                      الآية {activeVerse} <span>من {selectedSurah.ayahs}</span>
                    </p>
                    <div className="progress-line">
                      <i style={{ width: `${completion}%` }} />
                    </div>
                    <span className="progress-caption">
                      {completion}٪ من السورة
                    </span>
                  </div>
                  <div className="seal-progress">
                    <svg viewBox="0 0 120 120">
                      <circle className="seal-track" cx="60" cy="60" r="49" />
                      <circle
                        className="seal-fill"
                        cx="60"
                        cy="60"
                        r="49"
                        style={{
                          strokeDashoffset: 308 * (1 - completion / 100),
                        }}
                      />
                    </svg>
                    <div>
                      <strong>{activeVerse}</strong>
                      <small>موضع القراءة</small>
                    </div>
                  </div>
                </div>
                <div className="daily-card-footer">
                  <button
                    className="primary-button"
                    onClick={() => selectView("mushaf")}
                  >
                    <BookOpen size={17} /> متابعة القراءة{" "}
                    <ArrowLeft size={16} />
                  </button>
                  <button className="text-button" onClick={saveBookmark}>
                    {bookmarked ? (
                      <BookmarkCheck size={16} />
                    ) : (
                      <Bookmark size={16} />
                    )}{" "}
                    {bookmarked ? "محفوظ" : "حفظ الموضع"}
                  </button>
                </div>
              </div>
              <div className="next-prayer-card">
                <div className="card-label-row">
                  <span>
                    <Clock3 size={16} /> الصلاة القادمة
                  </span>
                  <button
                    className="text-button"
                    onClick={() => selectView("prayer")}
                  >
                    كل المواقيت <ArrowLeft size={15} />
                  </button>
                </div>
                <div className="next-prayer-main">
                  <div className="prayer-orb">
                    <Moon size={28} />
                  </div>
                  <div>
                    <span className="eyebrow">
                      {prayer.loading
                        ? "جارٍ تحديث المواقيت"
                        : nextPrayer
                          ? `متبقي ${prayer.countdown}`
                          : "تعذر تحميل المواقيت"}
                    </span>
                    <h3>{nextPrayer?.name || "—"}</h3>
                    <strong>{nextPrayer?.time || "—"}</strong>
                  </div>
                </div>
                <div className="prayer-location">
                  <MapPin size={14} /> {selectedCity}
                  <span>•</span>
                  <button onClick={prayer.requestLocation}>تحديث الموقع</button>
                </div>
                <div className="mini-prayer-strip">
                  {prayerTimes.slice(1, 4).map(prayer => (
                    <div key={prayer.name}>
                      <span>{prayer.name}</span>
                      <strong>{prayer.time}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="content-grid home-sections">
              <div className="main-column">
                <SectionHeading
                  eyebrow="استمع بخشوع"
                  title="تلاوتك الأخيرة"
                  description="جلسة هادئة، آية بعد آية."
                  action={
                    <button
                      className="text-button"
                      onClick={() => setHistoryOpen(true)}
                    >
                      عرض السجل <ArrowLeft size={15} />
                    </button>
                  }
                />
                <div className="recitation-card">
                  <div className="recitation-art">
                    <Headphones size={27} />
                    <span>١</span>
                  </div>
                  <div className="recitation-info">
                    <span className="eyebrow">آخر استماع</span>
                    <h3>{selectedSurah.name}</h3>
                    <p>تلاوة السورة كاملة · {selectedReciter.shortName}</p>
                  </div>
                  <button className="round-play" onClick={toggleAudio}>
                    {isPlaying ? (
                      <Pause size={19} fill="currentColor" />
                    ) : (
                      <Play size={19} fill="currentColor" />
                    )}
                  </button>
                  <div className="waveform" aria-hidden="true">
                    {Array.from({ length: 24 }).map((_, index) => (
                      <i
                        key={index}
                        style={{ height: `${24 + ((index * 17) % 30)}%` }}
                      />
                    ))}
                  </div>
                  <span className="duration">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <SectionHeading
                  eyebrow="رفقة يومية"
                  title="اختصارات نافعة"
                  description="اختر ما يناسب وقتك الآن."
                />
                <div className="quick-actions">
                  <button onClick={() => selectView("mushaf")}>
                    <span className="quick-icon amber">
                      <BookOpen size={20} />
                    </span>
                    <span>
                      <strong>افتح المصحف</strong>
                      <small>قراءة هادئة بلا تشتيت</small>
                    </span>
                    <ChevronLeft size={17} />
                  </button>
                  <button onClick={startReview}>
                    <span className="quick-icon sage">
                      <RotateCcw size={20} />
                    </span>
                    <span>
                      <strong>ابدأ المراجعة</strong>
                      <small>اختر سورة وسمّع من حفظك</small>
                    </span>
                    <ChevronLeft size={17} />
                  </button>
                  <button onClick={() => selectView("prayer")}>
                    <span className="quick-icon blue">
                      <Compass size={20} />
                    </span>
                    <span>
                      <strong>اتجاه القبلة</strong>
                      <small>اعرف اتجاه قبلتك</small>
                    </span>
                    <ChevronLeft size={17} />
                  </button>
                  <button onClick={() => selectView("duas")}>
                    <span className="quick-icon amber">
                      <BookOpen size={20} />
                    </span>
                    <span>
                      <strong>دعاء يرافق يومك</strong>
                      <small>أدعية قرآنية موثقة</small>
                    </span>
                    <ChevronLeft size={17} />
                  </button>
                  <button onClick={() => selectView("tasbih")}>
                    <span className="quick-icon sage">
                      <Circle size={20} />
                    </span>
                    <span>
                      <strong>سبحتك الإلكترونية</strong>
                      <small>ذكر، عدّاد وهدف شخصي</small>
                    </span>
                    <ChevronLeft size={17} />
                  </button>
                  <button onClick={toggleReminders}>
                    <span className="quick-icon blue">
                      <Clock3 size={20} />
                    </span>
                    <span>
                      <strong>
                        {reminders ? "إيقاف التذكيرات" : "تذكير الصلاة"}
                      </strong>
                      <small>يعمل أثناء فتح التطبيق فقط</small>
                    </span>
                    <ChevronLeft size={17} />
                  </button>
                </div>
              </div>
              <aside className="side-column">
                <SectionHeading
                  eyebrow="خطوتك التالية"
                  title="خطة المراجعة"
                  action={
                    <button
                      className="icon-button subtle"
                      onClick={() => selectView("review")}
                    >
                      <ArrowLeft size={16} />
                    </button>
                  }
                />
                <div className="review-mini-card">
                  <div className="review-score">
                    <strong>{reviewPercent}</strong>
                    <span>%</span>
                    <small>أنجزت اليوم</small>
                  </div>
                  <div className="review-mini-list">
                    {reviewTasks.map(item => (
                      <div key={item.id}>
                        <span
                          className={`status-dot ${item.state === "مكتمل" ? "done" : item.state === "قيد المراجعة" ? "current" : ""}`}
                        >
                          {item.state === "مكتمل" ? (
                            <Check size={11} />
                          ) : (
                            item.id
                          )}
                        </span>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.meta}</small>
                        </div>
                        <span className="review-status">{item.state}</span>
                      </div>
                    ))}
                  </div>
                  <button className="wide-button" onClick={startReview}>
                    متابعة المراجعة <ArrowLeft size={15} />
                  </button>
                </div>
              </aside>
            </section>
          </div>
        )}

        {view === "mushaf" && (
          <div className="page-content quran-page">
            <section className="reader-header">
              <div>
                <span className="eyebrow">القرآن الكريم</span>
                <h1>المصحف</h1>
                <p>قراءة على مهل، وقلب حاضر.</p>
              </div>
              <div className="reader-actions">
                <button
                  className="outline-button"
                  onClick={() => setFontSize(size => Math.min(36, size + 2))}
                >
                  تكبير النص
                </button>
                  <button
                    className="icon-button subtle"
                    onClick={() => setFontSize(size => Math.max(23, size - 2))}
                    aria-label="تصغير نص المصحف"
                  >
                    أصغر
                  </button>
                  <button
                    className={`icon-button subtle ${bookmarked ? "selected" : ""}`}
                    onClick={saveBookmark}
                    aria-label={bookmarked ? "إزالة العلامة المرجعية" : "حفظ موضع القراءة"}
                    aria-pressed={bookmarked}
                  >
                  {bookmarked ? (
                    <BookmarkCheck size={18} />
                  ) : (
                    <Bookmark size={18} />
                  )}
                </button>
                {bookmarked && savedBookmark && (
                  <button
                    className="outline-button"
                    onClick={() => {
                      pauseAudio();
                      setPosition(savedBookmark);
                      setToast("تم فتح العلامة المحفوظة");
                    }}
                  >
                    اذهب للعلامة
                  </button>
                )}
              </div>
            </section>
            <div className="quran-layout">
              <aside className={`surah-panel ${isSurahListOpen ? "surah-panel-open" : "surah-panel-collapsed"}`}>
                <div className="surah-panel-head">
                  <div>
                    <span className="eyebrow">السور</span>
                    <strong>فهرس القرآن</strong>
                    <small className="surah-count">
                      {surahs.length.toLocaleString("ar")} سورة
                    </small>
                  </div>
                  <button
                    type="button"
                    className="surah-index-toggle icon-button subtle"
                    title={isSurahListOpen ? "طي فهرس السور" : "عرض فهرس السور"}
                    aria-label={isSurahListOpen ? "طي فهرس السور" : "عرض أسماء السور"}
                    aria-expanded={isSurahListOpen}
                    aria-controls="surah-index-list"
                    onClick={() => setIsSurahListOpen(open => !open)}
                  >
                    <ListMusic size={17} />
                    <span className="surah-index-toggle-label">
                      {isSurahListOpen ? "طي الفهرس" : "عرض السور"}
                    </span>
                  </button>
                </div>
                <div
                  id="surah-index-list"
                  className="surah-index-content"
                  hidden={!isSurahListOpen}
                >
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      ref={quranSearchRef}
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                      placeholder="ابحث عن سورة"
                      aria-label="البحث عن سورة أو رقمها"
                    />
                  </label>
                  <div className="surah-list">
                    {filteredSurahs.map(surah => (
                      <button
                        key={surah.number}
                        className={`surah-row ${selectedSurah.number === surah.number ? "active" : ""}`}
                        onClick={() => setSelectedSurah(surah)}
                      >
                        <span className="surah-number">{surah.number}</span>
                        <span>
                          <strong>{surah.name}</strong>
                          <small>{surah.english}</small>
                        </span>
                        <em>{surah.ayahs}</em>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
              <article className="mushaf-reader" ref={mushafReaderRef}>
                <div className="reader-topline">
                  <span>الجزء {ayahMetadata?.juz ?? "—"}</span>
                  <span>ربع الحزب {ayahMetadata?.hizbQuarter ?? "—"}</span>
                  <span>صفحة المصدر {ayahMetadata?.page ?? "—"}</span>
                </div>
                <div className="surah-title">
                  <div className="ornament-line" />
                  <div className="surah-title-inner">
                    <span>
                      سُورَةٌ{" "}
                      {selectedSurah.place === "مدنية"
                        ? "مَدَنِيَّة"
                        : "مَكِّيَّة"}
                    </span>
                    <h2>{selectedSurah.name}</h2>
                    <small>{selectedSurah.ayahs} آية</small>
                  </div>
                  <div className="ornament-line flip" />
                </div>
                <label className="verse-jump">
                  انتقل إلى الآية{" "}
                  <input
                    type="number"
                    min={1}
                    max={selectedSurah.ayahs}
                    value={activeVerse}
                    onChange={event => {
                      const value = Number(event.target.value);
                      if (value >= 1 && value <= selectedSurah.ayahs)
                        setActiveVerse(value);
                    }}
                  />
                </label>
                {quranLoading && (
                  <p role="status">جارٍ تحميل المصحف الكامل...</p>
                )}
                {quranError && (
                  <div role="alert">
                    <p>{quranError}</p>
                    <button className="outline-button" onClick={retryQuran}>
                      إعادة المحاولة
                    </button>
                  </div>
                )}
                <div className="ayahs" style={{ fontSize: `${fontSize}px` }}>
                  {visibleAyahs.map(ayah => (
                    <button
                      key={ayah.number}
                      className={`ayah-line ${activeVerse === ayah.numberInSurah ? "active" : ""}`}
                      onClick={() => setActiveVerse(ayah.numberInSurah)}
                    >
                      <span className="ayah-number">{ayah.numberInSurah}</span>
                      <span>{ayah.text}</span>
                    </button>
                  ))}
                </div>
                <div className="reader-bottom">
                  <button
                    className="page-turn"
                    disabled={selectedSurah.number === 1 && verseChunk === 0}
                    onClick={() =>
                      verseChunk > 0
                        ? setActiveVerse((verseChunk - 1) * pageSize + 1)
                        : setSelectedSurah(surahs[selectedSurah.number - 2])
                    }
                  >
                    <ChevronRight size={18} /> السابق
                  </button>
                  <span>
                    عرض الآيات {verseChunk * pageSize + 1} –{" "}
                    {Math.min((verseChunk + 1) * pageSize, selectedSurah.ayahs)}
                  </span>
                  <button
                    className="page-turn"
                    disabled={
                      selectedSurah.number === 114 &&
                      (verseChunk + 1) * pageSize >= selectedSurah.ayahs
                    }
                    onClick={() =>
                      (verseChunk + 1) * pageSize < selectedSurah.ayahs
                        ? setActiveVerse((verseChunk + 1) * pageSize + 1)
                        : setSelectedSurah(surahs[selectedSurah.number])
                    }
                  >
                    التالي <ChevronLeft size={18} />
                  </button>
                </div>
                <p className="source-note">
                  نص عثماني كامل من{" "}
                  <a
                    href="https://alquran.cloud"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Al Quran Cloud
                  </a>{" "}
                  — عرض نصي وليس صور صفحات مصحف المدينة.
                </p>
              </article>
            </div>
          </div>
        )}

        {view === "review" && (
          <div className="page-content review-page">
            <section className="welcome-row">
              <div>
                <span className="eyebrow">المراجعة والتسميع</span>
                <h1>
                  ثبّت حفظك، <em>بهدوء</em>
                </h1>
                <p>قسّم وردك، استمع، ثم سمّع لنفسك بثقة.</p>
              </div>
              <div className="review-date">
                <CalendarCheck2 size={17} />
                <span>خطة اليوم · ٣ مهام</span>
              </div>
            </section>
            <section className="review-overview">
              <div className="overview-progress">
                <div className="large-ring">
                  <svg viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="68" className="ring-track" />
                    <circle
                      cx="80"
                      cy="80"
                      r="68"
                      className="ring-fill"
                      style={{
                        strokeDashoffset: 427 * (1 - reviewPercent / 100),
                      }}
                    />
                  </svg>
                  <div>
                    <strong>
                      {reviewPercent}
                      <small>%</small>
                    </strong>
                    <span>منجز اليوم</span>
                  </div>
                </div>
                <div>
                  <span className="eyebrow">رحلتك مستمرة</span>
                  <h2>أحسنت، بقي القليل</h2>
                  <p>
                    سجّلت {streak} أيام متتالية. اختر سورة من المصحف، ثم راجعها
                    من حفظك.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setIsTestMode(true);
                      setRevealed(false);
                    }}
                  >
                    ابدأ التسميع <Play size={16} fill="currentColor" />
                  </button>
                </div>
              </div>
              <div className="review-stats">
                <div>
                  <strong>{streak}</strong>
                  <span>أيام متتالية</span>
                </div>
                <div>
                  <strong>٣</strong>
                  <span>مهام اليوم</span>
                </div>
                <div>
                  <strong>{completedReviewIds.length}</strong>
                  <span>سور راجعتها</span>
                </div>
              </div>
            </section>
            <div className="review-layout">
              <section>
                <SectionHeading
                  eyebrow="مراجعة اليوم"
                  title="خطتك المختصرة"
                  description="تقدم صغير كل يوم، حفظ راسخ كل أسبوع."
                />
                <div className="review-tasks">
                  {reviewTasks.map(item => (
                    <div
                      key={item.id}
                      className={`review-task ${item.state === "قيد المراجعة" ? "current" : ""}`}
                    >
                      <div className="task-status">
                        {item.state === "مكتمل" ? (
                          <CheckCircle2 size={20} />
                        ) : item.state === "قيد المراجعة" ? (
                          <Timer size={20} />
                        ) : (
                          <Circle size={20} />
                        )}
                      </div>
                      <div className="task-copy">
                        <strong>{item.title}</strong>
                        <span>{item.meta}</span>
                      </div>
                      <span className="task-state">{item.state}</span>
                      <button
                        className="icon-button subtle"
                        onClick={() => {
                          setSelectedSurah(
                            surahs[(item.id === 3 ? 18 : item.id) - 1]
                          );
                          setIsTestMode(true);
                          setRevealed(false);
                        }}
                      >
                        {item.state === "مكتمل" ? (
                          <RotateCcw size={16} />
                        ) : (
                          <ArrowLeft size={16} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              <aside className="test-card">
                <div className="test-card-glow" />
                <div className="test-card-head">
                  <span className="quick-icon sage">
                    <Headphones size={19} />
                  </span>
                  <span className="eyebrow">وضع التسميع</span>
                </div>
                <h3>اختبر حفظك دون تردد</h3>
                <p>أخفِ الآيات، اقرأ من حفظك، ثم اكشف النص للمراجعة.</p>
                <div className="test-select">
                  <span>النطاق</span>
                  <strong>
                    {selectedSurah.name} · {selectedSurah.ayahs} آية
                  </strong>
                  <ChevronDown size={15} />
                </div>
                <button
                  className="wide-button"
                  onClick={() => {
                    setIsTestMode(true);
                    setRevealed(false);
                  }}
                >
                  ابدأ الاختبار <ArrowLeft size={15} />
                </button>
              </aside>
            </div>
            {isTestMode && (
              <div className="test-modal">
                <div className="test-modal-card">
                  <button
                    className="close-button"
                    aria-label="إغلاق التسميع"
                    onClick={() => setIsTestMode(false)}
                  >
                    <X size={18} />
                  </button>
                  <span className="eyebrow">تسميع {selectedSurah.name}</span>
                  <p className="source-note">
                    مراجعة ذاتية؛ لا يسجّل التطبيق صوتك ولا يقيّم صحة التسميع
                    آليًا.
                  </p>
                  <h2>
                    الآية {activeVerse} من {selectedSurah.ayahs}
                  </h2>
                  <div className={`hidden-verse ${revealed ? "revealed" : ""}`}>
                    {revealed ? (
                      verses[activeVerse - 1] || "جارٍ تحميل الآية..."
                    ) : (
                      <>
                        <LockKeyhole size={24} />
                        <span>النص مخفي — سمّع من حفظك</span>
                      </>
                    )}
                  </div>
                  <div className="test-actions">
                    <button
                      className="outline-button"
                      onClick={() => setRevealed(current => !current)}
                    >
                      {revealed ? <EyeOff size={16} /> : <Eye size={16} />}{" "}
                      {revealed ? "إخفاء النص" : "كشف النص"}
                    </button>
                    <button
                      className="outline-button"
                      disabled={activeVerse >= selectedSurah.ayahs}
                      onClick={() => {
                        setActiveVerse(
                          Math.min(activeVerse + 1, selectedSurah.ayahs)
                        );
                        setRevealed(false);
                      }}
                    >
                      الآية التالية
                    </button>
                    <button
                      className="primary-button"
                      onClick={() => {
                        setCompletedReview(true);
                        setToast("أحسنت، تم تسجيل المراجعة");
                        setIsTestMode(false);
                      }}
                    >
                      تم التسميع <Check size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === "prayer" && (
          <PrayerPage prayer={prayer} onTasbih={() => selectView("tasbih")} />
        )}
        {view === "duas" && <DuaPage notify={setToast} />}
        {view === "tasbih" && <TasbihPage notify={setToast} />}
        {view === "account" && (
          <AccountPage notify={setToast} sync={accountSync} />
        )}
        {historyOpen && (
          <div
            className="test-modal"
            role="dialog"
            aria-modal="true"
            aria-label="سجل الاستماع"
          >
            <div className="test-modal-card history-dialog">
              <button
                className="close-button"
                aria-label="إغلاق"
                onClick={() => setHistoryOpen(false)}
              >
                <X size={18} />
              </button>
              <h2>سجل استماعك</h2>
              {!history.length && (
                <p>لم تبدأ تلاوة بعد. اختر قارئًا واضغط تشغيل.</p>
              )}
              {history.map((item, index) => (
                <button
                  key={`${item.date}-${index}`}
                  className="history-item"
                  onClick={() => {
                    setSelectedSurah(surahs[item.surahNumber - 1]);
                    setHistoryOpen(false);
                    selectView("mushaf");
                  }}
                >
                  <strong>{item.name}</strong>
                  <span>
                    {item.reciter} ·{" "}
                    {new Date(item.date).toLocaleDateString("ar")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <div className="player-bar">
        <div className="player-details">
          <div className="mini-cover">
            <Volume2 size={18} />
          </div>
          <div>
            <strong>{selectedSurah.name}</strong>
            <span>{selectedReciter.shortName}</span>
          </div>
        </div>
        <div className="player-center">
          <div className="player-controls">
            <button onClick={() => seekBy(-10)} aria-label="رجوع 10 ثوان">
              <SkipForward size={17} className="rtl-icon" />
            </button>
            <button className="player-play" onClick={toggleAudio}>
              {isPlaying ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" />
              )}
            </button>
            <button onClick={() => seekBy(10)} aria-label="تقديم 10 ثوان">
              <SkipBack size={17} className="rtl-icon" />
            </button>
          </div>
          <div className="player-progress">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={event => updateProgress(Number(event.target.value))}
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        <div className="player-options">
          <div className="reciter-dropdown">
            <button
              className="player-reciter"
              onClick={() => setIsReciterOpen(open => !open)}
            >
              <span>القارئ</span>
              <strong>{selectedReciter.shortName}</strong>
              <ChevronDown size={14} />
            </button>
            {isReciterOpen && (
              <div className="reciter-menu">
                {reciters.map(reciter => (
                  <button
                    key={reciter.name}
                    onClick={() => chooseReciter(reciter)}
                  >
                    <span>{reciter.shortName}</span>
                    <small>{reciter.style}</small>
                    {selectedReciter.name === reciter.name && (
                      <Check size={15} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="speed-button"
            onClick={() => {
              const next = playbackRate >= 1.5 ? 0.75 : playbackRate + 0.25;
              setPlaybackRate(next);
              if (audioRef.current) audioRef.current.playbackRate = next;
            }}
          >
            {playbackRate}x
          </button>
          <button
            className="icon-button player-more"
            onClick={() => setToast("يمكنك متابعة التلاوة حتى مع قفل الشاشة")}
          >
            <Headphones size={17} />
          </button>
        </div>
      </div>

      {toast && (
        <div className="toast">
          <CheckCircle2 size={17} /> {toast}
        </div>
      )}
    </div>
  );
}
