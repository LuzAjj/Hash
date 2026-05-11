import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export interface MinerConfig {
  rpcUrl: string;
  privateKeys: string[];
  gasStrategy: "auto" | "fast" | "standard" | "custom";
  gasMaxGwei: bigint;
  gasPriorityGwei: bigint;
  gasMultiplier: number;
  threadsPerWallet: number;
  nonceBatchSize: number;
  autoApprove: boolean;
  minGasBalanceEth: string;
  logLevel: string;
  logDir: string;
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required env variable: ${key}\nCopy .env.example → .env dan isi konfigurasinya.`);
  }
  return val;
}

export function loadConfig(): MinerConfig {
  const rawKeys = requireEnv("PRIVATE_KEYS");
  const privateKeys = rawKeys
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (privateKeys.length === 0) {
    throw new Error("PRIVATE_KEYS tidak boleh kosong.");
  }

  return {
    rpcUrl:            process.env.RPC_URL ?? "https://rpc.mevblocker.io/fast",
    privateKeys,
    gasStrategy:       (process.env.GAS_STRATEGY ?? "auto") as MinerConfig["gasStrategy"],
    gasMaxGwei:        BigInt(process.env.GAS_MAX_GWEI ?? "50"),
    gasPriorityGwei:   BigInt(process.env.GAS_PRIORITY_GWEI ?? "2"),
    gasMultiplier:     parseFloat(process.env.GAS_MULTIPLIER ?? "1.2"),
    threadsPerWallet:  parseInt(process.env.THREADS_PER_WALLET ?? "1", 10),
    nonceBatchSize:    parseInt(process.env.NONCE_BATCH_SIZE ?? "10000", 10),
    autoApprove:       (process.env.AUTO_APPROVE ?? "true") === "true",
    minGasBalanceEth:  process.env.MIN_GAS_BALANCE_ETH ?? "0.005",
    logLevel:          process.env.LOG_LEVEL ?? "info",
    logDir:            process.env.LOG_DIR ?? "./logs",
  };
}
