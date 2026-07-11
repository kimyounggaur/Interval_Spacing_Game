import fs from "node:fs";
import path from "node:path";

const matrix = path.resolve("docs/test-matrix.md");
const source = fs.readFileSync(matrix, "utf8");
const required = [
  "DAT-BOARD-001",
  "DAT-DECK-001",
  "ENG-GREEN-001",
  "ENG-YEL-001",
  "RED-LOCK-001",
  "RED-LEAK-001",
  "SAV-V2-001",
  "A11Y-TARGET-001",
  "PWA-OFF-001",
];
const missing = required.filter((id) => !source.includes(id));
if (missing.length) {
  console.error(`traceability missing: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`traceability ok: ${required.length} required contracts found`);
