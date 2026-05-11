# hash256-miner CLI

> CLI Miner untuk **$HASH** token — keccak256 Proof-of-Work di Ethereum Mainnet  
> Mendukung multi-wallet, auto gas optimizer, logging file, dan live dashboard.

```
  ██╗  ██╗ █████╗ ███████╗██╗  ██╗    ███╗   ███╗██╗███╗   ██╗███████╗██████╗
  ██║  ██║██╔══██╗██╔════╝██║  ██║    ████╗ ████║██║████╗  ██║██╔════╝██╔══██╗
  ███████║███████║███████╗███████║    ██╔████╔██║██║██╔██╗ ██║█████╗  ██████╔╝
  ██╔══██║██╔══██║╚════██║██╔══██║    ██║╚██╔╝██║██║██║╚██╗██║██╔══╝  ██╔══██╗
  ██║  ██║██║  ██║███████║██║  ██║    ██║ ╚═╝ ██║██║██║ ╚████║███████╗██║  ██║
  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝    ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝
```

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org)
[![Ethereum](https://img.shields.io/badge/Network-Ethereum%20Mainnet-purple?logo=ethereum)](https://ethereum.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Daftar Isi

- [Cara Kerja](#cara-kerja-hash-mining)
- [Prerequisite](#prerequisite)
- [Instalasi Lokal](#instalasi-lokal)
- [Instalasi di VPS](#instalasi-di-vps)
- [Konfigurasi](#konfigurasi)
- [Penggunaan](#penggunaan)
- [Strategi Gas](#strategi-gas)
- [Multi-Wallet](#multi-wallet)
- [Menjalankan di Background VPS](#menjalankan-di-background-vps)
- [Log Files](#log-files)
- [Troubleshooting](#troubleshooting)
- [Struktur Repo](#struktur-repo)
- [Keamanan](#keamanan)
- [Lisensi](#lisensi)

---

## Cara Kerja $HASH Mining

$HASH adalah ERC-20 di Ethereum Mainnet yang di-mine dengan brute-force keccak256:

```
challenge = keccak256(chainId ‖ contract ‖ miner ‖ epoch)
valid iff keccak256(challenge ‖ nonce) < currentDifficulty
```

- **Address-bound** — challenge terikat ke alamat wallet, tidak bisa dicuri worker lain
- **Epoch rotate** — setiap 100 block (~20 menit), challenge berubah otomatis
- **Difficulty retarget** — setiap 2.016 mints (mirip mekanisme Bitcoin)
- **Hard cap** — 21 juta $HASH total supply

---

## Prerequisite

| Kebutuhan | Versi Minimum | Cek |
|---|---|---|
| Node.js | v18.0.0 | `node --version` |
| npm | v8.0.0 | `npm --version` |
| ETH per wallet | ~0.01 ETH | untuk gas fee |
| Ethereum RPC URL | — | lihat pilihan di bawah |

### Pilihan RPC URL

| Provider | URL | Keterangan |
|---|---|---|
| MEV Blocker | `https://rpc.mevblocker.io/fast` | Default, cepat |
| LlamaRPC | `https://eth.llamarpc.com` | Fallback publik gratis |
| Alchemy | `https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY` | Stabil, butuh daftar |
| Infura | `https://mainnet.infura.io/v3/YOUR_KEY` | Alternatif terpercaya |

---

## Instalasi Lokal

```bash
# 1. Clone repository
git clone https://github.com/LuzAjj/Hash.git
cd hash256-miner-v3

# 2. Install dependencies
npm install

# 3. Build TypeScript
npm run build

# 4. Salin dan isi konfigurasi
cp .env.example .env
nano .env

# 5. Jalankan
npm start mine
```

---

## Instalasi di VPS

Panduan ini menggunakan **Ubuntu 20.04 / 22.04 / 24.04**.

### Langkah 1 — Update Sistem

```bash
sudo apt update && sudo apt upgrade -y
```

### Langkah 2 — Install Node.js v20 (LTS)

```bash
# Tambahkan NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verifikasi
node --version   # harus v20.x.x
npm --version    # harus v10.x.x
```

### Langkah 3 — Install Git

```bash
sudo apt install -y git
```

### Langkah 4 — Clone Repository

```bash
cd ~
git clone https://github.com/USERNAME/hash256-miner.git
cd hash256-miner
```

### Langkah 5 — Install Dependencies

```bash
npm install
```

> Jika ada error `EACCES` permission, jangan gunakan `sudo npm install`. Perbaiki dulu:
> ```bash
> mkdir -p ~/.npm-global
> npm config set prefix '~/.npm-global'
> echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
> source ~/.bashrc
> ```

### Langkah 6 — Build TypeScript

```bash
npm run build
```

Sukses jika folder `dist/` terbentuk tanpa error.

### Langkah 7 — Konfigurasi

```bash
cp .env.example .env
nano .env
```

Isi minimal yang **wajib** diubah:

```env
RPC_URL=https://rpc.mevblocker.io/fast
PRIVATE_KEYS=0xPRIVATE_KEY_WALLET_KAMU
AUTO_APPROVE=true
GAS_MAX_GWEI=50
```

Simpan: `Ctrl+O` → Enter → `Ctrl+X`

### Langkah 8 — Test Koneksi (Dry Run)

```bash
npm start mine -- --dry-run
```

Output sukses:
```
✔ Konfigurasi dimuat.
✔ Koneksi berhasil.
✅ Dry run selesai. Semua konfigurasi valid.
```

### Langkah 9 — Cek Status Kontrak

```bash
npm start status
```

Pastikan tampil `Mining Open: ✅ TERBUKA` sebelum mulai mining.

### Langkah 10 — Mulai Mining

```bash
npm start mine
```

---

## Konfigurasi

### Opsi Lengkap

| Variable | Default | Keterangan |
|---|---|---|
| `RPC_URL` | `https://rpc.mevblocker.io/fast` | Ethereum RPC endpoint |
| `PRIVATE_KEYS` | *(wajib)* | Private key wallet. Pisah koma untuk multi-wallet |
| `GAS_STRATEGY` | `auto` | `auto` / `fast` / `standard` / `custom` |
| `GAS_MAX_GWEI` | `50` | Batas atas gas price (Gwei). Tx tidak submit jika gas lebih tinggi |
| `GAS_PRIORITY_GWEI` | `2` | Priority fee (tip ke validator) dalam Gwei |
| `GAS_MULTIPLIER` | `1.2` | Multiplier base fee untuk strategy `auto` |
| `THREADS_PER_WALLET` | `1` | Jumlah worker paralel per wallet (1–4) |
| `NONCE_BATCH_SIZE` | `10000` | Nonce yang dicek per batch sebelum update dashboard |
| `AUTO_APPROVE` | `true` | `true` = otomatis submit tx, `false` = perlu konfirmasi |
| `MIN_GAS_BALANCE_ETH` | `0.005` | Wallet dilewati jika saldo ETH di bawah nilai ini |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `LOG_DIR` | `./logs` | Direktori penyimpanan log file |

---

## Penggunaan

```bash
# Mulai mining
npm start mine

# Dry run (test tanpa kirim transaksi)
npm start mine -- --dry-run

# Mining tanpa live dashboard
npm start mine -- --no-dashboard

# Cek status kontrak
npm start status

# Info wallet dan saldo
npm start wallet
```

### Tampilan Dashboard

```
╔══════════════════════════════════════════════════════╗
║        $HASH CLI MINER — hash256.org/mine           ║
╚══════════════════════════════════════════════════════╝

┌ Network
  Epoch       : 42
  Reward      : 100.0 HASH / mint
  Difficulty  : 2.45e-72

┌ Aggregate
  Total Hashrate : 245.32 KH/s
  Total Mints    : 7
  Total Reward   : 700.0 HASH
  Uptime         : 0h 12m 34s

┌ Wallets
  Address        Status      Hashrate    Mints   Reward (HASH)   Errors
  ──────────────────────────────────────────────────────────────────────
  0x1234abcd…   mining      122.16 KH/s  4       400.00           0
  0x5678efgh…   mining      123.16 KH/s  3       300.00           0
```

---

## Strategi Gas

| Strategy | Kapan Pakai |
|---|---|
| `auto` | **Rekomendasi.** Ikuti base fee jaringan × multiplier |
| `fast` | Saat jaringan congested, mau konfirmasi cepat |
| `standard` | Gas rendah, oke untuk mining santai |
| `custom` | Set manual `GAS_MAX_GWEI` dan `GAS_PRIORITY_GWEI` |

---

## Multi-Wallet

```env
PRIVATE_KEYS=0xKEY1,0xKEY2,0xKEY3
```

Setiap wallet berjalan paralel. Untuk double worker per wallet:

```env
THREADS_PER_WALLET=2
```

> Setiap thread membutuhkan gas sendiri. Pastikan saldo ETH cukup di setiap wallet.

---

## Menjalankan di Background VPS

### Opsi A — PM2 (Direkomendasikan)

```bash
# Install PM2
npm install -g pm2

# Jalankan miner
pm2 start "npm start mine" --name hash-miner

# Lihat status
pm2 status

# Lihat log real-time
pm2 logs hash-miner

# Stop
pm2 stop hash-miner

# Auto-restart saat VPS reboot
pm2 startup
pm2 save
```

### Opsi B — Screen

```bash
# Install screen
sudo apt install -y screen

# Buat sesi baru
screen -S hash-miner

# Jalankan miner
cd ~/hash256-miner && npm start mine

# Detach (miner tetap jalan): Ctrl+A lalu D

# Kembali ke sesi
screen -r hash-miner
```

### Opsi C — tmux

```bash
# Install tmux
sudo apt install -y tmux

# Buat sesi baru
tmux new -s hash-miner

# Jalankan miner
cd ~/hash256-miner && npm start mine

# Detach (miner tetap jalan): Ctrl+B lalu D

# Kembali ke sesi
tmux attach -t hash-miner
```

---

## Log Files

Log tersimpan di `./logs/`:

| File | Isi |
|---|---|
| `miner-combined.log` | Semua event (info, warn, error) |
| `miner-error.log` | Hanya error |

```bash
# Monitor real-time
tail -f logs/miner-combined.log | jq .

# Filter mint sukses
grep 'Mint' logs/miner-combined.log | jq .

# Lihat error saja
cat logs/miner-error.log | jq .
```

---

## Troubleshooting

**`Missing required env variable: PRIVATE_KEYS`**  
Buat dan isi file `.env`:
```bash
cp .env.example .env && nano .env
```

**`Mining belum terbuka (genesis belum selesai)`**  
Genesis mint belum selesai. Pantau dengan `npm start status`.

**`could not detect network`**  
RPC URL tidak bisa dijangkau. Ganti di `.env`:
```env
RPC_URL=https://eth.llamarpc.com
```

**`Gas terlalu tinggi`**  
Naikkan batas gas:
```env
GAS_MAX_GWEI=80
```

**`Wallet balance terlalu rendah`**  
Top up ETH ke wallet, atau turunkan threshold:
```env
MIN_GAS_BALANCE_ETH=0.001
```

**`ENOENT dist/index.js`**  
Belum build:
```bash
npm run build
```

---

## Struktur Repo

```
hash256-miner/
├── src/
│   ├── index.ts              # Entry point CLI
│   ├── config/
│   │   ├── constants.ts      # Contract address, ABI, constants
│   │   └── config.ts         # Load & validasi .env
│   ├── core/
│   │   ├── solver.ts         # keccak256 PoW brute-force engine
│   │   ├── wallet-miner.ts   # Mining loop + tx submit per wallet
│   │   └── orchestrator.ts   # Multi-wallet paralel manager
│   └── utils/
│       ├── gas.ts            # Auto gas price optimizer
│       ├── logger.ts         # Winston logger
│       └── dashboard.ts      # Terminal live dashboard
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Keamanan

- Private key **hanya ada di `.env`** — tidak pernah di-log atau ditampilkan
- `.gitignore` sudah mengecualikan `.env` dan `logs/`
- Verifikasi lokal solusi sebelum submit untuk menghindari waste gas
- Gas cap mencegah submit tx dengan gas abnormal tinggi

> ⚠️ **JANGAN pernah commit atau share file `.env`.**  
> Siapapun yang punya private key kamu dapat menguras seluruh isi wallet.

---

## Catatan

> ⚠️ Mining belum tersedia sampai **Genesis Mint selesai** dan `seedPool()` dipanggil.  
> Pantau status di [https://hash256.org](https://hash256.org) atau jalankan `npm start status`.

---

## Lisensi

MIT

---

*Bukan financial advice. Mining selalu mengandung risiko biaya gas.*
