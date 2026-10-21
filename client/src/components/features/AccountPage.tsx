import { LogIn, LogOut, BellRing, Cloud, Download, HelpCircle, LoaderCircle, ShieldCheck, UserRound, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { announceMadiniDataChange, useAccountSync, type AccountSyncState } from "@/hooks/useAccountSync";
import { trpc } from "@/lib/trpc";
import "./account.css";

type Health = { status: "ready" | "configuration_incomplete"; missing: string[]; emailConfigured: boolean };
export type AccountPageProps = {
  notify: (message: string) => void;
  sync?: AccountSyncState;
};

function getReminderValue(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem("madini-reminders") === "true";
}

export function AccountPage({ notify, sync }: AccountPageProps) {
  const localAccount = useAccountSync({ active: !sync });
  const account = sync ?? localAccount;
  const [health, setHealth] = useState<Health | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(getReminderValue);
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requestPasswordReset = trpc.auth.requestPasswordReset.useMutation();

  useEffect(() => {
    let active = true;
    void fetch("/api/health", { headers: { Accept: "application/json" } })
      .then(async response => (response.ok ? response.json() : Promise.reject(new Error("health failed"))))
      .then((value: Health) => { if (active) setHealth(value); })
      .catch(() => { if (active) setHealth({ status: "configuration_incomplete", missing: ["خدمة API غير متاحة"], emailConfigured: false }); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const syncReminder = () => setRemindersEnabled(getReminderValue());
    window.addEventListener("madini-data-restored", syncReminder);
    return () => window.removeEventListener("madini-data-restored", syncReminder);
  }, []);

  async function toggleReminders(nextEnabled: boolean) {
    if (!nextEnabled) {
      window.localStorage.setItem("madini-reminders", "false");
      setRemindersEnabled(false);
      announceMadiniDataChange(["madini-reminders"]);
      notify("تم إيقاف تذكيرات الصفحة.");
      return;
    }
    if (!("Notification" in window)) {
      notify("لا يدعم هذا المتصفح إذن الإشعارات.");
      return;
    }
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") {
      notify("لم يُمنح إذن الإشعارات؛ يمكنك تفعيله من إعدادات المتصفح.");
      return;
    }
    window.localStorage.setItem("madini-reminders", "true");
    setRemindersEnabled(true);
    announceMadiniDataChange(["madini-reminders"]);
    notify("تم تفعيل تذكيرات الصفحة أثناء فتح الموقع.");
  }

  async function signOut() {
    try {
      await account.logout();
      notify("تم تسجيل الخروج من الحساب.");
    } catch {
      notify("تعذر تسجيل الخروج الآن. حاول مرة أخرى.");
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");
    setSubmitting(true);
    try {
      if (mode === "forgot") {
        await requestPasswordReset.mutateAsync({ email });
        setAuthNotice("إذا كان البريد مسجلًا، فستصلك رسالة برابط الاستعادة خلال دقائق.");
        return;
      }
      const success = mode === "register"
        ? await account.register({ name, email, password })
        : await account.login({ email, password });
      if (!success) throw new Error(mode === "register" ? "تعذر إنشاء الحساب. ربما البريد مسجل بالفعل." : "البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      setPassword("");
      notify(mode === "register" ? "تم إنشاء الحساب وتسجيل الدخول." : "تم تسجيل الدخول.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر تسجيل الدخول الآن.";
      setAuthError(message.includes("تعذر") || message.includes("البريد") || message.includes("محاولات") ? message : "تعذر إتمام الطلب. تحقق من البيانات وحاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="account-page" dir="rtl" aria-labelledby="account-title">
      <header className="account-heading">
        <div className="account-heading-icon"><UserRound size={22} /></div>
        <div><span>الحساب والإعدادات</span><h1 id="account-title">بياناتك في صحبة آمنة</h1><p>حساب مستقل بالبريد وكلمة مرور، مع مزامنة بياناتك عبر قاعدة بيانات الموقع.</p></div>
      </header>

      {health?.status === "configuration_incomplete" && (
        <div className="account-alert" role="status">
          <ShieldCheck size={19} />
          <div><strong>إعداد الموقع غير مكتمل</strong><p>يلزم إعداد قاعدة البيانات وسر الجلسة في استضافة الموقع. أسماء المتغيرات المطلوبة: {health.missing.join("، ")}. لا تُعرض أي قيمة سرية هنا.</p></div>
        </div>
      )}

      <div className="account-grid">
        <article className="account-card account-profile-card">
          <div className="account-card-top"><Cloud size={19} /><span>الحساب المستقل</span></div>
          {account.authLoading ? <div className="account-loading"><LoaderCircle className="account-spin" size={20} /> جارٍ التحقق من الجلسة…</div> : account.isAuthenticated && account.user ? (
            <>
              <div className="account-identity"><div className="account-avatar">{(account.user.name || "م").trim().slice(0, 1)}</div><div><strong>{account.user.name || "مستخدم"}</strong><small>{account.user.email}</small></div></div>
              <p className="account-copy">{account.hydrated ? account.syncMessage : "جارٍ استعادة بيانات حسابك قبل بدء المزامنة…"}</p>
              <div className="account-actions"><button className="account-button account-button-muted" type="button" onClick={() => void account.refresh()}>تحديث الاستعادة</button><button className="account-button account-button-danger" type="button" onClick={() => void signOut()}><LogOut size={16} /> تسجيل الخروج</button></div>
            </>
          ) : (
            <>
              <div className="account-auth-tabs" role="tablist" aria-label="نوع الدخول">
                <button type="button" className={mode === "login" || mode === "forgot" ? "active" : ""} onClick={() => { setMode("login"); setAuthError(""); setAuthNotice(""); }}><LogIn size={15} /> دخول</button>
                <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setAuthError(""); setAuthNotice(""); }}><UserPlus size={15} /> حساب جديد</button>
              </div>
              <form className="account-auth-form" onSubmit={event => void submitAuth(event)}>
                {mode === "register" && <label className="account-field">الاسم<input className="account-input" autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>}
                <label className="account-field">البريد الإلكتروني<input className="account-input" type="email" dir="ltr" autoComplete="email" required maxLength={320} value={email} onChange={event => setEmail(event.target.value)} /></label>
                {mode !== "forgot" && <label className="account-field">كلمة المرور<input className="account-input" type="password" dir="ltr" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={10} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} />{mode === "register" && <small>10 أحرف على الأقل.</small>}</label>}
                {mode === "login" && <button type="button" className="account-text-action" onClick={() => { setMode("forgot"); setAuthError(""); setAuthNotice(""); }}>نسيت كلمة المرور؟</button>}
                {mode === "forgot" && !health?.emailConfigured && <p className="account-copy" role="status">إرسال رسائل الاستعادة غير مفعّل بعد. يلزم إعداد خادم البريد في استضافة الموقع.</p>}
                {authError && <p className="account-auth-error" role="alert">{authError}</p>}
                {authNotice && <p className="account-copy" role="status">{authNotice}</p>}
                {mode === "forgot" && <button type="button" className="account-text-action" onClick={() => { setMode("login"); setAuthError(""); setAuthNotice(""); }}>العودة لتسجيل الدخول</button>}
                <button className="account-button account-button-primary" type="submit" disabled={submitting || health?.status !== "ready" || (mode === "forgot" && !health?.emailConfigured)}>{submitting ? "جارٍ التنفيذ…" : mode === "register" ? "إنشاء الحساب" : mode === "forgot" ? "إرسال رابط الاستعادة" : "تسجيل الدخول"}</button>
              </form>
              <p className="account-copy account-auth-note">تأكد من استخدام بريد يمكنك فتحه لاستقبال رابط الاستعادة عند الحاجة.</p>
            </>
          )}
        </article>

        <article className="account-card">
          <div className="account-card-top"><Cloud size={19} /><span>المزامنة والاستعادة</span></div>
          <p className="account-copy">تُزامن تفضيلات المصحف المحددة فقط. لا تُرفع كلمات المرور أو رموز الجلسات.</p>
          <div className={`account-sync-state account-sync-${account.syncStatus}`}><i />{account.isAuthenticated ? account.syncMessage || "في انتظار التحديث" : "أنشئ حسابًا أو سجّل الدخول لتفعيل الاستعادة بين الأجهزة."}</div>
          {account.isAuthenticated && account.guestDataAvailable && <button type="button" className="account-text-action" onClick={() => { if (account.importGuestData()) notify("تمت إضافة بيانات الزائر إلى بيانات حسابك."); }}><Download size={16} /> استيراد بيانات هذا الجهاز كزائر</button>}
        </article>

        <article className="account-card">
          <div className="account-card-top"><BellRing size={19} /><span>تذكيرات الصفحة</span></div>
          <label className="account-switch-row"><span><strong>تذكير لطيف بالورد</strong><small>يطلب إذن الإشعارات منك فقط، ويعمل أثناء فتح الموقع. لا توجد وعود بإشعارات في الخلفية.</small></span><input type="checkbox" checked={remindersEnabled} onChange={event => void toggleReminders(event.target.checked)} /><i aria-hidden="true" /></label>
        </article>

        <article className="account-card account-help-card">
          <div className="account-card-top"><HelpCircle size={19} /><span>المساعدة والخصوصية</span></div>
          <details><summary>ما الذي يُحفظ؟</summary><p>موضع القراءة، العلامة المرجعية، الوضع، حجم الخط، القارئ، نشاط المراجعة، السجل، وخيار التذكيرات فقط.</p></details>
          <details><summary>كيف أحافظ على حسابي؟</summary><p>اختر كلمة مرور قوية وفريدة. لا تشارك كلمة المرور أو رمز الجلسة مع أي شخص.</p></details>
        </article>
      </div>
    </section>
  );
}

export default AccountPage;
