# Validasyon Dosyası

Faz 14 kapsamı: "Bizimki Aerometa'dan daha iyi mi?" sorusuna ölçülebilir
cevap. Bu dosya, otoriteye sunulacak nihai belgenin **ilk sürümü** —
kabul kriteri en az 12 senaryoda paralel karşılaştırma gerektiriyor,
bu sürümde yalnızca 1'i dolu (bkz. §2 Senaryo Kapsamı).

Karşılaştırma motoru `tools/compare/` — kaynak kod, alan-alan
karşılaştırma mantığı ve testleri orada. Aşağıdaki tablolar o araçla
üretildi (`renderDiffReportMarkdown`), elle yazılmadı.

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

**Kapsam:** 1/12 — `tools/compare/src/scenarios.ts`'deki `scenarioCoverage()`.

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

## 4. Sonraki adımlar

- LIZFW/MACZFW/MACTOW/LITOW/STAB alanları, `docs/AHM560_ERRATA.md`
  "Kayıt 6"nın çözümü netleşince T5 692 senaryosuna eklenir (Loadsheet
  PDF üretimi — Faz 10 — artık tamam; kalan engel yalnızca bu açık veri
  sorusu).
- Kalan 11 senaryo, operasyon ekibi Aerometa'da karşılık gelen uçuşları
  kurdukça `tools/compare/src/scenarios.ts`'e işlenir.
- 12 senaryo tamamlandığında `docs/IMPLEMENTATION_PLAN.md` Bölüm D'deki
  regülasyon adımlarına (paralel çalıştırma, otorite başvurusu) geçilir.
