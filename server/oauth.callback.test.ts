import { describe, expect, it, vi } from "vitest";
import type { RequestHandler } from "express";
import { registerOAuthRoutes } from "./_core/oauth";
import { encodeOAuthState, OAUTH_STATE_COOKIE } from "../shared/const";

describe("Manus OAuth callback state validation", () => {
  it("rejects a callback whose state nonce is not bound to the initiating browser", async () => {
    let callback: RequestHandler | undefined;
    const app = {
      get: (path: string, handler: RequestHandler) => {
        if (path === "/api/oauth/callback") callback = handler;
      },
    };
    registerOAuthRoutes(app as never);
    expect(callback).toBeDefined();

    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      clearCookie: vi.fn(),
    };
    const state = encodeOAuthState({ redirectUri: "https://example.test/api/oauth/callback", nonce: "expected-nonce" });
    await callback!({
      query: { code: "authorization-code", state },
      headers: { cookie: `${OAUTH_STATE_COOKIE}=different-nonce` },
    } as never, response as never, vi.fn());

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "invalid oauth state" });
    expect(response.clearCookie).not.toHaveBeenCalled();
  });
});
