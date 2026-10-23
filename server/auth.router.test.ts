import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  createEmailUser: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  markUserSignedIn: vi.fn(),
  deleteExpiredAuthTokens: vi.fn(),
  invalidatePasswordResetTokens: vi.fn(),
  createPasswordResetToken: vi.fn(),
  getActivePasswordResetToken: vi.fn(),
  consumePasswordResetToken: vi.fn(),
  updateUserPassword: vi.fn(),
  getUserData: vi.fn(),
  saveUserData: vi.fn(),
}));
vi.mock("./db", () => database);

const delivery = vi.hoisted(() => ({
  emailDeliveryConfigured: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock("./_core/emailDelivery", () => delivery);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function sampleUser(passwordHash: string | null = null) {
  const now = new Date();
  return {
    id: 73,
    openId: null,
    name: "اختبار",
    email: "test@example.com",
    passwordHash,
    sessionVersion: 0,
    emailVerified: false,
    loginMethod: "email",
    role: "user" as const,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

function caller(ip = "198.51.100.27") {
  const cookieCalls: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const ctx: TrpcContext = {
    user: null,
    req: { ip, protocol: "http", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookieCalls.push({ name, value, options });
      },
    } as TrpcContext["res"],
  };
  return { api: appRouter.createCaller(ctx), cookieCalls };
}

describe("email authentication router", () => {
  const previousSecret = process.env.AUTH_JWT_SECRET;
  beforeEach(() => {
    vi.clearAllMocks();
    delivery.emailDeliveryConfigured.mockReturnValue(false);
    delivery.sendPasswordResetEmail.mockResolvedValue(undefined);
    process.env.AUTH_JWT_SECRET = "test-only-secret-long-enough-for-hmac-signing";
    delete process.env.AUTH_ALLOW_SIGNUP;
  });
  afterEach(() => {
    if (previousSecret === undefined) delete process.env.AUTH_JWT_SECRET;
    else process.env.AUTH_JWT_SECRET = previousSecret;
  });

  it("registers a normalized email, returns a safe profile, and issues an HttpOnly cookie", async () => {
    database.createEmailUser.mockImplementation(async (email: string, name: string, passwordHash: string) => ({
      ...sampleUser(passwordHash), email, name,
    }));
    const { api, cookieCalls } = caller();
    const result = await api.auth.register({
      name: "مستخدم تجريبي",
      email: " TEST@EXAMPLE.COM ",
      password: "Long-Password-123",
    });

    expect(database.createEmailUser).toHaveBeenCalledOnce();
    expect(database.createEmailUser.mock.calls[0]?.[0]).toBe("test@example.com");
    expect(database.createEmailUser.mock.calls[0]?.[2]).toMatch(/^scrypt\$/);
    expect(result).not.toHaveProperty("passwordHash");
    expect(result.email).toBe("test@example.com");
    expect(cookieCalls).toHaveLength(1);
    expect(cookieCalls[0]?.options).toMatchObject({ httpOnly: true, sameSite: "lax", secure: false });
  });

  it("authenticates a valid password without returning the stored hash", async () => {
    const { hashPassword } = await import("./_core/emailAuth");
    const hash = await hashPassword("Long-Password-123");
    database.getUserByEmail.mockResolvedValue(sampleUser(hash));
    database.markUserSignedIn.mockResolvedValue(undefined);
    const { api, cookieCalls } = caller();

    const result = await api.auth.login({ email: "test@example.com", password: "Long-Password-123" });
    expect(result).not.toHaveProperty("passwordHash");
    expect(database.markUserSignedIn).toHaveBeenCalledWith(73);
    expect(cookieCalls).toHaveLength(1);
  });

  it("accepts a previously registered short password during login", async () => {
    const { hashPassword } = await import("./_core/emailAuth");
    const password = "Short7!";
    const hash = await hashPassword(password);
    database.getUserByEmail.mockResolvedValue(sampleUser(hash));
    database.markUserSignedIn.mockResolvedValue(undefined);
    const { api } = caller();

    const result = await api.auth.login({ email: "test@example.com", password });
    expect(result.email).toBe("test@example.com");
    expect(database.markUserSignedIn).toHaveBeenCalledWith(73);
  });

  it("returns the same reset response for an unknown address without exposing account existence", async () => {
    database.getUserByEmail.mockResolvedValue(undefined);
    const result = await caller("203.0.113.8").api.auth.requestPasswordReset({ email: "unknown@example.com" });
    expect(result).toEqual({ success: true, message: "إذا كان البريد مسجلًا، فستصلك رسالة برابط الاستعادة." });
    expect(delivery.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("stores only a hash of reset tokens and never returns the token to the requester", async () => {
    delivery.emailDeliveryConfigured.mockReturnValue(true);
    database.getUserByEmail.mockResolvedValue(sampleUser("existing-password-hash"));
    const result = await caller("203.0.113.9").api.auth.requestPasswordReset({ email: " TEST@example.com " });
    expect(result.success).toBe(true);
    expect(database.invalidatePasswordResetTokens).toHaveBeenCalledWith(73);
    expect(database.createPasswordResetToken).toHaveBeenCalledOnce();
    const [, storedHash, expiry] = database.createPasswordResetToken.mock.calls[0] as [number, string, Date];
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(expiry.getTime()).toBeGreaterThan(Date.now() + 29 * 60 * 1000);
    const [recipient, rawToken] = delivery.sendPasswordResetEmail.mock.calls[0] as [string, string];
    expect(recipient).toBe("test@example.com");
    expect(rawToken).toHaveLength(43);
    expect(result.message).not.toContain(rawToken);
    expect(storedHash).not.toBe(rawToken);
  });

  it("consumes a reset token and stores a new password hash", async () => {
    const { createHash } = await import("node:crypto");
    const { hashPassword } = await import("./_core/emailAuth");
    const rawToken = "x".repeat(43);
    database.getActivePasswordResetToken.mockResolvedValue({
      id: 101, userId: 73, tokenHash: createHash("sha256").update(rawToken).digest("hex"),
      type: "RESET_PASSWORD", expiresAt: new Date(Date.now() + 60_000), used: false, createdAt: new Date(),
    });
    database.consumePasswordResetToken.mockResolvedValue(true);
    const result = await caller("203.0.113.10").api.auth.resetPassword({ token: rawToken, password: "Brand-New-Password-123" });
    expect(result).toEqual({ success: true });
    expect(database.consumePasswordResetToken).toHaveBeenCalledWith(101);
    expect(database.updateUserPassword).toHaveBeenCalledOnce();
    const [userId, newHash] = database.updateUserPassword.mock.calls[0] as [number, string];
    expect(userId).toBe(73);
    expect(newHash).toMatch(/^scrypt\$/);
    expect(await hashPassword("Brand-New-Password-123")).not.toBe(newHash);
  });
});
