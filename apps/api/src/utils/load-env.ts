import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootEnvPath = resolve(__dirname, "../../../../.env");

if (process.env.NODE_ENV !== "production") {
  const result = config({ path: rootEnvPath });

  if (result.error) {
    console.warn(`[API] Optional .env not found at ${rootEnvPath}: ${result.error.message}`);
  }
}
