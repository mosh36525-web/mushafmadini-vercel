import { LogIn, LogOut, BellRing, Cloud, Download, HelpCircle, LoaderCircle, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { announceMadiniDataChange, useAccountSync, type AccountSyncState } from "@/hooks/useAccountSync";
import "./account.css";

type Health = { status: "ready" | "configuration_incomplete"; missing: string[] };

export type AccountPageProps = {
  notify: (message: string) => void;
  /** Optional active instance from a parent that must synchronize before this view opens. */
  sync?: AccountSyncState;
};

function getReminderValue(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem("madini-reminders") === "true";
}

export function AccountPage({ notify, sync }: AccountPageProps) {
  // Hooks cannot be conditional. In parent-owned mode this passive instance keeps
  // the component standalone-compatible without registering a second saver.
  const localAccount = useAccountSync({ active: !sync });
  const account = sync ?? localAccount;
  const [health, setHealth] = useState<Health | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(getReminderValue);

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

  return (
    <section className="account-page" dir="rtl" aria-labelledby="account-title">
      <header className="account-heading">
        <div className="account-heading-icon"><UserRound size={22} /></div>
        <div><span>الحساب والإعدادات</span><h1 id="account-title">بياناتك في صحبة آمنة</h1><p>الدخول والاستعادة يتمان عبر حساب Manus الحقيقي، دون كلمة مرور محلية.</p></div>
      </header>

      {health?.status === "configuration_incomplete" && (
        <div className="account-alert" role="status">
          <ShieldCheck size={19} />
          <div><strong>إعداد Manus غير مكتمل في هذه البيئة</strong><p>لا يمكن تسجيل الدخول أو الاستعادة قبل توفير المتغيرات التالية: {health.missing.join("، ")}. لا تُعرض أي قيمة سرية هنا.</p></div>
        </div>
      )}

      <div className="account-grid">
        <article className="account-card account-profile-card">
          <div className="account-card-top"><Cloud size={19} /><span>حساب Manus</span></div>
          {account.authLoading ? <div className="account-loading"><LoaderCircle className="account-spin" size={20} /> جارٍ التحقق من الجلسة…</div> : account.isAuthenticated && account.user ? (
            <>
              <div className="account-identity"><div className="account-avatar">{(account.user.name || "م").trim().slice(0, 1)}</div><div><strong>{account.user.name || "مستخدم Manus"}</strong><small>{account.user.email || "تم التحقق عبر Manus"}</small></div></div>
              <p className="account-copy">{account.hydrated ? account.syncMessage : "جارٍ استعادة بيانات حسابك قبل بدء المزامنة…"}</p>
              <div className="account-actions"><button className="account-button account-button-muted" type="button" onClick={() => void account.refresh()}>تحديث الاستعادة</button><button className="account-button account-button-danger" type="button" onClick={() => void signOut()}><LogOut size={16} /> تسجيل الخروج</button></div>
            </>
          ) : (
            <>
              <p className="account-copy">احفظ موضع القراءة وتفضيلاتك واستعدها عند الانتقال إلى جهاز آخر عبر حساب Manus.</p>
              <button className="account-button account-button-primary" type="button" onClick={() => { if (account.login()) notify("سيتم فتح تسجيل الدخول الآمن من Manus."); }} disabled={health?.status === "configuration_incomplete"}><LogIn size={17} /> تسجيل الدخول عبر Manus</button>
            </>
          )}
        </article>

        <article className="account-card">
          <div className="account-card-top"><Cloud size={19} /><span>المزامنة والاستعادة</span></div>
          <p className="account-copy">تُزامن تفضيلات المصحف المحددة فقط. لا تُرفع كلمات المرور أو الرموز أو ملفات تعريف الارتباط.</p>
          <div className={`account-sync-state account-sync-${account.syncStatus}`}><i />{account.isAuthenticated ? account.syncMessage || "في انتظار التحديث" : "سجل الدخول لتفعيل الاستعادة بين الأجهزة."}</div>
          {account.isAuthenticated && account.guestDataAvailable && <button type="button" className="account-text-action" onClick={() => { if (account.importGuestData()) notify("تمت إضافة بيانات الزائر إلى بيانات حسابك."); }}><Download size={16} /> استيراد بيانات هذا الجهاز كزائر</button>}
        </article>

        <article className="account-card">
          <div className="account-card-top"><BellRing size={19} /><span>تذكيرات الصفحة</span></div>
          <label className="account-switch-row"><span><strong>تذكير لطيف بالورد</strong><small>يطلب إذن الإشعارات منك فقط، ويعمل أثناء فتح الموقع. لا توجد وعود بإشعارات في الخلفية.</small></span><input type="checkbox" checked={remindersEnabled} onChange={event => void toggleReminders(event.target.checked)} /><i aria-hidden="true" /></label>
        </article>

        <article className="account-card account-help-card">
          <div className="account-card-top"><HelpCircle size={19} /><span>المساعدة والخصوصية</span></div>
          <details><summary>ما الذي يُحفظ؟</summary><p>موضع القراءة، العلامة المرجعية، الوضع، حجم الخط، القارئ، نشاط المراجعة، السجل، وخيار التذكيرات فقط.</p></details>
          <details><summary>كيف أطلب المساعدة؟</summary><p>تحقق من اتصالك وإعدادات Manus أولًا. لا ترسل رموز الجلسة أو بيانات الدخول في أي رسالة دعم.</p></details>
        </article>
      </div>
    </section>
  );
}

export default AccountPage;
