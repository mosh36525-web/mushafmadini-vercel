import { and, eq, gt, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { authTokens, userData, users } from "../drizzle/schema.js";
import { userDataMapSchema, type UserDataMap } from "../shared/userData.js";
import { createPool } from "mysql2/promise";
import { mysqlConfig } from "./mysqlConfig.js";

const createDatabase = () => drizzle(createPool(mysqlConfig()));
let _db: ReturnType<typeof createDatabase> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    _db = createDatabase();
  }
  return _db;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0];
}

export async function createEmailUser(email: string, name: string, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(users).values({
    openId: null,
    email,
    name,
    passwordHash,
    emailVerified: false,
    loginMethod: "email",
    lastSignedIn: new Date(),
  });
  return getUserByEmail(email);
}

export async function markUserSignedIn(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

export async function invalidatePasswordResetTokens(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(authTokens).set({ used: true }).where(and(
    eq(authTokens.userId, userId),
    eq(authTokens.type, "RESET_PASSWORD"),
    eq(authTokens.used, false),
  ));
}

export async function deleteExpiredAuthTokens(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(authTokens).where(lt(authTokens.expiresAt, now));
}

export async function createPasswordResetToken(userId: number, tokenHash: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(authTokens).values({ userId, tokenHash, type: "RESET_PASSWORD", expiresAt });
}

export async function getActivePasswordResetToken(tokenHash: string, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(authTokens).where(and(
    eq(authTokens.tokenHash, tokenHash),
    eq(authTokens.type, "RESET_PASSWORD"),
    eq(authTokens.used, false),
    gt(authTokens.expiresAt, now),
  )).limit(1);
  return rows[0];
}

export async function consumePasswordResetToken(id: number, now = new Date()): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.update(authTokens).set({ used: true }).where(and(
    eq(authTokens.id, id),
    eq(authTokens.type, "RESET_PASSWORD"),
    eq(authTokens.used, false),
    gt(authTokens.expiresAt, now),
  ));
  return Number((result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0) === 1;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({
    passwordHash,
    emailVerified: true,
    sessionVersion: sql`${users.sessionVersion} + 1`,
  }).where(eq(users.id, userId));
}

export type StoredUserData = {
  data: UserDataMap;
  updatedAt: string | null;
};

export type UserDataSaveResult = StoredUserData & {
  status: "saved" | "conflict";
};

function toIsoString(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid user-data timestamp in database");
  return parsed.toISOString();
}

function parseStoredData(value: unknown): UserDataMap {
  const parsed = userDataMapSchema.safeParse(value);
  if (!parsed.success) throw new Error("Stored user data failed validation");
  return parsed.data;
}

async function readUserData(userId: number): Promise<StoredUserData> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(userData).where(eq(userData.userId, userId)).limit(1);
  const row = rows[0];
  if (!row) return { data: {}, updatedAt: null };
  return { data: parseStoredData(row.data), updatedAt: toIsoString(row.updatedAt) };
}

/** Reads exactly one row determined by the authenticated server-side user id. */
export async function getUserData(userId: number): Promise<StoredUserData> {
  return readUserData(userId);
}

/**
 * Compare-and-set save. A stale client receives the current account document so
 * the browser can merge its dirty local keys instead of overwriting another device.
 */
export async function saveUserData(
  userId: number,
  data: UserDataMap,
  expectedUpdatedAt: string | null,
): Promise<UserDataSaveResult> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const current = await readUserData(userId);
  if (current.updatedAt !== expectedUpdatedAt) {
    return { status: "conflict", ...current };
  }

  const now = new Date();
  if (current.updatedAt === null) {
    try {
      await db.insert(userData).values({ userId, data, updatedAt: now });
      const saved = await readUserData(userId);
      return { status: "saved", ...saved };
    } catch (error) {
      // A concurrent first save created the row. Return it rather than replacing it.
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
        return { status: "conflict", ...(await readUserData(userId)) };
      }
      throw error;
    }
  }

  const writeResult = await db
    .update(userData)
    .set({ data, updatedAt: now })
    .where(and(eq(userData.userId, userId), eq(userData.updatedAt, new Date(current.updatedAt))));
  const affectedRows = Number((writeResult as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0);
  if (affectedRows !== 1) {
    return { status: "conflict", ...(await readUserData(userId)) };
  }

  const saved = await readUserData(userId);
  return { status: "saved", ...saved };
}

/** Releases a lazily-created MySQL pool when a finite script explicitly uses db.ts. */
export async function closeDb(): Promise<void> {
  const client = (_db as unknown as { $client?: { end?: () => Promise<void> } } | null)?.$client;
  _db = null;
  if (client?.end) await client.end();
}
