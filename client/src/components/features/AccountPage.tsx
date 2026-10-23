import { BellRing, Cloud, Copy, Download, HelpCircle, LoaderCircle, LogIn, LogOut, ShieldCheck, UserPlus, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { announceMadiniDataChange, useAccountSync, type AccountSyncState } from "@/hooks/useAccountSync";
import { trpc } from "@/lib/trpc";
import "./account.css";

type Health = { status: "ready" | "configuration_incomplete"; missing: string[] };
export type AccountPageProps = {
  notify: (message: string) => void;
  sync?: AccountSyncState;
};

type AuthMode = "login" | "register" | "recover";

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
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [recoverySaved, setRecoverySaved] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const recoverWithCode = trpc.auth.recoverWithCode.useMutation();

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

  useEffect(() => {
    if (!recoveryCodes.length || recoverySaved) return;
    const warnBeforeClose = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeClose);
    return () => window.removeEventListener("beforeunload", warnBeforeClose);
  }, [recoveryCodes.length, recoverySaved]);

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
      if (mode === "recover") {
        await recoverWithCode.mutateAsync({ username, recoveryCode, password });
        setPassword("");
        setRecoveryCode("");
        setMode("login");
        setAuthNotice("تم تحديث كلمة المرور. استخدمها الآن لتسجيل الدخول.");
        notify("تم تحديث كلمة المرور. استخدم رمز استعادة آخر إذا احتجت إليها مستقبلًا.");
        return;
      }
      if (mode === "register") {
        const registration = await account.register({ name, username, password });
        setPassword("");
        setRecoverySaved(false);
        setRecoveryCodes(registration.recoveryCodes);
        notify("تم إنشاء الحساب. احفظ رموز الاستعادة قبل المتابعة.");
        return;
      }
      const user = await account.login({ username, password });
      if (!user) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
      setPassword("");
      notify("تم تسجيل الدخول.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر إتمام الطلب الآن.";
      const safeMessages = ["تعذر", "اسم المستخدم", "محاولات", "التسجيل", "حساب"];
      setAuthError(safeMessages.some(part => message.includes(part)) ? message : "تعذر إتمام الطلب. تحقق من البيانات وحاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  }

  function downloadRecoveryCodes() {
    const content = [
      "رموز استعادة حساب المصحف المديني",
      "كل رمز صالح للاستخدام مرة واحدة. احتفظ بهذا الملف في مكان آمن.",
      "",
      ...recoveryCodes,
    ].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "mushaf-recovery-codes.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("تم تنزيل ملف رموز الاستعادة.");
  }

  async function copyRecoveryCodes() {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      notify("نُسخت رموز الاستعادة. احفظها في مكان آمن.");
    } catch {
      notify("تعذر النسخ تلقائيًا؛ يمكنك تحديد الرموز ونسخها يدويًا.");
    }
  }

  function closeRecoveryCodes() {
    if (!recoverySaved) return;
    setRecoveryCodes([]);
    setRecoverySaved(false);
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
              <div className="account-actions"><button className="account-button account-button-muted" type="button" onClick={() => void account.refresh()}>تحديث الاستعادة</button><button className="account-button account-button-danger" type="button" onClick={() => void signOut()}><LogOut size={16} /> تسجيل الخروج</button></div>
            </>
          ) : (
            <>
              <div className="account-auth-tabs" role="tablist" aria-label="نوع الدخول">
                <button type="button" className={mode === "login" || mode === "recover" ? "active" : ""} onClick={() => changeMode("login")}><LogIn size={15} /> دخول</button>
                <button type="button" className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")}><UserPlus size={15} /> حساب جديد</button>
              </div>
              {mode === "login" && <p className="account-login-hint">استخدم اسم المستخدم وكلمة المرور. إن لم تنشئ حسابًا بعد، اختر «حساب جديد».</p>}
              {mode === "recover" && <p className="account-login-hint">استعد الحساب باستخدام أحد رموز الاستعادة التي ظهرت عند إنشاء الحساب. لا نرسل بريدًا.</p>}
              <form className="account-auth-form" onSubmit={event => void submitAuth(event)}>
                {mode === "register" && <label className="account-field">الاسم<input className="account-input" autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>}
                <label className="account-field">اسم المستخدم<input className="account-input" type="text" dir="ltr" autoComplete="username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_.-]+" value={username} onChange={event => setUsername(event.target.value)} /><small>3–32 خانة: حروف إنجليزية أو أرقام أو . _ -</small></label>
                {mode === "recover" && <label className="account-field">رمز استعادة غير مستخدم<input className="account-input" type="text" dir="ltr" autoComplete="off" required minLength={24} maxLength={29} value={recoveryCode} onChange={event => setRecoveryCode(event.target.value.toUpperCase())} /></label>}
                <label className="account-field">{mode === "recover" ? "كلمة المرور الجديدة" : "كلمة المرور"}<input className="account-input" type="password" dir="ltr" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? undefined : 10} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} />{mode !== "login" && <small>10 أحرف على الأقل.</small>}</label>
                {mode === "login" && <button type="button" className="account-text-action" onClick={() => changeMode("recover")}>نسيت كلمة المرور؟ لديّ رمز استعادة</button>}
                {authError && <p className="account-auth-error" role="alert">{authError}</p>}
                {authNotice && <p className="account-copy" role="status">{authNotice}</p>}
                {mode === "recover" && <button type="button" className="account-text-action" onClick={() => changeMode("login")}>العودة لتسجيل الدخول</button>}
                <button className="account-button account-button-primary" type="submit" disabled={submitting || health?.status !== "ready"}>{submitting ? "جارٍ التنفيذ…" : mode === "register" ? "إنشاء الحساب" : mode === "recover" ? "تغيير كلمة المرور" : "تسجيل الدخول"}</button>
              </form>
              {mode === "register" && <p className="account-copy account-auth-note">لن نطلب بريدًا. بعد التسجيل ستظهر رموز استعادة مرة واحدة؛ نزّلها واحتفظ بها.</p>}
            </>
          )}
        </article>

        <article className="account-card">
          <div className="account-card-top"><Cloud size={19} /><span>المزامنة والاستعادة</span></div>
          <p className="account-copy">تُزامن تفضيلات المصحف المحددة فقط. لا تُرفع كلمات المرور أو رموز الاستعادة أو رموز الجلسات.</p>
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
          <details><summary>كيف أحافظ على حسابي؟</summary><p>اختر كلمة مرور قوية وفريدة، واحفظ رموز الاستعادة خارج الموقع. كل رمز صالح مرة واحدة. إذا فقدت كلمة المرور وكل الرموز، لن يمكن استعادة الحساب ذاتيًا.</p></details>
        </article>
      </div>

      {recoveryCodes.length > 0 && (
        <div className="recovery-overlay">
          <section className="recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
            <div className="recovery-dialog-icon"><ShieldCheck size={23} /></div>
            <h2 id="recovery-title">احفظ رموز استعادة حسابك الآن</h2>
            <p>لن تظهر هذه الرموز مرة أخرى. احتفظ بها في مكان آمن؛ كل رمز يعمل مرة واحدة، ولا تُخزّن نسخها الأصلية على الخادم.</p>
            <div className="recovery-code-list" dir="ltr">{recoveryCodes.map(code => <code key={code}>{code}</code>)}</div>
            <div className="recovery-actions">
              <button type="button" className="account-button account-button-muted" onClick={() => void copyRecoveryCodes()}><Copy size={16} /> نسخ الرموز</button>
              <button type="button" className="account-button account-button-muted" onClick={downloadRecoveryCodes}><Download size={16} /> تنزيل ملف</button>
            </div>
            <label className="recovery-confirm"><input type="checkbox" checked={recoverySaved} onChange={event => setRecoverySaved(event.target.checked)} /> حفظت الرموز في مكان آمن</label>
            <button type="button" className="account-button account-button-primary" disabled={!recoverySaved} onClick={closeRecoveryCodes}>حفظت الرموز، متابعة</button>
          </section>
        </div>
      )}
    </section>
  );
}

export default AccountPage;
