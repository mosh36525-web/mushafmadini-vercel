import { describe, expect, it } from "vitest";
import { mysqlConfig } from "./mysqlConfig";

describe("Aiven MySQL configuration", () => {
  it("fails closed if remote CA is missing", () => {
    expect(() => mysqlConfig({ DATABASE_URL: "mysql://user:secret@db.example:23964/defaultdb?ssl-mode=REQUIRED" })).toThrow("MYSQL_SSL_CA");
  });
  it("enforces certificate and hostname validation and bounds the pool", () => {
    const config = mysqlConfig({ DATABASE_URL: "mysql://user:p%40ss@db.example:23964/defaultdb?ssl-mode=REQUIRED", MYSQL_SSL_CA: "-----BEGIN CERTIFICATE-----\\nexample\\n-----END CERTIFICATE-----" });
    expect(config.password).toBe("p@ss");
    expect(config.ssl).toMatchObject({ rejectUnauthorized: true, verifyIdentity: true });
    expect(config.connectionLimit).toBe(2);
    expect(config.multipleStatements).toBe(false);
  });
});
