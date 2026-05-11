import chalk from "chalk";
import { ethers } from "ethers";
import { OrchestratorStats } from "../core/orchestrator.js";

const STATUS_COLORS: Record<string, chalk.Chalk> = {
  mining:     chalk.green,
  submitting: chalk.yellow,
  idle:       chalk.gray,
  error:      chalk.red,
  paused:     chalk.magenta,
};

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

function formatHashrate(h: number): string {
  if (h >= 1_000_000) return `${(h / 1_000_000).toFixed(2)} MH/s`;
  if (h >= 1_000)     return `${(h / 1_000).toFixed(2)} KH/s`;
  return `${h} H/s`;
}

function difficultyPercent(diff: bigint): string {
  // Max uint256 untuk konteks
  const maxDiff = 2n ** 256n;
  const pct = Number((diff * 10_000n) / maxDiff) / 100;
  return pct.toExponential(2);
}

/**
 * Render dashboard ke terminal. Gunakan clear screen agar update in-place.
 */
export function renderDashboard(stats: OrchestratorStats): void {
  const lines: string[] = [];

  // Header
  lines.push(chalk.bold.cyan("╔══════════════════════════════════════════════════════╗"));
  lines.push(chalk.bold.cyan("║") + chalk.bold.white("        $HASH CLI MINER — hash256.org/mine           ") + chalk.bold.cyan("║"));
  lines.push(chalk.bold.cyan("╚══════════════════════════════════════════════════════╝"));
  lines.push("");

  // Network stats
  lines.push(chalk.bold("┌ Network"));
  lines.push(`  Epoch       : ${chalk.yellow(stats.currentEpoch.toString())}`);
  lines.push(`  Reward      : ${chalk.green(ethers.formatUnits(stats.currentReward || 100n * 10n**18n, 18))} HASH / mint`);
  lines.push(`  Difficulty  : ${chalk.red(difficultyPercent(stats.networkDifficulty))}`);
  lines.push("");

  // Aggregate stats
  lines.push(chalk.bold("┌ Aggregate"));
  lines.push(`  Total Hashrate : ${chalk.cyan(formatHashrate(stats.totalHashrate))}`);
  lines.push(`  Total Mints    : ${chalk.green(stats.totalMints.toString())}`);
  lines.push(`  Total Reward   : ${chalk.green(ethers.formatUnits(stats.totalReward, 18))} HASH`);
  lines.push(`  Uptime         : ${chalk.gray(formatUptime(stats.uptime))}`);
  lines.push(`  Started        : ${chalk.gray(stats.startedAt.toLocaleString())}`);
  lines.push("");

  // Per-wallet stats
  lines.push(chalk.bold("┌ Wallets"));
  lines.push(
    "  " +
    chalk.bold.gray("Address".padEnd(14)) +
    chalk.bold.gray("Status".padEnd(12)) +
    chalk.bold.gray("Hashrate".padEnd(12)) +
    chalk.bold.gray("Mints".padEnd(8)) +
    chalk.bold.gray("Reward (HASH)".padEnd(18)) +
    chalk.bold.gray("Errors")
  );
  lines.push("  " + "─".repeat(72));

  for (const w of stats.wallets) {
    const statusFn = STATUS_COLORS[w.status] ?? chalk.white;
    const addr    = w.address.slice(0, 10) + "…";
    const status  = statusFn(w.status.padEnd(10));
    const hr      = chalk.cyan(formatHashrate(w.hashrate).padEnd(10));
    const mints   = chalk.green(w.totalMints.toString().padEnd(6));
    const reward  = chalk.green(parseFloat(ethers.formatUnits(w.totalReward, 18)).toFixed(2).padEnd(16));
    const errors  = w.errors > 0 ? chalk.red(w.errors.toString()) : chalk.gray("0");

    lines.push(`  ${addr.padEnd(14)}${status}  ${hr}  ${mints}  ${reward}  ${errors}`);
  }

  lines.push("");
  lines.push(chalk.gray("  Ctrl+C untuk berhenti"));
  lines.push("");

  // Clear screen dan print
  process.stdout.write("\x1Bc"); // clear terminal
  console.log(lines.join("\n"));
}
