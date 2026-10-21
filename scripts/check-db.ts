import "dotenv/config";
import { createConnection } from "mysql2/promise";
import { mysqlConfig } from "../server/mysqlConfig";

async function main() {
  const connection = await createConnection(mysqlConfig());
  try {
    await connection.query("SELECT 1");
    const [rows] = await connection.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
    console.log("MySQL connection OK; TLS:", JSON.stringify(rows));
    const [tables] = await connection.query("SHOW TABLES");
    console.log("Available table names:", JSON.stringify(tables));
  } finally {
    await connection.end();
  }
}
main().catch(() => { console.error("Database check failed. Check DATABASE_URL, MYSQL_SSL_CA, credentials and Aiven allowlist. No secrets logged."); process.exitCode = 1; });
