import type { RequestHandler } from "express";

/** Mutations must originate from this site; Origin is set by browsers, not user JS. */
export const sameOriginMutations: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.headers.origin;
  const sourceHost = req.headers.host;
  const browserCrossSite = req.headers["sec-fetch-site"] === "cross-site";
  if (origin) {
    try {
      const url = new URL(origin);
      if (!["http:", "https:"].includes(url.protocol) || url.host !== sourceHost) {
        res.status(403).json({ error: "Cross-site request rejected" });
        return;
      }
    } catch {
      res.status(403).json({ error: "Invalid request origin" });
      return;
    }
  } else if (browserCrossSite || req.headers.cookie) {
    res.status(403).json({ error: "Request origin required" });
    return;
  }
  next();
};
