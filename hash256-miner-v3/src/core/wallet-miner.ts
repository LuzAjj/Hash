import { ethers } from "ethers";
import { CONTRACT_ADDRESS, HASH_ABI } from "../config/constants.js";
import { MinerConfig } from "../config/config.js";
import { solvePow, verifySolution, makeNoncePrefix } from "./solver.js";
import { getOptimalGasFees, formatEth, formatGwei } from "../utils/gas.js";
import { getLogger } from "../utils/logger.js";

export interface WalletStats {
  address: string;
  totalMints: number;
  totalReward: bigint;
  hashrate: number;
  lastMintAt?: Date;
  errors: number;
  status: "idle" | "mining" | "submitting" | "error" | "paused";
  workerIndex: number;
}

export class WalletMiner {
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private provider: ethers.JsonRpcProvider;
  private config: MinerConfig;
  public stats: WalletStats;
  private running = false;
  private noncePrefix: Uint8Array;

  constructor(
    privateKey: string,
    provider: ethers.JsonRpcProvider,
    config: MinerConfig,
    workerIndex = 0,
    totalWorkers = 1
  ) {
    this.provider  = provider;
    this.wallet    = new ethers.Wallet(privateKey, provider);
    this.contract  = new ethers.Contract(CONTRACT_ADDRESS, HASH_ABI, this.wallet);
    this.config    = config;
    // Buat prefix unik per worker agar range tidak overlap
    this.noncePrefix = makeNoncePrefix(workerIndex, totalWorkers);

    this.stats = {
      address:     this.wallet.address,
      totalMints:  0,
      totalReward: 0n,
      hashrate:    0,
      errors:      0,
      status:      "idle",
      workerIndex,
    };
  }

  get address(): string { return this.wallet.address; }

  async start(): Promise<void> {
    const log   = getLogger();
    const short = this.address.slice(0, 10) + "…";
    this.running = true;
    this.stats.status = "mining";

    // Cek balance
    const balance   = await this.provider.getBalance(this.address);
    const minBal    = ethers.parseEther(this.config.minGasBalanceEth);
    if (balance < minBal) {
      log.warn(`Wallet ${short} balance terlalu rendah (${formatEth(balance)} ETH). Skip.`, { wallet: this.address });
      this.stats.status = "paused";
      return;
    }

    // Cek mining open
    const miningOpen: boolean = await this.contract.miningOpen();
    if (!miningOpen) {
      log.warn("Mining belum terbuka (genesis belum selesai).", { wallet: this.address });
      this.stats.status = "paused";
      return;
    }

    log.info(`Worker #${this.stats.workerIndex} wallet ${short} mulai mining.`, { wallet: this.address });

    while (this.running) {
      try {
        await this.mineOnce();
      } catch (err: unknown) {
        this.stats.errors++;
        this.stats.status = "error";
        log.error(`Error wallet ${short}: ${String(err)}`, { wallet: this.address });
        await sleep(5000);
        this.stats.status = "mining";
      }
    }

    this.stats.status = "idle";
  }

  private async mineOnce(): Promise<void> {
    const log = getLogger();

    // currentDifficulty() returns bytes32 — kita ambil sebagai hex string
    const [challengeRaw, difficultyRaw, epoch] = await Promise.all([
      this.contract.getChallenge(this.address),
      this.contract.currentDifficulty(),
      this.contract.currentEpoch(),
    ]);

    // Pastikan format hex 64 karakter (32 byte)
    const challengeHex  = (challengeRaw as string);
    const difficultyHex = (difficultyRaw as string);
    const epochVal      = epoch as bigint;

    log.debug("Challenge", {
      wallet:     this.address,
      challenge:  challengeHex.slice(0, 18) + "…",
      difficulty: difficultyHex.slice(0, 18) + "…",
      epoch:      epochVal.toString(),
    });

    let counter      = 0n;
    let hashesTotal  = 0;
    const loopStart  = Date.now();

    while (this.running) {
      const result = solvePow(
        challengeHex,
        difficultyHex,
        this.noncePrefix,
        counter,
        this.config.nonceBatchSize
      );

      hashesTotal += result.hashesChecked;
      counter = result.nonce; // solver returns next counter via nonce field

      // Update hashrate
      const elapsed = (Date.now() - loopStart) / 1000;
      this.stats.hashrate = Math.round(hashesTotal / Math.max(elapsed, 0.001));

      if (result.found) {
        log.info(`✓ Solusi! nonce=0x${result.nonce.toString(16).slice(0, 16)}…`, {
          wallet:   this.address,
          hashrate: this.stats.hashrate,
        });

        if (!verifySolution(challengeHex, result.nonceBytes, difficultyHex)) {
          log.error("Verifikasi lokal gagal — skip", { wallet: this.address });
          break;
        }

        await this.submitSolution(result.nonce);
        break;
      }

      // Re-check epoch setiap 100 batch
      if (hashesTotal % (this.config.nonceBatchSize * 100) === 0) {
        const newEpoch: bigint = await this.contract.currentEpoch();
        if (newEpoch !== epochVal) {
          log.info("Epoch berubah, reset challenge.", { wallet: this.address });
          break;
        }
      }
    }
  }

  private async submitSolution(nonce: bigint): Promise<void> {
    const log   = getLogger();
    const short = this.address.slice(0, 10) + "…";
    this.stats.status = "submitting";

    try {
      const gasLimit = await this.contract.mine.estimateGas(nonce).catch(() => 120_000n);
      const gasFees  = await getOptimalGasFees(this.provider, this.config, gasLimit);

      if (!this.config.autoApprove) {
        log.warn(`[MANUAL] Wallet ${short}: set AUTO_APPROVE=true untuk auto-submit.`);
        this.stats.status = "mining";
        return;
      }

      log.info(`📤 Submit tx wallet ${short} | maxFee=${formatGwei(gasFees.maxFeePerGas)}`, { wallet: this.address });

      const tx = await this.contract.mine(nonce, {
        gasLimit,
        maxFeePerGas:         gasFees.maxFeePerGas,
        maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
      });

      log.info(`Tx: ${tx.hash}`, { wallet: this.address, txHash: tx.hash });

      const receipt = await tx.wait(1);

      if (receipt?.status === 1) {
        this.stats.totalMints++;
        const reward = this.parseReward(receipt);
        this.stats.totalReward += reward;
        this.stats.lastMintAt   = new Date();
        log.info(`✅ Mint! +${ethers.formatUnits(reward, 18)} HASH | total ${this.stats.totalMints} mints`, {
          wallet: this.address, txHash: tx.hash, block: receipt.blockNumber,
        });
      } else {
        log.error("Tx reverted", { wallet: this.address, txHash: tx.hash });
        this.stats.errors++;
      }
    } catch (err: unknown) {
      this.stats.errors++;
      const msg = String(err);
      log.error(`Submit gagal: ${msg}`, { wallet: this.address });
      if (msg.includes("underpriced") || msg.includes("replacement fee too low")) {
        log.warn("Naikkan GAS_MULTIPLIER atau GAS_MAX_GWEI di .env", { wallet: this.address });
      }
    } finally {
      this.stats.status = "mining";
    }
  }

  private parseReward(receipt: ethers.TransactionReceipt): bigint {
    try {
      const iface = new ethers.Interface(HASH_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === "Mined") return parsed.args.reward as bigint;
        } catch { /* skip */ }
      }
    } catch { /* fallback */ }
    return 100n * 10n ** 18n;
  }

  stop(): void { this.running = false; }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
