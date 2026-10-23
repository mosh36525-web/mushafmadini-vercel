import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { userDataSaveInputSchema } from "@shared/userData";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { authSecretConfigured, createSessionToken, hashPassword, verifyPassword } from "./_core/emailAuth";
import { emailDeliveryConfigured, sendPasswordResetEmail } from "./_core/emailDelivery";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const authInput = z.object({
  email: z.string().trim().max(320).email().transform(value => value.toLowerCase()),
  password: z.string().min(10).max(128),
});
const registerInput = authInput.extend({ name: z.string().trim().min(2).max(80) });
const resetRequestInput = z.object({
  email: z.string().trim().max(320).email().transform(value => value.toLowerCase()),
});
const resetPasswordInput = z.object({
  token: z.string().min(40).max(100),
  password: z.string().min(10).max(128),
});

// Modest per-instance limits reduce password guessing; do not treat these as a
// substitute for an edge/WAF rate limit on public production deployments.
const authAttempts = new Map<string, { count: number; resetAt: number }>();
function checkAuthRateLimit(ip: string, email: string): void {
  const now = Date.now();
  const keys = [`ip:${ip}`, `email:${email}`];
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
    email: user.email,
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
      checkAuthRateLimit(ctx.req.ip || "unknown", input.email);
      const passwordHash = await hashPassword(input.password);
      try {
        const user = await db.createEmailUser(input.email, input.name, passwordHash);
        if (!user) throw new Error("Failed to load inserted user");
        const token = await createSessionToken(user);
        setSessionCookie(ctx, token);
        return publicUser(user);
      } catch (error) {
        if ((error as { code?: string })?.code === "ER_DUP_ENTRY") {
          throw new TRPCError({ code: "CONFLICT", message: "يوجد حساب مسجل بهذا البريد بالفعل." });
        }
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء الحساب. تحقق من إعداد قاعدة البيانات." });
      }
    }),
    login: publicProcedure.input(authInput).mutation(async ({ ctx, input }) => {
      ensureAuthReady();
      checkAuthRateLimit(ctx.req.ip || "unknown", input.email);
      const user = await db.getUserByEmail(input.email);
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة." });
      }
      await db.markUserSignedIn(user.id);
      const refreshed = { ...user, lastSignedIn: new Date() };
      const token = await createSessionToken(refreshed);
      setSessionCookie(ctx, token);
      return publicUser(refreshed);
    }),
    requestPasswordReset: publicProcedure.input(resetRequestInput).mutation(async ({ ctx, input }) => {
      checkAuthRateLimit(ctx.req.ip || "unknown", input.email);
      try {
        if (emailDeliveryConfigured()) {
          const user = await db.getUserByEmail(input.email);
          if (user?.passwordHash && user.loginMethod === "email") {
            await db.deleteExpiredAuthTokens();
            await db.invalidatePasswordResetTokens(user.id);
            const token = randomBytes(32).toString("base64url");
            const tokenHash = createHash("sha256").update(token).digest("hex");
            await db.createPasswordResetToken(user.id, tokenHash, new Date(Date.now() + 30 * 60 * 1000));
            try {
              await sendPasswordResetEmail(input.email, token);
            } catch {
              await db.invalidatePasswordResetTokens(user.id);
              console.error("Password reset email delivery failed.");
            }
          }
        }
      } catch {
        // Keep response and timing independent of whether the account exists.
        console.error("Password reset request could not be processed.");
      }
      return { success: true, message: "إذا كان البريد مسجلًا، فستصلك رسالة برابط الاستعادة." } as const;
    }),
    resetPassword: publicProcedure.input(resetPasswordInput).mutation(async ({ input, ctx }) => {
      const tokenHash = createHash("sha256").update(input.token).digest("hex");
      checkAuthRateLimit(ctx.req.ip || "unknown", `reset:${tokenHash}`);
      const resetToken = await db.getActivePasswordResetToken(tokenHash);
      if (!resetToken) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "رابط الاستعادة غير صالح أو انتهت صلاحيته." });
      }
      if (!(await db.consumePasswordResetToken(resetToken.id))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "رابط الاستعادة غير صالح أو استُخدم من قبل." });
      }
      const passwordHash = await hashPassword(input.password);
      await db.updateUserPassword(resetToken.userId, passwordHash);
      await db.invalidatePasswordResetTokens(resetToken.userId);
      return { success: true } as const;
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
