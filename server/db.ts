import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, userData, users } from "../drizzle/schema";
import { userDataMapSchema, type UserDataMap } from "../shared/userData";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
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
