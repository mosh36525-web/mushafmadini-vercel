import { describe, expect, it, vi, beforeEach } from "vitest";

const database = vi.hoisted(() => ({
  getUserData: vi.fn(),
  saveUserData: vi.fn(),
}));

vi.mock("./db", () => database);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { userDataMapSchema } from "../shared/userData";

function contextFor(userId: number | null): TrpcContext {
  const now = new Date();
  return {
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: userId === null ? null : {
      id: userId,
      openId: `test-${userId}`,
      name: "اختبار",
      email: null,
      loginMethod: "email",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
  };
}

describe("user data validation", () => {
  it("accepts a bounded madini map and rejects sensitive or non-madini keys", () => {
    expect(userDataMapSchema.safeParse({
      "madini-position": JSON.stringify({ surahNumber: 1, verse: 1 }),
      "madini-tasbih-data": JSON.stringify({ counts: { tasbih: 33 } }),
    }).success).toBe(true);
    expect(userDataMapSchema.safeParse({ "other-setting": "x" }).success).toBe(false);
    expect(userDataMapSchema.safeParse({ "madini-browser-token": "never" }).success).toBe(false);
    expect(userDataMapSchema.safeParse({ "madini-position": { session: "never" } }).success).toBe(false);
  });
});

describe("userData router ownership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses ctx.user.id for reads and never accepts a client user id", async () => {
    database.getUserData.mockResolvedValue({ data: { "madini-dark": "true" }, updatedAt: null });
    const caller = appRouter.createCaller(contextFor(47));

    await expect(caller.userData.get()).resolves.toEqual({ data: { "madini-dark": "true" }, updatedAt: null });
    expect(database.getUserData).toHaveBeenCalledWith(47);
  });

  it("uses ctx.user.id for saves", async () => {
    database.saveUserData.mockResolvedValue({
      status: "saved",
      data: { "madini-bookmarked": "true" },
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const caller = appRouter.createCaller(contextFor(91));
    const input = { data: { "madini-bookmarked": "true" }, expectedUpdatedAt: null };

    await caller.userData.save(input);
    expect(database.saveUserData).toHaveBeenCalledWith(91, input.data, null);
  });

  it("rejects unauthenticated account-data reads", async () => {
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.userData.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
