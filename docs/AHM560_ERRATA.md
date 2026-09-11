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

## Kayıt 7 — AHM 560 Ed.1 **Rev.2** (10.06.2025) temin edildi: Kayıt 6 / Bulgu #2'nin DOW/DOI ayağı kapandı

**Bulunan:** Operasyondan gelen fotoğrafta AHM 560'ın **Edition 1, Revision 2** damgalı
s.6 sayfası (`Valid from 10.06.2025`) var — Kayıt 3'ün "revizyon geçmişi izlenmiyor"
tespitinin somut kanıtı: bir Rev.1 ve bir Rev.2 çıkmış, elimizdeki Rev.0'ın s.9 List of
Revisions tablosunda ikisi de görünmüyor.

Rev.2'nin DOW/DOI matrisi, Bulgu #2'deki 676 kg'lık farkı kapatıyor:

| Kaynak | EZ-F430, ekip 2/3 | DOW | DOI |
|---|---|---|---|
| `LS_T5692_11082026_ED01.pdf` (gerçek loadsheet) | | 111 043,70 | 78,22 |
| AHM 560 Ed.1 **Rev.0** s.6 | | 111 720 | 77,74 |
| AHM 560 Ed.1 **Rev.2** s.6 | | **111 044** | **78,19** |

Kalan 0,30 kg, loadsheet'in ondalıklı bir boş uçak ağırlığı taşıması, AHM tablosunun ise
tam kg'a basılmış olmasıdır.

**Doğrulama:** Üç bağımsız kontrol:
1. **Tablo içi tutarlılık** — s.6'nın Remark'ı "kokpit ekipajı bagajıyla 100 kg, kuryeci
   80 kg" diyor. Transkribe edilen 56 DOW hücresinin **tamamı** bu adımlarla tutarlı
   (`packages/ahm-data/test/ed1-rev2.test.ts`, "steps DOW by 80 kg per courier and 100 kg
   per cockpit occupant").
2. **Operatörün elle tuttuğu Excel** (`AIRBUS TAZE SENTR.xlsx`) `U24` hücresinde EZ-F430
   ekip 3/4 için `111224` taşıyor — Rev.2'nin 3/4 hücresiyle birebir aynı, Rev.0'ın
   (111 900) değil.
3. **Gerçek loadsheet** — yukarıdaki tablo.

**Nasıl kodlandı:** `packages/ahm-data/data/a330-243p2f/ed1-rev2/`. Sadece elimizde
fotoğrafı olan sayfa (s.6 → `dow-doi-matrix.json`) Rev.2'den transkribe edildi; diğer tüm
dosyalar Rev.0'dan **değiştirilmeden devralındı** ve bu devralma
`ed1-rev2/PROVENANCE.md`'de dosya dosya işaretlendi. Bir AHM revizyonu sadece değişen
sayfaları yeniden yayımlar — devralınmış bir dosya "o sayfa değişmedi" kanıtı **değildir**,
sadece "o sayfayı henüz görmedik" demektir.

**Kayıt 6 hâlâ açık:** Rev.2'nin DOI'si (78,19) Rev.0'ınkinden 0,45 daha yüksek, ama
Kayıt 6'daki LIZFW farkı 1,10 indeks birimiydi. Yani `positions.json`'ın ve
`fuel-index.json`'ın Rev.2 sayfaları da büyük olasılıkla değişmiş. **Hâlâ gereken
Rev.2 sayfaları:** boş ağırlık (BEW), yükleme indeks tablosu, standart yakıt indeks
tablosu, CG limit tabloları.

---

## Kayıt 8 — Cargo Loading Index Table kodlandı ve AHM pozisyon verisiyle doğrulandı

**Bulunan:** Operatörün laminatlı `CARGO LOADING INDEX TABLE` kartının tam ızgarası
temin edildi (`Cargo_Loading_Index_Table.xlsx`, 2026-09-09): 28 ağırlık aralığı × 17
zone = 293 dolu hücre + `MAX` satırı.

Kart, sistemin zaten tam olarak hesapladığı büyüklüğün **elle okunabilir, kabalaştırılmış
hâli**: her hücre, 500 kg'lık bir aralık için tam sayıya yuvarlanmış indeks birimi. Kartın
sütun eğimleri, `positions.json`'daki ana güverte `indexPerKg` değerleriyle **%20 içinde**
örtüşüyor (17 sütunun 13'ü %10 içinde):

| Zone | Kart eğimi | AHM index/kg | Oran |
|---|---|---|---|
| A | −0,00682 | −0,00696 | 0,98 |
| D | −0,00423 | −0,00424 | 1,00 |
| H | −0,00051 | −0,00063 | 0,81 |
| T | +0,00686 | +0,00693 | 0,99 |
| U | +0,00800 | +0,00792 | 1,01 |

Gevşek kalan dört sütun (F, H, J, K), indeks birimlerinin tüm kolon boyunca yalnızca
0, 1 veya 2 olduğu **nötre yakın** bölmeler — orada uyumsuzluk değil, tam sayıya
yuvarlama baskın.

**Ara düzeltme:** Bu kaydın ilk hâli, kartın "farklı bir büyüklük" ölçtüğünü iddia
ediyordu. O sonuç, `MAX` satırının elle iletilen ilk kopyasındaki bir yazım hatasına
(`H = −14`, doğrusu `H = −4`) dayanıyordu; −14, H bölmesi için 22 222 kg gibi imkânsız
bir yük ima ediyordu. Excel'den gelen doğru değerle böyle bir tutarsızlık yok — kart
ile hesap **aynı** büyüklüğü ölçüyor.

**Nasıl kodlandı:** `packages/ahm-data/data/a330-243p2f/ed1-rev2/cargo-index-table.json`
(şema opsiyonel — kartı olmayan bir revizyon da yüklenir).
`packages/wnb-core/src/cargo-index-table.ts` kartı okuyor
(`lookupCargoIndex`) ve yüklü her zone için tam hesapla karşılaştırıyor
(`crossCheckCargoIndexCard`). Tolerans elle ayarlanmış bir sayı değil, üç etkiden
türetiliyor: aralık yarı genişliği × |index/kg|, tam sayı yuvarlaması (1 birim) ve
sütun eğimi payı (%20 × |index/kg| × ağırlık). Kartın tüm ızgarasında en geniş gerçek
fark bu bütçenin **%79'unu** kullanıyor — yani sınırı aşan bir fark gerçek bir
uyuşmazlıktır: kart ile `positions.json` farklı AHM revizyonlarını anlatıyordur ya da
biri yanlış transkribe edilmiştir.

`packages/wnb-core/test/position-index.test.ts` bunu dört testle sabitliyor: ızgaranın
tamlığı, sütun eğimi ↔ index/kg ilişkisi, her hücrenin kendi toleransı içinde kalması ve
`MAX` satırının ima ettiği yükün son basılı aralığın yakınında olması.

**Onaylı kaynağa karşı doğrulandı (2026-09-09).** Laminatlı kartın üzerinde damga yoktu,
ama aynı tablo **onaylı AHM 560 PDF'inin Appendix I, s.74'ünde** (LOAD AND TRIM SHEET
plakası, "Valid for MSNs 0810 and 0815") basılı. PDF 600 dpi'da render edilip tablo hücre
hücre karşılaştırıldı: 28 aralığın tamamı, gri bırakılmış her hücre ve `MAX` satırı
**birebir tutuyor**. Yani operatörün Excel'i onaylı belgenin sadık bir kopyası ve
`cargo-index-table.json` artık laminatlı bir karta değil, **onaylı kaynağa** dayanıyor.

Plaka `Edition 1 / Revision 0` damgalı olduğu için dosya `ed1-rev0/`'a kondu ve diğer
değişmemiş sayfalar gibi `ed1-rev2/`'ye devredildi.

**Yan bulgu:** Kullanıcının 2026-09-09'da elle ilettiği `MAX` satırında `H = −14` yazıyordu;
hem Excel hem onaylı PDF `H = −4` diyor. Bu kaydın ilk hâlindeki "kart farklı bir büyüklük
ölçüyor" sonucu tamamen o yazım hatasından kaynaklanmıştı.

---

## Kayıt 9 — Appendix I plakası s.74 kodlandı: LMC, H-arm, yanal denge ve pozisyon satırları

**Tarih:** 2026-09-09 · **Aşama:** Opus T5 477 parite brief'i, Aşama 2

Onaylı AHM 560 PDF'inin **PDF s.75 / basılı Appendix I s.74** sayfası (LOAD AND TRIM
SHEET plakası sayfa 2, `Ed.1 Rev.0`, `Effective Date 15.03.2023`, "Valid for MSNs 0810
and 0815") dört yeni tablo taşıyor. Hepsi kodlandı:

| Tablo | Dosya |
|---|---|
| `LMC INDEX TABLE` | `lmc-index-table.json` |
| `LOADING ZONES H-arm TABLE` | `loading-zones-harm.json` |
| `LATERAL IMBALANCE CAUTION` | `lateral-imbalance.json` |
| Main/lower deck pozisyon ve ULD diyagramı | `position-configurations.json` |

### Doğrulama yöntemi — ikinci okuma değil, bağımsız veri

Sayfa gömülü bir JPEG (1199×887 piksel, ~185 ppi). Aynı rasterı ikinci kez okumak aynı
hatayı tekrarlar; bu yüzden her tablo **depoda zaten bulunan ve bu plakadan gelmeyen**
veriye karşı sınandı. Kaynak: `positions.json`, AHM'in kendi yükleme indeksi
sayfalarından transkribe edilmişti.

`index-formula.json`'a göre `indexPerKg = (arm − refSta) / C` olduğundan her pozisyonun
kolu geri hesaplanabiliyor. Sonuçlar:

- **`LMC INDEX TABLE`:** 17 bölgenin **17'si de** `positions.json`'daki 88×125 tek sıra
  `indexPerKg × 100` değerinin bir ondalığa yuvarlanmışına **birebir** eşit. F ve G'nin
  ikisinin de `−0,2` basması transkripsiyon hatası değil: −0,243 ve −0,153 aynı ondalığa
  yuvarlanıyor.
- **`LOADING ZONES H-arm TABLE`:** Tablo kendi içinde kapalı — her bölgenin arka H-arm'ı
  bir sonrakinin ön H-arm'ına eşit (17 bölge, 16 sınır, 16/16 tuttu). Bölge orta noktası
  A…P için `positions.json`'ın `indexPerKg`'sini **5 ondalığa kadar** üretiyor. R…U'da
  gövde daraldığı için bölge paletten geniş; sapma orada beklenen yönde ve büyüklükte.
- **Pozisyon satırları:** Plakadaki her max load değeri `positions.json` ile karşılaştırıldı.
  119 pozisyonun tamamı tuttu; eksik ya da fazla pozisyon yok. Ayrıca operatörün laminatlı
  kartının 2026-09-09 fotoğrafı **üçüncü bağımsız kaynak** olarak aynı ızgarayı veriyor.
- **Alt güverte geometrisi:** `{12P,13P}` çiftinin ayak izi `{12,13,14}` konteynerlerinin
  ayak izini **birebir** kaplıyor (16,438 m → 21,123 m); aynısı `{21P,22P}`/`{21,22,23}`,
  `{31P,32P}`/`{31,32,33}` ve `{41P,42P}`/`{41,42,43}` için. **`11P` ve `43P`'nin neden
  var olmadığı böylece açıklandı:** 11 numaralı konteynerin üstünde palet pozisyonu yok.
  Aşama 1'in "alt güverte yarım konteynerleri eksik" boşluğu da kapandı — plaka satırı
  `60.4"×61.5"` **veya** `60.4"×125"` diyor: her numaralı pozisyon ya bir tam boy ünite
  (3 174 kg) ya da iki yarım boy ünite (`L`/`R`, her biri 1 587 kg) alıyor. LIR'ın
  `11R/11L … 43R/43L` yazması bu.

### Ara düzeltme — JLR

İlk okumada 16 ft palet satırında `JLR = 10 658` yazılmıştı; `positions.json` `10 668`
diyor. Fotoğraf yüksek çözünürlükte yeniden kırpıldı: doğrusu **`10 668`**, FJR ile aynı.
Testin yakaladığı tek gerçek uyuşmazlık buydu ve transkripsiyon tarafında çıktı.
16 ft ve 20 ft palet satırları **onaylı plakada basılı değil** — yalnızca operatörün
laminatlı kartında var; dosya bunu açıkça not ediyor.

### Yanal denge — çözülen ve çözülmeyen

`LATERAL IMBALANCE CAUTION (FOR SIDE-BY-SIDE PALLETS ONLY)` tablosunun **yük yarısı**
tamamen okundu: `MAIN SBS 88" = 1,13 m`, `MAIN SBS 96" = 1,23 m`, `LOWER LD3 = 0,81 m`
Y-kolları; limit `±34 000 kg.m`; operasyonel marj `11 554 kg.m`. Basılı işaret kuralı:
*"SIGN OF OPERATIONAL MARGIN IS IDENTICAL TO SIGN OF TOTAL IMBALANCE WITHOUT OPERATIONAL
MARGIN"* — yani marj sonucu her zaman kötüleştirir, asla iyileştirmez.

**Yakıt yarısı çözülmedi** (bkz. Kayıt 10). Tablonun `OUTER TANKS` / `INNER TANKS`
satırları s.75'teki `FUEL LATERAL MOMENT PER TANK TABLE`'a atıf yapıyor ve o tablo
okunamadı. Bu yüzden `lateral-imbalance.json` `fuel.status = "SOURCE_NOT_TRANSCRIBED"`
taşıyor ve `checkLateralImbalance()` `NOT_AVAILABLE` kalmak zorunda. Bir test bunu
kilitliyor: durum değişmeden kontrol açılamaz.

### Nasıl kodlandı

Plaka `Ed.1 Rev.0` damgalı olduğu için dosyalar `ed1-rev0/`'a kondu ve Kayıt 8'deki
`cargo-index-table.json` gibi `ed1-rev2/`'ye değişmeden devredildi. Beşi de şemada
**opsiyonel**: plakasını tutmadığımız bir revizyon yine yüklenir.
`packages/ahm-data/test/appendix-i-plate.test.ts` 23 test ile sabitliyor.

---

## Kayıt 10 — s.75'teki iki yakıt tablosu bu taramadan güvenilir okunamıyor

**Tarih:** 2026-09-09 · **Aşama:** Opus T5 477 parite brief'i, Aşama 2

Plakanın **PDF s.76 / basılı Appendix I s.75** sayfası (LOAD AND TRIM SHEET sayfa 3) beş
tablo taşıyor. İkisi zaten kodlu (`STANDARD FUEL INDEX TABLE` → `fuel-index.json`), ikisi
**boş form** (`FUEL LATERAL MOMENT TABLE`, `MANUAL FUEL INDEX TABLE` — Kayıt 4'teki
Desired Trim Line gibi elle doldurulacak çalışma tabloları, veri değil). Kalan ikisi:

| Tablo | Durum |
|---|---|
| `FUEL INDEX PER TANK TABLE` | ⚠️ **provisional** olarak kodlandı |
| `FUEL LATERAL MOMENT PER TANK TABLE` | ❌ **kodlanmadı** |

### Kısıt

Sayfanın gömülü rasterı 1189×843 piksel (~174–183 ppi). Bu, kaynağın taşıdığı bilginin
tavanı — daha yüksek DPI'da render almak yalnızca büyütür, bilgi eklemez. Bu boyutta
**`6`/`8` ve `0`/`3` glifleri ayrılamıyor.**

Bunu bir tercih değil, ölçülmüş bir sonuç yapan kanıt: `FUEL LATERAL MOMENT PER TANK
TABLE`'ın `0.800` sütununda 26 250 kg → `153,3`, 26 750 kg → `158,8` okundu; aradaki
26 500 kg hücresi `156,6` gibi görünüyor. Ama bir önceki ve bir sonraki farklar 2,5 ve
2,2 iken bu 3,3/2,2 veriyor — kolonun kendi adımıyla çelişiyor. Doğrusu `156,0` ya da
`156,1` olmalı; yani en az bir hücre yanlış okundu ve **hangisi olduğu görüntüden
belirlenemiyor**. Aynı belirsizlik ~150 hücrelik ızgaranın her yerinde var.

CLAUDE.md kural #3 ve brief'in *"Stop and ask for authoritative input when a
safety-critical constant cannot be proven from the approved source"* şartı gereği bu
tablodan **hiçbir değer uydurulmadı ve hiçbir değer kodlanmadı.**

### `FUEL INDEX PER TANK TABLE` neden yine de kodlandı

Bu tablonun hücreleri bir–iki basamaklı **tam sayılar** ve kolonları güçlü bir yapıya
sahip. Kodlandı ama `provisional: true` bayrağı ve şüpheli hücrelerin açık listesiyle:

- `INNER` FULL satırı `0.760`'ta `−14`, oysa 31 000 kg satırı `−16` ve tank o yoğunlukta
  32 000 kg'ın altında doluyor — 1 000 kg'dan azda iki indeks birimi, kolonun kendi
  adımına aykırı.
- `TRIM` 3 400 kg satırı `+36` okundu; komşu 3 600 kg satırı aynı glif şekliyle `+38`
  okundu. Tam da ayrılamayan `6`/`8` durumu.
- `TRIM` 5 200 kg ve `TRIM` FULL `0.840` `+56` okundu; `+55` dışlanamıyor.
- `CENTER` 26 000 kg, yoğunlukların ilk ayrıştığı satır (`−34 / −33 / −33`).

Geçen yapısal kontroller: her kolonun sabit ağırlık adımı, yoğunluk arttıkça kapasitenin
artması (`0.760 ≤ 0.800 ≤ 0.840`), ve kolon işaretlerinin tutarlılığı (INNER ve CENTER
burun aşağı, OUTER ve TRIM kuyruk aşağı). Bunlar tek basamaklık bir yanlış okumayı
**elemiyor**.

### Kapanması için gereken

**Okunabilir bir `LOAD AND TRIM SHEET` sayfa 3 kopyası** — tercihen operatörün laminatlı
kartının fotoğrafı. Kullanıcı `STANDARD FUEL INDEX TABLE` ve `CARGO LOADING INDEX TABLE`
kartlarının fotoğraflarını 2026-09-09'da zaten sağladı; aynı desteden bu kartın fotoğrafı
her iki tabloyu da tek seferde kapatır. O gelene kadar:

- `fuel-tank-index.json` `provisional: true` kalır ve hiçbir hesaba bağlanmaz,
- `lateral-imbalance.json` `fuel.status = "SOURCE_NOT_TRANSCRIBED"` kalır,
- `checkLateralImbalance()` `NOT_AVAILABLE` döner,
- tank bazlı yakıt dağıtımı (Boşluk #4) uygulanamaz.

Üç test bu kapıları kilitliyor; bayrak çevrilmeden geçilemez.

---

## Kayıt 11 — `aircraft.json`'ın BEW'i Rev.2 DOW/DOI matrisiyle çelişiyor

**Tarih:** 2026-09-10 · **Aşama:** T5 477 parite brief'i, arayüz çalışması sırasında

Rev.2 DOW/DOI sayfasının altındaki basılı not matrisi **ayrıştırılabilir** kılıyor:
*"Cockpit crew weight including baggage weight is 100 kg. Courier crew weight including
baggage weight is 80 kg."* Bir hücreden mürettebatı çıkarınca geriye uçağın boş ağırlığı
artı her hücreye gömülü sabit kalemler (evrak/kurye istifi, içme suyu, atık tankı) kalır.

Bu aritmetik yapıldığında matris **kendi içinde kusursuz** çıkıyor:

- Her satır ve sütunda adım tam olarak 100 kg / 80 kg (2 tescil × 4 kokpit × 7 kurye).
- 28 hücrenin **hepsi** aynı mürettebatsız kalıntıyı veriyor — yani matris tek bir
  tartıma dayanıyor.

Ama o kalıntı `aircraft.json`'daki BEW ile uyuşmuyor:

| Tescil | Matrisin ima ettiği temel ağırlık | `aircraft.json` BEW | Fark |
|---|---|---|---|
| EZ-F429 | 110 854 | 111 072,5 | **218,5 kg** |
| EZ-F430 | 110 604 | 111 233,5 | **629,5 kg** |

Fark sabit kalemlerle açıklanamaz: referans operatörün kendi ekranı bu kalemleri
(evrak istifi 8,7 + kurye istifi 20 + içme suyu 18 + atık tankı 10) toplam **56,7 kg**
olarak gösteriyor. 629,5 kg başka bir şey — uçak yeniden tartılmış.

**Çapraz doğrulama.** Referans ekran EZ-F429 için BEW **110 797** ve sabit kalemler
56,7 kg gösteriyor: 110 797 + 56,7 = **110 853,7 ≈ 110 854** — bizim matrisimizin ima
ettiği değerin **birebir aynısı**. Yani Rev.2 matrisi yeniden tartılmış uçağa dayanıyor,
`aircraft.json` ise hâlâ Ed.1 Rev.0'ın tartımını taşıyor. `ed1-rev2/PROVENANCE.md`
bunu zaten "muhtemelen bayat" diye işaretlemişti; bu kayıt onu **ölçüyor**.

### Emniyet etkisi: şu an yok, ama kırılgan

Canlı hesap yolunda BEW **kullanılmıyor** — `calculateWnb` doğrudan matrisin DOW/DOI'sini
alıyor (`getDowDoi`), `aircraft.json`'ın BEW'ine hiç dokunulmuyor. Yani bugün yanlış bir
loadsheet üretilmiyor. Ancak biri DOW'u bileşenlerden kurmaya kalkarsa EZ-F430'da
**629,5 kg** hata doğar — ZFW, TOW ve underload'un hepsini kaydırır.

### Nasıl sabitlendi

`packages/ahm-data/test/dow-composition.test.ts` (5 test):

1. Matrisin 100/80 kg adımları — her satır ve sütunda.
2. 28 hücrenin tek bir temel ağırlık ima etmesi.
3. Ölçülen farkın **tam değeri** (218,5 / 629,5) — Rev.2 temel ağırlık sayfası gelip
   düzeltildiğinde bu test yüksek sesle kırılır.
4. Farkın sabit kalemlerle açıklanamayacak kadar büyük olması.
5. DOW'un BEW'e eşit olmaması — bileşenlerden DOW kurma kararı buradan geçmek zorunda.

`@tua/ahm-data` bilerek `decimal.js`'e bağlı değil; testler onda birlik tam sayı
aritmetiği kullanıyor (her AHM ağırlığı en fazla bir ondalıklı, dolayısıyla kesin).

### Kapanması için gereken

**AHM 560 Ed.1 Rev.2'nin temel ağırlık (Basic Weight) sayfası.** `ed1-rev2/PROVENANCE.md`
bunu zaten "Open — pages still needed" listesinde tutuyor; bu kayıt onun neden acil
olduğunu ölçüyor.

---

## Özet tablosu

| # | Sayfa | Tür | Durum |
|---|---|---|---|
| 1 | s.56 | Dizgi hatası (`25≤ZFCG<25` → `<26`) | Düzeltildi, test ile doğrulandı |
| 2 | s.6 | Basım tutarsızlığı (`76,8` tek ondalık) | Normalize edildi (`76.80`), test ile doğrulandı |
| 3 | s.9 | Boş tablo (List of Revisions) | Doküman kontrol açığı — Faz 4/5 çözümü |
| 4 | s.69 | Boş tablo (Desired Trim Line breakpoints) | Operasyonel karar bekliyor — Faz 3/8'de konfigüre edilebilir bırakılacak |
| 5 | s.76 | Metin katmanı yok (grafik/diyagram) | Elle okundu, yapısal olarak doğrulandı, yüksek çözünürlüklü yeniden doğrulama gerekli |
| 6 | — | Ed.1/Rev.0 verisi T5 692'nin gerçek LIZFW/yakıt indeksini üretmiyor (Bulgu #2 ile aynı kök neden) | Kısmen çözüldü (Kayıt 7) — DOW/DOI ayağı kapandı, LIZFW/yakıt ayağı hâlâ açık |
| 7 | s.6 (Rev.2) | Ed.1 Rev.2 temin edildi, DOW/DOI Bulgu #2'yi kapatıyor | `ed1-rev2/` olarak kodlandı ve aktif edildi; kalan Rev.2 sayfaları bekleniyor |
| 8 | Cargo Loading Index Table | Kartın tam ızgarası kodlandı, AHM pozisyon verisiyle örtüşüyor | `ed1-rev2/cargo-index-table.json`; canlı çapraz kontrol ekranda, 4 test ile sabitlendi |
| 9 | Appendix I s.74 | LMC, H-arm, yanal denge (yük yarısı) ve pozisyon satırları kodlandı | Bağımsız veriye karşı doğrulandı; 23 test. Yanal dengenin yakıt yarısı Kayıt 10'a bağlı |
| 10 | Appendix I s.75 | Tarama çözünürlüğü iki yakıt tablosunu okunamaz kılıyor | `fuel-tank-index.json` provisional; `FUEL LATERAL MOMENT PER TANK TABLE` kodlanmadı — okunabilir kaynak bekleniyor |
| 11 | s.6 (Rev.2) ↔ aircraft.json | `aircraft.json` BEW'i Rev.2 matrisiyle çelişiyor (EZ-F429 218,5 kg · EZ-F430 **629,5 kg**) | Canlı hesap etkilenmiyor (DOW matristen geliyor); 5 test ile ölçülüp sabitlendi — Rev.2 temel ağırlık sayfası bekleniyor |

Faz 2 kabul kriteri "en az 3 kayıt" — bu dosya **11 kayıt** içeriyor.
