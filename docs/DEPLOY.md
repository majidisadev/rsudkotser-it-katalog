# Deploy & Backup — Katalog IT RSUD Kota Serang

Satu artefak, **dua target** (PRD NFR4 / SDD Build/Deployment). Hanya env yang
berbeda. Pilih target sesuai keputusan kepatuhan (PPD Open Decision O1/O2).

- **A. Vercel + Neon** — target produksi terpilih (cloud). Paling ringkas.
- **B. Self-host** (server internal RS) — Docker + Postgres + Caddy (TLS). Untuk
  skenario on-prem/air-gapped.

Kontrak env tunggal: lihat [`.env.example`](../.env.example). `src/lib/env.ts`
memvalidasi **gagal-cepat** saat boot bila ada yang kurang/rusak.

> **Hash argon2 & `$`:** hanya di **berkas `.env`** setiap `$` wajib di-escape
> `\$` (dotenv-expand). Di **env langsung** (dashboard Vercel, `env_file` Docker
> yang diinjeksi sebagai variabel) pakai hash apa adanya. `SESSION_SECRET` ≥ 32
> karakter. Buat hash: `node -e "require('@node-rs/argon2').hash('PASSWORD').then(console.log)"`.

---

## A. Vercel + Neon (terpilih)

### 1. Database (Neon)

1. Buat project Neon → salin **connection string** (pooled, `-pooler`) sebagai
   `DATABASE_URL`. Sudah `sslmode=require`; driver `postgres` menghormatinya.
2. Terapkan skema ke Neon (dari mesin dev / CI, drizzle-kit = devDependency):
   ```bash
   DATABASE_URL="postgres://…neon…" pnpm db:migrate
   ```
3. (Opsional) seed awal: `DATABASE_URL="…" pnpm db:seed`.

### 2. Storage bukti

Vercel FS bersifat ephemeral → **wajib** `STORAGE_DRIVER=vercel-blob`.

1. Vercel → Storage → **Blob** → buat store → salin `BLOB_READ_WRITE_TOKEN`.

### 3. Deploy

1. Import repo ke Vercel (framework Next.js terdeteksi otomatis).
2. Set **Environment Variables** (Production):
   | Var | Nilai |
   |---|---|
   | `DATABASE_URL` | connection string Neon (pooled) |
   | `STORAGE_DRIVER` | `vercel-blob` |
   | `BLOB_READ_WRITE_TOKEN` | token Blob |
   | `ADMIN_PASSWORD_HASH` | hash argon2 **tanpa** escape `\$` |
   | `SESSION_SECRET` | rahasia ≥ 32 karakter |
   | `APP_URL` | URL produksi (mis. `https://katalog.vercel.app`) |
   | _(opsional)_ `UPSTASH_REDIS_REST_URL` / `_TOKEN` | rate-limit terdistribusi; absen → in-memory |
3. Deploy. `NEXT_OUTPUT_STANDALONE` **tidak** di-set di Vercel (biarkan default).
4. Migrasi skema baru ke depan: jalankan langkah A.1.2 sebelum/ saat rilis.

---

## B. Self-host (Docker + Caddy + mkcert)

Semua komponen dalam satu host via [`docker-compose.prod.yml`](../docker-compose.prod.yml):
`app` (Next standalone), `db` (Postgres 17), `caddy` (reverse-proxy + TLS).

### 1. Sertifikat TLS internal (mkcert)

Untuk LAN tanpa domain publik:

```bash
mkcert -install                                   # sekali per mesin (root CA lokal)
mkdir -p certs
mkcert -cert-file certs/cert.pem \
       -key-file  certs/key.pem  katalog.rsudkotser.local
```

Sesuaikan host di [`Caddyfile`](../Caddyfile). Tambahkan `katalog.rsudkotser.local`
ke DNS internal / `hosts` klien. Jika ada domain + internet → hapus baris `tls`
di Caddyfile agar Caddy meng-issue Let's Encrypt otomatis.

### 2. Konfigurasi env

Buat `.env.prod` (jangan commit — `.gitignore` sudah menutup `.env*`):

```dotenv
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<kuat>
POSTGRES_DB=katalog

DATABASE_URL=postgres://postgres:<kuat>@db:5432/katalog
STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=/app/.storage
ADMIN_PASSWORD_HASH=$argon2id$v=19$m=…        # env langsung → TANPA escape \$
SESSION_SECRET=<rahasia ≥ 32 karakter>
APP_URL=https://katalog.rsudkotser.local
RATE_LIMIT_MAX=60
RATE_LIMIT_WINDOW_SEC=60
```

> `POSTGRES_PASSWORD` juga dibaca compose untuk service `db` — samakan dengan
> yang ada di `DATABASE_URL`.

### 3. Jalankan

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Migrasi skema

Kontainer runner tak memuat drizzle-kit (devDependency). Terapkan migrasi dari
host yang punya repo, arahkan ke Postgres kontainer:

```bash
# Ekspos port db sementara, atau jalankan dari dalam jaringan compose:
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U postgres -d katalog < drizzle/0000_motionless_magma.sql
# — atau — dari mesin dev dengan port di-forward:
DATABASE_URL="postgres://postgres:<kuat>@localhost:5432/katalog" pnpm db:migrate
```

Untuk migrasi berikutnya, `pnpm db:migrate` (Drizzle melacak yang sudah diterapkan).

---

## Backup & pemulihan

### Neon (target A)

- **PITR bawaan:** Neon menyimpan riwayat (history retention) → pulihkan lewat
  **branch dari titik waktu** di konsol Neon (tanpa dump). Verifikasi retensi
  cukup untuk RS (mis. 7 hari) di Settings.
- **Dump terjadwal (arsip off-site):**
  ```bash
  pg_dump "$DATABASE_URL" -Fc -f "katalog-$(date +%F).dump"
  ```
  Jadwalkan (cron/GitHub Action) harian; simpan ke penyimpanan terpisah.
- **Restore:** `pg_restore --clean --no-owner -d "$DATABASE_URL" katalog-YYYY-MM-DD.dump`.
- **Bukti media** ada di Vercel Blob (durable, tereplikasi) — di luar dump DB.

### Self-host (target B)

- **Database:**
  ```bash
  docker compose -f docker-compose.prod.yml exec -T db \
    pg_dump -U postgres -Fc katalog > "katalog-$(date +%F).dump"
  ```
  Jadwalkan via cron host; rotasi & salin off-site. Restore:
  ```bash
  cat katalog-YYYY-MM-DD.dump | docker compose -f docker-compose.prod.yml exec -T db \
    pg_restore --clean --no-owner -U postgres -d katalog
  ```
- **Bukti media** (volume `storage`, `STORAGE_DRIVER=local`):
  ```bash
  docker run --rm -v <project>_storage:/data -v "$PWD":/backup alpine \
    tar czf /backup/storage-$(date +%F).tar.gz -C /data .
  ```

> **Uji restore berkala** — backup tak teruji = tak ada backup. Restore ke DB
> sekali-pakai tiap kuartal & pastikan app boot + data utuh.
