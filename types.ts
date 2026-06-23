/**
 * CapabilityProvenance — TypeScript mirror of capability-provenance.v0.1.schema.json.
 *
 * The shared contract both claude-box (producer) and keeperd (signer/verifier)
 * pin. Keep this in lockstep with the JSON Schema; the schema is authoritative.
 * No imports — this file is copied verbatim when the contract is extracted to
 * its own repo (github.com/bounded-systems/ocap-provenance).
 */

export const PREDICATE_TYPE =
  "https://github.com/bounded-systems/ocap-provenance/predicate/CapabilityProvenance/v0.1" as const;

/** The in-toto Statement type URI per the in-toto spec v1. */
export const IN_TOTO_STATEMENT_TYPE = "https://in-toto.io/Statement/v1" as const;

/** Algorithm -> lowercase hex digest (in-toto DigestSet). */
export type DigestSet = { sha256?: string } & Record<string, string>;

/** A resource identified by name (optional) and one or more cryptographic digests. */
export type ResourceDigest = { name?: string; digest: DigestSet };

/** The level in the capability provenance chain: "image" (base), "launch" (spawned), or "write" (side-effect). */
export type ChainLevel = "image" | "launch" | "write";

/** A capability door: a named resource with optional socket, environment, and grant bindings. */
export type Door = { name: string; socket?: string; env?: string; grants?: string };

/** The OCAP surface the actor held — empty at level "image". */
export type Capabilities = {
  workcell?: string;
  /** sha256 of the $CLAUDE_BOX_CAPABILITIES JSON — the value bound launch -> write. */
  manifestDigest?: DigestSet;
  doors?: Door[];
  denied?: { name: string }[];
};

/** An input material to a provenance chain: a URI-identified resource with optional digest. */
export type Material = { uri: string; digest?: DigestSet };

/** A link in the capability chain back-reference: the level and digest of a predecessor. */
export type ChainLink = { level: ChainLevel; digest: DigestSet };

/** The core capability provenance predicate: signed owner, resources, permissions, and chain links. */
export type CapabilityProvenance = {
  level: ChainLevel;
  producer: { kind: "nix-flake" | "keeperd"; id: string };
  image?: ResourceDigest;
  capabilities?: Capabilities;
  materials?: Material[];
  links?: ChainLink[];
  metadata?: { invocationId?: string; startedOn?: string; finishedOn?: string };
};

/** The in-toto Statement envelope carrying a CapabilityProvenance predicate. */
export type CapabilityProvenanceStatement = {
  _type: typeof IN_TOTO_STATEMENT_TYPE;
  subject: ResourceDigest[];
  predicateType: typeof PREDICATE_TYPE;
  predicate: CapabilityProvenance;
};

/** Build the envelope around a predicate + its subject(s). */
export function statement(
  subject: ResourceDigest[],
  predicate: CapabilityProvenance,
): CapabilityProvenanceStatement {
  return {
    _type: IN_TOTO_STATEMENT_TYPE,
    subject,
    predicateType: PREDICATE_TYPE,
    predicate,
  };
}
