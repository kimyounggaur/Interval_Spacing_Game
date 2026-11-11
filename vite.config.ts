import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

export default defineConfig({
  plugins: [
    viteSingleFile(),
    {
      name: "drive-cache-version",
      closeBundle() {
        const hash = createHash("sha256")
          .update(readFileSync("dist/index.html"))
          .digest("hex")
          .slice(0, 12);
        const worker = readFileSync("dist/sw.js", "utf8").replace("__BUILD_ID__", hash);
        writeFileSync("dist/sw.js", worker);
      },
    },
  ],
  build: {
    target: "es2022",
    sourcemap: false,
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});
