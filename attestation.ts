/**
 * @module
 * Signed-attestation primitive for the capability chain (L2 launch ↔ L3 write).
 *
 * A `SignedAttestation` is a statement plus a detached signature over its
 * **canonical JSON** — the one representation a signer and a verifier in
 * different runtimes (and across a wire / a git note) agree on. The statement's
 * `predicate.level` (`"image" | "launch" | "write"`, see `./types`) distinguishes
 * the chain tier: a launcher signs a `level: "launch"` statement (L2), a keeper
 * signs `level: "write"` (L3), and the L3 links back to the L2 by digest.
 *
 * Crypto is **injected** (a `Signer`/`Verifier`), so this module is runtime-pure
 * (Deno/Bun/Node) and the caller owns key custody. `canonicalJson` is the shared
 * deterministic encoding both sides MUST use.
 */

/** Recursively sort object keys, then `JSON.stringify` — independent of key
 *  insertion order AND stable across a JSON round-trip (JSON drops
 *  `undefined`-valued keys; this matches that exactly, so a signature made before
 *  the value crosses a wire/note still verifies after). */
function sortDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortDeep);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) out[k] = sortDeep(obj[k]);
  return out;
}

/** Canonical JSON encoding: recursively sorts object keys, then stringifies. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

/** A statement + a base64 signature over `canonicalJson(statement)`. */
export type SignedAttestation = {
  /** The signed statement. */
  readonly statement: unknown;
  /** Base64-encoded signature over the canonical JSON statement. */
  readonly signature: string;
  /** Optional key identifier used for signing. */
  readonly keyId?: string;
};

/** Sign the canonical statement bytes, returning a base64 signature. */
export type Signer = (canonicalStatement: string) => string;

/** Verify a base64 signature over the canonical statement bytes. */
export type Verifier = (canonicalStatement: string, signatureBase64: string) => boolean;

/** True iff `value` is shaped like a {@link SignedAttestation}. */
export function isSignedAttestation(value: unknown): value is SignedAttestation {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { signature?: unknown }).signature === "string" &&
    "statement" in value &&
    (value as { statement?: unknown }).statement !== undefined
  );
}

/** Build a signed attestation: sign `canonicalJson(statement)` with `sign`. */
export function buildAttestation(
  statement: unknown,
  sign: Signer,
  keyId?: string,
): SignedAttestation {
  const signature = sign(canonicalJson(statement));
  return keyId !== undefined ? { statement, signature, keyId } : { statement, signature };
}

/**
 * Verify a signed attestation under `verify`. Returns false on malformed input or
 * a signature that does not verify. Subject/level/chain-link policy is the
 * caller's (this only proves the statement was signed by the trusted key).
 */
export function verifyAttestation(att: unknown, verify: Verifier): boolean {
  if (!isSignedAttestation(att)) return false;
  try {
    return verify(canonicalJson(att.statement), att.signature);
  } catch {
    return false;
  }
}
