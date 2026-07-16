# Katalog & Peminjaman Barang Unit IT — RSUD Kota Serang

Aplikasi web katalog & peminjaman barang unit IT: **katalog publik** (peminjam self-serve) + **admin panel** (kelola barang & persetujuan). Satu basis kode, dua target deploy (server RS / Vercel).

Dokumen sumber: `../02 - analysis/prd.md`, `../03 - design/{sdd,dsd}.md`, `../04 - development/ppd.md`, sprint di `../04 - development/sprint/`.

## Fitur

- **Katalog publik** (mobile-first): gallery + search/filter, ketersediaan terhitung, keranjang, checkout **langsung** (stok langsung berkurang, bukti wajib) atau **booking** (menunggu persetujuan admin). Bukti = foto kamera **atau** tanda tangan kanvas.
- **Panel admin** (di balik login): kelola barang/kategori/foto; kelola peminjaman — setujui/tolak/batalkan, tandai diambil (+bukti serah-terima), pengembalian sebagian + undo; panel filter terpadu (status/tipe/barang/rentang tanggal) + **ekspor Excel** peminjaman (filter-aware); notifikasi in-app (polling); dashboard ringkasan.
- **Integritas stok**: Loan service satu-satunya penulis stok/status; guard transaksional `SELECT … FOR UPDATE` (anti-oversell, terbukti uji konkuren).

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · Drizzle ORM · PostgreSQL 17 · iron-session + argon2 (auth) · TanStack Query/Table · sharp (media) · ExcelJS (ekspor) · Vitest · Playwright · pnpm.

## Prasyarat

- Node.js ≥ 22 (LTS 24 direkomendasikan — lihat `.nvmrc`)
- pnpm 11
- Docker (Postgres lokal) — atau `DATABASE_URL` ke Postgres/Neon lain

## Mulai (development)

```bash
cp .env.example .env          # sesuaikan bila perlu
docker compose up -d db       # Postgres 17 lokal
pnpm install
pnpm db:migrate               # terapkan migrasi
pnpm db:seed                  # data contoh (kategori + barang)
pnpm dev                      # http://localhost:3000
```

Katalog publik: `/` · Panel admin: `/admin` (login di `/admin/login`).

### Auth admin

Kata sandi admin disimpan sebagai hash **argon2id** (`ADMIN_PASSWORD_HASH`), bukan plaintext. Buat hash:

```bash
node -e "require('@node-rs/argon2').hash('PASSWORD').then(console.log)"
```

> **Penting untuk berkas `.env`:** dotenv-expand Next menafsirkan `$` sebagai variabel → **escape tiap `$` pada hash menjadi `\$`** (di env Vercel/langsung tidak perlu). `SESSION_SECRET` wajib **≥ 32 karakter** (syarat iron-session).

## Skrip

| Skrip                                          | Fungsi                                                        |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `pnpm dev` / `build` / `start`                 | Next.js dev / build / serve                                   |
| `pnpm typecheck`                               | `tsc --noEmit`                                                |
| `pnpm lint`                                    | ESLint (next)                                                 |
| `pnpm test`                                    | Unit (Vitest)                                                 |
| `pnpm test:int`                                | Integration atas pglite                                       |
| `pnpm test:e2e`                                | E2E (Playwright/Chromium) — butuh `pnpm build` + Postgres dev |
| `pnpm db:generate` / `db:migrate` / `db:check` | Drizzle Kit                                                   |
| `pnpm db:seed`                                 | Seed data contoh                                              |

## Deploy

Satu artefak, dua target. Panduan lengkap (Vercel+Neon, self-host Docker/Caddy/mkcert, backup/restore): **[`docs/DEPLOY.md`](docs/DEPLOY.md)**. Target rilis terpilih: **Neon + Vercel**.

## Status

Siklus MVP 4 sprint — **selesai (Sprint 01–04)**. Seluruh scope Must terkirim.

- ✅ **Sprint 01 — Fondasi & Katalog Publik (baca):** scaffold, env, skema Drizzle + migrasi, adapter (Storage/RateLimiter/logger), Catalog service + ketersediaan, `GET /api/items`, gallery + search/filter.
- ✅ **Sprint 02 — Alur Peminjaman Publik (checkout):** keranjang + sheet checkout, ProofCapture (kamera/tanda tangan), `POST /api/loans` (DIRECT/BOOKING) + guard stok transaksional.
- ✅ **Sprint 03 — Panel Admin:** auth (iron-session + argon2) + middleware, CRUD barang/kategori/foto, transisi peminjaman (approve/activate+bukti/return+undo), notifikasi polling, dashboard.
- ✅ **Sprint 04 — Ekspor, Pengerasan & Deploy:** ekspor Excel (filter-aware, ExcelJS), filter barang + panel filter terpadu (popover), e2e Playwright (2 alur inti + auth), poles state offline/empty, deploy dua-target + backup. **Mode varian dibatalkan** (FR4 → Won't Have).

Detail per sprint: `../04 - development/sprint/`. Gate terkini: **72 unit + 36 integration + 3 e2e hijau**.

E2e: `pnpm build` lalu `pnpm test:e2e` (butuh Postgres dev hidup + `pnpm db:migrate`).
