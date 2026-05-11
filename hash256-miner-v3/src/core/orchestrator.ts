import { ethers } from "ethers";
import { MinerConfig } from "../config/config.js";
import { WalletMiner, WalletStats } from "./wallet-miner.js";
import { getLogger } from "../utils/logger.js";
import { CONTRACT_ADDRESS, HASH_ABI } from "../config/constants.js";

export interface OrchestratorStats {
  wallets: WalletStats[];
  totalHashrate: number;
  totalMints: number;
  totalReward: bigint;
  uptime: number; // ms
  networkDifficulty: bigint;
  currentEpoch: bigint;
  currentReward: bigint;
  startedAt: Date;
}

export class MinerOrchestrator {
  private miners: WalletMiner[] = [];
  private provider: ethers.JsonRpcProvider;
  private config: MinerConfig;
  private startedAt = new Date();
  private networkStats = {
    difficulty: 0n,
    epoch:      0n,
    reward:     0n,
  };
  private statsInterval?: ReturnType<typeof setInterval>;

  constructor(config: MinerConfig) {
    this.config   = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }

  /**
   * Inisialisasi semua wallet dan validasi koneksi.
   */
  async init(): Promise<void> {
    const log = getLogger();

    // Test koneksi RPC
    const network = await this.provider.getNetwork();
    log.info(`Terhubung ke jaringan: ${network.name} (chainId: ${network.chainId})`);

    if (network.chainId !== 1n) {
      log.warn(`⚠️  Chain ID ${network.chainId} bukan Ethereum Mainnet (1). Pastikan RPC_URL benar!`);
    }

    // Buat wallet miners
    for (const pk of this.config.privateKeys) {
      // Setiap wallet bisa punya beberapa thread (parallel nonce ranges)
      const totalWorkers = this.config.threadsPerWallet;
      for (let t = 0; t < totalWorkers; t++) {
        const miner = new WalletMiner(pk, this.provider, this.config, t, totalWorkers);

        // Untuk multi-thread per wallet, kita buat provider baru agar tidak conflict
        this.miners.push(miner);
      }
    }

    // Deduplicate berdasarkan address (jika threadsPerWallet = 1)
    log.info(`Siap menjalankan ${this.miners.length} miner worker dari ${this.config.privateKeys.length} wallet.`);

    // Ambil stats jaringan
    await this.refreshNetworkStats();

    // Tampilkan info wallet
    for (const miner of this.miners) {
      const balance = await this.provider.getBalance(miner.address);
      log.info(`Wallet ${miner.address.slice(0, 10)}… | ${ethers.formatEther(balance).slice(0, 8)} ETH`);
    }
  }

  /**
   * Start semua miner secara paralel.
   */
  async startAll(): Promise<void> {
    const log = getLogger();
    log.info("▶ Memulai semua wallet miner...");

    // Refresh network stats secara berkala
    this.statsInterval = setInterval(() => this.refreshNetworkStats(), 30_000);

    // Jalankan semua miner secara paralel (non-blocking)
    const promises = this.miners.map((m) =>
      m.start().catch((err) =>
        log.error(`Miner ${m.address} crash`, { err: String(err) })
      )
    );

    await Promise.all(promises);
  }

  /**
   * Stop semua miner.
   */
  stopAll(): void {
    const log = getLogger();
    log.info("⏹ Menghentikan semua miner...");
    this.miners.forEach((m) => m.stop());
    if (this.statsInterval) clearInterval(this.statsInterval);
  }

  /**
   * Ambil aggregate stats untuk dashboard.
   */
  getStats(): OrchestratorStats {
    const walletStats = this.miners.map((m) => m.stats);
    return {
      wallets:           walletStats,
      totalHashrate:     walletStats.reduce((s, w) => s + w.hashrate, 0),
      totalMints:        walletStats.reduce((s, w) => s + w.totalMints, 0),
      totalReward:       walletStats.reduce((s, w) => s + w.totalReward, 0n),
      uptime:            Date.now() - this.startedAt.getTime(),
      networkDifficulty: this.networkStats.difficulty,
      currentEpoch:      this.networkStats.epoch,
      currentReward:     this.networkStats.reward,
      startedAt:         this.startedAt,
    };
  }

  private async refreshNetworkStats(): Promise<void> {
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, HASH_ABI, this.provider);
      const [diff, epoch, reward] = await Promise.all([
        contract.currentDifficulty(),
        contract.currentEpoch(),
        contract.currentReward(),
      ]);
      this.networkStats = { difficulty: diff, epoch, reward };
    } catch (err) {
      getLogger().debug("Gagal refresh network stats", { err: String(err) });
    }
  }
}
