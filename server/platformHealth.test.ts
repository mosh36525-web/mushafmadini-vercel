import { describe, expect, it } from "vitest";
import { getPlatformHealth } from "./_core/platformHealth";

describe("public platform health", () => {
  it("requires only database, TLS CA and session secret without exposing values", () => {
    const result = getPlatformHealth({
      AUTH_JWT_SECRET: "a-long-test-secret-that-is-never-used-in-production",
      DATABASE_URL: "mysql://never-expose-this",
      MYSQL_SSL_CA: "-----BEGIN CERTIFICATE-----never-expose-this",
    });
    expect(result).toEqual({ status: "ready", missing: [] });
    expect("emailConfigured" in result).toBe(false);

    const incomplete = getPlatformHealth({ AUTH_JWT_SECRET: "short" });
    expect(incomplete.status).toBe("configuration_incomplete");
    expect(incomplete.missing).toContain("DATABASE_URL");
    expect(incomplete.missing).toContain("MYSQL_SSL_CA");
    expect(incomplete.missing).toContain("AUTH_JWT_SECRET");
    expect(JSON.stringify(incomplete)).not.toContain("never-expose-this");
  });
});
