/**
 * @module
 * slsa.ts — Convert CapabilityProvenance to SLSA Provenance v1 format.
 *
 * This provides interoperability with SLSA tooling while preserving OCAP semantics.
 * See SLSA-MAPPING.md for the mapping rationale.
 */

import type {
  CapabilityProvenanceStatement,
  CapabilityProvenance,
  ChainLevel,
  DigestSet,
  ResourceDigest,
  Capabilities,
  ChainLink,
  Material,
} from "./types";
import { IN_TOTO_STATEMENT_TYPE, PREDICATE_TYPE } from "./types";

// Re-export types from types.ts used in this module's public API
export type { CapabilityProvenanceStatement, CapabilityProvenance, ChainLevel, DigestSet, ResourceDigest, Capabilities, ChainLink, Material, Door };
export { IN_TOTO_STATEMENT_TYPE, PREDICATE_TYPE };

// ── SLSA Provenance v1 types ────────────────────────────────────────────────

/** The SLSA Provenance v1 predicate type URI. */
export const SLSA_PROVENANCE_V1 = "https://slsa.dev/provenance/v1" as const;

/** SLSA buildType URIs for each OCAP level: image (base), launch (spawned), write (side-effect). */
export const BUILD_TYPES = {
  /** Base image level. */
  image: "https://claude.ai/buildTypes/ocap-image/v1",
  /** Spawned launch level. */
  launch: "https://claude.ai/buildTypes/ocap-launch/v1",
  /** Side-effect write level. */
  write: "https://claude.ai/buildTypes/ocap-write/v1",
} as const;

/** Algorithm → hex digest mapping for SLSA provenance. */
export type SLSADigestSet = Record<string, string>; // Maps algorithm names to hex digest strings

/** A resource in SLSA provenance: uri, digest, name, optional metadata. */
export type SLSAResourceDescriptor = {
  /** URI identifying the resource. */
  uri?: string;
  /** Algorithm → hex digest mapping. */
  digest?: SLSADigestSet;
  /** Human-readable name of the resource. */
  name?: string;
  /** Download location of the resource. */
  downloadLocation?: string;
  /** MIME type of the resource. */
  mediaType?: string;
  /** Base64-encoded resource content. */
  content?: string;
};

/** A builder in SLSA provenance: identified by URI, optional version and dependencies. */
export type SLSABuilder = {
  /** Builder identifier (URI). */
  id: string;
  /** Builder version information. */
  version?: Record<string, string>;
  /** Builder dependencies. */
  builderDependencies?: SLSAResourceDescriptor[];
};

/** Build execution metadata: invocation ID, start time, and finish time. */
export type SLSAMetadata = {
  /** Unique invocation identifier. */
  invocationId?: string;
  /** ISO 8601 timestamp when execution started. */
  startedOn?: string;
  /** ISO 8601 timestamp when execution finished. */
  finishedOn?: string;
};

/** SLSA build definition: build type, external/internal parameters, resolved dependencies. */
export type SLSABuildDefinition = {
  /** Build type URI. */
  buildType: string;
  /** External build parameters (visible to the builder). */
  externalParameters: Record<string, unknown>;
  /** Internal build parameters (not visible externally). */
  internalParameters?: Record<string, unknown>;
  /** Resolved dependency resources. */
  resolvedDependencies?: SLSAResourceDescriptor[];
};

/** SLSA run details: builder, metadata, byproducts, and optional OCAP chain links. */
export type SLSARunDetails = {
  /** The builder that executed this build. */
  builder: SLSABuilder;
  /** Build execution metadata. */
  metadata?: SLSAMetadata;
  /** Build byproducts (artifacts generated during execution). */
  byproducts?: SLSAResourceDescriptor[];
  /** OCAP chain links (extension field for capability provenance). */
  ocap_links?: ChainLink[];
};

/** SLSA Provenance v1 predicate: build definition and run details. */
export type SLSAProvenanceV1 = {
  /** The build definition (type, parameters, dependencies). */
  buildDefinition: SLSABuildDefinition;
  /** The run details (builder, metadata, byproducts). */
  runDetails: SLSARunDetails;
};

/** An in-toto Statement carrying a SLSA Provenance v1 predicate. */
export type SLSAStatement = {
  /** The in-toto statement type URI. */
  _type: typeof IN_TOTO_STATEMENT_TYPE;
  /** The subject(s) of this statement. */
  subject: SLSAResourceDescriptor[];
  /** The SLSA Provenance v1 predicate type URI. */
  predicateType: typeof SLSA_PROVENANCE_V1;
  /** The SLSA provenance predicate. */
  predicate: SLSAProvenanceV1;
};

// ── Conversion functions ────────────────────────────────────────────────────

/** Map CapabilityProvenance producer to SLSA builder */
function toBuilder(producer: CapabilityProvenance["producer"]): SLSABuilder {
  const kindToId: Record<string, string> = {
    "nix-flake": "https://claude.ai/builders/nix-flake/v1",
    keeperd: "https://claude.ai/builders/keeperd/v1",
  };

  return {
    id: kindToId[producer.kind] ?? `https://claude.ai/builders/${producer.kind}/v1`,
    version: { ref: producer.id },
  };
}

/** Convert materials to SLSA resolvedDependencies */
function toResolvedDependencies(materials?: Material[]): SLSAResourceDescriptor[] | undefined {
  if (!materials?.length) return undefined;

  return materials.map((m) => ({
    uri: m.uri,
    digest: m.digest as SLSADigestSet | undefined,
  }));
}

/** Convert ResourceDigest to SLSA subject format */
function toSubject(subject: ResourceDigest[]): SLSAResourceDescriptor[] {
  return subject.map((s) => ({
    name: s.name,
    digest: s.digest as SLSADigestSet,
  }));
}

/**
 * Convert a CapabilityProvenanceStatement to SLSA Provenance v1 format.
 *
 * The OCAP-specific fields are placed in:
 * - `buildDefinition.externalParameters.capabilities` — the OCAP surface
 * - `buildDefinition.externalParameters.image` — the box image (if present)
 * - `runDetails.ocap_links` — chain back-references (extension field)
 */
export function toSLSA(stmt: CapabilityProvenanceStatement): SLSAStatement {
  const pred = stmt.predicate;

  const externalParameters: Record<string, unknown> = {};

  // OCAP capabilities go in externalParameters (what the caller requested)
  if (pred.capabilities) {
    externalParameters.capabilities = pred.capabilities;
  }

  // Image reference (for launch/write levels)
  if (pred.image) {
    externalParameters.image = pred.image;
  }

  const slsaPredicate: SLSAProvenanceV1 = {
    buildDefinition: {
      buildType: BUILD_TYPES[pred.level],
      externalParameters,
      internalParameters: {},
      resolvedDependencies: toResolvedDependencies(pred.materials),
    },
    runDetails: {
      builder: toBuilder(pred.producer),
      metadata: pred.metadata,
      // Extension field for chain links
      ocap_links: pred.links,
    },
  };

  return {
    _type: IN_TOTO_STATEMENT_TYPE,
    subject: toSubject(stmt.subject),
    predicateType: SLSA_PROVENANCE_V1,
    predicate: slsaPredicate,
  };
}

/**
 * Convert SLSA Provenance v1 back to CapabilityProvenanceStatement.
 *
 * This is the inverse of toSLSA() — useful for verifiers that receive
 * SLSA-formatted attestations but want to work with the OCAP types.
 */
export function fromSLSA(slsa: SLSAStatement): CapabilityProvenanceStatement {
  const pred = slsa.predicate;
  const buildType = pred.buildDefinition.buildType;

  // Determine level from buildType
  let level: ChainLevel = "image";
  if (buildType === BUILD_TYPES.launch) level = "launch";
  else if (buildType === BUILD_TYPES.write) level = "write";

  // Extract producer from builder
  const builderId = pred.runDetails.builder.id;
  let kind: "nix-flake" | "keeperd" = "keeperd";
  if (builderId.includes("nix-flake")) kind = "nix-flake";

  const producerId = pred.runDetails.builder.version?.ref ?? builderId;

  // Extract capabilities and image from externalParameters
  const extParams = pred.buildDefinition.externalParameters;
  const capabilities = extParams.capabilities as Capabilities | undefined;
  const image = extParams.image as ResourceDigest | undefined;

  // Convert resolvedDependencies back to materials
  const materials: Material[] | undefined = pred.buildDefinition.resolvedDependencies?.map((d) => ({
    uri: d.uri ?? "",
    digest: d.digest as DigestSet | undefined,
  }));

  // Subject conversion
  const subject: ResourceDigest[] = slsa.subject.map((s) => ({
    name: s.name,
    digest: s.digest as DigestSet,
  }));

  return {
    _type: IN_TOTO_STATEMENT_TYPE,
    subject,
    predicateType: "https://github.com/bounded-systems/ocap-provenance/predicate/CapabilityProvenance/v0.1",
    predicate: {
      level,
      producer: { kind, id: producerId },
      image,
      capabilities,
      materials: materials?.length ? materials : undefined,
      links: pred.runDetails.ocap_links,
      metadata: pred.runDetails.metadata,
    },
  };
}
