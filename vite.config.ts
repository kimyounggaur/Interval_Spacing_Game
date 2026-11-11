import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

export default defineConfig({
  plugins: [
    viteSingleFile(),
    {
      name: "drive-cache-version",
      closeBundle() {
        // Media bytes participate in the version: changing an illustration must
        // produce a fresh offline cache even when application code is unchanged.
        const files = (directory: string): string[] =>
          readdirSync(directory).flatMap((name) => {
            const path = join(directory, name);
            return statSync(path).isDirectory() ? files(path) : [path];
          });
        const digest = createHash("sha256");
        for (const file of files("dist")
          .filter((file) => file !== join("dist", "sw.js"))
          .sort()) {
          digest.update(relative("dist", file));
          digest.update(readFileSync(file));
        }
        const hash = digest.digest("hex").slice(0, 12);
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
