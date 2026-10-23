import type { NextFunction } from "express";

type ResponseLike = {
  setHeader(name: string, value: string): unknown;
  status(code: number): { json(body: unknown): unknown };
};

function requestProperty(request: unknown, property: "method" | "headers"): unknown {
  if (typeof request !== "object" || request === null) return undefined;
  return (request as Record<string, unknown>)[property];
}

function requestHeader(request: unknown, name: string): string | undefined {
  const headers = requestProperty(request, "headers");
  if (typeof headers !== "object" || headers === null) return undefined;
  const value = (headers as Record<string, unknown>)[name];
  return typeof value === "string" ? value : undefined;
}

/** Mutations must originate from this site; Origin is set by browsers, not user JS. */
export const sameOriginMutations = (req: unknown, res: unknown, next: NextFunction): void => {
  const response = res as ResponseLike;
  response.setHeader("Cache-Control", "private, no-store");
  const method = requestProperty(req, "method");
  if (typeof method === "string" && ["GET", "HEAD", "OPTIONS"].includes(method)) return next();
  const origin = requestHeader(req, "origin");
  const sourceHost = requestHeader(req, "host");
  const browserCrossSite = requestHeader(req, "sec-fetch-site") === "cross-site";
  if (origin) {
    try {
      const url = new URL(origin);
      if (!["http:", "https:"].includes(url.protocol) || url.host !== sourceHost) {
        response.status(403).json({ error: "Cross-site request rejected" });
        return;
      }
    } catch {
      response.status(403).json({ error: "Invalid request origin" });
      return;
    }
  } else if (browserCrossSite || requestHeader(req, "cookie")) {
    response.status(403).json({ error: "Request origin required" });
    return;
  }
  next();
};
