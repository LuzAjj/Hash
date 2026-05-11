#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { ethers } from "ethers";
import { loadConfig } from "./config/config.js";
import { initLogger, getLogger } from "./utils/logger.js";
import { MinerOrchestrator } from "./core/orchestrator.js";
import { renderDashboard } from "./utils/dashboard.js";
import { CONTRACT_ADDRESS, HASH_ABI } from "./config/constants.js";

const VERSION = "1.0.0";

const program = new Command();

program
  .name("hash-miner")
  .description("CLI Miner untuk $HASH token — keccak256 PoW on Ethereum Mainnet")
  .version(VERSION);

// ─── Command: mine ────────────────────────────────────────────────────────────
program
  .command("mine")
  .description("Mulai mining $HASH dengan semua wallet yang dikonfigurasi")
  .option("--no-dashboard", "Nonaktifkan live dashboard (gunakan raw logs)")
  .option("--dry-run", "Test koneksi dan tampilkan info tanpa mining")
  .action(async (opts) => {
    printBanner();

    const spinner = ora("Memuat konfigurasi...").start();

    let config;
    try {
      config = loadConfig();
      spinner.succeed("Konfigurasi dimuat.");
    } catch (err) {
      spinner.fail(String(err));
      process.exit(1);
    }

    // Init logger
    initLogger(config.logDir, config.logLevel);
    const log = getLogger();

    log.info(`hash-miner v${VERSION} memulai`);
    log.info(`Wallet: ${config.privateKeys.length} | Threads/wallet: ${config.threadsPerWallet}`);
    log.info(`Gas strategy: ${config.gasStrategy} | Max: ${config.gasMaxGwei} Gwei`);
    log.info(`Auto approve: ${config.autoApprove ? "✅ ON" : "❌ OFF (manual)"}`);

    // Init orchestrator
    const orchestrator = new MinerOrchestrator(config);

    spinner.start("Menginisialisasi koneksi ke Ethereum...");
    try {
      await orchestrator.init();
      spinner.succeed("Koneksi berhasil.");
    } catch (err) {
      spinner.fail(`Gagal init: ${String(err)}`);
      process.exit(1);
    }

    if (opts.dryRun) {
      log.info("Mode dry-run: selesai tanpa memulai mining.");
      console.log(chalk.green("\n✅ Dry run selesai. Semua konfigurasi valid."));
      process.exit(0);
    }

    // Graceful shutdown
    process.on("SIGINT", () => {
      console.log(chalk.yellow("\n\nMenghentikan miner..."));
      orchestrator.stopAll();
      const stats = orchestrator.getStats();
      log.info("Sesi mining selesai", {
        totalMints:  stats.totalMints,
        totalReward: ethers.formatUnits(stats.totalReward, 18),
        uptime:      stats.uptime,
      });
      process.exit(0);
    });

    // Start live dashboard
    if (opts.dashboard !== false) {
      const dashInterval = setInterval(() => {
        renderDashboard(orchestrator.getStats());
      }, 2000);

      // Cleanup dashboard interval juga saat shutdown
      process.on("exit", () => clearInterval(dashInterval));
    }

    // Start mining!
    console.log(chalk.green("\n▶ Mining dimulai! Tekan Ctrl+C untuk berhenti.\n"));
    await orchestrator.startAll();
  });

// ─── Command: status ──────────────────────────────────────────────────────────
program
  .command("status")
  .description("Tampilkan info kontrak dan status mining saat ini")
  .action(async () => {
    printBanner();

    let config;
    try {
      config = loadConfig();
    } catch (err) {
      console.error(chalk.red(String(err)));
      process.exit(1);
    }

    initLogger(config.logDir, "info");

    const spinner = ora("Mengambil data dari kontrak...").start();

    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, HASH_ABI, provider);

      const [
        miningOpen,
        difficulty,
        epoch,
        reward,
        totalMints,
      ] = await Promise.all([
        contract.miningOpen(),
        contract.currentDifficulty(),
        contract.currentEpoch(),
        contract.currentReward(),
        contract.totalMints(),
      ]);

      spinner.succeed("Data berhasil diambil.");

      console.log("\n" + chalk.bold.cyan("─── $HASH Contract Status ───────────────────────"));
      console.log(`  Contract    : ${chalk.yellow(CONTRACT_ADDRESS)}`);
      console.log(`  Mining Open : ${miningOpen ? chalk.green("✅ TERBUKA") : chalk.red("❌ BELUM TERBUKA (tunggu genesis selesai)")}`);
      console.log(`  Epoch       : ${chalk.white(epoch.toString())}`);
      console.log(`  Difficulty  : ${chalk.white("0x" + (difficulty as bigint).toString(16).slice(0, 16) + "…")}`);
      console.log(`  Reward      : ${chalk.green(ethers.formatUnits(reward as bigint, 18))} HASH / mint`);
      console.log(`  Total Mints : ${chalk.white((totalMints as bigint).toString())}`);

      // Wallet balances
      console.log("\n" + chalk.bold.cyan("─── Wallet Balances ──────────────────────────────"));
      for (const pk of config.privateKeys) {
        const wallet  = new ethers.Wallet(pk, provider);
        const balance = await provider.getBalance(wallet.address);
        console.log(`  ${wallet.address} : ${chalk.green(ethers.formatEther(balance).slice(0, 10))} ETH`);
      }

      console.log("");
    } catch (err) {
      spinner.fail(`Error: ${String(err)}`);
      process.exit(1);
    }
  });

// ─── Command: wallet ──────────────────────────────────────────────────────────
program
  .command("wallet")
  .description("Tampilkan info semua wallet dari konfigurasi")
  .action(async () => {
    let config;
    try {
      config = loadConfig();
    } catch (err) {
      console.error(chalk.red(String(err)));
      process.exit(1);
    }

    initLogger(config.logDir, "error");
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);

    console.log(chalk.bold("\n$HASH Miner — Wallet Info\n"));
    for (let i = 0; i < config.privateKeys.length; i++) {
      const wallet  = new ethers.Wallet(config.privateKeys[i]);
      const balance = await provider.getBalance(wallet.address);
      const okGas   = balance >= ethers.parseEther(config.minGasBalanceEth);

      console.log(
        `  [${i + 1}] ${wallet.address}  ` +
        `${ethers.formatEther(balance).slice(0, 8)} ETH  ` +
        (okGas ? chalk.green("✅ Gas cukup") : chalk.red("⚠️  Gas rendah"))
      );
    }
    console.log("");
  });

// ─── Banner ───────────────────────────────────────────────────────────────────
function printBanner(): void {
  console.log(chalk.bold.cyan(`
  ██╗  ██╗ █████╗ ███████╗██╗  ██╗    ███╗   ███╗██╗███╗   ██╗███████╗██████╗
  ██║  ██║██╔══██╗██╔════╝██║  ██║    ████╗ ████║██║████╗  ██║██╔════╝██╔══██╗
  ███████║███████║███████╗███████║    ██╔████╔██║██║██╔██╗ ██║█████╗  ██████╔╝
  ██╔══██║██╔══██║╚════██║██╔══██║    ██║╚██╔╝██║██║██║╚██╗██║██╔══╝  ██╔══██╗
  ██║  ██║██║  ██║███████║██║  ██║    ██║ ╚═╝ ██║██║██║ ╚████║███████╗██║  ██║
  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝    ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝
  `));
  console.log(chalk.gray(`  CLI Miner v${VERSION} — hash256.org/mine — keccak256 PoW on Ethereum Mainnet\n`));
}

program.parse(process.argv);
