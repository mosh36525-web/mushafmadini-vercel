import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import { COOKIE_NAME } from "../../shared/const.js";
import type { User } from "../../drizzle/schema.js";
import { getUserById } from "../db.js";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const scryptOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, 64, scryptOptions, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string | null): Promise<boolean> {
  if (!encoded) return false;
  const [algorithm, saltText, keyText, extra] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltText || !keyText || extra) return false;
  try {
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(keyText, "base64url");
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = await derive(password, salt);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function getSecret(): Uint8Array {
  const value = process.env.AUTH_JWT_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_JWT_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(value);
}

export function authSecretConfigured(): boolean {
  return Boolean(process.env.AUTH_JWT_SECRET && process.env.AUTH_JWT_SECRET.length >= 32);
}

export async function createSessionToken(user: Pick<User, "id" | "sessionVersion">): Promise<string> {
  return new SignJWT({ ver: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("mushafmadini")
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

async function verifySessionToken(token: string): Promise<{ userId: number; version: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: "mushafmadini",
      requiredClaims: ["exp", "sub"],
    });
    const userId = Number(payload.sub);
    const version = payload.ver;
    return Number.isSafeInteger(userId) && userId > 0 && Number.isSafeInteger(version)
      ? { userId, version: Number(version) }
      : null;
  } catch {
    return null;
  }
}

export async function authenticateSession(req: unknown): Promise<User | null> {
  if (typeof req !== "object" || req === null) return null;
  const headers = (req as { headers?: unknown }).headers;
  if (typeof headers !== "object" || headers === null) return null;
  const cookieHeader = (headers as { cookie?: unknown }).cookie;
  const cookies = parseCookieHeader(typeof cookieHeader === "string" ? cookieHeader : "");
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const identity = await verifySessionToken(token);
  if (!identity) return null;
  const user = await getUserById(identity.userId);
  return user && user.sessionVersion === identity.version ? user : null;
}

export async function authenticatedUserFromToken(token: string): Promise<User | null> {
  const identity = await verifySessionToken(token);
  if (!identity) return null;
  const user = await getUserById(identity.userId);
  return user && user.sessionVersion === identity.version ? user : null;
}
