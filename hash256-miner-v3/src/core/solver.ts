import { keccak256 } from "js-sha3";

export interface SolveResult {
  found: boolean;
  nonce: bigint;
  nonceBytes: Uint8Array;
  hashesChecked: number;
  elapsedMs: number;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function uint256ToBytes(n: bigint): Uint8Array {
  const hex = n.toString(16).padStart(64, "0");
  return hexToBytes(hex);
}

export function bytesToUint256(b: Uint8Array): bigint {
  let result = 0n;
  for (const byte of b) result = (result << 8n) | BigInt(byte);
  return result;
}

/**
 * Buat 24-byte nonce prefix untuk worker tertentu.
 * Sesuai hash_miner.js: nonce[0..24]=prefix, nonce[24..32]=counter(8 byte BE)
 */
export function makeNoncePrefix(workerIndex: number, totalWorkers: number): Uint8Array {
  const prefix = new Uint8Array(24);
  prefix[22] = totalWorkers & 0xff;
  prefix[23] = workerIndex & 0xff;
  return prefix;
}

function buildNonce(prefix: Uint8Array, counter: bigint): Uint8Array {
  const nonce = new Uint8Array(32);
  nonce.set(prefix, 0);
  let c = counter;
  for (let i = 31; i >= 24; i--) {
    nonce[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  return nonce;
}

/**
 * keccak256(challenge[32] || nonce[32]) < difficulty
 * Nonce = prefix(24) + counter(8 BE) — identik dengan WASM hash_miner.js
 */
export function solvePow(
  challengeHex: string,
  difficultyHex: string,
  noncePrefix: Uint8Array,
  startCounter: bigint,
  batchSize: number
): SolveResult {
  const challengeBytes = hexToBytes(challengeHex);
  const difficultyVal  = bytesToUint256(hexToBytes(difficultyHex));

  const buf = new Uint8Array(64);
  buf.set(challengeBytes, 0);

  const start = Date.now();
  let counter = startCounter;

  for (let i = 0; i < batchSize; i++, counter++) {
    const nonceBytes = buildNonce(noncePrefix, counter);
    buf.set(nonceBytes, 32);
    const hashVal = BigInt("0x" + keccak256(buf));
    if (hashVal < difficultyVal) {
      return { found: true, nonce: bytesToUint256(nonceBytes), nonceBytes, hashesChecked: i + 1, elapsedMs: Date.now() - start };
    }
  }

  const nextNonce = buildNonce(noncePrefix, counter);
  return { found: false, nonce: bytesToUint256(nextNonce), nonceBytes: nextNonce, hashesChecked: batchSize, elapsedMs: Date.now() - start };
}

/** Identik dengan verify() dari hash_miner.js */
export function verifySolution(
  challengeHex: string,
  nonceBytes: Uint8Array,
  difficultyHex: string
): boolean {
  const buf = new Uint8Array(64);
  buf.set(hexToBytes(challengeHex), 0);
  buf.set(nonceBytes, 32);
  return BigInt("0x" + keccak256(buf)) < bytesToUint256(hexToBytes(difficultyHex));
}
