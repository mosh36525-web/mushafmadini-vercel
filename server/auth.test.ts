import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./_core/emailAuth";

describe("local email authentication", () => {
  it("stores only a salted scrypt hash and verifies the original password", async () => {
    const hash = await hashPassword("Correct-Horse-9876");
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain("Correct-Horse-9876");
    expect(await verifyPassword("Correct-Horse-9876", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("rejects malformed or missing hashes safely", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });
});
