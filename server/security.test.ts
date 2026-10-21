import { describe, expect, it, vi } from "vitest";
import { sameOriginMutations } from "./security";
import { appRouter } from "./routers";

describe("mutation origin guard", () => {
  it("rejects foreign origins", () => {
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    sameOriginMutations({ method: "POST", headers: { host: "site.example", origin: "https://attacker.example", cookie: "session=x" } } as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  it("accepts same-origin mutations", () => {
    const next = vi.fn();
    sameOriginMutations({ method: "POST", headers: { host: "site.example", origin: "https://site.example" } } as never, { setHeader: vi.fn() } as never, next);
    expect(next).toHaveBeenCalledOnce();
  });
  it("does not expose passwordHash or emailVerified in auth.me", async () => {
    const caller = appRouter.createCaller({ user: { id: 1, name: "اختبار", passwordHash: "sensitive-hash", emailVerified: false }, req: {}, res: {} } as never);
    const result = await caller.auth.me();
    expect(result).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(result)).not.toContain("sensitive-hash");
  });
});
