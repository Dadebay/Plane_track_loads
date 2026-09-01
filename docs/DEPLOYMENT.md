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
   DOCUMENTS_WATERMARK=true
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

CLAUDE.md kural #8: validasyon bitene kadar her PDF'te
`NOT FOR OPERATIONAL USE` filigranı basılır. Varsayılan `true`.

Bölüm D'deki regülasyon adımları (paralel çalıştırma, otorite kabulü)
tamamlanmadan **`DOCUMENTS_WATERMARK=false` yapılmaz** — bu bir dağıtım
ayarı değil, işletme kararıdır. `.env`'de açıkça `true` tutun; `false`'a
çeviren kişi bunu bilerek, otorite onayından sonra yapmalıdır.

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

## Üretilen belgeler ve mesaj kutusu

Üretilen LIR/LS/ENV PDF'leri (`apps/web/src/lib/document-storage.ts`) ve
gönderilen LDM/CPM/MVT mesajlarının yerel kopyası
(`apps/web/src/lib/message-transport.ts`) konteynerin yerel diskinde,
`/app/.data` altında saklanır — `compose.prod.yaml`'daki `web_data`
named volume'u bu dizini konteyner yeniden oluşturulduğunda korur.

**Önemli:** `tools/backup/` yalnızca postgres'i yedekler — `web_data`
ayrı bir hacim, otomatik yedeklemesi yok. `Document`/`OutgoingMessage`
tablolarındaki `sha256`/durum kayıtları postgres yedeğiyle korunur ama
asıl PDF/mesaj dosyaları korunmaz. Üretim öncesi bu hacmi de düzenli
yedekleme kapsamına alın (ör. `docker run --rm -v tua_web_data:/data
-v $(pwd)/backups:/backup alpine tar czf /backup/web_data_$(date
+%Y%m%dT%H%M%SZ).tar.gz -C /data .`).

## İmaj boyutu

`apps/web/Dockerfile` Next.js'in `standalone` çıktısını kullanır — çalışma
zamanı katmanı yalnızca izlenen (traced) dosyaları içerir, tam
`node_modules` değil. Doğrulamak için:

```bash
docker build -f apps/web/Dockerfile -t tua-web . && docker images tua-web
```
