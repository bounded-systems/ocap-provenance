// Checks for the signed-attestation primitive (L2 launch ↔ L3 write chain).
// Crypto is injected; the test uses node:crypto ed25519 as a concrete Signer/Verifier.
import { describe, test, expect } from "bun:test";
import { generateKeyPairSync, sign as edSign, verify as edVerify, type KeyObject } from "node:crypto";

import {
  buildAttestation,
  canonicalJson,
  isSignedAttestation,
  verifyAttestation,
  type Signer,
  type Verifier,
} from "./attestation.ts";
import { statement } from "./types.ts";

const signerFor = (priv: KeyObject): Signer => (data) =>
  edSign(null, Buffer.from(data), priv).toString("base64");
const verifierFor = (pub: KeyObject): Verifier => (data, sig) =>
  edVerify(null, Buffer.from(data), pub, Buffer.from(sig, "base64"));

describe("canonicalJson", () => {
  test("is independent of key insertion order", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });
  test("is stable across a JSON round-trip (drops undefined like JSON)", () => {
    const obj = { a: 1, b: undefined, c: { z: undefined, y: 2 } };
    expect(canonicalJson(obj)).toBe(canonicalJson(JSON.parse(JSON.stringify(obj))));
  });
});

describe("buildAttestation / verifyAttestation", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  test("round-trips a signed attestation", () => {
    const att = buildAttestation({ hello: "world" }, signerFor(privateKey), "k1");
    expect(att.keyId).toBe("k1");
    expect(verifyAttestation(att, verifierFor(publicKey))).toBe(true);
  });

  test("verifies regardless of statement key order (canonical)", () => {
    const att = buildAttestation({ a: 1, b: 2 }, signerFor(privateKey));
    // a verifier reconstructing the statement in a different order still verifies
    const reordered = { ...att, statement: { b: 2, a: 1 } };
    expect(verifyAttestation(reordered, verifierFor(publicKey))).toBe(true);
  });

  test("rejects a tampered statement", () => {
    const att = buildAttestation({ a: 1 }, signerFor(privateKey));
    expect(verifyAttestation({ ...att, statement: { a: 2 } }, verifierFor(publicKey))).toBe(false);
  });

  test("rejects under the wrong key", () => {
    const att = buildAttestation({ a: 1 }, signerFor(privateKey));
    const other = generateKeyPairSync("ed25519").publicKey;
    expect(verifyAttestation(att, verifierFor(other))).toBe(false);
  });

  test("fails closed on malformed input", () => {
    expect(verifyAttestation(null, verifierFor(publicKey))).toBe(false);
    expect(verifyAttestation({ signature: "x" }, verifierFor(publicKey))).toBe(false);
    expect(isSignedAttestation({ statement: {}, signature: "x" })).toBe(true);
  });

  test("L2 launch attestation: a signed `level:\"launch\"` statement", () => {
    const launch = statement(
      [{ name: "box-abc", digest: { sha256: "d".repeat(64) } }],
      {
        level: "launch",
        producer: { kind: "nix-flake", id: "facilities:launcher" },
        capabilities: { workcell: "claude-box", manifestDigest: { sha256: "e".repeat(64) } },
      },
    );
    const l2 = buildAttestation(launch, signerFor(privateKey), "launcher-key");
    expect(verifyAttestation(l2, verifierFor(publicKey))).toBe(true);
    expect((l2.statement as typeof launch).predicate.level).toBe("launch");
    // An L3 write would carry links:[{level:"launch", digest:{sha256: <digest of this L2>}}].
  });
});
