import { test } from "bun:test";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { assertSeam } from "@bounded-systems/seam-check";

// Flat layout (no src/): the package's .ts live at the repo root.
const ROOT = dirname(fileURLToPath(import.meta.url));

// @bounded-systems/ocap-provenance is a pure contract leaf — a capability-use
// provenance schema + SLSA mapping. Its prod files (types/attestation/slsa)
// import NOTHING external (prod: []); the harness proves that and that prod
// code holds no ambient authority. Tests may reach node:crypto (signing).
test("@bounded-systems/ocap-provenance upholds its seam claim", () => {
  assertSeam({
    root: ROOT,
    prod: [],
    test: ["@bounded-systems/ocap-provenance", "@bounded-systems/seam-check", "node:crypto"],
  });
});
