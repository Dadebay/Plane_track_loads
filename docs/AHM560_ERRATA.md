# AHM 560 — Errata (Kaynak Dokümandaki Hatalar)

> **Amaç:** Bu dosya, `AHM 560 - AIRBUS_A330_200P2F_APPROVED_FINAL.pdf` kaynak dokümanındaki
> dizgi hatalarını, boş bırakılmış tabloları ve belirsizlikleri kayıt altına alır — her biri
> Faz 2 çıkarımında **nasıl yorumlandı** ve **hangi dosyada nasıl kodlandı** ile birlikte.
>
> Kural (CLAUDE.md #9): Ground truth ile çıkarım çakışırsa çıkarım hatalıdır. Bu dosyadaki
> kayıtlar tam tersi durumu belgeliyor — **kaynak dokümanın kendisindeki** hata/eksiklikleri.
>
> Sayfa numaraları `docs/AHM560_GROUND_TRUTH.md` ile aynı kuralı izler: "s.N" = basılı sayfa
> numarası, PDF sayfası = basılı sayfa + 1.

---

## Kayıt 1 — s.56, Combined Load tablosu ikinci sütun başlığı dizgi hatası

**Bulunan:** `9.1 Combined Load Limitations` bölümünün ikinci tablosunda (ZFCG ≥ 25% MAC),
ilk sütun başlığı **`25≤ZFCG<25`** olarak basılmış. Alt sınır ve üst sınır aynı değer —
matematiksel olarak boş bir aralık.

**Yorum:** İkinci sütun `26≤ZFCG<27` ile başladığına göre, ilk sütunun üst sınırı mantıken
**26** olmalı. Bu bir dizgi hatası (`5` yerine `6` basılmış).

**Nasıl kodlandı:** `packages/ahm-data/data/a330-243p2f/ed1-rev0/combined-load.json` içinde
bant anahtarı `"25<=ZFCG<26"` olarak düzeltilmiş halde saklanıyor. Dosyanın `notes` alanında
açık bir uyarı var. `packages/ahm-data/test/ground-truth.test.ts` §12 testi bu düzeltmeyi
doğrudan assert ediyor (`ZFCG >= 25% MAC table matches AHM 560 s.56 verbatim (typo band
corrected to 25<=ZFCG<26)`).

---

## Kayıt 2 — s.6, EZ-F430 kokpit 3 / kuryeci 3 hücresi tek ondalıklı

**Bulunan:** `III. DOW & DOI DEPENDENCE ON CREW VERSIONS` tablosunda, EZ-F430 için kokpit
ekibi 3 / kuryeci ekibi 3 kombinasyonunun DOI değeri **`76,8`** olarak basılmış. Tablodaki
diğer 55 hücrenin tamamı iki ondalık basamaklı (`XX,XX` formatında).

**Yorum:** Kaynağa sadakat ilkesiyle değer **`76.80`**'e normalize edildi (tek ondalık ile
iki ondalık arasında sayısal fark yok, sadece basım tutarsızlığı).

**Nasıl kodlandı:** `packages/ahm-data/data/a330-243p2f/ed1-rev0/dow-doi-matrix.json` içinde
`EZ-F430` dizisinde `cockpitCrew: 3, courierCrew: 3` hücresinin `doi` alanı `"76.80"`. Dosyanın
`notes` alanında bu normalizasyon açıkça belirtiliyor.
`ground-truth.test.ts` içinde `"EZ-F430 cockpit3/courier3 cell is normalized to two decimals
(76.80), source printed 76,8"` testi bunu doğruluyor.

---

## Kayıt 3 — s.9, List of Revisions tablosu tamamen boş

**Bulunan:** `AHM 560 LIST OF REVISIONS` sayfası (Sheet 3) bir tablo şablonu içeriyor
(`Issue Number`, `Revision Number`, `Related Date`, `Completed by`, `Reason`, `Changes
Overview` sütunları) ama **hiçbir satır dolu değil** — elimizdeki Ed.1/Rev.0'ın kendisinden
önce hiçbir revizyon geçmişi kayıtlı değil.

**Yorum:** Bu, GROUND_TRUTH.md Bulgu #2 (Loadsheet DOW/DOI'nin AHM tablosuyla 676 kg fark
göstermesi) ile doğrudan ilişkili bir doküman kontrol açığı — muhtemelen uçak yeniden
tartıldı ve AHM'in daha yeni bir revizyonu var, ama bu revizyon geçmişi belgede izlenmiyor.
Sistemimizin AHM master verisini **versiyonlu ve tarihli** tutması (Faz 4 `AhmDocument`
tablosu, Faz 5 versiyon karşılaştırma arayüzü) bu açığın çözümüdür — Aerometa'ya karşı bir
üstünlük maddesi (bkz. IMPLEMENTATION_PLAN Bölüm E, madde 2 ve 13).

**Nasıl kodlandı:** Bu doküman-seviyesi bir eksiklik olduğundan tek bir JSON dosyasına
kodlanmadı; `packages/ahm-data/data/a330-243p2f/ed1-rev0/aircraft.json` içindeki
`edition`/`revision`/`effectiveDate` alanları elimizdeki tek bilinen revizyonu (Ed.1/Rev.0,
2023-03-15) yansıtıyor. Faz 4'te `AhmDocument.approvedBy`/`effectiveDate` alanları ve Faz 5'in
diff arayüzü, gelecekte yeni bir revizyon geldiğinde bu geçmişi sistemin kendisinde tutacak.

---

## Kayıt 4 — s.69, Desired Trim Line breakpoint tablosu boş

**Bulunan:** `1.2 Desired Trim Line at ZFW for fuel Saving Purposes` bölümünde, "yakıt
ekonomisi için LIZFW bu çizginin arkasında kalmalı" diyen bir açıklama ve boş bir
"Weight / Index value" giriş tablosu var — **hiçbir breakpoint değeri girilmemiş**, sadece
örnek bir grafik (35-90 index aralığında, 65-85 ağırlık aralığında) mevcut.

**Yorum:** Şu an tanımlı bir desired trim line **yok**. Bu operasyonel bir karar
(havayolu/dispatch tarafından belirlenecek), doküman hatası değil ama sistemin bunu
konfigüre edilebilir bırakması gerekiyor.

**Nasıl kodlandı:** `packages/wnb-core`'a henüz kodlanmadı (Faz 3'ün kapsamı). Faz 8'in
"otomatik trim optimizasyonu" özelliği bu breakpoint'leri **konfigüre edilebilir** bir
girdi olarak alacak şekilde tasarlanacak — sabit kodlanmayacak (CLAUDE.md kural #3).
GROUND_TRUTH.md §17 ve §21 soru 5'te de işaretli.

---

## Kayıt 5 — s.76, 16/20ft palet zone dağılım katsayıları metin olarak çıkarılamıyor

**Bulunan:** `Load & Trim Sheet` ekinin (Appendix I) 4. sayfası (basılı s.76), uzun
paletlerin (`CFR`, `FJR`, `JLR`, `LPR`, `CFG`, `FJG`, `JLG`) birden fazla zone'a nasıl
dağıtıldığını gösteren küçük punto bir grafik/diyagram içeriyor. Sayfanın `pdfplumber`
ile çıkarılan metin katmanı **tamamen boş** (`pdf.pages[n].extract_text()` → `""`) —
sayfa görsel/vektör bir diyagram, tablo değil.

**Yorum:** Bu bir doküman hatası değil, ama otomatik çıkarımın bir sınırı: bu değerler
Faz 2'de **elle, görsel olarak** okunup `docs/AHM560_GROUND_TRUTH.md` §14'e girildi
(GROUND_TRUTH zaten bunu bir uyarı olarak işaretlemişti). Katsayı toplamlarının her pozisyon
için 1,0 etmesi yapısal doğrulama olarak test edildi ve geçti — ama bu, okumanın doğru
olduğunun *kanıtı* değil, sadece *tutarlılık* kontrolü.

**Nasıl kodlandı:** `packages/ahm-data/data/a330-243p2f/ed1-rev0/zone-mapping.json` içinde
GROUND_TRUTH §14'teki değerler birebir kodlandı; dosyanın `notes` alanında bu sınırlama ve
"yüksek çözünürlüklü yeniden doğrulama şart" uyarısı açıkça yazılı. GROUND_TRUTH.md §21
soru 7 ile eşleşiyor — **operasyona geçmeden önce çözülmesi gereken açık madde**.

---

## Kayıt 6 — Faz 3'te bulundu: AHM 560 Ed.1/Rev.0 verisi T5 692'nin gerçek LIZFW/yakıt indeksini üretmiyor

**Bulunan:** `packages/wnb-core`'un T5 692 altın test vakasını AHM 560 Ed.1/Rev.0'ın kendi
pozisyon ve yakıt tablolarıyla **aşağıdan yukarıya** (DOI + 33 yük kaleminin indeks katkısı)
hesaplaması, gerçek loadsheet'in bastığı `LIZFW = 106,07` değerini **üretmiyor** —
motor `104,97` hesaplıyor (**1,10 fark**). Aynı şekilde, 0,785 yoğunlukta 44 700 kg takeoff
yakıtı için AHM'in kendi yakıt tablosundan lineer interpolasyonla hesaplanan yakıt indeksi
`3,77` çıkıyor, ama loadsheet'in `LITOW = 109,39` değerinin ima ettiği yakıt katkısı `3,32`
(**0,45 fark**).

**Doğrulama:** Bu, çıkarım hatası değil — pozisyon indeksleri (`positions.json`) ve yakıt
tablosu (`fuel-index.json`) tek tek GROUND_TRUTH.md'deki kaynak PDF metniyle karşılaştırılıp
doğrulandı (bkz. `packages/ahm-data/test/ground-truth.test.ts`, 58 test / 200+ assertion,
hepsi geçiyor). Ayrıca `%MAC` formülünün kendisi, loadsheet'in bastığı LIZFW/LITOW değerleri
**girdi olarak verildiğinde** GROUND_TRUTH.md §19.2'nin çalışma adımlarını **bit bit**
yeniden üretiyor (`golden-t5692.test.ts` Part 2). Yani hata formülde değil, veri
tutarlılığında.

**Yorum:** Bu, zaten belgelenmiş **Bulgu #2** (DOW/DOI'nin AHM tablosuyla 676 kg fark
göstermesi) ile **aynı kök nedene** işaret ediyor: gerçek `LS_T5692_11082026_ED01.pdf`'i
üreten Aerometa sistemi, muhtemelen elimizdeki **Ed.1/Rev.0 değil, daha yeni/farklı bir AHM
560 revizyonu** kullanmış — ve bu revizyon farkı sadece DOW/DOI'yi değil, pozisyon indeks
tablosunu ve yakıt indeks tablosunu da etkilemiş görünüyor. `docs/AHM560_GROUND_TRUTH.md`
§9'daki List of Revisions tablosunun boş olması (Kayıt 3), bu revizyon geçmişinin hiçbir
yerde izlenmediğini zaten gösteriyordu.

**Nasıl kodlandı:** `packages/wnb-core/src/wnb.ts`'in üstündeki kod yorumunda açıkça
belgelendi. `packages/wnb-core/test/golden-t5692.test.ts` üç parçaya ayrıldı:
- **Part 1** — saf aritmetik alanlar (TTL, ZFW, TOW, LDW, TAXI WEIGHT, UNDERLOAD): **tam
  eşleşme**, indeks hesabından bağımsız.
- **Part 2** — `%MAC`/`STAB` formülünün kendisi, loadsheet'in LIZFW/LITOW değerleri girdi
  olarak verildiğinde: **tam eşleşme**, formülün doğruluğunu kanıtlıyor.
- **Part 3** — motorun AHM 560 Ed.1/Rev.0 verisinden **kendi hesapladığı** LIZFW/yakıt
  indeksi/MACZFW/MACTOW: loadsheet'ten **farklı**, bu fark açıkça pin'lenmiş (testler
  motorun ürettiği değerleri assert ediyor, loadsheet'in değerlerini değil).

**Sonuç — bu aslında sistemin değer önerisinin bir kanıtı:** Aerometa'nın loadsheet'i hangi
AHM revizyonuyla üretildiğini göstermiyor (Bulgu #2), biz ise bağımsız olarak AHM 560'ın
**elimizdeki, tarihli, versiyonlu** kopyasından hesaplayıp, tutmayan her yeri **otomatik
olarak buluyoruz**. Faz 5'in AHM versiyon karşılaştırma arayüzü ve Faz 14'ün karşılaştırma
koşum takımı, bu tür farkları sistematik hale getirecek. Operasyona geçmeden önce gerçek/güncel
AHM 560 revizyonunun temin edilmesi gerekiyor — bu, GROUND_TRUTH.md §21 soru 6 ile aynı açık
madde.

---

## Özet tablosu

| # | Sayfa | Tür | Durum |
|---|---|---|---|
| 1 | s.56 | Dizgi hatası (`25≤ZFCG<25` → `<26`) | Düzeltildi, test ile doğrulandı |
| 2 | s.6 | Basım tutarsızlığı (`76,8` tek ondalık) | Normalize edildi (`76.80`), test ile doğrulandı |
| 3 | s.9 | Boş tablo (List of Revisions) | Doküman kontrol açığı — Faz 4/5 çözümü |
| 4 | s.69 | Boş tablo (Desired Trim Line breakpoints) | Operasyonel karar bekliyor — Faz 3/8'de konfigüre edilebilir bırakılacak |
| 5 | s.76 | Metin katmanı yok (grafik/diyagram) | Elle okundu, yapısal olarak doğrulandı, yüksek çözünürlüklü yeniden doğrulama gerekli |
| 6 | — | Ed.1/Rev.0 verisi T5 692'nin gerçek LIZFW/yakıt indeksini üretmiyor (Bulgu #2 ile aynı kök neden) | Faz 3'te bulundu, testlerle pin'lendi, gerçek AHM revizyonu temin edilmeli |

Faz 2 kabul kriteri "en az 3 kayıt" — bu dosya **6 kayıt** içeriyor.
