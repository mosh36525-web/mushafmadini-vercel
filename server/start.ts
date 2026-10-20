import { createServer } from "http";
import { createApp } from "./app";
import { serveStatic, setupVite } from "./_core/vite";

export async function startServer(): Promise<void> {
  const app = createApp();
  const server = createServer(app);

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid PORT");
  }

  server.on("error", error => {
    console.error("Server failed:", error.message);
    process.exitCode = 1;
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on port ${port}`);
  });
}
