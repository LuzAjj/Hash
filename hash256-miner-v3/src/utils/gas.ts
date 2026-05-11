import { ethers } from "ethers";
import { MinerConfig } from "../config/config.js";
import { getLogger } from "./logger.js";

const GWEI = 1_000_000_000n;

export interface GasFees {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  estimatedCostWei: bigint;
}

/**
 * Mengambil gas price terkini dari jaringan dan menerapkan strategi
 * yang dikonfigurasi user.
 */
export async function getOptimalGasFees(
  provider: ethers.JsonRpcProvider,
  config: MinerConfig,
  gasLimitEstimate: bigint = 100_000n
): Promise<GasFees> {
  const log = getLogger();

  try {
    const feeData = await provider.getFeeData();
    const baseFee = feeData.lastBaseFeePerGas ?? 10n * GWEI;

    let maxPriority: bigint;
    let maxFee: bigint;

    if (config.gasStrategy === "auto") {
      // Auto: base fee × multiplier + priority tip
      maxPriority = config.gasPriorityGwei * GWEI;
      const adjustedBase = BigInt(Math.ceil(Number(baseFee) * config.gasMultiplier));
      maxFee = adjustedBase + maxPriority;
    } else if (config.gasStrategy === "fast") {
      maxPriority = 3n * GWEI;
      maxFee = baseFee * 2n + maxPriority;
    } else if (config.gasStrategy === "standard") {
      maxPriority = 1n * GWEI;
      maxFee = baseFee + maxPriority + GWEI;
    } else {
      // custom — pakai nilai dari config
      maxPriority = config.gasPriorityGwei * GWEI;
      maxFee = config.gasMaxGwei * GWEI;
    }

    // Terapkan batas maksimal dari config
    const maxAllowed = config.gasMaxGwei * GWEI;
    if (maxFee > maxAllowed) {
      log.warn(`Gas terlalu tinggi (${maxFee / GWEI} Gwei > max ${config.gasMaxGwei} Gwei), clamp ke max.`);
      maxFee = maxAllowed;
    }

    const estimatedCostWei = maxFee * gasLimitEstimate;

    log.debug("Gas dihitung", {
      baseFee:     `${baseFee / GWEI} Gwei`,
      maxFee:      `${maxFee / GWEI} Gwei`,
      maxPriority: `${maxPriority / GWEI} Gwei`,
      strategy:    config.gasStrategy,
    });

    return { maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPriority, estimatedCostWei };
  } catch (err) {
    log.error("Gagal mengambil fee data, fallback ke default", { err });
    // Fallback aman
    const fallback = 20n * GWEI;
    return {
      maxFeePerGas:         fallback,
      maxPriorityFeePerGas: 2n * GWEI,
      estimatedCostWei:     fallback * gasLimitEstimate,
    };
  }
}

/**
 * Format wei ke string ETH yang mudah dibaca.
 */
export function formatEth(wei: bigint, decimals = 6): string {
  return parseFloat(ethers.formatEther(wei)).toFixed(decimals);
}

/**
 * Format gwei ke string yang mudah dibaca.
 */
export function formatGwei(wei: bigint): string {
  return `${Number(wei / GWEI)}.${Number(wei % GWEI).toString().slice(0, 2)} Gwei`;
}
