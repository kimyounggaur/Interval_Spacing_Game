import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

// Pack recurring SVG markup once in the production single-file build. The
// original editable SVG files and development imports remain unchanged.
function packedRulebook() {
  const folder = resolve("src/assets/rulebook");
  const virtual = "virtual:packed-rulebook";
  const resolved = "\0" + virtual;
  // These are literal SVG fragments; placeholders never overlap a fragment.
  const fragments = [
    '" stroke-linecap="round" stroke-linejoin="round"',
    '" font-family="system-ui, sans-serif" font-weigh',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 280"><rect x="2" y="2" width="636" height="276" rx="12" fill="#f8efd9" stroke="#b78a3e" stroke-width="3"/><rect x="9" y="9" width="622"',
    '" stroke-wid',
    'e" stroke="#',
    'th="2"/><circle cx="25" cy="29" r="3" fill="#b78a3e"/><circle cx="615" cy="29" r="3" fill="#b78a3e"/><circle cx="25" cy="251" r="3" fill="#b78a3e"/><circle cx="615" cy="251" r="3" fill="#b78a3',
    '/><path d="M',
    '" fill="#fff',
    't="600" font',
    '" text-ancho',
    "><circle cx=",
    '" stroke="#b',
    '" fill="#245444" stroke=',
    '" fill="#203',
    '2" fill="non',
    '7" fill="non',
    '" stroke-linecap="round"',
    '" width="22" height="19" rx="2" fill="#ecdfbf" s',
    '"/><rect x="',
    '"/><text x="',
    "</text><text",
    '" opacity=".',
    '" width="36" height="35"',
    'troke="#2038',
    '" fill="#245',
  ];
  return {
    name: "packed-rulebook",
    enforce: "pre" as const,
    apply: "build" as const,
    resolveId(id: string) {
      return id === virtual ? resolved : null;
    },
    load(id: string) {
      if (id === resolved) {
        const entries = Object.fromEntries(
          readdirSync(folder)
            .filter((name) => name.endsWith(".svg"))
            .sort()
            .map((name) => {
              const original = readFileSync(join(folder, name), "utf8");
              let content = original;
              if (content.includes("~"))
                throw new Error("Rulebook SVG contains a reserved placeholder");
              fragments.forEach((fragment, index) => {
                content = content
                  .split(/(~[A-Z])/g)
                  .map((part) =>
                    /^~[A-Z]$/.test(part)
                      ? part
                      : part.split(fragment).join("~" + String.fromCharCode(65 + index)),
                  )
                  .join("");
              });
              const restored = content.replace(
                /~([A-Z])/g,
                (_, letter: string) => fragments[letter.charCodeAt(0) - 65]!,
              );
              if (restored !== original) throw new Error(`Rulebook SVG packing failed: ${name}`);
              return [name, content];
            }),
        );
        return `const fragments=${JSON.stringify(fragments)},data=${JSON.stringify(entries)};
          for(const key of Object.keys(data))
            data[key]=data[key].replace(/~([A-Z])/g,(_,letter)=>fragments[letter.charCodeAt(0)-65]);
          export default data;`;
      }
      const match = id.match(/^(.*\.svg)\?raw$/);
      if (match && resolve(match[1]!).startsWith(folder + "/"))
        return `import art from ${JSON.stringify(virtual)}; export default art[${JSON.stringify(basename(match[1]!))}];`;
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    packedRulebook(),
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
