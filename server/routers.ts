import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "../shared/const.js";
import { userDataSaveInputSchema } from "../shared/userData.js";
import * as db from "./db.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { authSecretConfigured, createSessionToken, hashPassword, verifyPassword } from "./_core/authSession.js";
import { systemRouter } from "./_core/systemRouter.js";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc.js";

const usernameSchema = z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/, "اسم المستخدم يقبل الحروف الإنجليزية والأرقام و . _ - فقط.").transform(value => value.toLowerCase());
const authInput = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(128),
});
const registerInput = authInput.extend({
  name: z.string().trim().min(2).max(80),
  password: z.string().min(10).max(128),
});
// Modest per-instance limits reduce password guessing; do not treat these as a
// substitute for an edge/WAF rate limit on public production deployments.
const authAttempts = new Map<string, { count: number; resetAt: number }>();
function checkAuthRateLimit(ip: string, username: string): void {
  const now = Date.now();
  const keys = [`ip:${ip}`, `username:${username}`];
  for (const [key, record] of authAttempts) if (record.resetAt <= now) authAttempts.delete(key);
  for (const key of keys) {
    const record = authAttempts.get(key);
    const maximum = key.startsWith("ip:") ? 40 : 8;
    if (record && record.count >= maximum) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى." });
    }
  }
  for (const key of keys) {
    const record = authAttempts.get(key);
    if (!record || record.resetAt <= now) authAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    else record.count += 1;
  }
}

function publicUser(user: NonNullable<Awaited<ReturnType<typeof db.getUserById>>>) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
    lastSignedIn: user.lastSignedIn,
  };
}

function ensureAuthReady() {
  if (!authSecretConfigured()) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "إعداد AUTH_JWT_SECRET غير مكتمل." });
  }
}

function setSessionCookie(ctx: { req: import("express").Request; res: import("express").Response }, token: string) {
  ctx.res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => (ctx.user ? publicUser(ctx.user) : null)),
    register: publicProcedure.input(registerInput).mutation(async ({ ctx, input }) => {
      ensureAuthReady();
      if (process.env.AUTH_ALLOW_SIGNUP?.toLowerCase() === "false") {
        throw new TRPCError({ code: "FORBIDDEN", message: "التسجيل مغلق حاليًا." });
      }
      checkAuthRateLimit(ctx.req.ip || "unknown", input.username);
      const passwordHash = await hashPassword(input.password);
      try {
        const user = await db.createUsernameUser(input.username, input.name, passwordHash);
        const token = await createSessionToken(user);
        setSessionCookie(ctx, token);
        return publicUser(user);
      } catch (error) {
        if ((error as { code?: string })?.code === "ER_DUP_ENTRY") {
          throw new TRPCError({ code: "CONFLICT", message: "اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر." });
        }
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء الحساب. تحقق من إعداد قاعدة البيانات." });
      }
    }),
    login: publicProcedure.input(authInput).mutation(async ({ ctx, input }) => {
      ensureAuthReady();
      checkAuthRateLimit(ctx.req.ip || "unknown", input.username);
      const user = await db.getUserByUsername(input.username);
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "اسم المستخدم أو كلمة المرور غير صحيحة." });
      }
      await db.markUserSignedIn(user.id);
      const refreshed = { ...user, lastSignedIn: new Date() };
      const token = await createSessionToken(refreshed);
      setSessionCookie(ctx, token);
      return publicUser(refreshed);
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      const expiredCookie = [
        `${COOKIE_NAME}=`,
        `Path=${cookieOptions.path ?? "/"}`,
        "Max-Age=0",
        "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      ];
      if (cookieOptions.httpOnly) expiredCookie.push("HttpOnly");
      if (cookieOptions.secure) expiredCookie.push("Secure");
      if (cookieOptions.sameSite === true) expiredCookie.push("SameSite=Strict");
      else if (typeof cookieOptions.sameSite === "string") {
        expiredCookie.push(`SameSite=${cookieOptions.sameSite[0]?.toUpperCase()}${cookieOptions.sameSite.slice(1)}`);
      }
      ctx.res.setHeader("Set-Cookie", expiredCookie.join("; "));
      return { success: true } as const;
    }),
  }),
  userData: router({
    get: protectedProcedure.query(({ ctx }) => db.getUserData(ctx.user.id)),
    save: protectedProcedure
      .input(userDataSaveInputSchema)
      .mutation(({ ctx, input }) => db.saveUserData(ctx.user.id, input.data, input.expectedUpdatedAt)),
  }),
});

export type AppRouter = typeof appRouter;
