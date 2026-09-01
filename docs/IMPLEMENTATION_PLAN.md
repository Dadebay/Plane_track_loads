# TUA Load Control System — Uygulama Planı

> **Proje:** Turkmenistan Airlines için tam kapsamlı yük kontrol (Load Control) ve
> ağırlık-denge (Weight & Balance) sistemi. `tua.aerometa.aero`'nun **tam muadili ve
> rakibi**.
>
> **Kullanım:** Gerçek uçuş verisiyle, operasyonel kullanım hedefli.
>
> **Bu doküman nasıl kullanılır:** Her faz, Sonnet 5'e **tek seferde verilebilecek**
> şekilde yazıldı. Fazı açın, `## Sonnet 5 Prompt` bölümünü kopyalayın, çalıştırın,
> `## Kabul Kriterleri`'ni doğrulayın, sonraki faza geçin. Fazlar **sıralıdır** —
> atlama yapmayın.
>
> **Referans dosyalar:**
> - `docs/AHM560_GROUND_TRUTH.md` — doğrulanmış AHM 560 verisi + T5 692 test vektörü
> - `docs/AHM560_ERRATA.md` — Faz 2'de oluşturulacak
> - Kaynak PDF'ler: `~/Downloads/AHM 560 -AIRBUS_A330_200P2F_APPROVED_FINAL.pdf`,
>   `ENV_T5692_11082026_ED01.pdf`, `LIR_T5692_11082026_ED01.pdf`, `LS_T5692_11082026_ED01.pdf`

---

# Bölüm A — Ürün Kararları (değiştirilmeyecek)

## A.1 Teknoloji yığını (KİLİTLİ)

```
Dil            TypeScript (strict) — uçtan uca
Frontend       Next.js 15 (App Router) + React 19
Stil           Tailwind CSS v4 + shadcn/ui
Tema           next-themes (light / dark / system)
i18n           next-intl — tk (Türkmençe), ru (Русский), en (English)
State          TanStack Query (server) + Zustand (UI)
Form           react-hook-form + zod
Backend        Next.js Route Handlers + Server Actions
DB             PostgreSQL 16
ORM            Prisma
Auth           Auth.js (NextAuth v5) — credentials + rol tabanlı
PDF            @react-pdf/renderer (sunucu tarafı, deterministik)
Grafik         Sunucuda üretilen saf SVG (CG envelope) — kütüphane yok
Test           Vitest (unit) + Playwright (e2e)
Monorepo       pnpm workspaces + Turborepo
Konteyner      Docker + docker-compose
```

### Neden bu seçimler
- **TypeScript uçtan uca** — birim karışması (kg/lb, m/inch) tip düzeyinde engellenir;
  hesap tipleri frontend, backend ve PDF arasında paylaşılır.
- **`@react-pdf/renderer` (Puppeteer değil)** — headless Chrome deterministik değil
  (font rendering, sürüm farkı) ve sunucuda ağır. Emniyet-kritik belgede **aynı girdi
  → byte-identical çıktı** şart.
- **Saf SVG grafik** — CG envelope'un her pikseli AHM verisinden türemeli;
  chart kütüphanesi araya yorum katar.
- **PostgreSQL** — uçuş → leg → ULD → pozisyon → edition ilişkisel; denetim izi ve
  transaction garantisi şart. Firestore bu iş için uygun değil.

## A.2 Kesin kurallar

| # | Kural |
|---|---|
| 1 | **Hesap çekirdeği (`@tua/wnb-core`) hiçbir framework'e bağımlı olmayamaz.** Saf TS, sıfır runtime bağımlılık (sadece `decimal.js`). |
| 2 | **Float aritmetik yasak.** Tüm W&B hesabı `decimal.js` ile. Yuvarlama sadece sunum katmanında. |
| 3 | **Hiçbir AHM sabiti koda gömülemez.** Hepsi versiyonlu JSON'dan gelir. |
| 4 | **Belgeler (LIR/Loadsheet/ENV/NOTOC) her zaman İngilizce.** Havacılık standardı + otorite gereği. **UI 3 dilli, belgeler değil.** |
| 5 | Her hesap fonksiyonu, kaynağını AHM 560 sayfa numarasıyla yorumlar (`// AHM 560 s.16 §3.4`). |
| 6 | Üretilen her belge **değişmez (immutable)**. Değişiklik = yeni edition (ED01 → ED02). |
| 7 | Validasyon tamamlanana kadar her PDF'e `NOT FOR OPERATIONAL USE` filigranı. Kaldırma tek bir env flag ile. |
| 8 | `prepared_by ≠ checked_by` — sistem zorunlu kılar. |
| 9 | Mobil öncelikli. Ramp ekibi tablet/telefon kullanır. |
| 10 | Offline dayanıklılık: yükleme ekranı ağ kesilse de çalışmaya devam eder (PWA + IndexedDB kuyruk). |

## A.3 Monorepo yapısı

```
plane_project/
├─ apps/
│  └─ web/                    # Next.js uygulaması
│     ├─ src/app/[locale]/    # i18n route segmenti
│     ├─ src/components/
│     ├─ src/server/          # server actions, db erişimi
│     └─ messages/            # tk.json, ru.json, en.json
├─ packages/
│  ├─ wnb-core/               # ⭐ hesap motoru — saf TS
│  ├─ ahm-data/               # AHM 560 JSON + zod şema + loader
│  ├─ documents/              # PDF üreticileri (LIR, LS, ENV, NOTOC)
│  ├─ messaging/              # LDM/CPM/MVT/FFM/FBL kodlayıcıları
│  ├─ db/                     # Prisma şeması + client
│  └─ ui/                     # paylaşılan shadcn bileşenleri + tema
├─ tools/
│  └─ extract-ahm560/         # PDF → JSON çıkarım scriptleri (Python)
├─ docs/
│  ├─ AHM560_GROUND_TRUTH.md
│  ├─ AHM560_ERRATA.md
│  ├─ IMPLEMENTATION_PLAN.md  # bu dosya
│  └─ VALIDATION_DOSSIER.md
└─ compose.yaml
```

---

# Bölüm B — Tasarım Sistemi Şartnamesi

Bu bölüm **Faz 1'de** uygulanır ve sonraki tüm fazlar buna uyar.

## B.1 Marka ve renk

Turkmenistan Airlines kurumsal rengi: **yeşil**. Referans ekranlardan alınan tonlar:
- Birincil yeşil: `#1B8B3A` civarı (sidebar aktif, butonlar)
- Koyu yeşil: `#0F6B2A` (logo)
- Tablo başlığı mavisi: `#2563EB` civarı (mevcut sistemde kullanılıyor)

**Token yapısı** — CSS değişkenleri, hem light hem dark için tanımlı:

```css
:root {
  --brand-50 ... --brand-950     /* yeşil skalası */
  --bg, --bg-subtle, --bg-muted
  --fg, --fg-muted, --fg-subtle
  --border, --border-strong
  --success, --warning, --danger, --info
  --status-reserved, --status-active, --status-departed,
  --status-cancelled, --status-finalized
}
```

**Dark mode kuralları:**
- `next-themes` ile `class` stratejisi, `light` / `dark` / `system` üç durum
- Renk **tanımı asla** sadece `@media (prefers-color-scheme)` içinde olmaz —
  önce `:root`'ta tam light paleti, sonra `.dark`'ta override
- Dark modda saf siyah (`#000`) **kullanılmaz** → `#0B0F0E` gibi hafif yeşilimsi koyu
- Durum renkleri (Reserved/Active/…) her iki temada **WCAG AA kontrast** sağlar
- **PDF'ler her zaman light** — tema PDF'i etkilemez

## B.2 Responsive strateji

| Breakpoint | Genişlik | Davranış |
|---|---|---|
| `mobile` | < 640px | Sidebar → alt tab bar. Tablolar → kart listesi. Yükleme planı → dikey akış |
| `tablet` | 640–1024px | Sidebar daraltılabilir ikon şeridi. Tablolar yatay kaydırmalı |
| `desktop` | > 1024px | Tam sidebar + tablolar |

**Kritik ekranlar için özel kurallar:**
- **Uçuş listesi tablosu:** mobilde tablo yerine kart. Her kart: durum rozeti,
  uçuş no, rota, kalkış zamanı. Detay için tıklama.
- **Yükleme planı (load planning):** masaüstünde uçak gövdesi şeması + sürükle-bırak.
  Mobilde **pozisyon listesi** görünümü — her satır bir pozisyon, dokunarak ULD ata.
  Uçak şeması mobilde küçük bir "mini map" olarak üstte sabit.
- **Tüm geniş tablolar** kendi `overflow-x: auto` kabında; sayfa gövdesi **asla**
  yatay kaymaz.
- Dokunma hedefleri minimum **44×44px**.

## B.3 i18n şartnamesi

**Diller:** `tk` (Türkmençe, varsayılan), `ru` (Русский), `en` (English)

```
apps/web/messages/
  tk.json
  ru.json
  en.json
```

**Kurallar:**
1. URL yapısı: `/tk/flights`, `/ru/flights`, `/en/flights`. Varsayılan `tk`.
2. **Hiçbir kullanıcıya görünen string koda gömülemez.** ESLint kuralı ile zorla.
3. Anahtar yapısı alan bazlı: `flights.list.title`, `wnb.errors.cgOutOfEnvelope`
4. **Havacılık terimleri çevrilmez** — `ULD`, `ZFW`, `TOW`, `MAC`, `LIR`, `LDM`,
   `AWB`, `PMC`, `MTOW` vb. üç dilde de aynı kalır. Yanına parantez içi açıklama
   çevrilebilir: `tk: "ZFW (Ýangyçsyz agram)"`, `ru: "ZFW (Вес без топлива)"`.
5. Sayı/tarih formatı: `Intl.NumberFormat` / `Intl.DateTimeFormat` locale ile.
   **Ama ağırlıklar her zaman `1 234,5` formatında** (boşluk binlik, virgül ondalık) —
   AHM ve loadsheet formatına uyum için, locale'den bağımsız.
6. Tarih girişi her zaman `DD/MM/YYYY`, saat `HH:mm` (havacılık standardı).
7. **UTC / Local seçimi** her zaman görünür — mevcut sistemde `Time Zone` alanı var.
8. Kiril (ru) ve Latin-Türkmen (tk) karakter desteği fontlarda doğrulanır.
   Türkmen alfabesi özel karakterler içerir: `ä ç ž ň ö ş ü ý`.
9. Çeviri eksikse **fallback `en`**, ve konsola uyarı.

**PDF'ler:** `packages/documents` **i18n kullanmaz** — tüm etiketler İngilizce sabit.

---

# Bölüm C — Fazlar

---

## FAZ 0 — Monorepo İskeleti

**Amaç:** Çalışan, test edilebilir, konteynerize boş bir iskelet.

**Görevler:**
1. pnpm workspace + Turborepo kurulumu
2. `apps/web` — Next.js 15 App Router, TypeScript strict
3. `packages/`: `wnb-core`, `ahm-data`, `documents`, `messaging`, `db`, `ui` (boş, build alan)
4. ESLint + Prettier + `tsconfig` base config paylaşımı
5. Vitest kurulumu (her pakette çalışır)
6. `compose.yaml` — Postgres 16 + web servisi
7. GitHub Actions: lint → typecheck → test → build
8. `.env.example`

**Kabul kriterleri:**
- [ ] `pnpm install && pnpm build` hatasız
- [ ] `pnpm test` çalışır (0 test geçer)
- [ ] `docker compose up` ile Postgres + web ayağa kalkar
- [ ] `tsc --noEmit` her pakette temiz
- [ ] CI yeşil

### Sonnet 5 Prompt
```
plane_project dizininde bir pnpm + Turborepo monorepo kur.

Yapı:
  apps/web              → Next.js 15 App Router, React 19, TypeScript strict
  packages/wnb-core     → saf TS kütüphane, tek runtime bağımlılık: decimal.js
  packages/ahm-data     → saf TS, bağımlılık: zod
  packages/documents    → @react-pdf/renderer
  packages/messaging    → saf TS
  packages/db           → Prisma
  packages/ui           → React + Tailwind v4 + shadcn/ui

Gereksinimler:
- TypeScript strict + noUncheckedIndexedAccess: true
- Paylaşılan tsconfig.base.json, eslint config, prettier config
- Vitest her pakette bağımsız çalışsın, kökten `pnpm test` hepsini koştursun
- Turborepo pipeline: lint, typecheck, test, build (doğru bağımlılık sırasıyla)
- compose.yaml: postgres:16 (volume ile kalıcı) + web servisi
- .env.example: DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_APP_URL,
  DOCUMENTS_WATERMARK=true
- .github/workflows/ci.yml: install → lint → typecheck → test → build

Henüz iş mantığı yazma. Sadece iskelet, her şey derlensin ve testler koşsun.
Bitince `pnpm build` ve `pnpm test` çıktısını göster.
```

---

## FAZ 1 — Tasarım Sistemi + i18n Temeli

**Amaç:** Dark mode, responsive shell ve 3 dil altyapısı — içerik gelmeden önce.

**Görevler:**
1. Tailwind v4 tema tokenları (`packages/ui/src/theme.css`) — Bölüm B.1'e göre
2. `next-themes` entegrasyonu, tema değiştirici (light/dark/system)
3. `next-intl` kurulumu, `[locale]` route segmenti, middleware ile locale algılama
4. `messages/tk.json`, `ru.json`, `en.json` — iskelet anahtarlarla
5. Dil değiştirici bileşeni (bayrak/kod + ad)
6. Uygulama kabuğu (AppShell): sidebar (desktop) / alt tab bar (mobile) / header
7. shadcn/ui kurulumu ve tema tokenlarına bağlanması
8. Ortak bileşenler: `DataTable` (mobilde kart moduna geçen), `StatusBadge`,
   `PageHeader`, `FilterPanel`, `Pagination`
9. Storybook **kurulmayacak** — bunun yerine `/[locale]/_dev/components` sayfası
10. ESLint kuralı: JSX içinde çıplak string yasak

**Kabul kriterleri:**
- [ ] Tema değiştirici üç durumu da doğru çalışır, sayfa yenilemede korunur
- [ ] Dark modda hiçbir yerde okunmayan kontrast yok (otomatik kontrast testi)
- [ ] `/tk`, `/ru`, `/en` üçü de çalışır, dil değiştirici sayfayı korur
- [ ] Türkmen özel karakterleri (`ä ç ž ň ö ş ü ý`) ve Kiril doğru render olur
- [ ] 375px genişlikte hiçbir sayfada yatay kaydırma yok
- [ ] `DataTable` mobilde kart moduna geçer
- [ ] Lighthouse mobil erişilebilirlik ≥ 95

### Sonnet 5 Prompt
```
docs/IMPLEMENTATION_PLAN.md Bölüm B'yi oku ve tasarım sistemi + i18n temelini kur.

1. packages/ui:
   - Tailwind v4 tema: CSS değişkenleriyle tam light paleti :root'ta,
     .dark'ta override. Turkmenistan Airlines yeşili birincil renk (#1B8B3A civarı).
     Dark modda saf siyah kullanma, #0B0F0E gibi hafif yeşilimsi koyu kullan.
   - Durum renkleri: reserved, active, departed, cancelled, finalized
     — her ikisinde de WCAG AA kontrast.
   - shadcn/ui kur, tema tokenlarına bağla.
   - Bileşenler: DataTable (mobilde <640px otomatik kart moduna geçer),
     StatusBadge, PageHeader, FilterPanel, Pagination, ThemeToggle, LocaleSwitcher.

2. apps/web:
   - next-themes: light/dark/system, localStorage'da kalıcı, FOUC yok.
   - next-intl: [locale] route segmenti, diller tk (varsayılan), ru, en.
     Middleware ile locale algılama ve yönlendirme.
   - messages/{tk,ru,en}.json — nav, common, flights, uld, wnb, auth
     alanları için iskelet anahtarlar. Üç dosya da AYNI anahtar setine sahip olsun.
   - AppShell: desktop'ta sol sidebar (Flight selection, Flight schedule,
     Flight document, ULD Stock), mobilde alt tab bar. Header'da tema ve
     dil değiştirici, sağ altta kullanıcı rozeti.
   - /[locale]/_dev/components sayfası: tüm bileşenleri her iki temada gösterir.

3. ESLint kuralı ekle: JSX içinde çıplak kullanıcıya görünen string yasak
   (react/jsx-no-literals, sayılar ve teknik kısaltmalar hariç).

ÖNEMLİ:
- Havacılık kısaltmaları (ULD, ZFW, TOW, MAC, LIR, AWB, MTOW) üç dilde de
  çevrilmez, aynı kalır.
- Ağırlık formatı locale'den bağımsız her zaman "1 234,5" (boşluk binlik,
  virgül ondalık).
- Tarih girişi her zaman DD/MM/YYYY, saat HH:mm.

Bitirince 375px, 768px ve 1440px genişliklerde, light ve dark modda
_dev/components sayfasının ekran görüntüsünü al ve göster.
```

---

## FAZ 2 — AHM 560 Veri Çıkarımı ⭐

**Amaç:** 79 sayfalık onaylı PDF'i makine-okunur, doğrulanmış JSON'a çevirmek.
**Bu projenin en kritik fazıdır.** Buradaki bir hata her loadsheet'e yansır.

**Görevler:**
1. `tools/extract-ahm560/` — Python, `pdfplumber` + `pdftotext -layout`
2. Her tablo tipi için ayrı çıkarıcı (fuel, positions, cg-limits, combined-load, …)
3. Çıktı: `packages/ahm-data/data/a330-243p2f/ed1-rev0/*.json`
4. `packages/ahm-data/src/schema.ts` — tüm veri için zod şeması
5. **Ground truth testi:** `docs/AHM560_GROUND_TRUTH.md`'deki her değeri assert eden
   test dosyası
6. `docs/AHM560_ERRATA.md` — kaynak dokümandaki hatalar ve nasıl ele alındıkları
7. Yapısal doğrulamalar: 15 yoğunluk tablosu var mı, her pozisyon indeksi var mı,
   zone dağılım katsayıları 1,0 topluyor mu, vb.

**Veri dosyaları:**
```
aircraft.json          # tescil, BEW, BEW CG, limitler
index-formula.json     # RefSta, K, C, MAC, LEMAC, stab trim eğrisi
dow-doi-matrix.json    # ekip kombinasyonları
fuel-index.json        # 15 yoğunluk × ~45 satır
cg-limits.json         # ZFW/TOW forward/aft breakpoint'leri
compartments.json      # kompartıman limitleri ve indeksleri
positions.json         # tüm ULD pozisyonları: kod, güverte, tip, maxGross, indexPerKg
combined-load.json     # zone limitleri, H-arm, ZFCG bantları
zone-mapping.json      # pozisyon → zone, uzun palet dağılım katsayıları
uld-types.json         # PLA/FLA, PAG, PMC, PZA, PGA
crew-index.json        # kokpit/kuryeci/galley indeks etkileri
```

**Kabul kriterleri:**
- [ ] Ground truth testinin **tamamı** geçer (200+ assertion)
- [ ] 15 yakıt yoğunluğu tablosu, her biri eksiksiz, `FULL` satırı dahil
- [ ] Tüm pozisyon kodları çıkarıldı: ana güverte 4 tip + alt güverte 4 tip + 16/20ft
- [ ] Zod şeması tüm JSON'ları doğrular
- [ ] Errata dokümanı en az 3 kayıt içerir (`25≤ZFCG<25` dizgi hatası, `76,8`
      tek ondalık, boş `List of Revisions`)
- [ ] Çıkarım scripti **tekrarlanabilir** — aynı PDF, aynı JSON (byte-identical)

### Sonnet 5 Prompt
```
docs/AHM560_GROUND_TRUTH.md dosyasını BAŞTAN SONA oku. Bu, elle doğrulanmış
referans veridir.

Görev: ~/Downloads/AHM 560 -AIRBUS_A330_200P2F_APPROVED_FINAL.pdf dosyasından
tüm ağırlık-denge verisini çıkarıp JSON'a çevir.

1. tools/extract-ahm560/ altında Python çıkarım scriptleri yaz
   (pdfplumber ve/veya pdftotext -layout kullan; ikisi de mevcut).

   Sayfa haritası GROUND_TRUTH §8 ve bölüm başlıklarında verildi.
   PDF sayfası = basılı sayfa + 1.

   Yakıt tabloları en zor kısım: her sayfada 2 sütun çifti var
   (Fuel Weight | Index Value | Fuel Weight | Index Value).
   Okuma sırası: SOL sütun yukarıdan aşağı, SONRA sağ sütun yukarıdan aşağı.
   Karakter x-pozisyonuna göre sütun ayırımı yap ("Fuel Weight" başlığının
   ikinci geçişi sağ sütunun başlangıcıdır).
   Ağırlık monoton artmalı; İNDEKS DEĞERİ MONOTON DEĞİL — bu normaldir,
   monotonluk doğrulaması KOYMA.
   Son satır sayısal değil, "FULL" stringi.

2. Çıktıyı packages/ahm-data/data/a330-243p2f/ed1-rev0/ altına yaz.
   Dosya listesi IMPLEMENTATION_PLAN Faz 2'de verildi.

3. packages/ahm-data/src/schema.ts — her dosya için zod şeması.
   Loader fonksiyonu: loadAhmData(aircraftType, edition, revision).

4. packages/ahm-data/test/ground-truth.test.ts — GROUND_TRUTH.md'deki
   HER SAYISAL DEĞERİ assert et. Ağırlık limitleri, BEW, DOW/DOI matrisinin
   56 hücresi, indeks formülü sabitleri, tüm pozisyon indeksleri,
   combined load tablosunun 168 hücresi, CG limit breakpoint'leri,
   yakıt tablosunun GROUND_TRUTH §8'de verilen örnek satırları.

5. docs/AHM560_ERRATA.md oluştur. Kaynak dokümandaki her hata/belirsizlik:
   ne bulundu, nasıl yorumlandı, hangi dosyada nasıl kodlandı.
   En az şunlar girmeli:
   - s.56 ikinci tablo ilk sütun başlığı "25≤ZFCG<25" → "25≤ZFCG<26" düzeltmesi
   - s.6 EZ-F430 kokpit3/kuryeci3 hücresi "76,8" tek ondalık
   - s.9 List of Revisions tablosu boş
   - s.69 Desired Trim Line breakpoint tablosu boş

KURALLAR:
- Ground truth ile çıkarım çakışırsa ÇIKARIM HATALIDIR. Ground truth'u değiştirme.
- Çıkarım scripti deterministik olmalı: iki kez çalıştır, JSON'lar byte-identical olsun.
- Hiçbir değeri "makul görünüyor" diye elle düzeltme; tutarsızlığı ERRATA'ya yaz.
- Sayıları string olarak sakla (decimal.js ile okunacak), float'a çevirme.

Bitirince: test sonuçlarını ve üretilen JSON dosyalarının satır sayılarını göster.
Çıkaramadığın veya emin olamadığın her tabloyu açıkça listele.
```

---

## FAZ 3 — Hesap Motoru `@tua/wnb-core` ⭐

**Amaç:** T5 692'yi bire bir yeniden üreten, tam test edilmiş hesap çekirdeği.

**Görevler:**
1. Tip tanımları: `Aircraft`, `LoadItem`, `Position`, `FuelState`, `WnbResult`
2. `calculateIndex(weight, station)` / `indexToMac(index, weight)` — AHM s.15–16
3. `calculateDOW(registration, cockpitCrew, courierCrew)` — matris + interpolasyon yok
4. `fuelIndex(weight, density)` — tablo lookup + lineer interpolasyon
5. `calculateWnb(input)` — ana fonksiyon: ZFW, TOW, LDW, LIZFW, LITOW, LILAW,
   MACZFW, MACTOW, MACLAW, STAB
6. `checkEnvelope(weight, index, phase)` — CG limit interpolasyonu + zarf içi/dışı
7. `checkCombinedLoad(loadByZone, zfcg)` — kümülatif zone limitleri
8. `checkCompartmentLimits(load)` — kompartıman ve pozisyon max brüt
9. `checkLateralImbalance(load, fuel)` — side-by-side paletler için
10. `calculateUnderload(weights, limits)` — **Bulgu #1'i düzelt**
11. `applyLMC(result, changes)` — son dakika değişikliği
12. Hata tipleri: `CgOutOfEnvelopeError`, `WeightLimitExceededError`,
    `CumulativeLoadExceededError`, `FuelDensityOutOfRangeError`
13. Test: T5 692 altın vakası + sınır durumları + property-based testler

**Kabul kriterleri:**
- [ ] T5 692 testinde `MACZFW = 26,4`, `MACTOW = 26,7`, `TTL = 35 278`,
      `ZFW = 146 321,7`, `TOW = 191 021,7`, `LDW = 154 361,7` — tam eşleşme
- [ ] `UNDERLOAD = 23 678,3` (Aerometa'nın 24 722'sini **düzeltiyoruz**;
      test bu farkı açıkça belgeliyor)
- [ ] `STAB = 4,1` (truncate kuralı ile)
- [ ] Zarf dışı senaryolar hata fırlatır
- [ ] MZFW/MTOW/MLW aşımı hata fırlatır
- [ ] Yakıt yoğunluğu 0.760 altı / 0.830 üstü → hata
- [ ] `decimal.js` kullanımı — kodda hiçbir yerde `+` `-` `*` `/` ile ağırlık aritmetiği yok
- [ ] Test kapsamı ≥ %95
- [ ] Paket `wnb-core` hiçbir Next/React/Prisma bağımlılığı içermiyor

### Sonnet 5 Prompt
```
docs/AHM560_GROUND_TRUTH.md §5, §6, §10, §12, §19 ve §20'yi oku.

packages/wnb-core içinde ağırlık-denge hesap motorunu yaz.

MUTLAK KURALLAR:
- Saf TypeScript. Tek runtime bağımlılık: decimal.js. React/Next/Prisma YASAK.
- Tüm aritmetik decimal.js ile. Kodda ağırlık/indeks üzerinde çıplak + - * / YOK.
- Tüm sabitler @tua/ahm-data'dan gelir. Hiçbir sayı koda gömülmez.
- Her fonksiyonun üstünde kaynak: // AHM 560 s.16 §3.4

API:
  calculateIndex(weight, station, formula): Decimal
  indexToMac(index, weight, formula): Decimal
  macToStab(mac, curve): { value: Decimal, direction: 'UP'|'DOWN' }
  getDowDoi(registration, cockpitCrew, courierCrew): { dow, doi }
  getFuelIndex(fuelWeight, density): Decimal      // lineer interpolasyon
  calculateWnb(input: WnbInput): WnbResult
  checkEnvelope(weight, index, phase: 'ZFW'|'TOW'|'LDW'): EnvelopeCheck
  checkCombinedLoad(loadByZone, zfcg): CombinedLoadCheck
  checkCompartmentLimits(loadItems): LimitCheck[]
  checkLateralImbalance(loadItems, fuelState): ImbalanceCheck
  calculateUnderload(zfw, tow, ldw, limits): Decimal
  applyLmc(result, changes: LmcChange[]): WnbResult

DİKKAT EDİLECEK NOKTALAR:
1. STAB yuvarlama: formül 7 × (35 − %MAC) / 14, sonuç 1 ONDALIĞA TRUNCATE
   (yuvarlama değil). T5 692'de 4,155 → 4,1. Bunu tek bir yerde,
   ROUNDING_RULES sabitinde tanımla.

2. UNDERLOAD: min(MZFW−ZFW, MTOW−TOW, MLW−LDW). T5 692 için 23 678,3 çıkmalı.
   Aerometa 24 722 diyor ve bu YANLIŞ (DOW'u 110000'e yuvarlamış).
   Testte bu farkı açıkça belgele — testin adı:
   "underload: corrects Aerometa's rounding bug (Bulgu #1)"

3. Yakıt indeksi tablo dışına EKSTRAPOLASYON YASAK — hata fırlat.
   Yoğunluk tablo değerlerinden biri değilse şimdilik en yakın alt/üst tablolar
   arasında ikinci interpolasyon yap, ama bunu AÇIK BİR TODO ile işaretle
   (GROUND_TRUTH §21 soru 1 — operasyona sorulacak).

4. Combined load kümülatif yönü: FWD zone'lar (ZA→ZE) burundan kuyruğa,
   AFT zone'lar (ZU→ZJ) kuyruktan buruna kümülatif olmalı.
   Bunu böyle uygula ama testte AÇIK BİR ASSERTION ile belgele ve
   GROUND_TRUTH §21 soru 2'ye referans veren bir TODO bırak.

5. 16/20 ft paletler birden fazla zone'a yük dağıtır — zone-mapping.json'daki
   katsayıları kullan.

TESTLER (packages/wnb-core/test/):
  golden-t5692.test.ts   → GROUND_TRUTH §19'daki TÜM girdi ve beklenen çıktılar.
                            22 ana güverte + 11 alt güverte pozisyonu tek tek.
  envelope.test.ts       → zarf içi/dışı sınır vakaları
  limits.test.ts         → MZFW/MTOW/MLW/kompartıman aşımları
  fuel.test.ts           → interpolasyon, sınırlar, FULL satırı
  combined-load.test.ts  → zone kümülatif limitleri
  rounding.test.ts       → STAB truncate, ağırlık gösterimi

Test kapsamı en az %95 olmalı.
Bitirince golden-t5692 testinin çıktısını satır satır göster.
```

---

## FAZ 4 — Veritabanı ve Kimlik Doğrulama

**Amaç:** Veri modeli, roller, denetim izi.

**Ana tablolar:**
```
User            id, email, name, role, station, active, passwordHash
Role            ADMIN | LOAD_CONTROLLER | CHECKER | RAMP | VIEWER
Station         iata, icao, name, timezone
Aircraft        registration, type, msn, ahmDataRef, active
AhmDocument     aircraftType, edition, revision, effectiveDate, dataPath, approvedBy
Flight          flightNo, date, serviceType, status, aircraftId
FlightLeg       flightId, seq, from, via, to, stdDep, staArr, etdDep, atdDep
LoadPlan        legId, version, status, createdBy
LoadItem        loadPlanId, position, uldCode, awb, weight, contentCode, deck
Uld             code, typeCode, serial, ownerCode, assignedStation,
                currentStation, status, condition, baseplateCode
FuelRecord      legId, density, takeoffFuel, tripFuel, taxiFuel
WnbCalculation  legId, edition, inputHash, resultJson, calculatedAt, ahmDocumentId
Document        legId, type (LIR|LS|ENV|NOTOC), edition, pdfPath, sha256,
                preparedBy, checkedBy, approvedBy, issuedAt
AuditLog        actor, action, entity, entityId, before, after, at, ip
```

**Kritik kurallar:**
- `WnbCalculation` ve `Document` **UPDATE edilemez** — sadece INSERT. Prisma
  middleware ile zorla.
- `Document.sha256` — PDF'in hash'i, sonradan değiştirilmediğinin kanıtı
- `WnbCalculation.inputHash` — aynı girdi aynı sonucu vermeli (determinizm testi)
- `AuditLog` her mutasyonda otomatik (Prisma extension)
- `Document.preparedBy ≠ Document.checkedBy` — DB constraint

**Kabul kriterleri:**
- [ ] Migration'lar çalışır, seed verisi yüklenir (EZ-F429, EZ-F430, ASB/SGN/FRA istasyonları)
- [ ] Auth.js ile giriş, rol tabanlı sayfa koruması
- [ ] `WnbCalculation` UPDATE denemesi hata verir
- [ ] `preparedBy = checkedBy` INSERT'i DB seviyesinde reddedilir
- [ ] Her mutasyon `AuditLog`'a yazılır

### Sonnet 5 Prompt
```
packages/db içinde Prisma şemasını ve apps/web içinde Auth.js kurulumunu yap.

Şema: IMPLEMENTATION_PLAN Faz 4'teki tablo listesini uygula.

DEĞİŞMEZLİK (immutability) ZORUNLU:
- WnbCalculation ve Document tabloları sadece INSERT kabul eder.
  Prisma client extension ile update/delete çağrılarını runtime'da engelle
  VE Postgres seviyesinde RULE/TRIGGER ile de engelle (çift koruma).
- Document tablosunda CHECK constraint: prepared_by <> checked_by
- Document.sha256 NOT NULL

DENETİM İZİ:
- Prisma client extension: her create/update/delete AuditLog'a
  { actor, action, entity, entityId, before, after, at } olarak yazılsın.
- AuditLog da değişmez.

AUTH:
- Auth.js v5, credentials provider, argon2 ile parola hash
- Roller: ADMIN, LOAD_CONTROLLER, CHECKER, RAMP, VIEWER
- Middleware ile rol tabanlı route koruması
- Oturum 8 saat (vardiya süresi), yenilenebilir

SEED:
- Uçaklar: EZ-F429, EZ-F430 (A330-243P2F, ahmDataRef = 'a330-243p2f/ed1-rev0')
- İstasyonlar: ASB, SGN, FRA, IST, DXB, DEL, PEK
- Test kullanıcıları: her rol için bir tane
- AhmDocument: ed1-rev0, effectiveDate 2023-03-15

Bitirince migration'ı çalıştır, seed'i yükle ve immutability testlerini göster
(WnbCalculation'a UPDATE denemesi hem Prisma hem Postgres seviyesinde reddedilmeli).
```

---

## FAZ 5 — AHM Master Data Yönetim Arayüzü

**Amaç:** AHM verisini görüntüleme, versiyon karşılaştırma, yeni revizyon yükleme.
**Bu, Bulgu #2'nin (boş List of Revisions) çözümüdür.**

**Görevler:**
1. `/[locale]/admin/ahm` — AHM dokümanları listesi (edition/revision/effective date)
2. Detay: tüm tabloları okunabilir şekilde göster (yakıt, pozisyonlar, CG limitleri…)
3. **Versiyon karşılaştırma (diff):** iki revizyon arasındaki her değişikliği göster
4. Yeni revizyon yükleme akışı: JSON yükle → zod doğrula → önizleme → onay
5. Hangi uçuşların hangi AHM revizyonu ile hesaplandığı raporu
6. CG envelope'un interaktif önizlemesi (Faz 11'in SVG motorunu kullanır)

**Kabul kriterleri:**
- [ ] ed1-rev0 verisi eksiksiz görüntülenir, 3 dilde
- [ ] Yeni revizyon yüklenebilir ve eskisiyle diff alınabilir
- [ ] Geçersiz JSON reddedilir, hata mesajı anlaşılır
- [ ] Sadece ADMIN erişebilir
- [ ] Mobilde tablolar kart moduna geçer

---

## FAZ 6 — Uçuş Programı Modülü

**Amaç:** Aerometa'nın `Flight selection` + `Flight schedule` ekranlarının muadili.

**Görevler:**
1. `/[locale]/flights` — filtre paneli: tarih aralığı, rota (from/via/to),
   uçuş no, uçak tescili, haftanın günü, servis tipi
2. Sonuç tablosu: Status, Sch/Est/Act Time Dep, Sch Time Arr, From, To, Route,
   Flt No, Reg, Type, Svc Type — **sıralanabilir, sayfalanabilir**
3. `/[locale]/schedule` — Add Flight + PDF çıktısı
4. Uçuş oluşturma/düzenleme modalı — **çok bacaklı (multi-leg) destek**
   (Aerometa'nın `Edit Flight — Leg 1` modalı gibi ama daha iyisi)
5. Doğrulama: rota zorunlu, varış > kalkış, enroute süresi tutarlı, uçak müsait mi
6. Durum akışı: `Reserved → Planned → Loading → Finalized → Departed → Arrived`
   (ayrıca `Cancelled`)
7. Zaman dilimi: Local / UTC anahtarı, her yerde görünür

**Aerometa'ya karşı üstünlükler (bu fazda uygulanacak):**
- Çok bacaklı uçuş tek modalda, bacak ekle/çıkar
- Uçak müsaitlik çakışması otomatik uyarı
- Rota alanında havaalanı arama (IATA/ICAO/şehir adı, 3 dilde)
- Filtre durumu URL'de saklanır (paylaşılabilir link)
- Klavye kısayolları

**Kabul kriterleri:**
- [ ] Filtreleme, sıralama, sayfalama çalışır
- [ ] Çok bacaklı uçuş oluşturulabilir
- [ ] Aynı uçağa çakışan uçuş atanamaz
- [ ] Local/UTC değişimi tüm zamanları doğru dönüştürür
- [ ] Mobilde kart görünümü, 375px'te yatay kaydırma yok
- [ ] 3 dilde tüm etiketler doğru

---

## FAZ 7 — ULD Stok ve Takip

**Amaç:** Aerometa'nın `ULD Stock` ekranının muadili + eksiklerinin giderilmesi.

**Görevler:**
1. `/[locale]/uld` — filtreler: ULD code, serial, type code, owner code,
   assigned station, current station, status, condition, baseplate code
2. Tablo: Baseplate Code, ULD Code, Type Code, Serial, Owner, Assigned Station,
   Current Station, Status, Flight — çoklu seçim, toplu işlem
3. Add / Edit / Delete ULD
4. **ULD Naming Convention** yardımcısı (IATA standardı: `PMC12345TU`)
   — kod doğrulayıcı ve üretici
5. ULD hareket geçmişi (hangi uçuş, hangi istasyon, ne zaman)
6. PDF export
7. `uld-types.json`'dan tip bilgisi otomatik (dara, brüt, hacim)

**Aerometa'ya karşı üstünlükler:**
- ULD hareket zaman çizelgesi
- Kayıp/gecikmiş ULD uyarısı (X gündür hareketsiz)
- İstasyon bazlı stok dengesi görünümü
- Barkod/QR tarama ile hızlı arama (mobil kamera)
- CSV/Excel toplu içe aktarma

**Kabul kriterleri:**
- [ ] Filtreler çalışır, boş durumda "filtre kullanın" mesajı
- [ ] ULD kodu IATA formatına göre doğrulanır
- [ ] Hareket geçmişi kaydedilir
- [ ] Mobilde kamera ile QR tarama çalışır

---

## FAZ 8 — Yükleme Planlama Arayüzü ⭐

**Amaç:** Sistemin kalbi. ULD'leri pozisyonlara atama, canlı W&B geri bildirimi.

**Görevler:**
1. `/[locale]/flights/[id]/load-plan`
2. **Uçak şeması (SVG):** ana güverte + alt güverte, tüm pozisyonlar tıklanabilir
   - Ana güverte: 88×125 (A–U), 96×125 (AA–TT), 125×96 (AB–MP),
     side-by-side 125×88 ve 125×96 (ABR/ABL … PRL), 16ft (CFR/FJR/JLR/LPR),
     20ft (CFG/FJG/JLG)
   - Alt güverte: konteynerler 11–43, paletler 12P–42P, bulk 51/52/53
   - Konfigürasyon seçimi: hangi pozisyon setinin aktif olduğu
3. Pozisyona ULD atama: ULD kodu, AWB, ağırlık, içerik kodu (B/C/M/P/S/E)
4. **Canlı W&B paneli:** her değişiklikte anında ZFW, TOW, LDW, MACZFW, MACTOW,
   STAB, underload, zarf durumu
5. **Canlı ihlal uyarıları:** pozisyon max brüt aşımı, kompartıman limiti,
   kümülatif zone limiti, lateral imbalance, zarf dışı — her biri kırmızı,
   pozisyon şemasında da işaretli
6. **Otomatik trim optimizasyonu** (Aerometa'da yok): verilen ULD setini
   zarf içinde ve desired trim line'ın arkasında kalacak şekilde dağıt
7. Yakıt girişi: yoğunluk, takeoff/trip/taxi fuel
8. Ekip girişi: kokpit (1–4), kuryeci (0–6) → DOW/DOI otomatik
9. **Mobil görünüm:** pozisyon listesi + üstte sabit mini şema
10. **Offline:** IndexedDB'ye yaz, bağlantı gelince senkronize et

**Kabul kriterleri:**
- [ ] T5 692'nin yükünü arayüzden girince W&B paneli GROUND_TRUTH §19.2'deki
      değerleri gösterir
- [ ] Pozisyon max brüt aşımı anında uyarır
- [ ] Zarf dışına çıkınca kaydetme engellenir
- [ ] 375px'te kullanılabilir (pozisyon listesi modu)
- [ ] Ağ kesildiğinde çalışmaya devam eder, bağlantı gelince senkronize olur
- [ ] Otomatik trim optimizasyonu geçerli bir dağılım üretir

### Sonnet 5 Prompt (özet — faza gelince genişlet)
```
Yükleme planlama ekranını yaz. @tua/wnb-core'u kullan, hesabı ASLA yeniden yazma.
Uçak şeması saf SVG, positions.json'dan üretilecek — koordinatlar veri dosyasında
tanımlı olmalı, koda gömülmemeli.
Her değişiklikte wnb-core'u çağır (debounce 150ms) ve paneli güncelle.
Mobilde <640px: şema mini map'e küçülür, altında pozisyon listesi.
Offline: TanStack Query persist + IndexedDB mutation kuyruğu.
```

---

## FAZ 9 — LIR (Loading Instruction Report) PDF

**Amaç:** `LIR_T5692_11082026_ED01.pdf` ile **görsel olarak eşdeğer**, verisel olarak
doğru PDF üretimi.

**Görevler:**
1. `packages/documents/src/lir/` — `@react-pdf/renderer` bileşenleri
2. Başlık bloğu: logo, STATION, FLIGHT, DATE, A/C, Prepared by, Approved by, ED NO
3. Uyarı metni + kod açıklamaları (B/C/M/P/S/E, O/X/NIL, R/L)
4. MAIN DECK: tüm pozisyon satırları (single row 88×125, 96×125, 125×96,
   side-by-side 125×88 ve 125×96, 16ft, 20ft)
5. LOWER DECK: kompartıman limitleri başlığı + konteyner/palet satırları
6. Her hücrede ULD/AWB (üst) + ağırlık (alt), boşsa `N`
7. Kullanılmayan pozisyonlar gri
8. SI (Special Information) alanı
9. Filigran (env flag ile)

**Kabul kriterleri:**
- [ ] T5 692 verisiyle üretilen PDF, orijinaliyle **yan yana karşılaştırmada**
      tüm hücrelerde aynı değeri gösterir
- [ ] Sayfa taşması yok, A4 tek sayfa
- [ ] Aynı girdi → byte-identical PDF (determinizm testi)
- [ ] Filigran flag'i çalışır

---

## FAZ 10 — Loadsheet PDF ⭐

**Amaç:** `LS_T5692_11082026_ED01.pdf` muadili + **eksiklerinin giderilmesi**.

**Görevler:**
1. Başlık: logo, LOADSHEET, ALL WEIGHTS IN KILOGRAM, CHECKED/APPROVED/EDNO
2. FROM/TO, FLIGHT, A/C REG, VERSION, CREW, DATE, TIME
3. LOAD IN COMPARTMENTS — main deck / weight distribution / lower deck şeması
4. PASSENGER/CABIN BAG, TOTAL TRAFFIC LOAD, DRY OPERATING WEIGHT
5. ZFW / TAKE OFF FUEL / TOW / TRIP FUEL / LDW — her biri MAX ve ADJ ile
6. BALANCE AND SEATING CONDITIONS: FUEL DENSITY, DOI, LIZFW, MACZFW,
   LITOW, MACTOW, TRIM SETTING
7. **LILAW ve MACLAW ekle** — Bulgu #5, AHM zorunlu kılıyor, Aerometa yapmıyor
8. UNDERLOAD BEFORE LMC — **düzeltilmiş hesap** (Bulgu #1)
9. LAST MINUTE CHANGES bloğu
10. TAXI FUEL / TAXI WEIGHT / A/C TYPE / CAPTAIN INFORMATION
11. ZFW(corrected), ZFI(corrected), AUTOMATIC REFUELING limit satırları
12. Alt özet satırı: uçuş bilgisi + tüm pozisyon/ağırlık listesi
13. SI alanı
14. **Yeni:** AHM edition/revision referansı belgede görünür (Bulgu #2 çözümü)

**Kabul kriterleri:**
- [ ] T5 692 çıktısı orijinalle karşılaştırıldığında: TTL, DOW, ZFW, TOW, LDW,
      DOI, LIZFW, MACZFW, LITOW, MACTOW, TRIM — **tam eşleşme**
- [ ] UNDERLOAD 23 678,3 gösterir (orijinaldeki 24 722 hatalı) ve bu fark
      validasyon dosyasında belgelenmiş
- [ ] LILAW/MACLAW gösterilir
- [ ] AHM ed/rev referansı görünür
- [ ] Determinizm testi geçer

---

## FAZ 11 — CG Envelope PDF

**Amaç:** `ENV_T5692_11082026_ED01.pdf` muadili — ama layout hatası olmadan (Bulgu #6).

**Görevler:**
1. Başlık tablosu — **kenar taşması olmadan** (orijinaldeki hata düzeltilecek)
2. Saf SVG grafik üretici:
   - X ekseni: Index (40–200)
   - Y ekseni: Weight (110k–240k)
   - Takeoff limits (mavi kesikli) — `cg-limits.json` TOW fwd/aft
   - Zero fuel limits (yeşil düz) — ZFW fwd/aft
   - Landing limit (kırmızı yatay) — MLW seviyesinde
   - Min weight limit (siyah)
   - Zero fuel CG (yeşil nokta), Take off CG (mavi yıldız),
     Zero fuel CG corrected (mor kare)
3. Lejant
4. Zarf dışı nokta varsa **kırmızı vurgu + uyarı metni**

**Kabul kriterleri:**
- [ ] T5 692 için ZFCG noktası (146 321,7 / 106,07) ve TOCG (191 021,7 / 109,39)
      doğru konumda
- [ ] Zarf poligonları `cg-limits.json`'dan üretiliyor, koda gömülü koordinat yok
- [ ] Başlık kırpılmıyor
- [ ] Zarf dışı senaryoda uyarı görünür

---

## FAZ 12 — LMC ve Edition Yönetimi

**Görevler:**
1. Finalize edilmiş uçuşa LMC ekleme akışı
2. LMC → yeni edition (ED01 → ED02), tüm belgeler yeniden üretilir
3. Eski edition'lar erişilebilir kalır, "SUPERSEDED" damgası
4. LMC listesi loadsheet'te LAST MINUTE CHANGES bloğunda görünür
5. LMC sonrası yeniden zarf ve limit kontrolü
6. `UNDERLOAD BEFORE LMC` ve `LMC TOTAL` doğru hesaplanır

**Kabul kriterleri:**
- [ ] ED02 üretildiğinde ED01 değişmez ve erişilebilir kalır
- [ ] LMC zarfı bozarsa engellenir
- [ ] Denetim izinde kim, ne zaman, neyi değiştirdi görünür

---

## FAZ 13 — Mesajlaşma (LDM / CPM / MVT / FFM / FBL)

**Görevler:**
1. `packages/messaging` — her mesaj tipi için kodlayıcı
2. `LDM` (AHM 583) — Load Distribution Message
3. `CPM` (AHM 388/587) — Container Pallet Message
4. `MVT` (AHM 011/780) — Movement Message
5. `FFM` — Airline Flight Manifest
6. `FBL` — Freight Booked List
7. Mesaj adres listesi yönetimi
8. Gönderim kuyruğu (SITA/e-posta), yeniden deneme, gönderim kaydı
9. Gelen `CPM` (acceptance only) ayrıştırıcısı

**Kabul kriterleri:**
- [ ] T5 692 için üretilen LDM, IATA AHM 583 formatına uygun
- [ ] Mesajlar denetim izine kaydedilir
- [ ] Gönderim başarısızsa yeniden denenir ve raporlanır

---

## FAZ 14 — Karşılaştırma Koşum Takımı + Validasyon Dosyası ⭐

**Amaç:** "Bizimki Aerometa'dan daha iyi mi?" sorusunu **ölçülebilir** cevaplamak.
Kullanıcının belirttiği iş akışı tam olarak bu.

**Görevler:**
1. `tools/compare/` — Aerometa PDF'i + bizim PDF'imizi alıp alan alan karşılaştıran araç
   - PDF'ten değer çıkarımı (LS için ~30 alan)
   - Fark raporu: alan, Aerometa değeri, bizim değerimiz, fark, değerlendirme
2. Test uçuşu kütüphanesi: her senaryo için Aerometa'da üretilmiş referans PDF
   - Normal yük · hafif yük · ağır yük (MZFW sınırı) · ileri CG · geri CG
   - Sadece ana güverte · sadece alt güverte · 16ft palet · 20ft palet
   - LMC'li · ferry (kargosuz) · farklı yakıt yoğunlukları
3. `docs/VALIDATION_DOSSIER.md` — otorite sunumu için:
   - Her AHM tablosunun sisteme doğru aktarıldığının kanıtı
   - Paralel çalıştırma sonuçları
   - Bulunan farklar ve gerekçeleri
   - Test kapsamı raporu
4. Fark panosu — `/[locale]/admin/validation`

**Kabul kriterleri:**
- [ ] En az 12 senaryoda paralel karşılaştırma yapılmış
- [ ] Her fark ya "bizim düzeltmemiz" ya da "araştırılacak" olarak sınıflandırılmış
- [ ] Validasyon dosyası otoriteye sunulabilir düzeyde

### Kullanıcının test iş akışı (belgelenecek)
```
1. https://tua.aerometa.aero/wb/SchedulePlanner → uçuş oluştur, yükle, PDF al
2. Bizim sistemde AYNI veriyi gir → PDF al
3. tools/compare ile iki PDF'i karşılaştır
4. Fark raporunu incele:
   - Fark bizim hatamızsa → düzelt
   - Fark Aerometa'nın hatasıysa → VALIDATION_DOSSIER'a kaydet (üstünlük kanıtı)
5. 12 senaryo tamamlanınca geçiş kararı
```

---

## FAZ 15 — Dağıtım ve Operasyon

**Görevler:**
1. Docker imajı (multi-stage, ~200MB)
2. `compose.prod.yaml`: web + postgres + caddy (otomatik HTTPS) + yedekleme
3. Otomatik veritabanı yedekleme (günlük, 30 gün saklama)
4. Sağlık kontrolü uç noktaları (`/api/health`, `/api/health/db`)
5. Yapılandırılmış loglama (JSON) + hata izleme
6. Ortam bazlı `DOCUMENTS_WATERMARK` flag'i
7. Dağıtım rehberi

**Hosting kararı:**

| Aşama | Platform | Maliyet |
|---|---|---|
| Geliştirme/demo | Cloudflare Pages + Neon Free | 0 |
| Pilot | Hetzner CX22 VPS + Docker | ~4 €/ay |
| Üretim | Kurum içi / özel bulut (veri egemenliği) | — |

> **Not:** Vercel Hobby ücretsizdir ama **ToS'a göre ticari kullanıma kapalıdır**.
> Havayolu operasyonu için kullanılamaz. Cloudflare ve Netlify ücretsiz katmanları
> ticari kullanıma açıktır.
>
> Gerçek operasyonel kullanımda Türkmenistan sivil havacılık otoritesi büyük
> ihtimalle **yurt içi veya kurum içi barındırma** isteyecektir. Bu yüzden
> **Faz 0'dan itibaren konteynerize** geliştiriyoruz — taşıma maliyeti sıfır olsun.

---

# Bölüm D — Regülasyon Yol Haritası

Sistem gerçek dispatch'te kullanılacaksa teknik iş bitince şunlar gerekir:

| # | Adım | Sorumlu |
|---|---|---|
| 1 | OM-A / Ground Operations Manual'a sistem tanımının eklenmesi | Havayolu |
| 2 | Validasyon dosyasının hazırlanması (Faz 14) | Geliştirme |
| 3 | Paralel çalıştırma dönemi (min. 3 ay, her uçuş çift hesap) | Operasyon |
| 4 | Kullanıcı eğitimi ve yetkilendirme kayıtları | Havayolu |
| 5 | Türkmenistan sivil havacılık otoritesine başvuru ve kabul | Havayolu |
| 6 | `DOCUMENTS_WATERMARK=false` — filigranın kaldırılması | Geliştirme |

**Bu adımlar tamamlanana kadar sistem geliştirilebilir ve test edilebilir**, sadece
üretilen belgeler operasyonel kullanılamaz. Filigran bunu garanti eder.

---

# Bölüm E — Aerometa'ya Karşı Üstünlük Listesi

Satış argümanı olarak takip edilecek. Her biri bir fazda uygulanıyor.

| # | Üstünlük | Faz | Kaynak |
|---|---|---|---|
| 1 | UNDERLOAD doğru hesaplanıyor (1 043,7 kg fark) | 3, 10 | Bulgu #1 |
| 2 | Loadsheet hangi AHM edition/revision ile üretildiğini gösteriyor | 5, 10 | Bulgu #2 |
| 3 | LILAW / MACLAW üretiliyor (AHM zorunlu kılıyor) | 3, 10 | Bulgu #5 |
| 4 | ENV PDF layout hatası yok | 11 | Bulgu #6 |
| 5 | Otomatik trim optimizasyonu → yakıt tasarrufu | 8 | AHM s.69 |
| 6 | Gerçek mobil destek (ramp ekibi tablet/telefon) | 1, 8 | — |
| 7 | Dark mode | 1 | — |
| 8 | 3 dil: Türkmençe, Rusça, İngilizce | 1 | — |
| 9 | Offline çalışma (ağ kesintisinde yükleme devam eder) | 8 | — |
| 10 | Tam denetim izi, değişmez belgeler, SHA-256 doğrulama | 4 | — |
| 11 | Çok bacaklı uçuş tek ekranda | 6 | — |
| 12 | ULD hareket geçmişi + kayıp ULD uyarısı + QR tarama | 7 | — |
| 13 | AHM versiyon karşılaştırma (diff) | 5 | Bulgu #2 |
| 14 | Canlı ihlal uyarıları (yüklerken, sonradan değil) | 8 | — |
| 15 | Paylaşılabilir filtre linkleri, klavye kısayolları | 6 | — |

---

# Bölüm F — Faz Özeti ve Süre Tahmini

| Faz | Ad | Kritiklik | Tahmin |
|---|---|---|---|
| 0 | Monorepo iskeleti | ⚪ | 1 gün |
| 1 | Tasarım sistemi + i18n | 🟡 | 3 gün |
| 2 | AHM 560 veri çıkarımı | 🔴 | 4 gün |
| 3 | Hesap motoru `wnb-core` | 🔴 | 5 gün |
| 4 | DB + auth + denetim izi | 🟡 | 2 gün |
| 5 | AHM yönetim arayüzü | ⚪ | 2 gün |
| 6 | Uçuş programı | 🟡 | 4 gün |
| 7 | ULD stok | ⚪ | 3 gün |
| 8 | Yükleme planlama | 🔴 | 6 gün |
| 9 | LIR PDF | 🟡 | 3 gün |
| 10 | Loadsheet PDF | 🔴 | 4 gün |
| 11 | CG envelope PDF | 🟡 | 2 gün |
| 12 | LMC + edition | 🟡 | 2 gün |
| 13 | Mesajlaşma | ⚪ | 4 gün |
| 14 | Karşılaştırma + validasyon | 🔴 | 4 gün |
| 15 | Dağıtım | ⚪ | 2 gün |
| | **Toplam** | | **~51 gün** |

🔴 = hata kabul etmez, ekstra dikkat · 🟡 = önemli · ⚪ = standart

**Kritik yol:** Faz 0 → 1 → 2 → 3 → 8 → 10 → 14
Diğer fazlar bu zincire paralel yürütülebilir.

---

# Bölüm G — Her Faz İçin Kontrol Listesi

Bir fazı tamamlanmış saymadan önce:

- [ ] Kabul kriterlerinin **tamamı** işaretli
- [ ] `pnpm typecheck` temiz
- [ ] `pnpm test` yeşil, kapsam düşmemiş
- [ ] `pnpm lint` temiz
- [ ] Yeni kullanıcıya görünen string varsa **üç dilde de** eklenmiş
- [ ] Yeni ekran varsa 375px / 768px / 1440px'te, light ve dark modda kontrol edilmiş
- [ ] Yeni hesap varsa AHM sayfa referansı yorumda
- [ ] Yeni belirsizlik varsa `AHM560_ERRATA.md` veya `GROUND_TRUTH §21`'e eklenmiş
- [ ] Denetim izi gereken mutasyon varsa `AuditLog`'a yazıyor
