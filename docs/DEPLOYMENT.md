# Dağıtım Rehberi

Faz 15 kapsamı: Docker imajı, üretim compose dosyası, otomatik yedekleme,
sağlık kontrolü uç noktaları, yapılandırılmış loglama.

## Aşamalar

| Aşama | Platform | Maliyet | Compose dosyası |
|---|---|---|---|
| Geliştirme | Yerel Docker | 0 | `compose.yaml` |
| Pilot | Hetzner CX22 VPS + Docker | ~4 €/ay | `compose.prod.yaml` |
| Üretim | Kurum içi / özel bulut | — | `compose.prod.yaml` (uyarlanmış) |

Vercel Hobby ticari kullanıma kapalı (ToS), bu yüzden Faz 0'dan beri
konteynerize geliştiriyoruz — platform bağımsız kalır.

## Geliştirme

```bash
docker compose up
```

`compose.yaml` sabit dev şifreleriyle gelir, yalnızca yerel kullanım içindir.

## Pilot / Üretim

1. VPS'e Docker + Docker Compose kurun.
2. Repoyu klonlayın, `.env` dosyası oluşturun (repoya **eklenmez**):

   ```bash
   POSTGRES_PASSWORD=<güçlü-şifre>
   AUTH_SECRET=<openssl rand -base64 32>
   DOMAIN=tua.example.com
   DOCUMENTS_WATERMARK=false
   ```

3. DNS'te `DOMAIN` A kaydını VPS IP'sine yönlendirin (Caddy'nin Let's
   Encrypt doğrulaması için 80/443 portlarına erişim gerekir).
4. Başlatın:

   ```bash
   docker compose -f compose.prod.yaml up -d --build
   ```

5. İlk kurulumda migration'ları çalıştırın. `web` servisinin çalışma zamanı
   imajı Next.js'in budanmış `standalone` çıktısı — içinde ne prisma CLI'si
   ne de `prisma/migrations/` dizini var, bu yüzden migration'lar tam
   toolchain'e sahip ayrı bir `migrate` servisinden (aynı Dockerfile,
   `migrator` build target'ı) çalıştırılır:

   ```bash
   docker compose -f compose.prod.yaml run --rm migrate
   ```

6. Boş bir veritabanına ilk kullanıcıları ve AHM verisini yükleyin.
   `migrate` servisi tam toolchain'e sahip olduğu için seed'i de o çalıştırır:

   ```bash
   docker compose -f compose.prod.yaml run --rm migrate pnpm --filter @tua/db seed
   ```

   Seed, `packages/db/prisma/seed.ts`'deki geliştirme parolasıyla kullanıcı
   açar. **Üretimde ilk işiniz** o parolaları değiştirmek olmalı — seed'i
   yalnızca boş bir veritabanında çalıştırın, mevcut veriye asla.

7. Güncelleme (kod değiştiğinde):

   ```bash
   git pull
   docker compose -f compose.prod.yaml up -d --build
   docker compose -f compose.prod.yaml run --rm migrate
   ```

## Domainsiz pilot test (paylaşımlı sunucu, sadece IP)

80/443 portları başka sitelerle dolu bir sunucuda, domain olmadan sadece IP
üzerinden hızlı bir deneme yapmak için `compose.pilot-test.yaml` kullanın —
Caddy yok (Let's Encrypt domain gerektirir, çıplak IP'ye sertifika
verilemez), `web` doğrudan seçtiğiniz bir host portuna (`WEB_PORT`,
varsayılan 8080) bağlanır, `postgres` yine yalnızca compose ağında kalır:

```bash
# .env: POSTGRES_PASSWORD, AUTH_SECRET, HOST_IP=<sunucu IP'si>, WEB_PORT (ops.)
docker compose -f compose.pilot-test.yaml up -d --build
docker compose -f compose.pilot-test.yaml run --rm migrate
```

`http://<HOST_IP>:<WEB_PORT>` üzerinden erişin. Bu geçici bir deneme
kurulumu — gerçek pilot/üretim için domain alıp `compose.prod.yaml`'a
geçin (HTTPS olmadan kimlik bilgileri düz metin gider).

`compose.prod.yaml` yalnızca Caddy'yi internete açar; `postgres` ve `web`
compose ağı dışından erişilemez.

## `DOCUMENTS_WATERMARK`

Filigran (`NOT FOR OPERATIONAL USE`) bu anahtarla açılıp kapanır.

**Operatör kararı (2026-09-11): filigran kapatıldı.** Depo varsayılanı
artık `false`, `compose.prod.yaml` dahil. Anahtar koddan kaldırılmadı —
`DOCUMENTS_WATERMARK=true` yazıldığı anda filigran geri gelir.

Kararın bağlamı kayıt altında kalsın: bu, bir dağıtım ayarı değil işletme
kararıdır ve `docs/VALIDATION_DOSSIER.md`'nin kaydettiği durumu
değiştirmez — 13 senaryonun 2'sinde referans var, `AHM560_ERRATA.md`
Kayıt 6 açık, tank bazlı yakıt ve yanal denge verisi eksik. Filigransız
üretilen bir belge, otorite kabulü alınmış bir belge değildir; paralel
operasyonel validasyon ve havayolu/otorite kabulü hâlâ gereklidir.

## Kısıtlı sunucuya dağıtım (npm erişimi yok, düşük RAM)

Pilot sunucu iki şeyi yapamıyor: `registry.npmjs.org` ve `binaries.prisma.sh`
adreslerine çıkamıyor (SNI bazlı engel) ve 1 GB'ın altındaki RAM'iyle
`next build` çalıştıramıyor. Yani "klonla, kur, derle" yolu kapalı —
**geliştirme makinesinde derlenip paket olarak gönderiliyor.**

### Paketi hazırlama (geliştirme makinesinde)

```bash
pnpm --filter @tua/web build
mkdir -p /tmp/bundle && cp -R apps/web/.next/standalone/. /tmp/bundle/
mkdir -p /tmp/bundle/apps/web/.next
cp -R apps/web/.next/static /tmp/bundle/apps/web/.next/static
cp -R apps/web/public /tmp/bundle/apps/web/public
# Prisma: standalone çıktısı query engine'i taşımıyor, elle ekleniyor
SRC=$(ls -d node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client | head -1)
REL=$(dirname $(dirname $SRC)); mkdir -p /tmp/bundle/$REL/.prisma
cp -R $SRC /tmp/bundle/$REL/.prisma/
# Belgelerdeki logo çalışma anında dosyadan okunuyor, o da izlenmiyor
mkdir -p /tmp/bundle/packages/documents/assets
cp packages/documents/assets/airline-logo.png /tmp/bundle/packages/documents/assets/
# Migration'lar için şema
cp -R packages/db/prisma /tmp/bundle/packages/db/prisma
# Çökme koruyucusu — üretimde server.js yerine bu çalıştırılır
cp apps/web/server-guard.mjs /tmp/bundle/apps/web/
# macOS ikilileri işe yaramaz, çıkar
rm -rf /tmp/bundle/node_modules/.pnpm/@img+sharp-* /tmp/bundle/node_modules/.pnpm/sharp@*
rm -rf /tmp/bundle/node_modules/.pnpm/argon2@*/node_modules/argon2/prebuilds/darwin-*
rm -f  /tmp/bundle/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/*darwin*
tar czf tua-deploy.tar.gz -C /tmp/bundle .
```

Paket ~30 MB. `sharp` çıkarılabiliyor çünkü uygulama `next/image` kullanmıyor;
`argon2` çıkarılamaz — parola doğrulaması ona bağlı, sunucuda **linux-x64**
prebuild'i bulunmalı (mevcut kurulumdan kopyalanır veya Linux'ta üretilir).

### Prisma CLI paketi

Sunucu engine indiremediği için CLI de ayrı, kendi kendine yeten bir paket
olarak gönderilir — pnpm'in symlink düzeni kopyalanamadığından **npm'in düz
node_modules düzeniyle**:

```bash
mkdir /tmp/prisma-cli && cd /tmp/prisma-cli && npm init -y
PRISMA_SKIP_POSTINSTALL_GENERATE=1 npm install prisma@<sürüm>
E=node_modules/@prisma/engines
rm -f $E/*darwin*
cp <linux schema-engine> $E/schema-engine-debian-openssl-3.0.x
cp <linux query engine>  $E/libquery_engine-debian-openssl-3.0.x.so.node
chmod +x $E/schema-engine-debian-openssl-3.0.x
```

Linux engine'leri, CLI ile **aynı** engine commit'inden alınır:
`https://binaries.prisma.sh/all_commits/<enginesVersion>/debian-openssl-3.0.x/schema-engine.gz`
(`enginesVersion` için `@prisma/engines-version/package.json`).

### Sunucuda

```bash
tar xzf tua-deploy.tar.gz -C ~/tua-new
cp <eski kurulum>/.env ~/tua-new/.env          # DATABASE_URL, AUTH_SECRET, DOCUMENTS_WATERMARK
cp -R <argon2 linux-x64 prebuild> ~/tua-new/node_modules/.pnpm/argon2@*/node_modules/argon2/prebuilds/
node ~/prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema ~/tua-new/packages/db/prisma/schema.prisma
```

`server.js` `.env` dosyasını **kendisi okumaz** — pm2'ye verilen sarmalayıcı
okur. Sunucu `server.js` yerine `server-guard.mjs` ile başlatılır: istemci
yanıtın ortasında kaybolunca (sekme kapandı, yenilendi) Node `ECONNRESET`
fırlatıyor, Next bunu yakalamıyor ve süreç ölüyor — pilot sunucu bu yüzden
311 kez yeniden başlamıştı. Koruyucu o kodları yutar, başka her hatada
çıkar (`apps/web/test/server-guard.test.ts` ikisini de doğruluyor).

```bash
#!/bin/bash
set -a; . /path/to/app/.env; set +a
export PORT=8080
exec /path/to/node /path/to/app/apps/web/server-guard.mjs
```

```bash
cd /path/to/app && pm2 start start.sh --name tua-web --interpreter bash --cwd /path/to/app && pm2 save
```

`--cwd` şart: pm2 süreci ilk oluşturduğu andaki çalışma dizinini saklar ve
o dizin sonradan silinirse süreç hiç başlayamaz — `pm2 list` yine "online"
gösterir, oysa 8080'i dinleyen kimse yoktur. Eski kurulum silindikten sonra
pm2 kaydını **silip yeniden oluşturun**, yalnızca `restart` yetmez.

### `db push` ile kurulmuş bir veritabanını devralmak

Pilot veritabanı migration geçmişi olmadan (`prisma db push`) kurulmuşsa
`migrate deploy` **P3005** verir. Çözüm, hangi değişikliğin fiilen içeride
olduğunu ölçüp uygulanmış olanları baseline'lamaktır:

```bash
prisma migrate resolve --applied <migration_adı>   # zaten içeride olan her biri
prisma migrate deploy                              # kalanlar
```

Sütunları ararken kolon adlarının **camelCase** olduğuna dikkat edin
(`"cockpitCrew"`, `"tareWeight"`) — snake_case arayan bir sorgu "yok" der ve
yanlış baseline'a yol açar.

## akbulut'a geçiş (2026-10-07)

Pilot, alybabanew'dan (1 çekirdek, 957 MB RAM, swap yok, 29 GB boş) akbulut'a
taşındı: 2 çekirdek, 1.9 GB RAM + 2 GB swap, 103 GB boş, nginx 1.28.0.
Adres `https://akbulut.com.tm/load` — ana sitenin hâlihazırda kullandığı
Sectigo sertifikasının altında, alt yol olarak. Alt alan adı
(`load.akbulut.com.tm`) daha temiz şekildi ama `akbulut.com.tm`'in DNS'i
Türkmentelekom'da (`webns1/webns2.telecom.tm`) ve operatör oraya kayıt
ekleyemiyor — A kaydı yoksa alt alan adı yok. Gerekçenin tam kaydı:
`tools/nginx/README.md`.

İki sunucunun **ortak** kısıtı: `registry.npmjs.org`, `github.com` ve
`binaries.prisma.sh` ikisinde de engelli. Yani paket yine geliştirme
makinesinde üretilip taşınıyor, `build-bundle.sh` yolu değişmiyor. Paket
**`NEXT_PUBLIC_BASE_PATH=/load` ile** derleniyor — prefix derleme zamanında
her varlık URL'sine gömülür, sonradan takılamaz.

Taşımada dikkat edilen üç nokta:

| Konu | alybabanew | akbulut | Sonuç |
|---|---|---|---|
| Postgres | 15.5 | **14.24** | `apt.postgresql.org` akbulut'ta engelli, 15'e çıkılamıyor. Döküm 15'ten 14'e yükleniyor; PG16'nın `\restrict` sorunu burada yok ama yükleme sonrası sayımlar doğrulanmalı. |
| Node | `/home/ubuntu/node22/bin/node` | sistemde 18.18.0 | `nodejs.org` engelli. node22 dizini alybabanew'dan kopyalanıyor — ikisi de Ubuntu 22.04 x86-64, ikili uyumlu. |
| Boş port | 8080 (next-server, 0.0.0.0) | 8080 **nginx'te dolu** | Uygulama `127.0.0.1:3000`. Loopback bağlama kasıtlı: eski kurulumda 8080 dışarıya açıktı ve TLS'i tamamen atlıyordu. |

### Sıra

```bash
# 1. node22'yi taşı (alybabanew'da)
tar czf ~/node22.tar.gz -C /home/ubuntu node22
scp ~/node22.tar.gz ubuntu@216.250.11.77:~/ && ssh ubuntu@216.250.11.77 'tar xzf ~/node22.tar.gz -C /home/ubuntu && /home/ubuntu/node22/bin/node -v'

# 3. Veritabanı dökümü (alybabanew'da) — operasyonel veri dahil, 9 MB
set -a; . /home/ubuntu/tua-20261005/.env; set +a; U="${DATABASE_URL%%\?*}"
pg_dump --no-owner --no-privileges "$U" > ~/tua-akbulut-$(date +%F).sql

# 4. Üretilmiş PDF'ler (9 dosya, 788 KB) — postgres yedeği bunları kapsamaz
tar czf ~/tua-documents.tar.gz -C /home/ubuntu tua-documents
```

```bash
# 5. akbulut'ta: veritabanını kur ve dökümü yükle
sudo -u postgres createuser tua --pwprompt
sudo -u postgres createdb -O tua tua_load_control
psql "postgresql://tua:<sifre>@127.0.0.1:5432/tua_load_control" \
  -v ON_ERROR_STOP=1 -f ~/tua-akbulut-<tarih>.sql

# 6. Paketi aç ve .env'i yaz
mkdir -p ~/tua-20261007 && tar xzf ~/tua-deploy-akbulut.tar.gz -C ~/tua-20261007
tar xzf ~/tua-documents.tar.gz -C /home/ubuntu
```

`.env`. AUTH_SECRET **yeniden üretilir**, eski kurulumdan kopyalanmaz: taşıma
sırasında eski değer bir sohbet geçmişine düştü, o yüzden yakılmış sayılıyor.
Tek maliyeti herkesin bir kez yeniden giriş yapması:

```bash
DATABASE_URL="postgresql://tua:<sifre>@127.0.0.1:5432/tua_load_control?schema=public"
AUTH_SECRET="$(openssl rand -base64 32)"
NEXT_PUBLIC_APP_URL="https://akbulut.com.tm/load"
NEXT_PUBLIC_DEFAULT_LOCALE="en"
DOCUMENTS_WATERMARK="false"
DOCUMENTS_STORAGE_PATH="/home/ubuntu/tua-documents"
NODE_ENV="production"
PORT=3000
HOSTNAME=127.0.0.1
```

`start.sh` — `HOSTNAME` şart, yoksa Next 0.0.0.0'a bağlanır ve 3000 dışarıya
açılır:

```bash
#!/bin/bash
set -a; . /home/ubuntu/tua-20261007/.env; set +a
exec /home/ubuntu/node22/bin/node /home/ubuntu/tua-20261007/apps/web/server-guard.mjs
```

```bash
# 7. pm2 — --cwd şart (bu dosyanın üstündeki pm2 notuna bak)
chmod +x ~/tua-20261007/start.sh
cd ~/tua-20261007 && pm2 start start.sh --name tua-web --interpreter bash \
  --cwd /home/ubuntu/tua-20261007
pm2 save && pm2 startup   # yazdırdığı sudo komutunu çalıştır

# 8. nginx: tools/nginx/README.md — sertifika adımı yok, ana sitenin
#    sertifikası kullanılıyor
```

### Doğrulama (alybabanew kapatılmadan önce)

```bash
curl -s localhost:3000/api/health; curl -s localhost:3000/api/health/db
curl -sI https://akbulut.com.tm/load/en | head -3
psql "$DATABASE_URL" -t -c "select 'wnb='||(select count(*) from wnb_calculations)||' doc='||(select count(*) from documents)||' plan='||(select count(*) from load_plans)||' user='||(select count(*) from users);"
```

alybabanew'daki sayımlar: `wnb=20 doc=15 plan=24 user=5`, 9 PDF. Üçü de
eşleşmeli. Ardından tarayıcıdan giriş, bir belge üretimi ve altın test
vakasının (T5 692) ekrandaki değerleri — `MACZFW 26,4` · `MACTOW 26,7` ·
`TTL 35 278` — kontrol edilir. Hepsi geçtikten sonra alybabanew'da
`pm2 delete tua-web && pm2 save`.

## Sağlık kontrolü

| Uç nokta | Ne kontrol eder | Kimlik doğrulama |
|---|---|---|
| `GET /api/health` | Süreç ayakta mı (liveness) | Yok — dışarıya açık, izleme araçları içindir |
| `GET /api/health/db` | Postgres'e erişilebiliyor mu (readiness) | Yok |

`apps/web/Dockerfile`'daki `HEALTHCHECK` doğrudan `/api/health`'i kullanır.
Harici izleme (uptime robot vb.) her iki uç noktayı da ayrı ayrı izlemeli —
`/api/health` 200 dönerken `/api/health/db` 503 dönebilir (DB kesintisi,
uygulama süreci sağlıklı).

## Loglama

`apps/web/src/lib/logger.ts` — harici bağımlılık yok, stdout/stderr'e
tek satır JSON. Konteyner log toplayıcıları (Docker, Hetzner, Cloudflare)
ek yapılandırma gerektirmeden bunu okur.

Harici hata izleme (Sentry vb.) henüz entegre değil — `captureError()`
tek entegrasyon noktası; ne zaman bir servis seçilirse yalnızca o
fonksiyonun gövdesi değişir.

## Yedekleme

`tools/backup/` — `postgres:16-alpine` tabanlı ayrı bir konteyner, günde
bir kez (varsayılan `03:00 UTC`, `BACKUP_HOUR_UTC` ile ayarlanır) `pg_dump`
alır, gzip'ler, `RETENTION_DAYS` (varsayılan 30) gün sonra siler.
`compose.prod.yaml`'da `./backups` dizinine bağlanır.

**Geri yükleme:**

```bash
gunzip -c backups/tua_load_control_20260811T030000Z.sql.gz | \
  docker compose -f compose.prod.yaml exec -T postgres psql -U tua -d tua_load_control
```

**Önemli:** `backups/` dizini VPS'in kendisiyle birlikte kaybolursa işe
yaramaz. Pilot/üretimde bu dizini düzenli olarak VPS dışına
(ör. `rsync` ile başka bir sunucuya veya nesne depolamaya) kopyalayın —
bu adım henüz otomatik değil, Faz 15 kapsamı yalnızca yerel yedeklemedir.

## Üretilen belgeler

Üretilen LIR/LS/ENV PDF'leri (`apps/web/src/lib/document-storage.ts`)
konteynerin yerel diskinde, `/app/.data` altında saklanır —
`compose.prod.yaml`'daki `web_data` named volume'u bu dizini konteyner
yeniden oluşturulduğunda korur.

**Önemli:** `tools/backup/` yalnızca postgres'i yedekler — `web_data`
ayrı bir hacim, otomatik yedeklemesi yok. `Document` tablosundaki
`sha256`/durum kayıtları postgres yedeğiyle korunur ama asıl PDF
dosyaları korunmaz. Üretim öncesi bu hacmi de düzenli yedekleme
kapsamına alın (ör. `docker run --rm -v tua_web_data:/data
-v $(pwd)/backups:/backup alpine tar czf /backup/web_data_$(date
+%Y%m%dT%H%M%SZ).tar.gz -C /data .`).

### pm2 kurulumunda depo yolu

Docker dışı (pm2) kurulumda `DOCUMENTS_STORAGE_PATH` **mutlaka** verilir.
Boş bırakılırsa depo `process.cwd()/.data/documents` olur — yani sürümün
kurulum klasörünün içi. Her dağıtım yeni bir klasöre açıldığı ve pm2 oraya
taşındığı için, o ana kadar üretilmiş bütün PDF'ler yeni kurulumdan
görünmez olur: `Document` satırları durur, dosyalar bulunamaz (belgeler
sayfası bunu "dosya yok" diye gösterir). Kurulumdan bağımsız sabit bir yol
verin ve yedeklemeye onu alın:

```bash
mkdir -p /home/ubuntu/tua-documents
echo 'DOCUMENTS_STORAGE_PATH="/home/ubuntu/tua-documents"' >> <kurulum>/.env
```

## İmaj boyutu

`apps/web/Dockerfile` Next.js'in `standalone` çıktısını kullanır — çalışma
zamanı katmanı yalnızca izlenen (traced) dosyaları içerir, tam
`node_modules` değil. Doğrulamak için:

```bash
docker build -f apps/web/Dockerfile -t tua-web . && docker images tua-web
```
