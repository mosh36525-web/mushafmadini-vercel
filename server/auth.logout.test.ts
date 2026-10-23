import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type HeaderCall = { name: string; value: string };
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; headers: HeaderCall[] } {
  const headers: HeaderCall[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: null,
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "email",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      setHeader: (name: string, value: string) => {
        headers.push({ name, value });
      },
    } as unknown as TrpcContext["res"],
  };

  return { ctx, headers };
}

describe("auth.logout", () => {
  it("expires the session cookie and reports success", async () => {
    const { ctx, headers } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(headers).toHaveLength(1);
    expect(headers[0]?.name).toBe("Set-Cookie");
    expect(headers[0]?.value).toContain(`${COOKIE_NAME}=`);
    expect(headers[0]?.value).toContain("Path=/");
    expect(headers[0]?.value).toContain("Max-Age=0");
    expect(headers[0]?.value).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(headers[0]?.value).toContain("HttpOnly");
    expect(headers[0]?.value).toContain("SameSite=Lax");
  });
});
