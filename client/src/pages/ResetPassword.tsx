import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [tokenReady, setTokenReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const resetPassword = trpc.auth.resetPassword.useMutation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    setToken(params.get("token") ?? "");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setTokenReady(true);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    try {
      await resetPassword.mutateAsync({ token, password });
      setPassword("");
      setConfirmation("");
      setComplete(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "تعذر إعادة تعيين كلمة المرور.";
      setError(message.includes("رابط الاستعادة") ? message : "تعذر إتمام العملية. قد يكون الرابط منتهي الصلاحية أو مستخدمًا.");
    }
  }

  return (
    <main className="account-page" dir="rtl">
      <header className="account-heading">
        <div className="account-heading-icon">م</div>
        <div><span>المصحف المديني</span><h1>إعادة تعيين كلمة المرور</h1><p>الرابط صالح للاستخدام مرة واحدة ولمدة 30 دقيقة.</p></div>
      </header>
      <section className="account-card reset-password-card">
        {complete ? (
          <div role="status"><h2>تم تحديث كلمة المرور</h2><p className="account-copy">سُجّل خروج أجهزتك الأخرى. يمكنك الآن الدخول بكلمة المرور الجديدة.</p><Link className="account-button account-button-primary" href="/account">العودة إلى تسجيل الدخول</Link></div>
        ) : !tokenReady ? (
          <p className="account-copy">جارٍ التحقق من رابط الاستعادة…</p>
        ) : !token ? (
          <div role="alert"><h2>الرابط غير صالح</h2><p className="account-copy">افتح رابط الاستعادة من الرسالة، أو اطلب رابطًا جديدًا من صفحة الحساب.</p><Link className="account-text-action" href="/account">الذهاب إلى الحساب</Link></div>
        ) : (
          <form className="account-auth-form" onSubmit={event => void submit(event)}>
            <label className="account-field">كلمة المرور الجديدة<input className="account-input" type="password" dir="ltr" autoComplete="new-password" minLength={10} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} /><small>10 أحرف على الأقل.</small></label>
            <label className="account-field">تأكيد كلمة المرور<input className="account-input" type="password" dir="ltr" autoComplete="new-password" minLength={10} maxLength={128} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
            {error && <p className="account-auth-error" role="alert">{error}</p>}
            <button className="account-button account-button-primary" type="submit" disabled={resetPassword.isPending}>{resetPassword.isPending ? "جارٍ الحفظ…" : "حفظ كلمة المرور الجديدة"}</button>
          </form>
        )}
      </section>
    </main>
  );
}
