import { describe, expect, it } from "vitest";
import { getPlatformHealth } from "./_core/platformHealth";

describe("public platform health", () => {
  it("reports missing environment names without exposing values", () => {
    const result = getPlatformHealth({
      MANUS_PROJECT_ID: "project-public-id",
      MANUS_OAUTH_PORTAL_URL: "https://portal.example",
      MANUS_OAUTH_API_URL: "https://api.example",
      MANUS_JWT_SECRET: "never-expose-this",
      DATABASE_URL: "mysql://never-expose-this",
    });
    expect(result).toEqual({ status: "ready", missing: [] });

    const incomplete = getPlatformHealth({ MANUS_PROJECT_ID: "project-public-id" });
    expect(incomplete.status).toBe("configuration_incomplete");
    expect(incomplete.missing).toContain("DATABASE_URL");
    expect(JSON.stringify(incomplete)).not.toContain("never-expose-this");
  });
});
