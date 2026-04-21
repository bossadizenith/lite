import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  minify: true,
  noExternal: ["hono", "dotenv"],
  bundle: true,
});
