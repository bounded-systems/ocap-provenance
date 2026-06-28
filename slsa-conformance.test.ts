/**
 * slsa-conformance.test.ts (trust ledger row 4.5) — prove the format is real, not
 * just kinship: `toSLSA()` must emit a structurally VALID in-toto Statement v1
 * carrying a structurally VALID SLSA Provenance v1 predicate.
 *
 * The requirements asserted below are transcribed from the PUBLISHED specs —
 * in-toto/attestation `spec/v1/statement.md` and `slsa.dev/spec/v1.0/provenance`
 * — and checked with generic structural predicates, NOT against our own TS types.
 * So this is conformance to the format *spec*, the schema-layer analogue of the
 * DSSE interop proof (anchored-chain / ledger 4.4). It deliberately proves the
 * FORMAT only; it asserts no SLSA build *level* (that's a separate, unclaimed bar).
 */
import { describe, expect, test } from "bun:test";

import { SLSA_PROVENANCE_V1, toSLSA } from "./slsa.ts";
import { statement } from "./types.ts";

// ── requirements transcribed from the published specs ───────────────────────
const IN_TOTO_STATEMENT_V1 = "https://in-toto.io/Statement/v1";

/** field_types.md#TypeURI: an absolute URI. */
const isTypeURI = (v: unknown): v is string => typeof v === "string" && /^[a-z][a-z0-9+.-]*:\/\//.test(v);

/** digest_set.md: a non-empty map of algorithm → lowercase-hex string. */
function isDigestSet(d: unknown): boolean {
  if (!d || typeof d !== "object") return false;
  const e = Object.entries(d as Record<string, unknown>);
  return e.length > 0 && e.every(([alg, hex]) => alg.length > 0 && typeof hex === "string" && /^[0-9a-f]+$/.test(hex));
}

/** statement.md: `_type` (TypeURI, required) · `subject` (array of
 *  ResourceDescriptor, required, each MUST have `digest`) · `predicateType`
 *  (TypeURI, required) · `predicate` (object). */
function assertInTotoStatementV1(s: Record<string, any>): void {
  expect(s._type).toBe(IN_TOTO_STATEMENT_V1);
  expect(Array.isArray(s.subject)).toBe(true);
  expect(s.subject.length).toBeGreaterThan(0);
  for (const sub of s.subject) expect(isDigestSet(sub.digest)).toBe(true); // each MUST have digest
  expect(isTypeURI(s.predicateType)).toBe(true);
  expect(s.predicate !== null && typeof s.predicate === "object").toBe(true);
}

/** slsa.dev/provenance/v1: `buildDefinition` (required) with `buildType` (TypeURI)
 *  + `externalParameters` (object); `runDetails` (required) with `builder.id`
 *  (TypeURI). `resolvedDependencies`, if present, is an array of descriptors. */
function assertSlsaProvenanceV1(p: Record<string, any>): void {
  expect(p.buildDefinition !== null && typeof p.buildDefinition === "object").toBe(true);
  expect(isTypeURI(p.buildDefinition.buildType)).toBe(true);
  expect(typeof p.buildDefinition.externalParameters).toBe("object");
  if (p.buildDefinition.resolvedDependencies !== undefined) {
    expect(Array.isArray(p.buildDefinition.resolvedDependencies)).toBe(true);
    for (const dep of p.buildDefinition.resolvedDependencies) {
      // resource_descriptor.md: a descriptor MUST set at least one of uri/digest/content.
      expect(typeof dep.uri === "string" || isDigestSet(dep.digest)).toBe(true);
    }
  }
  expect(p.runDetails !== null && typeof p.runDetails === "object").toBe(true);
  expect(isTypeURI(p.runDetails.builder.id)).toBe(true);
}

describe("toSLSA conformance to the published in-toto/SLSA format specs (4.5)", () => {
  // A representative L3 keeper git-write attestation.
  const sample = statement([{ name: "gitCommit:1f2e3d", digest: { sha256: "a".repeat(64) } }], {
    level: "write",
    producer: { kind: "keeperd", id: "keeperd@v1" },
    materials: [{ uri: "git+https://github.com/bounded-systems/trust", digest: { sha1: "b".repeat(40) } }],
    links: [{ level: "launch", digest: { sha256: "c".repeat(64) } }],
    metadata: { invocationId: "inv-1", startedOn: "2026-06-28T00:00:00Z", finishedOn: "2026-06-28T00:01:00Z" },
  });

  // Serialize → parse, so we validate the actual on-the-wire JSON document.
  const slsa = JSON.parse(JSON.stringify(toSLSA(sample))) as Record<string, any>;

  test("emits a valid in-toto Statement v1 envelope", () => {
    assertInTotoStatementV1(slsa);
  });

  test("carries a valid SLSA Provenance v1 predicate (standard predicateType)", () => {
    expect(slsa.predicateType).toBe(SLSA_PROVENANCE_V1); // https://slsa.dev/provenance/v1
    assertSlsaProvenanceV1(slsa.predicate);
  });

  test("the subject digest survives the projection unchanged", () => {
    expect(slsa.subject[0].digest).toEqual({ sha256: "a".repeat(64) });
  });
});
