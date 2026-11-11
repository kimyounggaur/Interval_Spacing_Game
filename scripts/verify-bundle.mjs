import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import assert from "node:assert/strict";

const html = readFileSync("dist/index.html", "utf8");
const bytes = Buffer.byteLength(html);
const gzipBytes = gzipSync(html).length;
assert.ok(bytes <= 400 * 1024, `index.html ${bytes} bytes exceeds 400 KiB`);
assert.ok(gzipBytes <= 120 * 1024, `gzip ${gzipBytes} bytes exceeds 120 KiB`);
assert.doesNotMatch(html, /<script[^>]+src=["'][^"']+["']/i, "JavaScript must be inline");
assert.doesNotMatch(html, /<link[^>]+rel=["']stylesheet["']/i, "CSS must be inline");
assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i, "No remote asset references");
assert.doesNotMatch(html, /@import\s+(?:url\()?\s*["']?https?:/i, "No external font imports");
assert.doesNotMatch(html, /url\(["']?https?:/i, "No external CSS assets");
assert.ok(!readdirSync("dist").includes("assets"), "No split JS/CSS assets directory");
for (const file of ["manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "sw.js"]) {
  assert.ok(statSync(`dist/${file}`).size > 0, `${file} is missing`);
}
assert.doesNotMatch(readFileSync("dist/sw.js", "utf8"), /__BUILD_ID__/, "Cache version must match this build");
console.log(`bundle PASS: ${bytes} bytes, gzip ${gzipBytes} bytes; self-contained assets and PWA shell present`);
