# Validasyon Dosyası

Faz 14 kapsamı: "Bizimki Aerometa'dan daha iyi mi?" sorusuna ölçülebilir
cevap. Bu dosya, otoriteye sunulacak nihai belgenin **ilk sürümü** —
kabul kriteri en az 12 senaryoda paralel karşılaştırma gerektiriyor,
bu sürümde yalnızca 1'i dolu (bkz. §2 Senaryo Kapsamı).

Karşılaştırma motoru `tools/compare/` — kaynak kod, alan-alan
karşılaştırma mantığı ve testleri orada. Aşağıdaki tablolar o araçla
üretildi (`renderDiffReportMarkdown`), elle yazılmadı ve şu komutla
yeniden üretilebilir:

```bash
pnpm --filter @tua/compare report
```

Komut yalnızca stdout'a yazar; bu dosyayı kendisi değiştirmez —
validasyon belgesi bir insan incelemesinden geçmeden değişmez.

## 1. Yöntem

`docs/IMPLEMENTATION_PLAN.md` Faz 14'teki iş akışı:

```
1. tua.aerometa.aero → uçuş oluştur, yükle, PDF al
2. Bizim sistemde AYNI veriyi gir → PDF al
3. tools/compare ile iki PDF'i karşılaştır
4. Fark raporunu incele:
   - Fark bizim hatamızsa → düzelt
   - Fark Aerometa'nın hatasıysa → burada kanıt olarak sakla
5. 12 senaryo tamamlanınca geçiş kararı
```

Her fark üç şekilde sınıflandırılır (`tools/compare/src/known-issues.ts`):

| Sınıf | Anlamı |
|---|---|
| ✅ eşleşiyor | İki sistem aynı değeri üretiyor |
| 🟢 bizim düzeltmemiz | Fark, CLAUDE.md'de belgelenmiş bilinen bir Aerometa hatasına karşılık geliyor |
| 🟡 araştırılacak | Fark açıklanamıyor — bilinen bir hataya karşılık gelmiyor, incelenmeli |

PDF'ten otomatik alan çıkarımı henüz yok — `tools/compare/src/index.ts`'de
belgelendiği gibi, bunun için gerçek Aerometa referans PDF'leri gerekiyor
(11 bekleyen senaryo için — Aerometa'da gerçek uçuş kurulmasını
gerektirir, bu depo dışında bir adım). Kendi tarafımızın çıktısı artık
mevcut: Loadsheet/LIR/ENV PDF üretimi (Faz 9-11) tamamlandı ve
`generateLoadsheet` server action'ı gerçek uçuş verisiyle test edildi.
Karşılaştırma motorunun kendisi (`compareFields`) veri kaynağından
bağımsız — düz alan haritaları alır, aşağıdaki T5 692 karşılaştırması
bunu kanıtlıyor.

## 2. Senaryo Kapsamı

| # | Senaryo | Durum |
|---|---|---|
| 1 | T5 692 — Normal yük | ✅ referans mevcut |
| 1b | **T5 477 — MLW sınırlı yük** | ✅ **referans mevcut** (planda yoktu, sonradan geldi) |
| 2 | Hafif yük | ⏳ bekliyor |
| 3 | Ağır yük (MZFW sınırı) | ⏳ bekliyor |
| 4 | İleri CG | ⏳ bekliyor |
| 5 | Geri CG | ⏳ bekliyor |
| 6 | Sadece ana güverte | ⏳ bekliyor |
| 7 | Sadece alt güverte | ⏳ bekliyor |
| 8 | 16ft palet | ⏳ bekliyor |
| 9 | 20ft palet | ⏳ bekliyor |
| 10 | LMC'li | ⏳ bekliyor |
| 11 | Ferry (kargosuz) | ⏳ bekliyor |
| 12 | Farklı yakıt yoğunlukları | ⏳ bekliyor |

**Kapsam:** 2/13 — `tools/compare/src/scenarios.ts`'deki `scenarioCoverage()`.
T5 477, `IMPLEMENTATION_PLAN.md` Faz 14'ün 12 senaryosunda yoktu; ikinci bir
gerçek Aerometa üretim çıktısı olarak sonradan eklendi ve planın kapsamını
daraltmıyor, genişletiyor.

Kalan 11 senaryonun her biri Aerometa'da gerçek bir uçuş kurulmasını
gerektiriyor (yukarıdaki §1 iş akışı) — bu proje deposunun dışında bir
adım, geliştirme ile değil operasyon ekibiyle ilerler.

## 3. T5 692 — Normal Yük (SGN → ASB, 2026-08-11)

Kaynak: `LS_T5692_11082026_ED01.pdf` / `LIR_T5692_11082026_ED01.pdf` —
Aerometa'nın **gerçek bir uçuş için ürettiği** çıktı, `docs/
AHM560_GROUND_TRUTH.md` §19'a elle doğrulanmış olarak aktarıldı. "Bizim"
sütunu `@tua/wnb-core`'un `calculateWnb()` çıktısı (`packages/wnb-core/
test/fixtures/t5692.ts`, altın regresyon testiyle sabitlenmiş).

Kapsam bilinçli olarak dar tutuldu: saf toplam alanlar (kesin eşleşmesi
gereken, herhangi bir AHM revizyon sorusundan etkilenmeyen TTL/ZFW/TOW/
LDW/TAXI WEIGHT), CLAUDE.md'nin iki çözülmüş bulgusu (DOW/DOI — Bulgu #2,
UNDERLOAD BEFORE LMC — Bulgu #1) ve tek açık soru (LIZFW). MACZFW/MACTOW/
LITOW/STAB/LILAW/MACLAW şu an dahil değil — bkz. `scenarios.ts`'in üst
yorumu: bunları temiz bir eşleşme veya düzeltme olarak göstermek, `docs/
AHM560_ERRATA.md` "Kayıt 6"da belgelenmiş açık bir veriyi kapatılmış gibi
sunar.

### T5 692 — Normal yük

**Özet:** 9 alan — 5 eşleşiyor, 3 bizim düzeltmemiz, 1 araştırılacak.

| Alan | Aerometa | Bizim | Fark | Değerlendirme | Not |
|---|---|---|---|---|---|
| TOTAL TRAFFIC LOAD | 35278 | 35278 | 0 | ✅ eşleşiyor | — |
| ZFW | 146321.7 | 146321.7 | 0 | ✅ eşleşiyor | — |
| TOW | 191021.7 | 191021.7 | 0 | ✅ eşleşiyor | — |
| LDW | 154361.7 | 154361.7 | 0 | ✅ eşleşiyor | — |
| TAXI WEIGHT | 191621.7 | 191621.7 | 0 | ✅ eşleşiyor | — |
| DOW | 111720 | 111043.7 | -676.3 | 🟢 bizim düzeltmemiz (Bulgu #2) | Loadsheet DOW, AHM 560'ın crew tablosuyla uyuşmuyor, revizyon takibi yok (CLAUDE.md #2). |
| DOI | 77.74 | 78.22 | 0.48 | 🟢 bizim düzeltmemiz (Bulgu #2) | Loadsheet DOI, AHM 560'ın crew tablosuyla uyuşmuyor, revizyon takibi yok (CLAUDE.md #2). |
| UNDERLOAD BEFORE LMC | 24722 | 23678.3 | -1043.7 | 🟢 bizim düzeltmemiz (Bulgu #1) | UNDERLOAD BEFORE LMC yanlış — Aerometa DOW'u 110 000'e yuvarlıyor (CLAUDE.md #1). |
| LIZFW | 106.07 | 104.97 | -1.1 | 🟡 araştırılacak | Bottom-up AHM 560 Ed.1/Rev.0 hesabı 104,97 veriyor, basılı loadsheet 106,07 — AHM560_ERRATA.md 'Kayıt 6': formül doğrulandı (golden-t5692.test.ts Part 2), kaynak veri revizyonu araştırılıyor. Çözülmüş bir hata değil, açık bir soru. |

*(Tabloyu yeniden üretmek için: `tools/compare` içinde `scenarios.find(s => s.id === "t5692-normal-load")` ve `renderDiffReportMarkdown`.)*

### Sayısal olmayan bulgular (bu tabloya girmez)

Alan-alan karşılaştırmanın kapsamı dışında kalan, ama CLAUDE.md'nin
"Bilinen Aerometa hataları" listesinde yer alan iki madde:

| Bulgu | Aerometa | Biz |
|---|---|---|
| #5 — LILAW/MACLAW | Üretmiyor (AHM 560 zorunlu kılmasına rağmen) | Üretiyoruz — sayısal karşılaştırma yok çünkü Aerometa tarafında karşılaştırılacak bir değer yok |
| #6 — ENV PDF başlık taşması | Başlık sayfa kenarından taşıyor (görsel hata) | Düzeltildi — bir "alan" değil, layout kontrolü |

## 3b. T5 477 — MLW Sınırlı Yük (ASB → FRA, 2026-09-05)

Kaynak: `LS_T5477_05092026_ED178.pdf` / `LIR_T5477_05092026_ED178.pdf` /
`ENV_T5477_05092026_ED178.pdf`. Transkripsiyon, yöntem, sterilizasyon ve
kaynak soruları: **`docs/T5477_REFERENCE_TRANSCRIPTION.md`**. "Bizim" sütunu
`@tua/wnb-core` `calculateWnb()` çıktısı, AHM 560 **Ed.1 Rev.2** ile
(`packages/wnb-core/test/fixtures/t5477.ts`,
`test/t5477-comparison.test.ts` ile sabitlenmiş).

Bu senaryonun T5 692'nin gösteremediği iki şeyi var:

1. **Diğer tescil.** EZ-F429 üzerinde çalışıyor, yani Ed.1 Rev.2'nin ekip
   matrisi tek uçakta değil, **her iki uçakta** doğrulanmış oluyor.
2. **MLW bağlayıcı.** Gonuş ağırlığı MLW'ye 2 437 kg kaldığı için Bulgu #1'in
   etkisi burada T5 692'dekinin 13 katı.

**Özet:** 10 alan — 7 eşleşiyor, 1 bizim düzeltmemiz, 2 araştırılacak.

| Alan | Aerometa | Bizim | Fark | Değerlendirme |
|---|---|---|---|---|
| TOTAL TRAFFIC LOAD | 43841 | 43841 | 0 | ✅ eşleşiyor |
| DOW | 111293.70 | 111294 | +0.3 | ✅ eşleşiyor (AHM tablosu tam kg'a basılı) |
| DOI | 76.31 | 76.29 | −0.02 | ✅ eşleşiyor (baskı yuvarlaması) |
| ZFW | 155134.7 | 155135 | +0.3 | ✅ eşleşiyor |
| TOW | 216534.7 | 216535 | +0.3 | ✅ eşleşiyor |
| LDW | 179562.7 | 179563 | +0.3 | ✅ eşleşiyor |
| TAXI WEIGHT | 217134.7 | 217135 | +0.3 | ✅ eşleşiyor |
| **UNDERLOAD BEFORE LMC** | **16159** | **2437** | **−13722** | 🟢 **bizim düzeltmemiz (Bulgu #1)** |
| LIZFW | 100.78 | 101.46 | +0.68 | 🟡 araştırılacak (Bulgu #7) |
| MACZFW | 25.2 | 25.3 | +0.1 | 🟡 LIZFW'den türüyor |

### 🔴 Bulgu #1 bu uçuşta emniyet açısından kritik

| Limit | Hesap | Sonuç |
|---|---|---|
| MZFW | 170 000 − 155 134,7 | 14 865,3 |
| MTOW | 233 000 − 216 534,7 | 16 465,3 |
| **MLW** | **182 000 − 179 562,7** | **2 437,3** ← bağlayıcı |

Aerometa'nın bastığı `16 159` = `170 000 − 110 000 − 43 841`: yanlış limit
(MZFW), **ve** 110 000'e yuvarlanmış bir DOW. Yükleme kontrolörüne
**13 722 kg** fazladan boş kapasite gösteriliyor. T5 692'de aynı hata
1 044 kg'lıktı — oradaki bağlayıcı limit MZFW olduğu için etkisi küçüktü;
burada MLW bağlayıcı olduğu için hata büyüyor. Bu, hatanın uçuştan uçuşa
**büyüyebilir** olduğunun kanıtı.

### Bulgu #2 kapandı, Bulgu #7 daraldı

- **Bulgu #2 (DOW/DOI):** Ed.1 Rev.2 ile kapandı. T5 692 EZ-F430'da 0,3 kg,
  T5 477 EZ-F429'da 0,3 kg. Her iki tescil de doğrulandı; artık "bizim
  düzeltmemiz" değil, **eşleşme**.
- **Bulgu #7 (LIZFW):** DOI artık neredeyse tam (0,02) olduğu için farkın
  tamamı deadload indeksinde: basılı 24,47, bizde 25,17. Yakıt tarafındaki
  fark ise bu uçuşta yalnızca 0,12 (T5 692'de 0,45'ti). Kalıntının ağırlıklı
  olarak **pozisyon indeks tablosunda** olduğu, yakıt tablosunda olmadığı
  ortaya çıktı.

### Sayısal olmayan bulgular

| Bulgu | Aerometa | Biz |
|---|---|---|
| #4 — CG limit interpolasyonu | FWD ZFW 85,6 / AFT 158 / FWD TOW 72,2 / AFT TOW 171,2 | 84,74 / 158,30 / 71,46 / 172,93 — testlerde ölçülüp sabitlendi |
| #5 — LILAW/MACLAW | Basmıyor | 95,07 / 24,1 üretiyoruz |
| #6 — ENV başlık taşması | `ED NO / 178` hücresi sayfa kenarından kırpılmış — T5 692'den yedi ay sonra hâlâ aynı | Düzeltildi |

## 3c. Belge görsel doğrulaması (Aşama 7 / Aşama 8)

Brief'in açık şartı: üretilen her PDF Poppler ile PNG'ye render edilip
**her sayfası gözle** incelenecek — metin çıkarımı yeterli değil. Örnek
seti yeniden üretilebilir:

```bash
pnpm --filter @tua/documents samples /tmp/qa
cd /tmp/qa && for f in *.pdf; do pdftoppm -r 110 -png "$f" "${f%.pdf}"; done
```

`packages/documents/scripts/render-samples.ts` yedi varyant üretiyor;
hepsi **tek A4 sayfa** (`pdfinfo` ile doğrulandı) ve hepsi 2026-09-09'da
110 dpi PNG olarak gözle incelendi:

| Örnek | Neyi kanıtlıyor | Sonuç |
|---|---|---|
| `LIR` | Konfigürasyon satırları (plaka düzeni), bloke hücre gölgesi, tare/net/brutto manifestosu | ✅ tek sayfa, taşma yok, sütunlar hizalı |
| `LIR-empty-plate` | AHM revizyonunun plaka sayfası yoksa | ✅ boş ızgara yerine açık uyarı basılıyor |
| `LS` | Referansın alan sırası, ağırlık/denge blokları, LILAW/MACLAW, AHM ed/rev | ✅ tek sayfa |
| `LS-fuel-lmc-exceeded` | Tank bazlı yakıt tablosu, LMC satırları, aşılmış bölme | ✅ `EXCEEDED` hem kırmızı hem kelimeyle |
| `LS-no-watermark` | `DOCUMENTS_WATERMARK=false` yolu | ✅ filigran yok, altlık `OPERATIONAL` |
| `ENV` | Kapalı zarf konturu, veri güdümlü eksen, ızgara | ✅ hiçbir eğri kırpılmıyor |
| `ENV-out-of-envelope` | Zarf dışı noktanın uyarı bandı ve genişleyen eksen | ✅ nokta grafik içinde kalıyor |

Ölçülen bulgular:

- **Bulgu #6 taşınmadı.** Referansın `ED NO` hücresi sayfa kenarından
  kırpılıyor. Bizim başlık bandı yüzde değil **flex** ağırlıklarıyla
  kuruluyor (`packages/documents/src/shared/chrome.tsx`), yani satır
  ebeveyninden geniş olamaz — hata bir kez düzeltilmedi, yapısal olarak
  imkânsız hâle getirildi. Yedi örneğin hepsinde `ED NO` tam görünür.
- **Ekran ve PDF tek kaynaktan.** Plaka satırları `buildDeckLayout()`,
  CG zarfı eksenleri `buildEnvelopeExtent()` — ikisi de
  `packages/wnb-core`'da, hem `position-workspace.ts` (ekran) hem LIR/LS/ENV
  (PDF) aynı fonksiyonu çağırıyor. Eksen sınırları artık koda gömülü
  değil, AHM eğrilerinden türetiliyor.
- **Determinizm.** Aynı girdi → aynı sha256 (LIR/LS/ENV için ayrı testler),
  belgede hiçbir yerde üretim zaman damgası yok.
- **Filigran.** Varsayılan açık; testlerde ve arayüzde atlatılmıyor
  (CLAUDE.md kural #8). Kapalı yol yalnızca `DOCUMENTS_WATERMARK=false`
  ile ve altlıkta `OPERATIONAL` yazarak görünür hâle geliyor.
- **Yakıt dağıtımı uydurulmuyor.** Operatör tank kırılımı kaydetmemişse
  Loadsheet `PER-TANK ALLOCATION NOT AVAILABLE` basıyor ve nedenini
  yazıyor (`AHM560_ERRATA.md` Kayıt 10). Eşit bölüşüm varsayılmıyor.
- **NOTOC üretilmiyor** — tehlikeli madde veri modeli yok; sahte bir
  operasyonel NOTOC basmak kapsam dışı bırakıldı.

Sayısal hiçbir değer bu aşamada değişmedi: `pnpm --filter @tua/compare report`
çıktısı §3 ve §3b tablolarıyla birebir aynı (T5 692: 5 eşleşme / 3 bizim
düzeltmemiz / 1 araştırılacak — T5 477: 7 / 1 / 2). Belge yerleşimi
değişti, hesap değişmedi.

## 4. Sonraki adımlar

- LIZFW/MACZFW/MACTOW/LITOW/STAB alanları, `docs/AHM560_ERRATA.md`
  "Kayıt 6"nın çözümü netleşince T5 692 senaryosuna eklenir (Loadsheet
  PDF üretimi — Faz 10 — artık tamam; kalan engel yalnızca bu açık veri
  sorusu).
- Kalan 11 senaryo, operasyon ekibi Aerometa'da karşılık gelen uçuşları
  kurdukça `tools/compare/src/scenarios.ts`'e işlenir.
- T5 477'nin transkripsiyonu **tek kişi tarafından** yapıldı (aritmetik çapraz
  kontrol tuttu, ama ikinci kişi doğrulaması yapılmadı). Operasyonel
  kullanımdan önce ikinci bir okuyucu PDF'lere karşı doğrulamalı — bkz.
  `docs/T5477_REFERENCE_TRANSCRIPTION.md`.
- 12 senaryo tamamlandığında `docs/IMPLEMENTATION_PLAN.md` Bölüm D'deki
  regülasyon adımlarına (paralel çalıştırma, otorite başvurusu) geçilir.

> **Operasyonel hazırlık beyanı.** Bu dosya hiçbir aşamada operasyonel
> kullanıma uygunluk beyan etmiyor. 13 senaryonun 2'sinde referans var,
> `AHM560_ERRATA.md` Kayıt 6 (LIZFW) açık, tank bazlı yakıt ve yanal denge
> verisi eksik. **Paralel operasyonel validasyon ve havayolu/otorite
> kabulü hâlâ gereklidir**; belgeler o kabule kadar `NOT FOR OPERATIONAL
> USE` filigranıyla üretilir.
