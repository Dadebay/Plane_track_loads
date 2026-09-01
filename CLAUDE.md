# TUA Load Control System

Turkmenistan Airlines için ağırlık-denge (Weight & Balance) ve yük kontrol sistemi.
`tua.aerometa.aero`'nun muadili ve rakibi. **Gerçek uçuş operasyonu hedefli.**

## Önce bunları oku

| Dosya | Ne zaman |
|---|---|
| `docs/IMPLEMENTATION_PLAN.md` | Her zaman. Faz planı, teknoloji kararları, tasarım ve i18n şartnamesi. |
| `docs/AHM560_GROUND_TRUTH.md` | Hesapla, AHM verisiyle veya belge üretimiyle ilgili her işte. |
| `docs/AHM560_ERRATA.md` | Kaynak dokümandaki hatalar (Faz 2'de oluşturulur). |

Hangi fazda olduğunu bilmiyorsan `docs/IMPLEMENTATION_PLAN.md` Bölüm F'deki
faz tablosuna bak ve tamamlanmış kabul kriterlerinden çıkar.

## Değiştirilemez kurallar

1. **`packages/wnb-core` framework'e bağımlı olamaz.** Saf TypeScript,
   tek runtime bağımlılığı `decimal.js`. React/Next/Prisma import etmek yasak.
2. **Float aritmetik yasak.** Ağırlık, indeks, %MAC hesaplarında çıplak
   `+ - * /` kullanma. Her şey `decimal.js`. Yuvarlama sadece sunum katmanında.
3. **AHM sabitleri koda gömülemez.** Hepsi `@tua/ahm-data`'dan, versiyonlu
   JSON'dan gelir. Kodda `33.1555`, `2500`, `0.00677` gibi bir sayı görürsen bu bir hatadır.
4. **Belgeler her zaman İngilizce.** LIR, Loadsheet, CG Envelope, NOTOC çevrilmez —
   havacılık standardı. UI 3 dilli (tk/ru/en), belgeler değil.
5. **Üretilen belgeler değişmez.** Değişiklik = yeni edition (ED01 → ED02).
   `WnbCalculation` ve `Document` tabloları sadece INSERT kabul eder.
6. **Her hesap fonksiyonu kaynağını belirtir:** `// AHM 560 s.16 §3.4`
7. **`prepared_by ≠ checked_by`** — sistem zorunlu kılar (DB constraint).
8. **Validasyon bitene kadar her PDF'te `NOT FOR OPERATIONAL USE` filigranı.**
   `DOCUMENTS_WATERMARK` env değişkeni ile kontrol edilir. Varsayılan `true`.
9. **Ground truth ile çıkarım çakışırsa çıkarım hatalıdır.**
   `AHM560_GROUND_TRUTH.md` elle doğrulanmıştır — onu değiştirme, kodu düzelt.
10. **Mobil öncelikli.** Ramp ekibi tablet ve telefon kullanır.
    375px'te hiçbir sayfa yatay kaymaz.

## Altın test vakası

Uçuş **T5 692**, SGN→ASB, 2026-08-11, EZ-F430.
Beklenen: `MACZFW 26,4` · `MACTOW 26,7` · `TTL 35 278` · `ZFW 146 321,7` ·
`TOW 191 021,7` · `LDW 154 361,7` · `STAB 4,1`

Tam girdi ve çıktı: `docs/AHM560_GROUND_TRUTH.md` §19.
`packages/wnb-core` üzerinde çalıştıysan **her zaman** bu testi koştur.

## Bilinen Aerometa hataları (biz düzeltiyoruz)

| # | Hata | Bizim değerimiz |
|---|---|---|
| 1 | UNDERLOAD yanlış (DOW 110 000'e yuvarlanmış) | `23 678,3` (Aerometa: 24 722) |
| 2 | Loadsheet DOW/DOI, AHM 560 ile uyuşmuyor, revizyon takibi yok | AHM ed/rev belgede gösterilir |
| 5 | `LILAW`/`MACLAW` üretilmiyor (AHM zorunlu kılıyor) | Üretiyoruz |
| 6 | ENV PDF başlığı sayfa kenarından taşıyor | Düzeltildi |

Detay: `docs/AHM560_GROUND_TRUTH.md` §20.

## Komutlar

```bash
pnpm install
pnpm dev          # apps/web
pnpm test         # tüm paketler
pnpm typecheck
pnpm lint
docker compose up # postgres + web
```

## Dil ve i18n

- Diller: `tk` (Türkmençe, varsayılan), `ru` (Русский), `en` (English)
- Çeviri dosyaları: `apps/web/messages/{tk,ru,en}.json` — **üçü de aynı anahtar setine sahip**
- Havacılık kısaltmaları (`ULD`, `ZFW`, `TOW`, `MAC`, `LIR`, `AWB`, `MTOW`, `PMC`)
  **hiçbir dilde çevrilmez**
- Ağırlık formatı locale'den bağımsız: `1 234,5` (boşluk binlik, virgül ondalık)
- Tarih `DD/MM/YYYY`, saat `HH:mm`, Local/UTC anahtarı her zaman görünür
- JSX içinde çıplak string yasak (ESLint zorlar)

## Tema

`next-themes` — `light` / `dark` / `system`. Dark modda saf siyah kullanılmaz.
Renk tanımları önce `:root`'ta tam light paleti, sonra `.dark`'ta override.
**PDF'ler temadan etkilenmez, her zaman light.**
