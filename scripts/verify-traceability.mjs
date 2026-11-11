import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("docs/test-matrix.md", "utf8");
const required = [
  "BASE-BOARD",
  "BASE-SEED",
  "BASE-SAVE-1",
  "BASE-SAVE-2",
  "BASE-SAVE-3",
  ...Object.entries({ TH: 12, GN: 6, RN: 6, ST: 5, SV: 6, AU: 4, CT: 3, E: 15 }).flatMap(
    ([group, count]) =>
      Array.from({ length: count }, (_, i) => `${group}-${String(i + 1).padStart(2, "0")}`),
  ),
];
const rows = source
  .split("\n")
  .filter((line) => line.startsWith("| "))
  .map((line) =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim()),
  )
  .filter((row) => required.includes(row[0]));
for (const id of required) {
  const matches = rows.filter((row) => row[0] === id);
  assert.equal(matches.length, 1, `${id}: expected exactly one traceability row`);
  const row = matches[0];
  assert.equal(row.length, 6, `${id}: expected six columns`);
  assert.ok(existsSync(row[2]), `${id}: implementation file missing: ${row[2]}`);
  assert.ok(existsSync(row[3]), `${id}: test file missing: ${row[3]}`);
  assert.ok(
    ["PASS", "PENDING", "PARTIAL", "FAIL", "NOT_RUN"].includes(row[5]),
    `${id}: unknown status`,
  );
  if (row[5] === "PASS")
    assert.match(row[4], /\d{4}-\d{2}-\d{2}/, `${id}: PASS requires dated execution evidence`);
}
console.log(
  `traceability PASS: ${required.length} contracts, existing implementation/test files, dated PASS evidence`,
);
