# ocap-provenance — SLSA Provenance v1 with OCAP extensions

**Format:** [SLSA Provenance v1](https://slsa.dev/spec/v1.0/provenance) with OCAP
capability extensions.

## Quick start

```ts
import { statement } from "@bounded-systems/ocap-provenance";
import { toSLSA } from "@bounded-systems/ocap-provenance/slsa";

// Build a capability provenance statement
const stmt = statement(
  [{ name: "my-artifact", digest: { sha256: "abc123" } }],
  {
    level: "write",
    producer: { kind: "keeperd", id: "keeperd@sha256:deadbeef" },
    capabilities: {
      doors: [{ name: "git-write", socket: "/run/doors/git-write" }],
      denied: [],
    },
  },
);

// Convert to SLSA Provenance v1 for cosign / sigstore tooling
const slsa = toSLSA(stmt);
console.log(slsa.predicateType); // "https://slsa.dev/provenance/v1"
```

```ts
import { buildAttestation, verifyAttestation } from "@bounded-systems/ocap-provenance/attestation";

// Sign a statement (inject your own signer — runtime-agnostic)
const signed = buildAttestation(stmt, (canonical) => mySign(canonical));

// Verify
const ok = verifyAttestation(signed, (canonical, sig) => myVerify(canonical, sig));
``` Uses the standard `https://slsa.dev/provenance/v1` predicate
type for tooling compatibility, with OCAP-specific fields in `externalParameters`
and the `ocap_links` extension.

## Why SLSA Provenance v1

- **Tooling compatibility:** cosign, sigstore, and SLSA verification tools understand it
- **Standard envelope:** in-toto Statement v1 (`https://in-toto.io/Statement/v1`)
- **Extension-friendly:** SLSA allows vendor extensions like `ocap_links`

## What's novel: capability-aware provenance

Standard provenance answers *"who/what produced this artifact, and how."*
claude-box adds a dimension: *"what authority did the producing actor hold."*
The `$CLAUDE_BOX_CAPABILITIES` manifest (the OCAP surface — which doors were
granted, which were denied) lives in `externalParameters.capabilities`. A verifier
can check not just "nix built this image" / "keeper signed this commit," but
**"the box that asked for this write held exactly these doors and no others."**

## buildType URIs

Each level in the chain has its own buildType:

| Level | buildType | Producer |
|-------|-----------|----------|
| L1 image | `https://claude.ai/buildTypes/ocap-image/v1` | nix flake |
| L2 launch | `https://claude.ai/buildTypes/ocap-launch/v1` | launcherd |
| L3 write | `https://claude.ai/buildTypes/ocap-write/v1` | keeperd |

## OCAP extensions

- **`externalParameters.capabilities`** — the OCAP surface: `doors[]`, `denied[]`,
  `manifestDigest`, `workcell`
- **`runDetails.ocap_links`** — chain back-references (L2→L1, L3→L2)

## Files

- **[`CHAIN.md`](./CHAIN.md)** — how the three levels link
- **[`SLSA-MAPPING.md`](./SLSA-MAPPING.md)** — mapping from legacy format
- **[`slsa.ts`](./slsa.ts)** — SLSA conversion functions (`toSLSA`, `fromSLSA`)
- **[`types.ts`](./types.ts)** — internal OCAP types (used before conversion)
- **[`capability-provenance.v0.1.schema.json`](./capability-provenance.v0.1.schema.json)** — legacy schema

## References

- [SLSA Specification v1.0](https://slsa.dev/spec/v1.0/)
- [SLSA Provenance v1.0](https://slsa.dev/spec/v1.0/provenance)
- [slsa-framework/slsa](https://github.com/slsa-framework/slsa)
- [in-toto](https://github.com/in-toto/in-toto) — software supply chain integrity
- [in-toto Attestation Framework](https://github.com/in-toto/attestation)
- [in-toto Statement v1](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md)
- [in-toto.io](https://in-toto.io/)
- [in-toto/friends](https://github.com/in-toto/friends) — ecosystem integrations
