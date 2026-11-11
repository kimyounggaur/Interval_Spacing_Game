import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import assert from "node:assert/strict";

const html = readFileSync("dist/index.html", "utf8");
const bytes = Buffer.byteLength(html);
const gzipBytes = gzipSync(html).length;
// Preserve the original code/font shell budgets. Approved visual media is
// separately self-hosted and precached under an explicit total payload budget.
assert.ok(bytes <= 400 * 1024, `index.html ${bytes} bytes exceeds 400 KiB`);
assert.ok(gzipBytes <= 120 * 1024, `gzip ${gzipBytes} bytes exceeds 120 KiB`);
assert.doesNotMatch(html, /<script[^>]+src=["'][^"']+["']/i, "JavaScript must be inline");
assert.doesNotMatch(html, /<link[^>]+rel=["']stylesheet["']/i, "CSS must be inline");
assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i, "No remote asset references");
assert.doesNotMatch(html, /@import\s+(?:url\()?\s*["']?https?:/i, "No external font imports");
assert.doesNotMatch(html, /url\(["']?https?:/i, "No external CSS assets");
assert.ok(!readdirSync("dist").includes("assets"), "No split JS/CSS assets directory");
const requiredShell = [
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "sw.js",
];
for (const file of requiredShell)
  assert.ok(statSync(`dist/${file}`).size > 0, `${file} is missing`);
const worker = readFileSync("dist/sw.js", "utf8");
assert.doesNotMatch(worker, /__BUILD_ID__/, "Cache version must match this build");

const manifest = JSON.parse(readFileSync("dist/art/media-manifest.json", "utf8"));
assert.equal(manifest.raster_count, 7, "All seven approved illustrations must ship");
assert.equal(manifest.svg_count, 64, "Editable source components must be retained");
assert.equal(manifest.assets.length, 7, "Media manifest must describe exactly seven illustrations");
assert.equal(
  readdirSync("src/assets/railway/vector").filter((file) => file.endsWith(".svg")).length,
  64,
  "All editable source vectors must remain in the repository",
);
const expectedArt = [
  "title-hero",
  "route-map",
  "meadow",
  "village",
  "mountains",
  "night-tunnel",
  "sea-bridge",
];
const readWebpSize = (buffer) => {
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
  assert.equal(buffer.toString("ascii", 8, 12), "WEBP");
  for (let offset = 12; offset + 8 < buffer.length;) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === "VP8X")
      return [buffer.readUIntLE(data + 4, 3) + 1, buffer.readUIntLE(data + 7, 3) + 1];
    if (type === "VP8 ")
      return [buffer.readUInt16LE(data + 6) & 0x3fff, buffer.readUInt16LE(data + 8) & 0x3fff];
    if (type === "VP8L") {
      const bits = buffer.readUInt32LE(data + 1);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("WebP dimensions not found");
};
let mediaBytes = 0;
for (const name of expectedArt) {
  const url = `/art/${name}.webp`;
  const entry = manifest.assets.find((asset) => asset.url === url);
  assert.ok(entry, `${url} missing in media manifest`);
  assert.equal(
    entry.source,
    `Interval_Railway_Assets_v1_20261111/raster/${name}.png`,
    `${url} must retain its approved source provenance`,
  );
  assert.match(entry.source_sha256, /^[a-f0-9]{64}$/, `${url} needs a source digest`);
  assert.ok(worker.includes(`"${url}"`), `${url} must be precached`);
  assert.ok(html.includes(url), `${url} must be consumed by the application`);
  const buffer = readFileSync(`dist${url}`);
  assert.equal(buffer.length, entry.bytes, `${url} size differs from manifest`);
  assert.equal(
    createHash("sha256").update(buffer).digest("hex"),
    entry.sha256,
    `${url} hash differs`,
  );
  const size = readWebpSize(buffer);
  assert.deepEqual(size, [entry.width, entry.height], `${url} dimensions differ`);
  assert.ok(size[0] >= 1080, `${url} too small for the approved visual treatment`);
  assert.equal(entry.encoding.crop, false, "Artwork must not be cropped in the source conversion");
  mediaBytes += buffer.length;
}
assert.equal(mediaBytes, manifest.total_raster_bytes, "Media total differs from manifest");
const shellBytes =
  bytes + requiredShell.reduce((total, file) => total + statSync(`dist/${file}`).size, 0);
const offlineBytes = shellBytes + mediaBytes;
assert.ok(
  offlineBytes <= 1.5 * 1024 * 1024,
  `Offline payload ${offlineBytes} bytes exceeds 1.5 MiB`,
);
// The build id independently reproduces the digest of all shipped non-worker
// files, so a media-only edit cannot accidentally keep an obsolete cache.
const files = (directory) =>
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
assert.ok(
  worker.includes(`ijs-railway-${digest.digest("hex").slice(0, 12)}`),
  "Media-aware cache digest mismatch",
);
console.log(
  `bundle PASS: HTML ${bytes} bytes, gzip ${gzipBytes}; media ${mediaBytes}; full offline payload ${offlineBytes} bytes; 7 self-hosted illustrations`,
);
