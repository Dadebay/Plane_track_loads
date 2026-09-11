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

## İmaj boyutu

`apps/web/Dockerfile` Next.js'in `standalone` çıktısını kullanır — çalışma
zamanı katmanı yalnızca izlenen (traced) dosyaları içerir, tam
`node_modules` değil. Doğrulamak için:

```bash
docker build -f apps/web/Dockerfile -t tua-web . && docker images tua-web
```
