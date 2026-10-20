import { datetime, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import type { UserDataMap } from "../shared/userData";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * One bounded preferences/progress document per authenticated Manus user.
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
