import { describe, expect, it } from "vitest";
import { getPlatformHealth } from "./_core/platformHealth";

describe("public platform health", () => {
  it("reports missing environment names without exposing values", () => {
    const result = getPlatformHealth({
      AUTH_JWT_SECRET: "a-long-test-secret-that-is-never-used-in-production",
      DATABASE_URL: "mysql://never-expose-this",
      MYSQL_SSL_CA: "-----BEGIN CERTIFICATE-----never-expose-this",
    });
    expect(result).toEqual({ status: "ready", missing: [], emailConfigured: false });

    const mailReady = getPlatformHealth({
      AUTH_JWT_SECRET: "a-long-test-secret-that-is-never-used-in-production",
      DATABASE_URL: "mysql://never-expose-this",
      MYSQL_SSL_CA: "-----BEGIN CERTIFICATE-----never-expose-this",
      RESEND_API_KEY: "re_never-expose-this",
      AUTH_EMAIL_FROM: "noreply@example.test",
      PUBLIC_APP_URL: "https://example.test",
      NODE_ENV: "production",
    });
    expect(mailReady.emailConfigured).toBe(true);

    const incomplete = getPlatformHealth({ AUTH_JWT_SECRET: "short" });
    expect(incomplete.status).toBe("configuration_incomplete");
    expect(incomplete.missing).toContain("DATABASE_URL");
    expect(incomplete.missing).toContain("MYSQL_SSL_CA");
    expect(incomplete.missing).toContain("AUTH_JWT_SECRET");
    expect(JSON.stringify(incomplete)).not.toContain("never-expose-this");
  });
});
