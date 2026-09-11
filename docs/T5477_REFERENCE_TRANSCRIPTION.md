# T5 477 — referans çıktı transkripsiyonu ve kaynak notu

Bu belge, `docs/OPUS_T5477_LOAD_PLANNING_PARITY.md` Aşama 1'in çıktısıdır:
Aerometa'nın gerçek üretim çıktılarının sterilize edilmiş transkripsiyonu, nasıl
elde edildiği ve nelerin hâlâ açık olduğu.

## Kaynak

| Belge | Dosya | Sayfa | Metin katmanı |
|---|---|---|---|
| Loadsheet | `LS_T5477_05092026_ED178.pdf` | 1 (A4) | ❌ yok (görüntü) |
| Loading Instruction Report | `LIR_T5477_05092026_ED178.pdf` | 1 (A4) | ❌ yok (görüntü) |
| CG Envelope | `ENV_T5477_05092026_ED178.pdf` | 1 (A4) | ❌ yok (görüntü) |

Onaylı uçak kaynağı: `AHM 560 -AIRBUS_A330_200P2F_APPROVED_FINAL.pdf`,
SHA-256 `472bc7b823e634f6e6f2a21d7f72a0b1fe18f78ebff8da2a20ea4631fada885c` —
brief'te belirtilen özetle **birebir doğrulandı**.

**Yöntem:** üç PDF de `pdftoppm -png -r 200` ile PNG'ye render edilip görsel
olarak okundu. `pdftotext` üçünde de 1 karakter döndürüyor — brief'in uyardığı
gibi, bu belgelerin boş olduğunun kanıtı **değil**, metin katmanı olmadığının
kanıtı.

**Depoya alınmayanlar:** kaynak PDF'ler, ekran görüntüleri ve bunlardan
üretilen PNG'ler. Bunlar geçici çalışma dizininde kaldı.
`photo_2026-09-05 11.43.05.jpeg` brief'in belirttiği gibi ilgisiz müşteri
verisi — açılmadı, kopyalanmadı, incelenmedi.

**Sterilizasyon:** LS/LIR/ENV üzerinde hazırlayan, kontrol eden ve onaylayan
kişilerin isimleri basılı. Bunlar gerçek kişiler; **hiçbiri** bu belgeye,
fixture'lara, testlere veya kod yorumlarına aktarılmadı. Uçuş numarası, tescil,
tarih, ULD numaraları ve ağırlıklar operasyonel veridir, kişisel veri değildir —
onlar transkribe edildi.

**İkinci kişi doğrulaması:** ⬜ **yapılmadı.** Aşağıdaki tablolar tek bir
okuyucu (bu oturum) tarafından çıkarıldı. Operasyonel kullanımdan önce ikinci
bir kişinin PDF'lere karşı satır satır doğrulaması gerekiyor. Aritmetik bir
çapraz kontrol yapıldı ve tuttu (aşağıya bkz.), bu transkripsiyon hatası
ihtimalini azaltır ama ikinci kişi doğrulamasının yerine geçmez.

## Uçuş

| Alan | Değer |
|---|---|
| Uçuş | T5 477 |
| Güzergâh | ASB / FRA |
| Tarih / saat | 2026-09-05 13:10 |
| Uçak | EZ-F429, A330-243P2F |
| Ekip | 2/3 (kokpit 2, kuryeci 3) |
| ED NO | 178 |
| Yakıt yoğunluğu | 0,780 |

## Yük — LIR ve LS'den

LIR her pozisyonun **hangi konfigürasyon satırında** olduğunu açıkça
gösteriyor, dolayısıyla T5 692'deki gibi bir çıkarım gerekmedi.

### Ana güverte

`SINGLE ROW 96"x125"`:

| Poz | ULD | kg | | Poz | ULD | kg |
|---|---|---|---|---|---|---|
| AA | 06467 | 844 | | FF | 06381 | 3 220 |
| BB | 06538 | 1 645 | | PP | 06292 | 3 220 |
| CC | 06475 | 1 772 | | RR | 06636 | 1 684 |
| DD | 06757 | 1 970 | | SS | 06633 | 774 |
| EE | 06388 | 2 688 | | TT | 06024 | 1 534 |

`SIDE BY SIDE 125"x96"`:

| Poz | ULD | kg | | Poz | ULD | kg |
|---|---|---|---|---|---|---|
| HJL | 06754 | 726 | | HJR | 06755 | 726 |
| JKL | 05224 | 3 352 | | JKR | 06100 | 4 238 |
| KML | 06640 | 733 | | KMR | 06708 | 730 |
| MPL | 06723 | 2 208 | | MPR | 06379 | 910 |

Diğer tüm ana güverte satırları (`88"x125"`, `125"x96"` köprü,
`SIDE BY SIDE 125"x88"`, 16ft ve 20ft palet) `N` — boş.

**Ana güverte toplamı: 32 974 kg**

### Alt güverte

| Poz | ULD | kg | Satır |
|---|---|---|---|
| 11 | 05204 | 658 | `SINGLE ROW 60.4"x125"` |
| 12P | 06442 | 680 | `PALLET 96"x125"` |
| 13P | 06574 | 729 | `PALLET 96"x125"` |
| 21P | 06314 | 728 | `PALLET 96"x125"` |
| 22P | 06589 | 930 | `PALLET 96"x125"` |
| 31P | 06217 | 1 134 | `PALLET 96"x125"` |
| 32P | 06156 | 1 415 | `PALLET 96"x125"` |
| 41P | 06129 | 1 926 | `PALLET 96"x125"` |
| 42P | 06576 | 2 667 | `PALLET 96"x125"` |

**Alt güverte toplamı: 10 867 kg**

**Aritmetik çapraz kontrol:** 32 974 + 10 867 = **43 841** — LS'in bastığı
`TOTAL TRAFFIC LOAD` ile birebir. 27 kalemin herhangi birinde bir okuma hatası
olsaydı bu toplamın tutması beklenmezdi.

## Basılı sonuçlar ve bizim hesabımız

Bizim değerlerimiz `@tua/wnb-core` `calculateWnb()` çıktısı, AHM 560 **Ed.1
Rev.2** verisiyle. Fixture: `packages/wnb-core/test/fixtures/t5477.ts`,
testler: `packages/wnb-core/test/t5477-comparison.test.ts`.

| Alan | Aerometa | Bizim | Fark | Sınıf |
|---|---|---|---|---|
| TOTAL TRAFFIC LOAD | 43 841 | 43 841 | 0 | ✅ tam eşleşme |
| DOW | 111 293,70 | 111 294 | +0,30 | ✅ açıklanmış (AHM tablosu tam kg'a basılı) |
| DOI | 76,31 | 76,29 | −0,02 | ✅ açıklanmış (baskı yuvarlaması) |
| ZFW | 155 134,7 | 155 135 | +0,3 | ✅ DOW'dan türüyor |
| TOW | 216 534,7 | 216 535 | +0,3 | ✅ |
| LDW | 179 562,7 | 179 563 | +0,3 | ✅ |
| TAXI WEIGHT | 217 134,7 | 217 135 | +0,3 | ✅ |
| **UNDERLOAD BEFORE LMC** | **16 159** | **2 437** | **−13 722** | 🔴 **Aerometa hatası (Bulgu #1)** |
| LIZFW | 100,78 | 101,46 | +0,68 | ⚠️ açık (Bulgu #7) |
| LITOW | 99,82 | 100,38 | +0,56 | ⚠️ LIZFW'den türüyor |
| MACZFW | 25,2 | 25,3 | +0,1 | ⚠️ LIZFW'den türüyor |
| MACTOW | 25 | 25,1 | +0,1 | ⚠️ |
| TRIM SETTING | 5 | 4,9 | −0,1 | ⚠️ MACTOW'dan türüyor |
| FWD ZFW limit index | 85,6 | 84,74 | −0,86 | ⚠️ Bulgu #4 |
| AFT ZFW limit index | 158 | 158,30 | +0,30 | ⚠️ Bulgu #4 |
| FWD TOW limit index | 72,2 | 71,46 | −0,74 | ⚠️ Bulgu #4 |
| AFT TOW limit index | 171,2 | 172,93 | +1,73 | ⚠️ Bulgu #4 |
| LILAW / MACLAW | basılmıyor | 95,07 / 24,1 | — | ✅ bizim üstünlüğümüz (Bulgu #5) |

### 🔴 En önemli bulgu — UNDERLOAD bu uçuşta 13 722 kg yanlış

Doğru underload, üç marjın en küçüğüdür:

| Limit | Hesap | Sonuç |
|---|---|---|
| MZFW | 170 000 − 155 134,7 | 14 865,3 |
| MTOW | 233 000 − 216 534,7 | 16 465,3 |
| **MLW** | **182 000 − 179 562,7** | **2 437,3** ← bağlayıcı |

Aerometa'nın bastığı 16 159 = `170 000 − 110 000 − 43 841`, yani MZFW limiti,
**110 000'e yuvarlanmış bir DOW** ile. İki ayrı hata üst üste: yanlış limit
seçilmiş **ve** yuvarlanmış ağırlık kullanılmış.

Sonuç: yükleme kontrolörüne **16 159 kg** boş kapasitesi olduğu söyleniyor,
gerçekte azami gonuş ağırlığına **2 437 kg** kalmış. T5 692'de aynı hata
1 044 kg'lıktı; bu uçuşta MLW bağlayıcı olduğu için **13 kat** büyük ve
emniyet açısından yanlış yönde.

### Ed.1 Rev.2, ikinci uçakta da doğrulandı

T5 692 Rev.2'yi EZ-F430 üzerinde doğrulamıştı. T5 477 bunu **EZ-F429** üzerinde
bağımsız olarak tekrarlıyor: Rev.2 s.6'nın kokpit 2 / kuryeci 3 hücresi
`111 294 / 76,29`, basılı loadsheet `111 293,70 / 76,31`. Rev.0 aynı hücrede
`111 560 / 78,21` diyordu.

Bu, `GROUND_TRUTH.md` **Bulgu #2**'yi her iki tescil için de kapatır.

### Bulgu #7 hakkında yeni bilgi

DOI artık neredeyse tam (0,02) olduğuna göre, LIZFW'deki 0,68'lik farkın
**tamamı deadload indeksinde**:

| | Basılı | Bizim |
|---|---|---|
| LIZFW − DOI = deadload index | 24,47 | 25,17 |

T5 692'de aynı ölçüm 35 278 kg üzerinde **1,10** veriyordu; burada 43 841 kg
üzerinde **0,70**. Sabit bir kayma değil ve yükle basitçe orantılı da değil —
pozisyon dağılımına bağlı, yani `positions.json`'daki **pozisyon başına**
indeks değerlerinde bir fark olduğuna işaret ediyor.

Yakıt tarafı ise bu uçuşta çok yakın: yakıt indeksi katkısı bizde −1,08,
basılıda −0,96 (fark 0,12). T5 692'de bu fark 0,45'ti. Bu, kalıntının ağırlıklı
olarak **yakıt tablosunda değil, pozisyon tablosunda** olduğunun kanıtı.

### ENV — Bulgu #6 tekrar doğrulandı

`ENV_T5477_05092026_ED178.pdf`'in sağ üst köşesindeki `ED NO` / `178` hücresi
sayfa kenarından taşmış ve kırpılmış — T5 692'de gözlenen aynı düzen hatası,
yedi ay sonra hâlâ düzeltilmemiş.

## Aşama 1'de bulunan veri boşlukları

Bunlar Aşama 2'nin (AHM verisi) girdisidir, burada sadece kayda geçiriliyor.

1. **Alt güverte yarım konteyner pozisyonları eksik.** LIR'ın alt güverte
   bölümünde `SIDE BY SIDE 60.4"x61.5"` diye ayrı bir satır var: `11R/11L`,
   `12R/12L` … `43R/43L` (26 pozisyon). `positions.json` alt güvertede yalnızca
   tek sıra `11`…`43` (13 pozisyon) tanıyor. Bu uçuşta hepsi boş olduğu için
   hesabı etkilemedi, ama pozisyon modeli eksik.
2. **Kompartıman limitleri doğrulandı.** LIR'ın bastığı Fwd 18 869 / No1 12 696 /
   No2 10 206 / Aft 15 241 / No3 10 206 / No4 10 206 / Rear Bulk 3 468,
   `compartments.json` ile birebir tutuyor.
3. **`11P` ve `43P` gri.** LIR'da palet satırlarında bu iki hücre gri —
   `positions.json`'ın "11P ve 43P yok" notunu doğruluyor.
4. **Yanal denge** için LIR/LS hiçbir alan basmıyor; `checkLateralImbalance()`
   hâlâ `NOT_AVAILABLE` ve bu referanstan çözülemez.

## Açık kaynak soruları

| # | Soru | Neden önemli | Durum |
|---|---|---|---|
| Q1 | Ed.1 Rev.2'nin yükleme indeksi (pozisyon index/kg) sayfası | Bulgu #7'nin 0,68–1,10 birimlik kalıntısı büyük olasılıkla burada | ⛔ Kitapçık temin edilemiyor (kullanıcı 2026-09-09'da bildirdi) |
| Q2 | Ed.1 Rev.2 CG limit tabloları | Bulgu #4'ün 0,74–1,73 birimlik limit farkı | ⛔ Aynı |
| Q3 | Gonuş (landing) CG limit tablosu | Şu an ZFW zarfı yaklaşım olarak kullanılıyor | ⛔ Yayımlanmamış |
| Q4 | s.74 yanal denge tablosu | `checkLateralImbalance()` provizyonel kalıyor | ⛔ Çıkarılamadı |
| Q5 | Alt güverte yarım konteyner (R/L) index/kg değerleri | Boşluk #1'i kapatmak için | ⛔ Onaylı AHM'de aranmalı |
| Q6 | Tank bazlı yakıt tabloları (`FUEL INDEX PER TANK`, `FUEL LATERAL MOMENT`) | Brief'in Boşluk #4'ü | ⬜ Onaylı AHM PDF'inde var, yüksek çözünürlükte çıkarılmalı (Aşama 2) |

Q1–Q4 için kullanıcı 2026-09-09'da **"o kitapçık yok, eski hâlindeki verilere
devam et"** dedi. Bu, o farkların **kapatılamayacağı**, sadece **ölçülüp
belgeleneceği** anlamına gelir — testler bunları sabitledi. Operasyonel
kullanımdan önce bu kalemler ayrıca ele alınmalı.

---

**Bu belge operasyonel onay değildir.** Paralel operasyonel validasyon ve
havayolu/otorite kabulü hâlâ gereklidir.
