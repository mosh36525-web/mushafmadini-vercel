import { boolean, datetime, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import type { UserDataMap } from "../shared/userData.js";

/**
 * User accounts for independent username/password authentication.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Legacy nullable identifier retained for compatibility; local email accounts do not use it. */
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  /** Optional legacy email; new accounts authenticate with username only. */
  email: varchar("email", { length: 320 }).unique(),
  /** Unique public login name for username/password authentication. */
  username: varchar("username", { length: 32 }).unique(),
  /** Scrypt password hash for standalone password authentication. */
  passwordHash: varchar("passwordHash", { length: 255 }),
  /** Incremented when a password is reset to revoke all previously issued sessions. */
  sessionVersion: int("sessionVersion").default(0).notNull(),
  /** Status indicating whether user verified their email address. */
  emailVerified: boolean("emailVerified").default(false).notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Legacy email-reset tokens retained in the schema for existing deployments; username recovery uses recoveryCodes. */
export const authTokens = mysqlTable("auth_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["VERIFICATION", "RESET_PASSWORD"]).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  tokenHashUnique: uniqueIndex("auth_tokens_tokenHash_unique").on(table.tokenHash),
}));

export type AuthToken = typeof authTokens.$inferSelect;
export type InsertAuthToken = typeof authTokens.$inferInsert;

/** Legacy table retained for non-destructive migrations; no recovery codes are issued or accepted. */
export const recoveryCodes = mysqlTable("recovery_codes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: varchar("codeHash", { length: 64 }).notNull().unique(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RecoveryCode = typeof recoveryCodes.$inferSelect;
export type InsertRecoveryCode = typeof recoveryCodes.$inferInsert;

/**
 * One bounded preferences/progress document per authenticated user.
 * The numeric foreign key is the sole ownership boundary; client requests never
 * carry a user id for this table.
 */
export const userData = mysqlTable("user_data", {
  userId: int("userId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  data: json("data").$type<UserDataMap>().notNull(),
  // Set explicitly on every write: this keeps millisecond CAS markers compatible
  // with MySQL deployments that reject DEFAULT now() on TIMESTAMP(3).
  updatedAt: datetime("updatedAt", { mode: "date", fsp: 3 }).notNull(),
});

export type UserData = typeof userData.$inferSelect;
export type InsertUserData = typeof userData.$inferInsert;
