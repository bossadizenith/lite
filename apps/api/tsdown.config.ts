import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/app.ts"],
  format: ["esm"],
  clean: true,
  minify: true,
  deps: {
    alwaysBundle: ["hono", "dotenv"],
  },
  dts: false,
  target: false,
});
