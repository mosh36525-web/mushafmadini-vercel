import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { mysqlConfig } from "./server/mysqlConfig";

const connection = mysqlConfig();
export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: connection.host!,
    port: connection.port!,
    user: connection.user!,
    password: connection.password!,
    database: connection.database!,
    ssl: connection.ssl,
  },
});
