import "dotenv/config";
import { startServer } from "../start";

startServer().catch(error => { console.error(error); process.exit(1); });
