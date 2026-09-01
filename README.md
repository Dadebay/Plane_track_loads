# TUA Load Control System

Turkmenistan Airlines (T5) için ağırlık-denge (Weight & Balance) ve yük kontrol sistemi.
Airbus A330-243 P2F kargo filosu (EZ-F429, EZ-F430) için loadsheet, loading instruction
report, CG envelope ve NOTOC üretir.

**Durum:** Planlama tamamlandı, Faz 0 başlamadı.

---

## Ne üretiyor?

| Belge | Kod | Açıklama |
|---|---|---|
| Loadsheet | `LS` | Kaptana imzalatılan resmî ağırlık-denge belgesi |
| Loading Instruction Report | `LIR` | Ramp ekibine yükleme talimatı, sonrasında rapor |
| CG Envelope | `ENV` | Ağırlık merkezinin zarf içinde olduğunun grafik ispatı |
| NOTOC | — | Notification to Captain (tehlikeli madde) |

Ayrıca IATA mesajları: `LDM`, `CPM`, `MVT`, `FFM`, `FBL`.

---

## Nereden başlamalı

1. **`docs/IMPLEMENTATION_PLAN.md`** — 16 fazlık uygulama planı.
   Her fazın kendi Sonnet 5 prompt'u ve kabul kriterleri var.
2. **`docs/AHM560_GROUND_TRUTH.md`** — AHM 560'tan elle doğrulanmış referans veri
   ve T5 692 altın test vektörü.
3. **`CLAUDE.md`** — değiştirilemez kurallar. Kod yazmadan önce oku.

```
Faz 0  → Monorepo iskeleti
Faz 1  → Tasarım sistemi + i18n (dark mode, responsive, tk/ru/en)
Faz 2  → AHM 560 PDF → JSON çıkarımı          ⭐ kritik
Faz 3  → Hesap motoru wnb-core                 ⭐ kritik
Faz 4  → DB + auth + denetim izi
Faz 5  → AHM master data yönetimi
Faz 6  → Uçuş programı
Faz 7  → ULD stok ve takip
Faz 8  → Yükleme planlama arayüzü              ⭐ kritik
Faz 9  → LIR PDF
Faz 10 → Loadsheet PDF                         ⭐ kritik
Faz 11 → CG envelope PDF
Faz 12 → LMC + edition yönetimi
Faz 13 → Mesajlaşma
Faz 14 → Aerometa karşılaştırması + validasyon ⭐ kritik
Faz 15 → Dağıtım
```

**Kritik yol:** 0 → 1 → 2 → 3 → 8 → 10 → 14

---

## Teknoloji

TypeScript · Next.js 15 · Tailwind v4 · shadcn/ui · next-intl · next-themes ·
PostgreSQL + Prisma · Auth.js · @react-pdf/renderer · decimal.js ·
Vitest + Playwright · pnpm + Turborepo · Docker

---

## Kaynak dokümanlar

`~/Downloads/` altında:
- `AHM 560 -AIRBUS_A330_200P2F_APPROVED_FINAL.pdf` — 79 sayfa, onaylı W&B veri kitabı
- `LS_T5692_11082026_ED01.pdf` — örnek loadsheet (altın test vakası)
- `LIR_T5692_11082026_ED01.pdf` — örnek loading instruction report
- `ENV_T5692_11082026_ED01.pdf` — örnek CG envelope

Bunlar repoya **commit edilmeyecek** (onaylı havayolu dokümanı).
`docs/AHM560_GROUND_TRUTH.md` gerekli tüm veriyi içerir.

---

## Uyarı

Bu sistem gerçek uçuş dispatch'inde kullanılacaktır. Üretilen loadsheet
**emniyet-kritik ve regüle bir belgedir**.

Validasyon ve otorite kabulü tamamlanana kadar her PDF `NOT FOR OPERATIONAL USE`
filigranı taşır (`DOCUMENTS_WATERMARK=true`). Regülasyon yol haritası:
`docs/IMPLEMENTATION_PLAN.md` Bölüm D.
