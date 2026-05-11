import winston from "winston";
import path from "path";
import fs from "fs";

let _logger: winston.Logger | null = null;

export function initLogger(logDir: string, logLevel: string): winston.Logger {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const fmt = winston.format;

  _logger = winston.createLogger({
    level: logLevel,
    format: fmt.combine(
      fmt.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      fmt.errors({ stack: true }),
      fmt.json()
    ),
    transports: [
      // Console — human readable, colorized
      new winston.transports.Console({
        format: fmt.combine(
          fmt.colorize(),
          fmt.printf(({ level, message, timestamp, wallet, hashrate, ...meta }) => {
            const walletTag = wallet ? ` [${String(wallet).slice(0, 8)}…]` : "";
            const hrTag     = hashrate ? ` ⚡${hashrate}H/s` : "";
            const metaStr   = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
            return `${timestamp} ${level}${walletTag}${hrTag}: ${message}${metaStr}`;
          })
        ),
      }),
      // Daily rotate file — combined
      new winston.transports.File({
        filename: path.join(logDir, "miner-combined.log"),
        maxsize:  10 * 1024 * 1024, // 10MB
        maxFiles: 7,
        tailable: true,
      }),
      // Separate error log
      new winston.transports.File({
        filename: path.join(logDir, "miner-error.log"),
        level:    "error",
        maxsize:  5 * 1024 * 1024,
        maxFiles: 7,
        tailable: true,
      }),
    ],
  });

  return _logger;
}

export function getLogger(): winston.Logger {
  if (!_logger) throw new Error("Logger belum diinisialisasi. Panggil initLogger() terlebih dahulu.");
  return _logger;
}
