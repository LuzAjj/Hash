// ============================================================
//  HASH256 Contract — Confirmed dari hash_miner.js source
// ============================================================

export const CONTRACT_ADDRESS = "0xAC7b5d06fa1e77D08aea40d46cB7C5923A87A0cc";
export const CHAIN_ID = 1n;

// RPC publik yang dipakai browser hash256.org (dari DevTools)
export const DEFAULT_RPC_URL = "https://rpc.mevblocker.io/fast";
export const FALLBACK_RPC_URL = "https://eth.llamarpc.com";

// ABI — dikonfirmasi dari hash_miner.js comments:
//   getChallenge(address) → bytes32
//   currentDifficulty()   → bytes32 (big-endian, BUKAN uint256!)
//   mine(uint256 nonce)   → submit solusi
export const HASH_ABI = [
  {
    name: "getChallenge",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "miner", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "currentDifficulty",
    type: "function",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "currentEpoch",
    type: "function",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "currentReward",
    type: "function",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalMints",
    type: "function",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "miningOpen",
    type: "function",
    stateMutability: "view",
    inputs:  [],
    outputs: [{ name: "", type: "bool" }],
  },
  // mine(uint256) — nonce adalah 32-byte big-endian uint256
  // result.nonce dari SearchResult sudah dalam format ini
  {
    name: "mine",
    type: "function",
    stateMutability: "nonpayable",
    inputs:  [{ name: "nonce", type: "uint256" }],
    outputs: [],
  },
  {
    name: "Mined",
    type: "event",
    inputs: [
      { name: "miner",  indexed: true,  type: "address" },
      { name: "nonce",  indexed: false, type: "uint256" },
      { name: "reward", indexed: false, type: "uint256" },
      { name: "epoch",  indexed: false, type: "uint256" },
    ],
  },
];

// Mining constants (dari whitepaper + UI screenshot)
export const EPOCH_BLOCKS      = 100n;    // epoch rotate tiap 100 block (~20 mnt)
export const RETARGET_MINTS    = 2016n;   // difficulty retarget interval
export const MAX_MINTS_PER_BLOCK = 10;
export const BASE_REWARD       = 100n;    // 100 HASH/mint era 1
export const HARD_CAP          = 21_000_000n;

// Nonce structure (dari hash_miner.js Miner constructor):
//   byte  0..23 = nonce_prefix (24 byte, per-worker partition)
//   byte 24..31 = counter      (8 byte big-endian, di-increment)
export const NONCE_PREFIX_BYTES = 24;
export const NONCE_COUNTER_BYTES = 8;
