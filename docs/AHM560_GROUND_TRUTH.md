# AHM 560 — Doğrulanmış Referans Verisi (Ground Truth)

> **Amaç:** Bu dosya, `AHM 560 - AIRBUS_A330_200P2F_APPROVED_FINAL.pdf` dokümanından
> **elle okunarak doğrulanmış** verileri içerir. Faz 2'deki otomatik PDF çıkarımının
> çıktısı bu değerlere karşı test edilir. Buradaki bir sayı ile çıkarım sonucu
> uyuşmuyorsa **çıkarım hatalıdır**, bu dosya değil.
>
> **Kaynak:** "Turkmenistan" Airlines OJSC, AHM 560, Airbus A330-243 P2F,
> Edition 1 / Revision 0, Effective 15.03.2023, Ashgabat 2023.
> Tescil: **EZ-F429**, **EZ-F430**.
>
> **Sayfa numarası kuralı:** Bu dosyada "s.N" = dokümanın **basılı** sayfa numarası.
> PDF sayfası = basılı sayfa + 1 (kapak numarasız).

---

## 0. Doküman kimliği

| Alan | Değer |
|---|---|
| Carrier code | `TUA` |
| A/C Type | `Airbus A330-243 P2F` |
| Versiyon | `P2F` (Pax to Freighter) |
| Edition / Revision | `1` / `0` |
| Effective date | `2023-03-15` |
| Onay tarihi | `2023-05-08` |
| SITA | `ASBDBT5` |
| E-posta | `groundhandling@turkmenistanairlines.tm` |
| Ağırlık birimi | **kilogram** (tüm doküman) |
| Uzunluk birimi | **metre** |
| Hacim | **m³** |
| Yakıt yoğunluğu | **kg/litre** |
| Moment | **kg·metre** |

### Otomatik üretilecek belgeler (s.8, AHM 560 Sheet A-2)
Doküman şunları "üretilecek" olarak işaretlemiş — **sistemimizin kapsamı budur**:
- `NOTOC` ✅
- `LOADPLAN` ✅
- `LOADSHEET` ✅
- `LOADING INSTRUCTION/REPORT` ✅
- ~~SEATPLAN~~ ❌ (kargo uçağı)
- ~~PASSENGER INFO LIST~~ ❌

### Gerekli mesajlar (s.8)
`LDM` (AHM 583) · `CPM` (AHM 388, dispatch only) · `MVT` (AHM 011/780) ·
`CPM Container/Pallet Distribution` (AHM 587, acceptance only) · `FFM` · `FBL`

---

## 1. Ağırlık limitleri (s.3, s.48)

| Kod | Açıklama | kg |
|---|---|---|
| `MTW` | Maximum Taxi Weight | **233 900** |
| `MTOW` | Maximum Takeoff Weight (dry) | **233 000** |
| `MLW` | Maximum Landing Weight | **182 000** |
| `MZFW` | Maximum Zero Fuel Weight | **170 000** |
| `MIN` | Minimum Weight | **116 000** |

Her iki tescil (EZ-F429, EZ-F430) için aynı. `Design take-off wet` boş — su enjeksiyonu yok.

---

## 2. Basic Empty Weight (s.4)

| Tescil | BEW (kg) | BEW CG (%MAC) | BEW Index (s.5) |
|---|---|---|---|
| `EZ-F429` | **111 072,5** | 19,64 | 82,65 |
| `EZ-F430` | **111 233,5** | 19,49 | 82,15 |

---

## 3. DOW / DOI hesabı — standart ekip 2/3 (s.5)

| Kalem | Ağırlık (kg) | Index |
|---|---|---|
| Basic Empty Weight `EZ-F429` | 111 072,5 | 82,65 |
| Basic Empty Weight `EZ-F430` | 111 233,5 | 82,15 |
| Cockpit crew (2 kişi) | 200 | −1,94 |
| 3rd occupant (0 kişi) | 0 | 0 |
| 4th occupant (0 kişi) | 0 | 0 |
| Courier crew (3 kişi) | 240 | −2,07 |
| Courier stowage | 20 | −0,18 |
| Potable water | 18 | −0,16 |
| Document stowage | 8,7 | −0,08 |
| **DOW / DOI `EZ-F429`** | **111 560** | **78,21** |
| **DOW / DOI `EZ-F430`** | **111 720** | **77,74** |

**Notlar (s.5):**
- Kokpit ekibi ağırlığı bagaj dahil **100 kg/kişi**
- Kuryeci ekibi ağırlığı bagaj dahil **80 kg/kişi**
- Courier stowage DOI'ye dahil. **Eksik her 1 kg pantry için DOI'ye +0,009 ekle** (corrected index)
- Potable water (18 kg) DOI hesabına dahil
- Uçak dokümanları ve manüelleri DOI hesabına dahil

---

## 4. DOW/DOI — ekip kombinasyon matrisi (s.6)

3. ve 4. occupant dahildir. Satır = kokpit ekibi (1–4), sütun = kuryeci ekibi (0–6).

### EZ-F429

| Kokpit ↓ / Kuryeci → | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| **1** DOW | 111 220 | 111 300 | 111 380 | 111 460 | 111 540 | 111 620 | 111 700 |
| **1** DOI | 81,25 | 80,56 | 79,87 | 79,18 | 78,49 | 77,80 | 77,11 |
| **2** DOW | 111 320 | 111 400 | 111 480 | 111 560 | 111 640 | 111 720 | 111 800 |
| **2** DOI | 80,28 | 79,59 | 78,90 | 78,21 | 77,52 | 76,83 | 76,14 |
| **3** DOW | 111 420 | 111 500 | 111 580 | 111 660 | 111 740 | 111 820 | 111 900 |
| **3** DOI | 79,34 | 78,65 | 77,96 | 77,28 | 76,59 | 75,90 | 75,21 |
| **4** DOW | 111 520 | 111 600 | 111 680 | 111 760 | 111 840 | 111 920 | 112 000 |
| **4** DOI | 78,41 | 77,72 | 77,03 | 76,34 | 75,65 | 74,96 | 74,27 |

### EZ-F430

| Kokpit ↓ / Kuryeci → | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| **1** DOW | 111 380 | 111 460 | 111 540 | 111 620 | 111 700 | 111 780 | 111 860 |
| **1** DOI | 80,78 | 80,09 | 79,40 | 78,71 | 78,02 | 77,30 | 76,64 |
| **2** DOW | 111 480 | 111 560 | 111 640 | 111 720 | 111 800 | 111 880 | 111 960 |
| **2** DOI | 79,81 | 79,12 | 78,43 | 77,74 | 77,05 | 76,36 | 75,67 |
| **3** DOW | 111 580 | 111 660 | 111 740 | 111 820 | 111 900 | 111 980 | 112 060 |
| **3** DOI | 78,87 | 78,18 | 77,49 | 76,8 | 76,11 | 75,42 | 74,73 |
| **4** DOW | 111 680 | 111 760 | 111 840 | 111 920 | 112 000 | 112 080 | 112 160 |
| **4** DOI | 77,94 | 77,25 | 76,56 | 75,87 | 75,18 | 74,49 | 73,80 |

> ⚠️ EZ-F430 kokpit 3 / kuryeci 3 hücresi dokümanda `76,8` (tek ondalık) yazılmış.
> Diğer tüm hücreler iki ondalıklı. Çıkarımda `76.80` olarak normalize et,
> ama **kaynak sadakati notu** olarak işaretle.

**Ferry/training uçuşları için not (s.6):** Minimum ağırlık ve zero fuel CG limitleri
**mutlaka** kontrol edilmeli. Landing CG de kontrol edilmeli.

---

## 5. İndeks ve %MAC formülü (s.15–16) — ⭐ SİSTEMİN ÇEKİRDEĞİ

```
Index  =  W · (Sta − Ref.Sta) / C  +  K

           ( C · (I − K) / W )  +  Ref.Sta − LEMAC
%MAC  =  ─────────────────────────────────────────
                        MAC / 100
```

| Sabit | Değer |
|---|---|
| `Ref.Sta` | **33,1555** m (station zero'dan) |
| `K` | **100** |
| `C` | **2500** |
| `MAC` uzunluğu | **7,270** m |
| `LEMAC` | **31,3380** m (station zero'dan) |

Türetilmiş sabit: `Ref.Sta − LEMAC = 1,8175` · `MAC/100 = 0,0727`

### Değişkenler
- `W` = fiili ağırlık (kg)
- `Sta` = station, station zero'dan metre cinsinden yatay mesafe
- `Ref.Sta` = referans istasyon/eksen
- `K` = negatif indeks çıkmasını önleyen sabit
- `C` = moment→indeks dönüşüm paydası
- `I` = ağırlığa karşılık gelen indeks değeri

---

## 6. Stabilizer trim ayarı (s.16)

| %MAC | STAB | Yön |
|---|---|---|
| 18 | 7 | Up |
| 21 | 7 | Up |
| 35 | 0 | Down |
| 40 | 0 | Down |

**21% ile 35% arasında lineer değişim.**

```
%MAC ≤ 21          → STAB = 7,0 Up
21 < %MAC < 35     → STAB = 7 × (35 − %MAC) / 14   Up
%MAC ≥ 35          → STAB = 0,0 Down
```

> ⚠️ **Yuvarlama kuralı belirsiz.** T5 692'de MACTOW 26,69 → formül 4,155 verir,
> loadsheet **4,1** yazmış. Yani **1 ondalığa aşağı kesme (truncate)** yapılıyor,
> yuvarlama değil. Faz 3'te bunu doğrula ve tek yerde sabitle.

---

## 7. Loadsheet çıktı alanları (s.13, Sheet C-1)

Dokümanda `X` ile işaretlenenler — loadsheet'te **görünmesi zorunlu** olanlar:

| Kod | Alan | Zorunlu |
|---|---|---|
| `BI` | Basic Index | — |
| `DOI` | Dry Operating Index | ✅ |
| `DLI` | Deadload Index | — |
| `MACDLW` | Deadload MAC | — |
| `LIZFW` | Loaded Index at Zero Fuel Weight | ✅ |
| `LITOW` | Loaded Index at Take-off Weight | ✅ |
| `LILAW` | Loaded Index at Landing Weight | ✅ |
| `MACZFW` | MAC at Zero Fuel Weight | ✅ |
| `MACTOW` | MAC at Take-off Weight | ✅ |
| `MACLAW` | MAC at Landing Weight | ✅ |
| `STABTO` | Stabilizer trim at take-off | ✅ |

> ⚠️ `LILAW` ve `MACLAW` doküman gereği **zorunlu** ama örnek loadsheet'te (T5 692)
> **yok**. Sistemimiz bunları üretmeli — Aerometa'ya karşı bir üstünlük maddesi.

---

## 8. Yakıt indeks tabloları (s.17–46)

**15 farklı yoğunluk**, her biri 2 sayfa:

| Yoğunluk | PDF sayfaları |
|---|---|
| 0.760 | 18–19 |
| 0.765 | 20–21 |
| 0.770 | 22–23 |
| 0.775 | 24–25 |
| 0.780 | 26–27 |
| 0.785 | 28–29 |
| 0.790 | 30–31 |
| 0.795 | 32–33 |
| 0.800 | 34–35 |
| 0.805 | 36–37 |
| 0.810 | 38–39 |
| 0.815 | 40–41 |
| 0.820 | 42–43 |
| 0.825 | 44–45 |
| 0.830 | 46–47 |

**Sayfa yapısı:** Her sayfa 2 sütun (`Fuel Weight` / `Index Value`) ×2 = sayfa başına
4 kolon. Okuma sırası: **sol sütun yukarıdan aşağı → sağ sütun yukarıdan aşağı**,
sonra sonraki sayfa aynı şekilde. Yakıt ağırlığı monoton artan olmalı.

**Ağırlık adımları düzensiz:** 2000'den 39000'e kadar çoğunlukla 2000 kg adım, arada
500 kg adımlar (36500, 37000, 37500, 38000, 38500), sonra 2500 kg adım (41500, 44000,
46500, 49000, 51500, 54000, 56500, 59000, 61500), sonra 2000 kg adım (64000+).
Son satır sayısal değil: **`FULL`**.

**Doğrulama örneği — yoğunluk 0.760, sayfa 1 (s.17):**
```
2000 −2.09   |  34000 −15.05
4000 −4.25   |  36000 −16.68
6000 −6.35   |  36500 −17.09
8000 −8.40   |  37000 −12.00
10000 −7.70  |  37500  −6.84
12000 −3.72  |  38000  −1.63
14000 +1.10  |  38500  +3.57
16000 +1.18  |  39000  +7.75
18000 −0.78  |  41500  +5.83
20000 −2.70  |  44000  +3.98
22000 −4.57  |  46500  +2.27
24000 −6.40  |  49000  +0.95
26000 −8.22  |  51500  −0.03
28000 −9.97  |  54000  −0.63
30000 −11.70 |  56500  −0.82
32000 −13.39 |  59000  −0.58
             |  61500  +0.04
```
**Yoğunluk 0.760, sayfa 2 (s.18):**
```
64000 +1.13  |  85000 +2.93
66500 +2.71  |  87000 +1.99
69000 +4.91  |  89000 +1.07
71000 +7.06  |  91000 +0.18
73000 +7.85  |  93000 −0.71
75000 +7.36  |  95000 −1.57
77000 +6.63  |  97000 −2.47
79000 +5.77  |  99000 −3.41
81000 +4.84  | 101000 −4.47
83000 +3.89  | 103000 −5.74
             | 105000 −7.62
             | FULL   −8.98
```
**Yoğunluk 0.830, sayfa 2 (s.46) son satırlar** (üst sınır kontrolü):
```
113000 −9.34 | 115000 −11.09 | FULL −9.80
```

> ⚠️ İndeks değeri **monoton değil** — 8000'de −8.40 dip yapıp 16000'de +1.18'e
> çıkıyor, sonra tekrar düşüyor. Bu **normaldir** (tank doldurma sırası: inner →
> outer → center → trim). Çıkarımda "artan olmalı" gibi bir doğrulama **koyma**.
>
> ⚠️ Ara değerler için **lineer interpolasyon** kullanılmalı. Tablo dışına
> ekstrapolasyon **yasak** — hata fırlat.
>
> ⚠️ Yoğunluk tablo değerlerinden biri değilse (ör. 0.7832) → **en yakın alt ve üst
> tablo arasında ikinci bir interpolasyon** mu, yoksa **en yakın tabloya yuvarlama** mı?
> T5 692'de yoğunluk tam **0.785** olduğu için bu belirsizlik test edilemedi.
> **Faz 3'te operasyon ekibine sorulacak açık soru.**

---

## 9. Kokpit ve kabin indeks etkileri

### Kokpit (s.47, Sheet C-5)
| Max koltuk | Ref.Sta'dan kol (m) | Index/kg |
|---|---|---|
| 4 | −23,807 | **−0,00952** |

### Kuryeci koltukları (s.52, Sheet C-11)
| Konum | Max koltuk | Ref.Sta'dan kol (m) | Index/kg |
|---|---|---|---|
| Aft of lavatory L11 | 2 | −21,555 | **−0,00862** |
| Aft of Courier Stowage | 4 | −21,555 | **−0,00862** |

### Galley (s.52)
| Konum | Ref.Sta'dan kol (m) | Index/kg |
|---|---|---|
| Courier Stowage | −22,3555 | **−0,00864** |

### Kabin konfigürasyonu (s.51, Sheet C-8)
`6 YC` — Class 1 = `YC`, Courier Area = **6 koltuk**.
Standart kuryeci ekibi 6 kişi: 2 kişi lavabo arkası, 4 kişi courier stowage arkası (s.4).

---

## 10. CG limitleri — loadsheet için (s.49–50, Sheet C-7)

Bu tablolar **CG envelope grafiğinin** ve **zarf içi/dışı kontrolünün** kaynağıdır.
Ara ağırlıklar için **lineer interpolasyon**.

### ZFW limitleri

| FORWARD — Ağırlık (kg) | Index | | AFT — Ağırlık (kg) | Index |
|---|---|---|---|---|
| 116 000 | +100,88 | | 116 000 | +141,62 |
| 128 960 | +98,24 | | 167 840 | +163,72 |
| 131 759 | +97,47 | | 168 920 | +165,20 |
| 135 440 | +95,65 | | 170 000 | +164,45 |
| 143 000 | +90,20 | | | |
| 144 080 | +86,99 | | | |
| 170 000 | +81,72 | | | |

### TAKEOFF limitleri

| FORWARD — Ağırlık (kg) | Index | | AFT — Ağırlık (kg) | Index |
|---|---|---|---|---|
| 116 000 | +85,61 | | 116 000 | +115,28 |
| 210 000 | +66,50 | | 118 200 | +115,73 |
| 223 364 | +76,64 | | 169 000 | +157,83 |
| 233 000 | +99,29 | | 179 000 | +166,12 |
| | | | 228 625 | +175,13 |
| | | | 233 000 | +131,20 |

> **Landing limiti** ayrı tablo olarak verilmemiş. ENV grafiğinde MLW 182 000'de
> yatay kırmızı çizgi olarak görünüyor — **landing zarfı = ZFW zarfının MLW'ye kadar
> uzatılmışı** varsayımı ile çizilmiş olabilir. **Faz 11'de netleştirilecek açık soru.**

---

## 11. Kompartıman trim detayları (s.54, Sheet C-14)

| Comp. No | Açıklama | Max brüt (kg) | Index/kg |
|---|---|---|---|
| 1 | Forward cargo hold | 18 869 (1+2 birlikte) | **−0,00609** |
| 2 | Forward cargo hold | ″ | **−0,00379** |
| 3 | Aft cargo hold | 15 241 (3+4 birlikte) | **+0,00243** |
| 4 | Aft cargo hold | ″ | **+0,00444** |
| 5 | Rear (Bulk) cargo hold | 3 468 | **+0,00630** |

**Alt güverte alt-limitleri (LIR başlığından, s.77):**
Compartment No1 max **12 696** · No2 max **10 206** · No3 max **10 206** ·
No4 max **10 206** · No5 (bulk) max **3 468**

**Ana güverte max yük limiti (s.4):** **62 000 kg**

---

## 12. Combined Load Limitations (s.55–56, Sheet C-14 §9.1) — ⭐ KRİTİK

Zone bazlı **maksimum kümülatif yük**. ZFCG bandına göre değişir.
`FWD CANTILEVER` = ZA…ZE · `WING BOX` = ZF/ZG/ZH (limitsiz/gri) · `AFT CANTILEVER` = ZJ…ZU

### ZFCG < 25 %MAC

| Zone | H-arm (m) | 21≤ZFCG<22 | 22≤ZFCG<23 | 23≤ZFCG<23.5 | 23.5≤ZFCG<24 | 24≤ZFCG<24.5 | 24.5≤ZFCG<25 |
|---|---|---|---|---|---|---|---|
| ZA | 16,203 | 4 807 | 4 726 | 4 686 | 4 645 | 4 605 | 4 564 |
| ZB | 17,965 | 7 089 | 6 926 | 6 845 | 6 764 | 6 683 | 6 601 |
| ZC | 21,023 | 11 911 | 11 607 | 11 455 | 11 303 | 11 151 | 10 999 |
| ZD | 22,893 | 16 479 | 16 088 | 15 893 | 15 698 | 15 502 | 15 307 |
| ZE | 24,475 | 20 284 | 19 821 | 19 589 | 19 357 | 19 125 | 18 893 |
| ZJ | 32,732 | 28 450 | 29 014 | 29 579 | 29 861 | 30 143 | 30 425 |
| ZK | 34,993 | 26 664 | 27 228 | 27 792 | 28 075 | 28 357 | 28 639 |
| ZL | 38,419 | 22 348 | 22 811 | 23 273 | 23 504 | 23 735 | 23 966 |
| ZM | 40,002 | 20 302 | 20 691 | 21 080 | 21 274 | 21 468 | 21 663 |
| ZP | 41,979 | 17 534 | 17 831 | 18 128 | 18 277 | 18 426 | 18 574 |
| ZR | 45,144 | 12 249 | 12 400 | 12 551 | 12 626 | 12 701 | 12 777 |
| ZS | 46,987 | 9 716 | 9 802 | 9 888 | 9 931 | 9 973 | 10 016 |
| ZT | 49,369 | 6 489 | 6 518 | 6 547 | 6 562 | 6 576 | 6 591 |
| ZU | 51,833 | 3 739 | 3 743 | 3 747 | 3 749 | 3 751 | 3 753 |

### ZFCG ≥ 25 %MAC

| Zone | H-arm (m) | 25≤ZFCG<25* | 26≤ZFCG<27 | 27≤ZFCG<28 | 28≤ZFCG<29 | 29≤ZFCG<30 | 30≤ZFCG<38 |
|---|---|---|---|---|---|---|---|
| ZA | 16,203 | 4 484 | 4 403 | 4 322 | 4 242 | 4 161 | 3 515 |
| ZB | 17,965 | 6 439 | 6 277 | 6 114 | 5 952 | 5 790 | 4 491 |
| ZC | 21,023 | 10 695 | 10 391 | 10 087 | 9 783 | 9 479 | 7 047 |
| ZD | 22,893 | 14 916 | 14 526 | 14 135 | 13 744 | 13 354 | 10 229 |
| ZE | 24,475 | 18 429 | 17 965 | 17 501 | 17 037 | 16 573 | 12 862 |
| ZJ | 32,732 | 30 708 | 31 272 | 31 837 | 32 401 | 32 965 | 33 530 |
| ZK | 34,993 | 28 921 | 29 486 | 30 050 | 30 615 | 31 179 | 31 743 |
| ZL | 38,419 | 24 197 | 24 660 | 25 122 | 25 584 | 26 046 | 26 509 |
| ZM | 40,002 | 21 857 | 22 246 | 22 635 | 23 024 | 23 413 | 23 802 |
| ZP | 41,979 | 18 723 | 19 020 | 19 318 | 19 615 | 19 912 | 20 209 |
| ZR | 45,144 | 12 852 | 13 003 | 13 154 | 13 304 | 13 455 | 13 606 |
| ZS | 46,987 | 10 059 | 10 145 | 10 231 | 10 316 | 10 402 | 10 488 |
| ZT | 49,369 | 6 605 | 6 634 | 6 663 | 6 693 | 6 722 | 6 751 |
| ZU | 51,833 | 3 755 | 3 759 | 3 763 | 3 767 | 3 771 | 3 775 |

> ⚠️ `*` İkinci tablonun ilk sütun başlığı dokümanda **`25≤ZFCG<25`** yazıyor —
> bu bir **dizgi hatası**. Mantıken **`25≤ZFCG<26`** olmalı (ikinci sütun 26'dan
> başlıyor). Çıkarımda `25–26` olarak düzelt, ama koda **açık bir yorum** ve
> `docs/AHM560_ERRATA.md` kaydı bırak.
>
> ⚠️ Bantlar **21'den başlıyor** ama ZFCG 21'in altına düşebilir (min weight
> senaryoları). 21'in altı ve 38'in üstü için tablo **yok** → hata fırlat.
>
> **Kümülatif** demek: ZA limiti = sadece ZA'daki yük; ZB limiti = ZA+ZB toplamı;
> ... ZE limiti = ZA+…+ZE toplamı. Aft tarafta ters yönde: ZU'dan başlayarak öne
> doğru kümülatif. Load & Trim Sheet'teki (s.72) `Cumulative Load` sütunları
> bunu doğruluyor. **Faz 3'te yön mutlaka doğrulanmalı.**

---

## 13. Bay/Section indeksleri — ALT GÜVERTE (s.57–60)

### Bulk (s.57)
| Bay | Max brüt (kg) | Index/kg |
|---|---|---|
| 51 | 339 | +0,00571 |
| 52 | 1 413 | +0,00592 |
| 53 | 1 716 | +0,00674 |

### Konteyner — 60.4"×61.5" veya 60.4"×125" (s.58)
Hepsi max brüt **3 174 kg**.

| Bay | Index/kg | | Bay | Index/kg |
|---|---|---|---|---|
| 11 | −0,00709 | | 31 | +0,00178 |
| 12 | −0,00638 | | 32 | +0,00241 |
| 13 | −0,00575 | | 33 | +0,00305 |
| 14 | −0,00512 | | 41 | +0,00384 |
| 21 | −0,00441 | | 42 | +0,00447 |
| 22 | −0,00378 | | 43 | +0,00510 |
| 23 | −0,00315 | | | |

### Palet 88"×125" (s.59) — max brüt **4 626 kg**
| Bay | Index/kg | | Bay | Index/kg |
|---|---|---|---|---|
| 12P | −0,00624 | | 31P | +0,00192 |
| 13P | −0,00526 | | 32P | +0,00291 |
| 21P | −0,00427 | | 41P | +0,00398 |
| 22P | −0,00329 | | 42P | +0,00488 |

### Palet 96"×125" (s.60) — max brüt **5 103 kg**
| Bay | Index/kg | | Bay | Index/kg |
|---|---|---|---|---|
| 12P | −0,00628 | | 31P | +0,00196 |
| 13P | −0,00530 | | 32P | +0,00295 |
| 21P | −0,00431 | | 41P | +0,00394 |
| 22P | −0,00333 | | 42P | +0,00492 |

> ⚠️ `11P` pozisyonu **yok** (LIR formunda da gri/kapalı). `43P` de yok.

---

## 14. Bay/Section indeksleri — ANA GÜVERTE (s.61–67)

### Single row 88"×125" (s.61)
| Bay | Max brüt (kg) | Index/kg |
|---|---|---|
| A | 2 826 | −0,00696 |
| B | 3 123 | −0,00605 |
| C | 3 391 | −0,00515 |
| D | 3 391 | −0,00424 |
| E | 4 687 | −0,00334 |
| F | 6 033 | −0,00243 |
| G | 6 033 | −0,00153 |
| H | 6 033 | −0,00063 |
| J | 6 033 | +0,00028 |
| K | 5 945 | +0,00118 |
| L | 4 037 | +0,00209 |
| M | 4 037 | +0,00299 |
| P | 3 725 | +0,00389 |
| R | 3 714 | +0,00496 |
| S | 3 714 | +0,00595 |
| T | 3 059 | +0,00693 |
| U | 2 541 | +0,00792 |

### Single row 96"×125" (s.62)
| Bay | Max brüt (kg) | Index/kg |
|---|---|---|
| AA | 3 080 | −0,00692 |
| BB | 3 428 | −0,00593 |
| CC | 3 696 | −0,00494 |
| DD | 3 696 | −0,00396 |
| EE | 5 670 | −0,00297 |
| FF | 5 670 | −0,00199 |
| GG | 5 670 | −0,00100 |
| HH | 5 670 | −0,00002 |
| JJ | 5 670 | +0,00097 |
| KK | 4 822 | +0,00196 |
| LL | 4 400 | +0,00295 |
| MM | 4 091 | +0,00394 |
| PP | 4 048 | +0,00492 |
| RR | 4 048 | +0,00591 |
| SS | 3 389 | +0,00689 |
| TT | 2 809 | +0,00788 |

### Single row 125"×96" (s.63)
| Bay | Max brüt (kg) | Index/kg |
|---|---|---|
| AB | 3 429 | −0,00677 |
| BC | 3 941 | −0,00549 |
| CE | 4 001 | −0,00421 |
| EF | 6 804 | −0,00293 |
| FH | 6 804 | −0,00165 |
| HJ | 6 804 | −0,00037 |
| JK | 6 804 | +0,00091 |
| KM | 4 868 | +0,00219 |
| MP | 4 445 | +0,00348 |

### Side by side 125"×88" (s.64)
| Bay | Max brüt (kg) | Index/kg | | Bay | Max brüt (kg) | Index/kg |
|---|---|---|---|---|---|---|
| ABR | 2 000 | −0,00677 | | ABL | 2 000 | −0,00677 |
| BCR | 2 358 | −0,00549 | | BCL | 2 358 | −0,00549 |
| CER | 2 400 | −0,00421 | | CEL | 2 400 | −0,00421 |
| EFR | 3 825 | −0,00293 | | EFL | 3 825 | −0,00293 |
| FHR | 4 321 | −0,00165 | | FHL | 4 321 | −0,00165 |
| HJR | 4 321 | −0,00037 | | HJL | 4 321 | −0,00037 |
| JKR | 4 321 | +0,00091 | | JKL | 4 321 | +0,00091 |
| KMR | 2 964 | +0,00219 | | KML | 2 964 | +0,00219 |
| MPR | 2 756 | +0,00348 | | MPL | 2 756 | +0,00348 |
| PRR | 2 629 | +0,00477 | | PRL | 2 629 | +0,00477 |

### Side by side 125"×96" (s.65)
**125"×88" ile aynı değerler**, ancak `PRR`/`PRL` **yok** (ABR…MPL, 9 çift).

### 16 ft palet — 196"×96" (s.66)
| Pozisyon | Max brüt (kg) | Index/kg |
|---|---|---|
| CFR | 7 729 | −0,00385 |
| FJR | 10 668 | −0,00137 |
| JLR | 10 668 | +0,00070 |
| LPR | 6 236 | +0,00274 |

### 20 ft palet — 238.5"×96" (s.67)
| Pozisyon | Max brüt (kg) | Index/kg |
|---|---|---|
| CFG | 10 602 | −0,00361 |
| FJG | 11 340 | −0,00114 |
| JLG | 11 340 | +0,00131 |

### 16/20 ft palet → zone dağılımı (s.76, Load&Trim Sheet sayfa 4) — ⭐
Uzun paletler birden fazla zone'a yük dağıtır. Combined load kontrolü için gerekli:

| Pozisyon | Zone dağılımı |
|---|---|
| CFR | ×0,6 → ZONE D · ×0,4 → ZONE E |
| FJR | ×0,2 → ZONE E · ×0,5 → ZONE F · ×0,3 → ZONE G |
| JLR | ×0,2 → ZONE J · ×0,5 → ZONE K · ×0,3 → ZONE L |
| LPR | ×0,4 → ZONE L · ×0,5 → ZONE M · ×0,1 → ZONE P |
| CFG | ×0,2 → ZONE D · ×0,4 → ZONE E · ×0,4 → ZONE F |
| FJG | ×0,1 → ZONE F · ×0,4 → ZONE G · ×0,4 → ZONE H · ×0,1 → ZONE J |
| JLG | ×0,2 → ZONE J · ×0,4 → ZONE K · ×0,4 → ZONE L |

> ⚠️ Bu değerler s.76 grafiğinden **görsel olarak** okundu (küçük punto).
> **Faz 2'de yüksek çözünürlüklü yeniden doğrulama şart.** Katsayı toplamları
> 1,0 olmalı — CFG için 0,2+0,4+0,4 = 1,0 ✅, FJG 0,1+0,4+0,4+0,1 = 1,0 ✅.

---

## 15. ULD tipleri (s.70, Sheet D-2)

| Type Code | Dara (kg) | Brüt (kg) | Hacim (m³) | Güverte |
|---|---|---|---|---|
| `PLA`/`FLA` | 115 | 3 175 | 6,94 | Lower deck |
| `PAG` | 120 | 4 626 | 9,91 | Lower / Main |
| `PMC` | 120 | 5 035 | 15,8 | Lower / Main |
| `PZA` | 454 | 11 340 | 29,4 | Main deck |
| `PGA` | 545 | 13 608 | 35,8 | Main deck |

## 16. Balast (s.68, Sheet C-15)

| ULD Type | Brüt (kg) |
|---|---|
| PMC | 2 865 |
| PMC | 3 025 |

**Notlar:** Balast paletleri sadece **kargosuz veya eğitim uçuşlarında** kullanılır.
Trim tank'ta sıkışmış yakıtın balast olarak bloke edilmesi **MSN 810 ve 815** uçaklarında
**kesinlikle yasak**.

---

## 17. Desired Trim Line (s.69, Sheet D-1)

> "Yakıt ekonomisi açısından, mümkün olduğunda kompartımanlardaki yük **LIZFW bu
> çizginin arkasında (aft) kalacak** şekilde dağıtılmalıdır."

⚠️ Dokümanda **breakpoint tablosu boş bırakılmış** — sadece örnek grafik var.
Yani şu an tanımlı bir desired trim line **yok**. Sistemimiz bunu
**konfigüre edilebilir** yapmalı (Aerometa'ya karşı özellik: otomatik trim
optimizasyonu → yakıt tasarrufu).

---

## 18. LIR kodları (LIR formu başlığı)

| Kod | Anlam | | Kod | Anlam |
|---|---|---|---|---|
| `B` | BAGGAGE | | `O` | FULL |
| `C` | CARGO | | `X` | EMPTY |
| `M` | MAIL | | `NIL` | NO CONTAINER OR PALLET OR POSITION |
| `P` | PALLET | | `R` | RIGHT |
| `S` | RUMMAGE | | `L` | LEFT |
| `E` | EQUIPMENT | | | |

---

# 19. ⭐ REGRESYON TEST VEKTÖRÜ — T5 692

Bu, `wnb-core`'un **altın test vakasıdır**. Kaynak: `LS_T5692_11082026_ED01.pdf`,
`LIR_T5692_11082026_ED01.pdf`, `ENV_T5692_11082026_ED01.pdf`.

## 19.1 Girdi

```yaml
flight:      T5 692
route:       SGN → ASB
date:        2026-08-11
time:        "22:00"
aircraft:    EZ-F430
version:     P2F
crew:        "2/3"          # kokpit 2 / kuryeci 3
edno:        "01"
checked_by:  BEZIRGEN
station:     SGN

fuel:
  density:      0.785
  takeoff_fuel: 44700
  trip_fuel:    36660
  taxi_fuel:    600

dry_operating_weight: 111043.70   # ⚠️ AHM tablosu 111720 diyor — Bulgu #2
dry_operating_index:  78.22       # ⚠️ AHM tablosu 77.74 diyor — Bulgu #2
```

### Ana güverte yükü (LIR + LS)
| Poz | ULD/AWB | kg | | Poz | ULD/AWB | kg |
|---|---|---|---|---|---|---|
| ABL | 06154 | 717 | | ABR | 06115 | 834 |
| BCL | 06298 | 915 | | BCR | 06017 | 919 |
| CEL | 06589 | 925 | | CER | 06586 | 952 |
| EFL | 06743 | 956 | | EFR | 06141 | 1 019 |
| FHL | 0029  | 1 022 | | FHR | 06505 | 1 029 |
| HJL | 06507 | 1 285 | | HJR | 06628 | 1 104 |
| JKL | 06683 | 1 089 | | JKR | 06668 | 1 094 |
| KML | 06591 | 1 068 | | KMR | 06273 | 1 096 |
| MPL | 06730 | 1 575 | | MPR | 06102 | 1 702 |
| PP  | 06014 | 2 125 | | RR  | 06332 | 1 856 |
| SS  | 06243 | 1 528 | | TT  | 06064 | 2 119 |

**Ana güverte toplamı: 26 929 kg** (≤ 62 000 ✅)

### Alt güverte yükü
| Poz | ULD/AWB | kg | Tip |
|---|---|---|---|
| 11  | 05185 | 472 | Container (single row) |
| 12P | 06645 | 800 | Pallet 96"×125" |
| 13P | 06672 | 835 | Pallet 96"×125" |
| 21P | 06116 | 846 | Pallet 96"×125" |
| 22P | 06094 | 871 | Pallet 96"×125" |
| 31P | 06044 | 876 | Pallet 96"×125" |
| 32P | 0002  | 916 | Pallet 96"×125" |
| 41P | 06530 | 1 003 | Pallet 96"×125" |
| 42P | 06284 | 1 050 | Pallet 96"×125" |
| 52  | —     | 340 | Bulk |
| 53  | —     | 340 | Bulk |

**Alt güverte toplamı: 8 349 kg**

**Kompartıman kontrolü:**
- Fwd (comp 1+2) = 472+800+835+846+871 = **3 824** ≤ 18 869 ✅
- Aft (comp 3+4) = 876+916+1 003+1 050 = **3 845** ≤ 15 241 ✅
- Bulk (comp 5) = 340+340 = **680** ≤ 3 468 ✅

## 19.2 Beklenen çıktı

| Alan | Beklenen | Doğrulama durumu |
|---|---|---|
| `TOTAL TRAFFIC LOAD` | **35 278** | ✅ 26 929 + 8 349 = 35 278 |
| `ZFW` | **146 321,7** | ✅ 111 043,70 + 35 278 |
| `TOW` | **191 021,7** | ✅ 146 321,7 + 44 700 |
| `LDW` | **154 361,7** | ✅ 191 021,7 − 36 660 |
| `TAXI WEIGHT` | **191 621,7** | ✅ 191 021,7 + 600 |
| `LIZFW` | **106,07** | (girdiden türetilir) |
| `MACZFW` | **26,4** | ✅ formülle yeniden üretildi → 26,43 |
| `LITOW` | **109,39** | ✅ 106,07 + 3,32 (yakıt indeksi) |
| `MACTOW` | **26,7** | ✅ formülle yeniden üretildi → 26,69 |
| `TRIM SETTING` | **4,1** | ⚠️ formül 4,155 verir → truncate kuralı |
| `UNDERLOAD BEFORE LMC` | **24 722** | ❌ **HATALI** — bkz. Bulgu #1 |
| `ZFW (corrected)` | 146 321,7 | ✅ |
| `ZFI (corrected)` | 106,07 | ✅ |
| `FWD/AFT ZFW LIMITS: INDEX` | 87,4 / 154,3 | (CG limit tablosundan interpolasyon) |
| `FWD/AFT TOW LIMITS: INDEX` | 71,1 / 166,6 | (CG limit tablosundan interpolasyon) |

### Hesap adımlarının açık hali (test assertion'ları)

```
MACZFW:
  2500 × (106,07 − 100) / 146 321,7  = 0,1037093
  + 1,8175                            = 1,9212093
  / 0,0727                            = 26,4265  →  26,4  ✅

MACTOW:
  2500 × (109,39 − 100) / 191 021,7  = 0,1228920
  + 1,8175                            = 1,9403920
  / 0,0727                            = 26,6904  →  26,7  ✅

STAB:
  7 × (35 − 26,6904) / 14             = 4,1548   →  4,1   (truncate)
```

## 19.3 CG limit interpolasyon doğrulaması

Loadsheet `FWD/AFT ZFW LIMITS: INDEX = 87,4 / 154,3` diyor. ZFW = 146 321,7.

**FWD:** 144 080 (+86,99) ile 170 000 (+81,72) arasında:
`86,99 + (146 321,7 − 144 080)/(170 000 − 144 080) × (81,72 − 86,99)`
`= 86,99 + 0,08648 × (−5,27) = 86,99 − 0,4558 = 86,53`
→ loadsheet **87,4** diyor. **0,87 fark var** ⚠️

**AFT:** 116 000 (+141,62) ile 167 840 (+163,72) arasında:
`141,62 + (146 321,7 − 116 000)/(167 840 − 116 000) × (163,72 − 141,62)`
`= 141,62 + 0,58492 × 22,10 = 141,62 + 12,927 = 154,55`
→ loadsheet **154,3** diyor. **0,25 fark** — yakın ama tam değil.

> ⚠️ **Bulgu #4 (yeni):** Aerometa'nın CG limit interpolasyonu bizim
> AHM tablosu okumamızla tam örtüşmüyor. Olası sebepler:
> (a) AHM'in daha yeni bir revizyonundaki farklı breakpoint'ler,
> (b) Aerometa'nın ek bir operasyonel marj uygulaması,
> (c) bizim tablo okumamızda hata.
> **Faz 3'te bu mutlaka çözülmeli** — CG limitleri emniyet-kritik.
> AFT tarafı yakın (0,25), FWD tarafı uzak (0,87) olması (b) veya (a)'yı işaret ediyor.

---

# 20. ⚠️ BULGULAR — Aerometa çıktısındaki tutarsızlıklar

Bunlar hem **bizim doğru yapmamız gereken** noktalar, hem de **rakibe karşı
somut üstünlük argümanları**. Her biri validasyon dosyasına girmeli.

### Bulgu #1 — UNDERLOAD yanlış hesaplanmış 🔴
Loadsheet `UNDERLOAD BEFORE LMC = 24 722` diyor.

Doğrusu üç limitin en küçüğü:
| Limit | Hesap | Sonuç |
|---|---|---|
| MZFW | 170 000 − 146 321,7 | **23 678,3** ← en kısıtlayıcı |
| MTOW | 233 000 − 191 021,7 | 41 978,3 |
| MLW | 182 000 − 154 361,7 | 27 638,3 |

**Doğru değer: 23 678,3 kg.**

24 722 nereden geliyor? `170 000 − 110 000 − 35 278 = 24 722` —
yani **DOW olarak 111 043,70 yerine yuvarlanmış 110 000** kullanılmış.

**Sonuç: 1 043,7 kg fazla iyimser underload.** Emniyet açısından yanlış yönde
bir hata — yükleme kontrolörü bu marja güvenip fazladan yük kabul edebilir.

### Bulgu #2 — DOW/DOI, AHM 560 ile uyuşmuyor 🟡
| Kaynak | DOW | DOI |
|---|---|---|
| Loadsheet (EZ-F430, crew 2/3) | 111 043,70 | 78,22 |
| AHM 560 Ed.1 Rev.0 s.6 (EZ-F430, 2/3) | 111 720 | 77,74 |
| AHM 560 Ed.1 Rev.0 s.6 (EZ-F429, 2/3) | 111 560 | 78,21 |

676 kg fark. DOI ise EZ-**F429**'un değerine (78,21) çok yakın — **tescil karışması
ihtimali** de var. Muhtemelen uçak yeniden tartıldı ve AHM'in yeni revizyonu çıktı,
**ama elimizdeki AHM'in `List of Revisions` tablosu (s.9) tamamen boş.**

**Bu bir doküman kontrol açığıdır.** Sistemimizde AHM master data
**versiyonlu ve tarihli** olmalı; loadsheet hangi AHM edition/revision ile
üretildiğini **belgede göstermeli**.

### Bulgu #3 — TRIM yuvarlama kuralı belgelenmemiş 🟡
Formül 4,155 → belge 4,1. Truncate mi, banker's rounding mu, yoksa
farklı bir MACTOW hassasiyeti mi? Tek yerde sabitlenmeli.

### Bulgu #4 — CG limit interpolasyonu tam örtüşmüyor 🟠
Bkz. §19.3. FWD ZFW limitinde 0,87 indeks farkı.

### Bulgu #5 — LILAW / MACLAW üretilmiyor 🟡
AHM 560 s.13 bunları **zorunlu çıktı** olarak işaretlemiş, loadsheet'te yok.

### Bulgu #6 — ENV PDF layout hatası 🟢
`ENV_T5692_11082026_ED01.pdf` sağ üst köşesinde `ED NO` / `01` hücresi
sayfa kenarından taşmış (kırpılmış). Kozmetik ama profesyonellik göstergesi.

### Bulgu #7 — AHM 560 Ed.1/Rev.0 verisi T5 692'nin LIZFW/yakıt indeksini üretmiyor 🔴
Faz 3'te `wnb-core` altın testi çalıştırılırken bulundu. DOI + 33 yük kaleminin pozisyon
indeksi (AHM 560 Ed.1/Rev.0'ın kendi `positions.json` verisinden) toplanınca `LIZFW = 104,97`
çıkıyor, loadsheet `106,07` diyor (**1,10 fark**). Aynı şekilde 44 700 kg / 0,785 yoğunluk
için AHM'in kendi yakıt tablosundan hesaplanan yakıt indeksi `3,77`, loadsheet'in ima ettiği
`3,32` değil (**0,45 fark**).

`%MAC` formülünün kendisi doğru — loadsheet'in LIZFW/LITOW değerleri girdi olarak verildiğinde
formül GROUND_TRUTH §19.2'yi bit bit yeniden üretiyor (`golden-t5692.test.ts` Part 2). Hata
formülde değil, **veride**: pozisyon/yakıt tabloları tek tek doğrulandı
(`packages/ahm-data/test/ground-truth.test.ts`, 200+ assertion, hepsi geçiyor), yani AHM 560
Ed.1/Rev.0'ı doğru okumuşuz — ama bu revizyon T5 692'nin gerçek loadsheet'ini üreten sistemin
kullandığı revizyonla **aynı değil**.

Bulgu #2 ile aynı kök neden: muhtemelen uçak yeniden tartıldı / AHM'in bir sonraki revizyonu
çıktı, ama elimizdeki AHM'in List of Revisions tablosu (s.9) boş olduğu için bu revizyon
farkı hiçbir yerde iz bırakmamış. Detay: `docs/AHM560_ERRATA.md` Kayıt 6.

**Bu aslında değer önerimizin kanıtı:** Aerometa hangi AHM revizyonuyla hesapladığını
göstermiyor; biz elimizdeki (tarihli, versiyonlu) AHM verisiyle bağımsız hesaplayıp tutmayan
her yeri otomatik buluyoruz. Faz 5 (AHM versiyon diff) ve Faz 14 (karşılaştırma koşum takımı)
bu tür farkları sistematikleştirecek. **Operasyona geçmeden önce güncel AHM 560 revizyonu
temin edilmeli** — bkz. §21 soru 6.

---

## 21. Faz 2'de cevaplanacak açık sorular

1. **Yakıt yoğunluğu ara değerleri:** tablo dışı yoğunlukta (ör. 0.7832) ne yapılır?
   İki tablo arası interpolasyon mu, en yakına yuvarlama mı?
2. **Combined load kümülatif yönü:** FWD zone'lar burundan kuyruğa mı,
   AFT zone'lar kuyruktan buruna mı toplanıyor?
3. **Landing CG zarfı:** ayrı tablo var mı, yoksa ZFW zarfı mı kullanılıyor?
4. **ZFCG < 21 veya > 38** durumunda ne yapılır?
5. **Desired trim line** breakpoint'leri (s.69 boş) — operasyon ekibinden alınacak.
6. **AHM 560'ın güncel revizyonu** hangisi? (Bulgu #2)
7. **16/20 ft palet zone dağılım katsayıları** (s.76) yüksek çözünürlükte doğrulanmalı.
8. **Lateral imbalance** limitleri (s.74) — okunmadı, Faz 2'de çıkarılacak.
