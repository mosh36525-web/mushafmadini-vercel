import type { PoolOptions } from "mysql2/promise";

/** Parse explicitly: mysql2 does not interpret Aiven's ssl-mode URI option. */
export function mysqlConfig(env: NodeJS.ProcessEnv = process.env): PoolOptions {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const url = new URL(env.DATABASE_URL);
  if (url.protocol !== "mysql:") throw new Error("DATABASE_URL must use mysql://");
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  const ca = env.MYSQL_SSL_CA?.replace(/\\n/g, "\n").trim();
  if (!local && !ca) throw new Error("MYSQL_SSL_CA is required for verified TLS");
  if (ca && !ca.includes("-----BEGIN CERTIFICATE-----")) throw new Error("MYSQL_SSL_CA must contain a PEM certificate");
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    ...(local && !ca ? {} : { ssl: { ca, rejectUnauthorized: true, verifyIdentity: true } }),
    connectionLimit: 2,
    maxIdle: 1,
    idleTimeout: 30_000,
    connectTimeout: 10_000,
    waitForConnections: true,
    queueLimit: 50,
    enableKeepAlive: true,
    multipleStatements: false,
    timezone: "Z",
  };
}
