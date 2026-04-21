import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootEnvPath = resolve(__dirname, "../../../../.env");

const result = config({ path: rootEnvPath });

if (result.error) {
  throw new Error(`[API] Failed to load .env from ${rootEnvPath}: ${result.error.message}`);
}
