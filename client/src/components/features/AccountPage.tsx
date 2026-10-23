import { BellRing, Cloud, Download, HelpCircle, LoaderCircle, LogIn, LogOut, ShieldCheck, UserPlus, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { announceMadiniDataChange, useAccountSync, type AccountSyncState } from "@/hooks/useAccountSync";
import "./account.css";

type Health = { status: "ready" | "configuration_incomplete"; missing: string[] };
export type AccountPageProps = {
  notify: (message: string) => void;
  sync?: AccountSyncState;
};

type AuthMode = "login" | "register";

function getReminderValue(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem("madini-reminders") === "true";
}

export function AccountPage({ notify, sync }: AccountPageProps) {
  const localAccount = useAccountSync({ active: !sync });
  const account = sync ?? localAccount;
  const [health, setHealth] = useState<Health | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(getReminderValue);
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/health", { headers: { Accept: "application/json" } })
      .then(async response => (response.ok ? response.json() : Promise.reject(new Error("health failed"))))
      .then((value: Health) => { if (active) setHealth(value); })
      .catch(() => { if (active) setHealth({ status: "configuration_incomplete", missing: ["خدمة API غير متاحة"] }); });
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
      if (mode === "register") {
        await account.register({ name, username, password });
        setPassword("");
        setAuthNotice("تم إنشاء حسابك وتسجيل دخولك. استخدم اسم المستخدم وكلمة المرور نفسيهما عند الدخول من أي جهاز.");
        notify("تم إنشاء الحساب وتسجيل الدخول.");
        return;
      }
      const user = await account.login({ username, password });
      if (!user) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
      setPassword("");
      notify("تم تسجيل الدخول إلى حسابك.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر إتمام الطلب الآن.";
      const safeMessages = ["تعذر", "اسم المستخدم", "محاولات", "التسجيل", "حساب"];
      setAuthError(safeMessages.some(part => message.includes(part)) ? message : "تعذر إتمام الطلب. تحقق من البيانات وحاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  }

  function changeMode(next: AuthMode) {
    setMode(next);
    setAuthError("");
    setAuthNotice("");
  }

  return (
    <section className="account-page" dir="rtl" aria-labelledby="account-title">
      <header className="account-heading">
        <div className="account-heading-icon"><UserRound size={22} /></div>
        <div><span>الحساب والإعدادات</span><h1 id="account-title">بياناتك في صحبة آمنة</h1><p>حساب باسم مستخدم وكلمة مرور، بلا بريد إلكتروني، مع مزامنة بياناتك عبر قاعدة بيانات الموقع.</p></div>
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
              <div className="account-identity"><div className="account-avatar">{(account.user.name || "م").trim().slice(0, 1)}</div><div><strong>{account.user.name || "مستخدم"}</strong><small dir="ltr">@{account.user.username || "حساب قديم"}</small></div></div>
              <p className="account-copy">{account.hydrated ? account.syncMessage : "جارٍ استعادة بيانات حسابك قبل بدء المزامنة…"}</p>
              <div className="account-actions"><button className="account-button account-button-muted" type="button" onClick={() => void account.refresh()}>تحديث المزامنة</button><button className="account-button account-button-danger" type="button" onClick={() => void signOut()}><LogOut size={16} /> تسجيل الخروج</button></div>
            </>
          ) : (
            <>
              <div className="account-auth-tabs" role="tablist" aria-label="نوع الدخول">
                <button type="button" className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}><LogIn size={15} /> دخول</button>
                <button type="button" className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")}><UserPlus size={15} /> حساب جديد</button>
              </div>
              {mode === "login" && <p className="account-login-hint">للدخول إلى حسابك من أي جهاز، اكتب اسم المستخدم وكلمة المرور اللذين أنشأت بهما الحساب.</p>}
              <form className="account-auth-form" onSubmit={event => void submitAuth(event)}>
                {mode === "register" && <label className="account-field">الاسم<input className="account-input" autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>}
                <label className="account-field">اسم المستخدم<input className="account-input" type="text" dir="ltr" autoComplete="username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_.-]+" value={username} onChange={event => setUsername(event.target.value)} /><small>3–32 خانة: حروف إنجليزية أو أرقام أو . _ -</small></label>
                <label className="account-field">كلمة المرور<input className="account-input" type="password" dir="ltr" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 10 : undefined} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} />{mode === "register" && <small>10 أحرف على الأقل.</small>}</label>
                {authError && <p className="account-auth-error" role="alert">{authError}</p>}
                {authNotice && <p className="account-copy" role="status">{authNotice}</p>}
                <button className="account-button account-button-primary" type="submit" disabled={submitting || health?.status !== "ready"}>{submitting ? "جارٍ التنفيذ…" : mode === "register" ? "إنشاء الحساب" : "تسجيل الدخول"}</button>
              </form>
              {mode === "register" && <p className="account-copy account-auth-note">أنشئ كلمة مرور قوية واحتفظ بها؛ الدخول إلى الحساب من جهاز آخر يكون باسم المستخدم وكلمة المرور نفسيهما.</p>}
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
          <details><summary>كيف أحافظ على حسابي؟</summary><p>استخدم كلمة مرور قوية وفريدة واحفظها في مكان آمن. يمكنك الدخول إلى الحساب من عدة أجهزة باسم المستخدم وكلمة المرور. لا يوجد استرداد لكلمة المرور المنسية دون بريد أو وسيلة تحقق أخرى.</p></details>
        </article>
      </div>
    </section>
  );
}

export default AccountPage;
