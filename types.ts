/**
 * @module
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
export type DigestSet = {
  /** SHA-256 digest (optional). */
  sha256?: string;
} & Record<string, string>;

/** A resource identified by name (optional) and one or more cryptographic digests. */
export type ResourceDigest = {
  /** Optional resource name. */
  name?: string;
  /** One or more cryptographic digests. */
  digest: DigestSet;
};

/** The level in the capability provenance chain: "image" (base), "launch" (spawned), or "write" (side-effect). */
export type ChainLevel = "image" | "launch" | "write";

/** A capability door: a named resource with optional socket, environment, and grant bindings. */
export type Door = {
  /** Name of the capability door. */
  name: string;
  /** Optional socket reference. */
  socket?: string;
  /** Optional environment variable. */
  env?: string;
  /** Optional grant binding. */
  grants?: string;
};

/** The OCAP surface the actor held — empty at level "image". */
export type Capabilities = {
  /** Optional workcell identifier. */
  workcell?: string;
  /** SHA-256 of the $CLAUDE_BOX_CAPABILITIES JSON — the value bound launch -> write. */
  manifestDigest?: DigestSet;
  /** Accessible capability doors. */
  doors?: Door[];
  /** Denied resources. */
  denied?: {
    /** Name of the denied resource. */
    name: string;
  }[];
};

/** An input material to a provenance chain: a URI-identified resource with optional digest. */
export type Material = {
  /** URI identifying the material resource. */
  uri: string;
  /** Optional cryptographic digests. */
  digest?: DigestSet;
};

/** A link in the capability chain back-reference: the level and digest of a predecessor. */
export type ChainLink = {
  /** The level of the predecessor in the chain: "image", "launch", or "write". */
  level: ChainLevel;
  /** Digest of the predecessor statement. */
  digest: DigestSet;
};

/** The core capability provenance predicate: signed owner, resources, permissions, and chain links. */
export type CapabilityProvenance = {
  /** The level of the provenance chain: "image" (base), "launch" (spawned), or "write" (side-effect). */
  level: ChainLevel;
  /** The producer that generated this provenance. */
  producer: {
    /** Kind of producer: "nix-flake" or "keeperd". */
    kind: "nix-flake" | "keeperd";
    /** Producer identifier. */
    id: string;
  };
  /** The base image referenced in this provenance (optional). */
  image?: ResourceDigest;
  /** Capabilities held at this level. */
  capabilities?: Capabilities;
  /** Input materials to the build/execution. */
  materials?: Material[];
  /** Chain links to predecessor statements. */
  links?: ChainLink[];
  /** Build/execution metadata. */
  metadata?: {
    /** Unique invocation identifier. */
    invocationId?: string;
    /** ISO 8601 timestamp when execution started. */
    startedOn?: string;
    /** ISO 8601 timestamp when execution finished. */
    finishedOn?: string;
  };
};

/** The in-toto Statement envelope carrying a CapabilityProvenance predicate. */
export type CapabilityProvenanceStatement = {
  /** The in-toto statement type URI. */
  _type: typeof IN_TOTO_STATEMENT_TYPE;
  /** The subject(s) of this statement. */
  subject: ResourceDigest[];
  /** The predicate type URI. */
  predicateType: typeof PREDICATE_TYPE;
  /** The capability provenance predicate. */
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
