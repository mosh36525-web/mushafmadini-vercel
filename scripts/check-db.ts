import "dotenv/config";
import type { RowDataPacket } from "mysql2";
import { createConnection } from "mysql2/promise";
import { mysqlConfig } from "../server/mysqlConfig";

async function main() {
  const connection = await createConnection(mysqlConfig());
  try {
    await connection.query("SELECT 1");
    const [tlsRows] = await connection.query<RowDataPacket[]>("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
    console.log("MySQL connection OK; TLS:", JSON.stringify(tlsRows));

    const [tables] = await connection.query<RowDataPacket[]>("SHOW TABLES");
    console.log("Available table names:", JSON.stringify(tables));
    const tableNames = new Set(tables.map(row => String(Object.values(row)[0])));
    if (!tableNames.has("users")) {
      throw new Error("Database preflight stopped safely: required users table is missing.");
    }

    const [columns] = await connection.query<RowDataPacket[]>(`
      SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('users', 'auth_tokens')
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);
    console.log("Auth schema columns (names/types only):", JSON.stringify(columns));

    const [indexes] = await connection.query<RowDataPacket[]>(`
      SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('users', 'auth_tokens')
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
    `);
    console.log("Auth schema indexes (names only):", JSON.stringify(indexes));

    const [foreignKeys] = await connection.query<RowDataPacket[]>(`
      SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE CONSTRAINT_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
        AND TABLE_NAME IN ('users', 'auth_tokens')
      ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION
    `);
    console.log("Auth schema foreign keys (names only):", JSON.stringify(foreignKeys));

    const [duplicateEmailRows] = await connection.query<RowDataPacket[]>(`
      SELECT COUNT(*) AS duplicateGroups
      FROM (
        SELECT email FROM users
        WHERE email IS NOT NULL
        GROUP BY email
        HAVING COUNT(*) > 1
      ) AS duplicate_emails
    `);
    const duplicateEmailGroups = Number(duplicateEmailRows[0]?.duplicateGroups ?? 0);

    let duplicateTokenHashGroups = 0;
    let orphanTokenRows = 0;
    if (tableNames.has("auth_tokens")) {
      const [duplicateTokenRows] = await connection.query<RowDataPacket[]>(`
        SELECT COUNT(*) AS duplicateGroups
        FROM (
          SELECT tokenHash FROM auth_tokens
          WHERE tokenHash IS NOT NULL
          GROUP BY tokenHash
          HAVING COUNT(*) > 1
        ) AS duplicate_tokens
      `);
      duplicateTokenHashGroups = Number(duplicateTokenRows[0]?.duplicateGroups ?? 0);

      const [orphanRows] = await connection.query<RowDataPacket[]>(`
        SELECT COUNT(*) AS orphanRows
        FROM auth_tokens AS token
        LEFT JOIN users AS user ON user.id = token.userId
        WHERE user.id IS NULL
      `);
      orphanTokenRows = Number(orphanRows[0]?.orphanRows ?? 0);
    }

    console.log("Preflight counts only:", JSON.stringify({ duplicateEmailGroups, duplicateTokenHashGroups, orphanTokenRows }));
    if (duplicateEmailGroups || duplicateTokenHashGroups || orphanTokenRows) {
      throw new Error("Database preflight stopped safely: conflicting rows must be reviewed before adding unique constraints or foreign keys. No email, token, or user values were logged.");
    }
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : "Unknown database error";
  if (message.startsWith("Database preflight stopped safely:")) console.error(message);
  else console.error("Database check failed. Check DATABASE_URL, MYSQL_SSL_CA, credentials and Aiven allowlist. No secrets logged.");
  process.exitCode = 1;
});
