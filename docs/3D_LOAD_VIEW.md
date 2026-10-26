# 3D yük görünümü

Yükleme planının pozisyonlar sekmesindeki **2D / 3D** düğmeleri görünümü değiştirir.
Varsayılan mevcut 2D plandır; Three.js yalnızca 3D seçildiğinde yüklenir.

- Eklenen yük, ana veya alt güvertedeki pozisyonunda görünür. Yeni yükler kısa bir
  yerleştirme hareketiyle gelir; kayıtlı yükler doğrudan yerlerinde açılır.
- Yük üzerindeki etikette pozisyon ve brüt ağırlık; panelde güverte toplamı ve
  bütün planın brüt yük toplamı gösterilir. Birimi kg'dır.
- Yüke veya boş pozisyona tıklanabilir; klavye ile pozisyon seçimi de vardır.
  Ekleme, düzenleme ve silme mevcut pozisyon formunu ve taslak verisini kullanır.
- Ana/alt güverte, konfigürasyon, kesit/kapalı gövde, etiketler, üstten görünüm,
  döndürme, yakınlaştırma ve seçilen yüke odaklanma desteklenir.
- Kesinleşmiş planlar salt okunur kalır. Çakışan pozisyonlar mevcut 2D çalışma
  alanındaki kurallarla engellenir. Başka konfigürasyonda yüklenmiş yükler gizlenmez.

## Veri ve model sınırı

Ağırlıklar planın gerçek taslak verisinden, pozisyon ayak izleri mevcut
`buildPositionFootprints` hesabından gelir. Ağırlık toplamları Decimal kullanır.
Mevcut W&B, CG, limit ve belge hesaplarında değişiklik yoktur.

Uçak gövdesi ve kutu yüksekliği görsel temsil içindir; fiziksel boşluk veya yükün
paket ölçüsü doğrulaması yapmaz. AHM'de ayak izi bulunmayan dökme yüklerin geometrisi
varsayımsaldır ve seçim panelinde belirtilir. Varyantı çözülemeyen eski kayıtlar
uyarıyla gösterilir; toplam ağırlıktan çıkarılmaz.

WebGL kullanılamıyorsa 2D'ye dönüş düğmesi görünür. Hareket azaltma tercihi
uygulanır. Görünüm boşta, ekran dışında veya kapalıyken sürekli render döngüsü
çalışmaz; 2D'ye geçişte WebGL kaynakları temizlenir.

## Uçak modelinin görsel referansları

Model, A330-200P2F biçimine göre yerel olarak üretilir: kıvrımlı burun/gövde,
profilli ve yukarı eğimli kanatlar, kanat ucu kanatçıkları, motor girişleri ve
fanlar, dört tekerli ana iniş takımları, kargo kapıları ve gövde yazıları.
Gövde/kanat/motor detayları statik geometri olarak birleştirilir. Görsel model
çalışırken uzaktan model veya görsel dosyası yüklenmez. Havayolunun resmî
şahin amblemi yerel vektör verisi olarak paketlenir; kuyruk ve burun yüzeyine uygulanır.

- [Airbus A330-200 boyutları](https://www.aircraft.airbus.com/en/aircraft/a330/a330-200)
- [A330 kokpit/burun fotoğrafı — Delta News Hub](https://news.delta.com/media/image/47736)
- [Turkmenistan Airlines resmî logo kaynağı](https://turkmenistanairlines.com/icons.svg) (`logo` sembolü, 26.10.2026)
- [EFW A330P2F dönüşüm referansı](https://www.elbeflugzeugwerke.com/en/solutions/freighter-conversion/a330p2f/)

Bu referanslar dış görünüm içindir. Gövde biçimi, kapılar ve iç donanım
birebir üretici CAD modeli değildir; yükleme hesaplarının girdisi değildir.
