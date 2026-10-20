import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerOAuthRoutes } from "./_core/oauth";
import { getPlatformHealth } from "./_core/platformHealth";
import { publicPlatformScript } from "./_core/publicConfig";

/**
 * Builds only the shared HTTP application. Starting a listener stays in startServer,
 * so the same routes work in a Vercel function and in the standalone server.
 */
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(self), notifications=(self)");
    // Do not send X-Frame-Options: DENY/SAMEORIGIN would break the HTTPS Manus Preview iframe.
    next();
  });
  app.use(express.json({ limit: "50kb" }));
  app.use(express.urlencoded({ limit: "50kb", extended: true }));

  app.get("/api/health", (_req, res) => {
    res.set("Cache-Control", "no-store").json(getPlatformHealth());
  });
  app.get("/api/platform/config.js", (_req, res) => {
    res
      .set("Cache-Control", "no-store")
      .type("application/javascript")
      .send(publicPlatformScript());
  });

  // Preserve the existing Manus OAuth callback and its state/nonce validation.
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return app;
}
