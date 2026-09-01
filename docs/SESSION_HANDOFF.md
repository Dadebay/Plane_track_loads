# Oturum Devir Notu — 2026-08-17

> Bu dosya, projeyi başka bir Claude oturumunun/hesabının devralması için yazıldı.
> Güncel durumu okuduktan sonra bu dosyayı silebilir veya güncelleyebilirsin —
> kalıcı bir belge değil, bir "kaldığımız yer" notu.

## Durum özeti

**16 fazdan 5'i tamamen bitti** (Faz 0-5, tüm kabul kriterleriyle). Sıradaki:
**Faz 6** (Uçuş Programı Modülü).

**Müşteri önceliği (kullanıcıdan iletildi):** Kapsam daraltılmıyor, TÜM fazlar
yapılacak — ama müşteri özellikle **W&B hesabı + PDF çıktısı**na önem
veriyor, ULD stok yönetimini (Faz 7) pek önemsemiyor. Zaman baskısı olursa
Faz 8 (yükleme planlama) ve Faz 9-11 (PDF üretimi) öncelikli tutulmalı.

**Faz 5 sonrası ekstra iyileştirmeler (plan dışı ama yapıldı):**
- Login sayfası: kargo uçağı arka plan fotoğrafı (`public/login-background.png`,
  kullanıcı ChatGPT ile ürettirdi) + karanlık overlay + cam efektli kart +
  logo/dil/tema seçici header + footer. Hem light hem dark modda, 375px'te
  test edildi.
- **Gilroy font** tüm uygulamaya eklendi (`apps/web/src/fonts.ts`,
  `next/font/local` ile self-hosted, `apps/web/src/fonts/Gilroy-*.ttf`).
  `--font-sans` artık Gilroy'u öncelikli kullanıyor, Türkmen/Kiril karakterler
  için sistem fontuna otomatik (karakter bazlı) fallback yapıyor —
  `globals.css`'teki yorum bunu açıklıyor. Font dosyaları
  `x_ai_uygulama` projesindeki Gilroy TTF'lerinden kopyalandı (kullanıcının
  kendi lisanslı font dosyaları).
- `TRUNCATE` immutability açığı bulundu ve kapatıldı (bkz. Faz 4 notları).

Repo genelinde `pnpm typecheck && pnpm test && pnpm lint && pnpm build` — hepsi
temiz (son kontrol: bu dosyanın yazıldığı an).

## Ortam / nasıl devam edilir

```bash
# Postgres gerekiyor (Docker Desktop açık olmalı):
docker compose up -d postgres

# apps/web/.env.local zaten var (gitignored), içeriği:
#   DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_APP_URL, DOCUMENTS_WATERMARK, NEXT_PUBLIC_DEFAULT_LOCALE
# Yoksa .env.example'dan kopyala.

pnpm install
pnpm dev   # veya Claude Code'un preview_start aracı, launch.json'da "web" adıyla tanımlı
```

**Test giriş bilgileri** (`packages/db/prisma/seed.ts`, hepsi aynı şifre):
| Rol | Email |
|---|---|
| ADMIN | admin@tua.local |
| LOAD_CONTROLLER | controller@tua.local |
| CHECKER | checker@tua.local |
| RAMP | ramp@tua.local |
| VIEWER | viewer@tua.local |

Şifre: `ChangeMe123!`

## Faz bazında durum

### ✅ Faz 0 — Monorepo iskeleti
pnpm + Turborepo, tüm paketler kurulu, CI (`ci.yml`) postgres servisiyle
çalışıyor (bir `prisma migrate deploy` adımı eklendi).

### ✅ Faz 1 — Tasarım sistemi + i18n
Tema (`packages/ui/src/theme.css`), 3 dil (`tk`/`ru`/`en`), `AppShell`,
`DataTable`/`StatusBadge`/`PageHeader`/`FilterPanel`/`Pagination`.

**Önemli:** `DataTable` her zaman `<tr onClick>` render ediyor (onRowClick
verilmese bile) — bu yüzden Next.js Server Component içinde DOĞRUDAN
kullanılamıyor, "Event handlers cannot be passed to Client Component props"
hatası verir. **Desen:** Server Component veri çeker → sonucu bir
`"use client"` alt bileşene prop olarak geçirir → o alt bileşen DataTable'ı
render eder. `apps/web/src/app/[locale]/(app)/admin/ahm/` altındaki her
sayfa bu deseni kullanıyor (`page.tsx` = server, `*-view.tsx` = client).
Yeni bir DataTable kullanan sayfa yazarken bunu tekrarla.

### ✅ Faz 2 — AHM 560 veri çıkarımı
`packages/ahm-data/data/a330-243p2f/ed1-rev0/*.json` (11 dosya) + zod şeması
+ `ground-truth.test.ts` (58 test / 200+ assertion) + `docs/AHM560_ERRATA.md`
(6 kayıt).

### ✅ Faz 3 — `@tua/wnb-core` hesap motoru
T5 692 altın test vakası çalışıyor (58 test). **Önemli bulgu (Bulgu #7,
`docs/AHM560_GROUND_TRUTH.md` ve `AHM560_ERRATA.md`'de belgeli):** AHM
560 Ed.1/Rev.0 verisiyle aşağıdan yukarıya hesaplanan LIZFW/yakıt indeksi,
gerçek loadsheet'in bastığı değerlerle tam örtüşmüyor (~1,1 / ~0,45 fark).
Formülün kendisi doğru (loadsheet'in kendi LIZFW/LITOW değerleri girdi
olarak verildiğinde GT'yi bit bit üretiyor) — sorun muhtemelen elimizdeki
AHM revizyonunun gerçek loadsheet'i üreten revizyon olmaması (Bulgu #2 ile
aynı kök neden). Golden test bunu 3 parçaya bölerek belgeliyor.

### ✅ Faz 4 — DB + Auth + denetim izi
Prisma şeması, immutable `WnbCalculation`/`Document` (Prisma extension +
Postgres trigger — **TRUNCATE için de** ayrı bir trigger var, row-level
trigger'lar TRUNCATE'i yakalamıyor, bunu Faz 5'te bulup düzelttim), `prepared_by
<> checked_by` CHECK constraint, AuditLog extension, Auth.js v5.

**Önemli teknik detaylar:**
- `apps/web/src/auth.config.ts` (Edge-safe, provider yok) vs `auth.ts`
  (Node-only, argon2 + Credentials provider). Middleware SADECE
  `auth.config.ts`'den kendi `auth()`'unu kurar — `auth.ts`'i import etmez
  (argon2'nin `node:crypto`'su Edge runtime'da patlıyor).
- `turbo.json`'da `globalEnv` var — DATABASE_URL/AUTH_SECRET/vb. olmadan
  turbo v2 varsayılan `strict` env modunda bu değişkenleri child process'lere
  GEÇİRMİYOR. Yeni bir env var eklersen `globalEnv` listesine de ekle.
- `/api/*` route'ları middleware.ts'in matcher'ı dışında — kendi auth
  kontrolünü kendisi yapmalı (bkz. `app/api/admin/ahm/*/route.ts`).

### ✅ Faz 5 — AHM Master Data Yönetim Arayüzü
- `/admin/ahm` liste, `/admin/ahm/[id]` detay (tüm tablolar), `/admin/ahm/diff`
  (versiyon karşılaştırma — `packages/ahm-data/src/diff.ts`, 9 test),
  `/admin/ahm/upload` (validate→confirm iki adımlı akış, gerçek dosyalarla
  uçtan uca test edildi), `/admin/ahm/calculations` (hangi uçuş hangi AHM
  revizyonuyla hesaplandı raporu).
- Sadece ADMIN erişebiliyor — middleware'de test edildi (controller rolüyle
  `/admin/ahm`'e gidince ana sayfaya redirect oluyor).
- **Bilerek atlanan tek şey:** CG envelope'un interaktif SVG önizlemesi (plan
  madde 6) — Faz 11'in SVG motoruna bağımlı, henüz o faz yok.
- ADMIN erişim kontrolü tarayıcıda gerçek oturumla doğrulandı (controller
  rolüyle `/admin/ahm`'e gidince ana sayfaya redirect).

### ⬜ Faz 6-15 — henüz başlanmadı
Sıradaki: **Faz 6 — Uçuş Programı Modülü**
(`docs/IMPLEMENTATION_PLAN.md`'de tam prompt var). Not:
`apps/web/src/app/[locale]/(app)/flights/page.tsx` zaten Faz 1'den kalma
**mock veriyle çalışan bir placeholder** — gerçek DB'ye bağlanmıyor, T5 692'yi
sabit kodlanmış gösteriyor. Faz 6'da bunu gerçek `Flight`/`FlightLeg` CRUD'una
bağlamak gerekecek.

**Kritik yol:** Faz 0→1→2→3→**8**→10→14 (plan dokümanına göre). Faz 5-7
paralel/opsiyonel ama Faz 8 (yükleme planlama) kritik.

## Bilinen küçük teknik borç
- `.next` klasörünü prod `pnpm build` ile dev server aynı anda çalışırken
  karıştırma — çakışıyor, "vendor-chunks not found" hatası veriyor. Biri
  diğeriyle çakışırsa `rm -rf apps/web/.next` + server restart.
- Dev Postgres'te birkaç zararsız test kaydı olabilir (immutable tablolar
  yüzünden silinemiyor, TRUNCATE de artık engelli — bu bilinçli bir tasarım
  tercihi, prod'da sorun değil).
