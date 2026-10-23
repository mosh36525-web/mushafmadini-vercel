import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  createUsernameUser: vi.fn(),
  getUserByUsername: vi.fn(),
  getUserById: vi.fn(),
  markUserSignedIn: vi.fn(),
  getUserData: vi.fn(),
  saveUserData: vi.fn(),
}));
vi.mock("./db", () => database);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function sampleUser(passwordHash: string | null = null) {
  const now = new Date();
  return {
    id: 73,
    openId: null,
    name: "اختبار",
    email: null,
    username: "test.user",
    passwordHash,
    sessionVersion: 0,
    emailVerified: false,
    loginMethod: "username",
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

describe("username authentication router", () => {
  const previousSecret = process.env.AUTH_JWT_SECRET;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_JWT_SECRET = "test-only-secret-long-enough-for-hmac-signing";
    delete process.env.AUTH_ALLOW_SIGNUP;
  });
  afterEach(() => {
    if (previousSecret === undefined) delete process.env.AUTH_JWT_SECRET;
    else process.env.AUTH_JWT_SECRET = previousSecret;
  });

  it("registers a normalized username and immediately signs in without issuing recovery codes", async () => {
    database.createUsernameUser.mockImplementation(async (username: string, name: string, passwordHash: string) => ({
      ...sampleUser(passwordHash), username, name,
    }));
    const { hashPassword } = await import("./_core/authSession");
    const { api, cookieCalls } = caller();
    const result = await api.auth.register({
      name: "مستخدم تجريبي",
      username: " Test.User ",
      password: "Long-Password-123",
    });

    expect(database.createUsernameUser).toHaveBeenCalledOnce();
    const [username, , passwordHash] = database.createUsernameUser.mock.calls[0] as [string, string, string];
    expect(username).toBe("test.user");
    expect(passwordHash).toMatch(/^scrypt\$/);
    expect(await hashPassword("Long-Password-123")).not.toBe(passwordHash);
    expect(result).not.toHaveProperty("recoveryCodes");
    expect(result).not.toHaveProperty("passwordHash");
    expect(result.username).toBe("test.user");
    expect(result).not.toHaveProperty("email");
    expect(cookieCalls).toHaveLength(1);
    expect(cookieCalls[0]?.options).toMatchObject({ httpOnly: true, sameSite: "lax", secure: false });
  });

  it("authenticates a valid password and normalizes the username without returning a hash", async () => {
    const { hashPassword } = await import("./_core/authSession");
    const hash = await hashPassword("Long-Password-123");
    database.getUserByUsername.mockResolvedValue(sampleUser(hash));
    database.markUserSignedIn.mockResolvedValue(undefined);
    const { api, cookieCalls } = caller();

    const result = await api.auth.login({ username: " TEST.USER ", password: "Long-Password-123" });
    expect(database.getUserByUsername).toHaveBeenCalledWith("test.user");
    expect(result).not.toHaveProperty("passwordHash");
    expect(result.username).toBe("test.user");
    expect(database.markUserSignedIn).toHaveBeenCalledWith(73);
    expect(cookieCalls).toHaveLength(1);
  });

  it("accepts a previously registered short password during login", async () => {
    const { hashPassword } = await import("./_core/authSession");
    const password = "Short7!";
    const hash = await hashPassword(password);
    database.getUserByUsername.mockResolvedValue(sampleUser(hash));
    database.markUserSignedIn.mockResolvedValue(undefined);
    const { api } = caller();

    const result = await api.auth.login({ username: "test.user", password });
    expect(result.username).toBe("test.user");
    expect(database.markUserSignedIn).toHaveBeenCalledWith(73);
  });

  it("does not authenticate unknown users or accounts without a local password", async () => {
    database.getUserByUsername.mockResolvedValue(undefined);
    const { api } = caller("203.0.113.8");
    await expect(api.auth.login({ username: "unknown-user", password: "Any-Password-123" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(database.getUserByUsername).toHaveBeenCalledWith("unknown-user");
  });
});
