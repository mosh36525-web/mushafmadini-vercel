import { afterEach, describe, expect, it, vi } from "vitest";
import { emailDeliveryConfigured, sendPasswordResetEmail } from "./_core/emailDelivery";

const baseEnv = {
  RESEND_API_KEY: "dummy-api-key-for-unit-tests",
  AUTH_EMAIL_FROM: "Mushaf Madini <onboarding@resend.dev>",
  PUBLIC_APP_URL: "https://mushaf.example.test",
  NODE_ENV: "production",
};
const envKeys = ["RESEND_API_KEY", "AUTH_EMAIL_FROM", "PUBLIC_APP_URL", "NODE_ENV"] as const;
const previousEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const previousFetch = globalThis.fetch;

afterEach(() => {
  for (const key of envKeys) {
    const value = previousEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = previousFetch;
  vi.restoreAllMocks();
});

describe("Resend password-reset email", () => {
  it("requires an API key, sender, and safe public HTTPS origin", () => {
    expect(emailDeliveryConfigured(baseEnv)).toBe(true);
    expect(emailDeliveryConfigured({ ...baseEnv, RESEND_API_KEY: "" })).toBe(false);
    expect(emailDeliveryConfigured({ ...baseEnv, PUBLIC_APP_URL: "http://mushaf.example.test" })).toBe(false);
    expect(emailDeliveryConfigured({ ...baseEnv, PUBLIC_APP_URL: "https://user:pass@mushaf.example.test" })).toBe(false);
  });

  it("sends an awaited HTTPS API request and keeps the reset token out of the query string", async () => {
    Object.assign(process.env, baseEnv);
    const fakeFetch = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
    globalThis.fetch = fakeFetch as unknown as typeof fetch;
    const rawToken = "x".repeat(43);

    await sendPasswordResetEmail("owner@example.test", rawToken);

    expect(fakeFetch).toHaveBeenCalledOnce();
    const [url, init] = fakeFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer dummy-api-key-for-unit-tests");
    const payload = JSON.parse(String(init.body)) as { from: string; to: string[]; html: string; text: string };
    expect(payload.from).toBe(baseEnv.AUTH_EMAIL_FROM);
    expect(payload.to).toEqual(["owner@example.test"]);
    expect(payload.text).toContain(`/reset-password#token=${rawToken}`);
    expect(payload.html).toContain(`/reset-password#token=${rawToken}`);
    expect(payload.text).not.toContain(`?token=${rawToken}`);
  });
});
