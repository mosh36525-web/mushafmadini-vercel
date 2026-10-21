import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { getPlatformHealth } from "./_core/platformHealth";
import { sameOriginMutations } from "./security";

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
    next();
  });
  app.use("/api", sameOriginMutations);
  app.use(express.json({ limit: "50kb" }));
  app.use(express.urlencoded({ limit: "50kb", extended: true }));

  app.get("/api/health", (_req, res) => {
    res.set("Cache-Control", "no-store").json(getPlatformHealth());
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return app;
}
