export function emailDeliveryConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.RESEND_API_KEY?.trim() && env.AUTH_EMAIL_FROM?.trim() &&
    safeAppOrigin(env.PUBLIC_APP_URL, env.NODE_ENV === "production"),
  );
}

function safeAppOrigin(value: string | undefined, production: boolean): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return null;
    if (production ? url.protocol !== "https:" : !["https:", "http:"].includes(url.protocol)) return null;
    if (production && ["localhost", "127.0.0.1"].includes(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]!);
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const env = process.env;
  if (!emailDeliveryConfigured(env)) throw new Error("Resend email delivery is not configured");
  const origin = safeAppOrigin(env.PUBLIC_APP_URL, env.NODE_ENV === "production");
  if (!origin) throw new Error("Public application URL is invalid");

  const resetUrl = new URL("/reset-password", origin);
  // Keep the one-time token in the URL fragment so it is not sent in HTTP requests or referrers.
  resetUrl.hash = new URLSearchParams({ token }).toString();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM,
      to: [to],
      subject: "إعادة تعيين كلمة المرور — المصحف المديني",
      text: `تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك. افتح الرابط التالي خلال 30 دقيقة لإتمام العملية:\n${resetUrl}\n\nإذا لم تطلب إعادة التعيين فتجاهل هذه الرسالة.`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#16221b"><h2>إعادة تعيين كلمة المرور</h2><p>افتح الرابط التالي خلال 30 دقيقة لإتمام العملية. الرابط يستخدم مرة واحدة فقط.</p><p><a href="${escapeHtml(resetUrl.toString())}" style="display:inline-block;padding:12px 18px;background:#d7ad65;color:#16221b;text-decoration:none;border-radius:8px">إعادة تعيين كلمة المرور</a></p><p>إذا لم تطلب إعادة التعيين فتجاهل هذه الرسالة.</p></div>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Resend email request failed with status ${response.status}`);
}
