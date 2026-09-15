# Pilot sunucu paketi

Pilot sunucu (Ubuntu 22.04, glibc, Node 22, x86-64) internete çıkamıyor:
GitHub da npm registry de engelli. Bu yüzden uygulama orada derlenmiyor —
burada derlenip hazır paket olarak yükleniyor.

`Dockerfile.bundle` neden ayrı: deponun kendi `apps/web/Dockerfile`'ı
alpine (musl) üstünde çalışıyor, sunucu ise glibc. Prisma sorgu motoru,
`argon2` ve `sharp` yerel ikili dosyalar — yanlış libc ile yüklenmezler.

## Paketi üret

```bash
docker build --platform linux/amd64 -f tools/deploy/Dockerfile.bundle \
  --target bundle -t tua-deploy:latest .
docker run --rm tua-deploy:latest tar -czf - -C /app . > ~/Downloads/tua-deploy.tar.gz
```

Apple Silicon'da bu derleme emülasyonlu ve yavaştır. Docker Desktop →
Settings → General → "Use Rosetta for x86/amd64 emulation" belirgin biçimde
hızlandırır.

## Veritabanı

Sunucuda `tsx` ve internet olmadığı için seed çalıştırılamıyor; bunun yerine
yerel veritabanından şema + referans verisi (uçuşlar, istasyonlar, uçaklar,
AHM belgeleri, ULD'ler, kullanıcılar) SQL olarak alınıp `psql` ile yükleniyor.
Operasyonel tablolar (planlar, belgeler, hesaplar) bilerek boş bırakılır:

PG16'nın `pg_dump`'ı dosyanın başına ve sonuna `\restrict` / `\unrestrict`
satırları koyuyor; sunucudaki psql 15 bu meta-komutu tanımıyor ve dosyayı
5. satırda reddediyor. Dökümü aldıktan sonra o iki satırı sil:

```bash
sed -i '' '/^\\restrict /d; /^\\unrestrict /d' ~/Downloads/tua-clean-bench.sql   # macOS
sed -i    '/^\\restrict /d; /^\\unrestrict /d' ~/tua-clean-bench.sql             # Linux
```

Yükleme (sunucuda, Docker yok — Postgres orada sistem servisi):

```bash
set -a; . ~/tua-new/.env; set +a; U="${DATABASE_URL%%\?*}"
pg_dump "$U" > ~/db-before-restore-$(date +%F-%H%M).sql
psql "$U" -v ON_ERROR_STOP=1 -f ~/tua-clean-bench.sql
```

```bash
docker exec plane_track_loads-postgres-1 pg_dump -U tua -d tua_load_control \
  --clean --if-exists \
  --exclude-table-data=load_plans --exclude-table-data=load_items \
  --exclude-table-data=documents --exclude-table-data=wnb_calculations \
  --exclude-table-data=fuel_records --exclude-table-data=fuel_tank_allocations \
  --exclude-table-data=audit_logs --exclude-table-data=uld_movements \
  > ~/Downloads/tua-clean-bench.sql
```

## Paketi macOS'ta elle üretmek (Docker'sız, hızlı yol)

Emülasyonlu Docker derlemesi 20+ dakika sürüyor. Aynı paketi yerel derlemeden
de çıkarmak mümkün — sunucuya ait ikili dosyalar zaten `node_modules`'ta
duruyor (Prisma'nın `binaryTargets`'ı Linux motorlarını da üretiyor, `argon2`
npm paketi bütün platformların prebuild'lerini taşıyor). Sırası:

1. `pnpm build`
2. `apps/web/.next/standalone` + `.next/static` + `public` → paket kökü
3. `@prisma/client` ve `.prisma/client`'ı kopyala. Prisma motoru **üç** yere
   birden konmalı, aradığı yollar bunlar:
   - `node_modules/.pnpm/@prisma+client@<sürüm>/node_modules/.prisma/client`
   - `apps/web/.prisma/client`
   - `apps/web/.next/server`
4. **`argon2`'nin izlenen kopyasını düzelt.** Next yalnızca derleme sırasında
   yüklenen platformun prebuild'ini pakete alıyor; `.pnpm/argon2@<sürüm>/
   node_modules/argon2/prebuilds/` altına `linux-x64` elle kopyalanmalı.
5. macOS'a özel `sharp` paketlerini sil (uygulama `next/image` kullanmıyor).
6. **`COPYFILE_DISABLE=1 tar -czf ...`** ile paketle. Yoksa macOS her dosyanın
   yanına `._ad` biçiminde AppleDouble dosyası yazıyor; `node-gyp-build`
   alfabetik sırada önce onu bulup yüklemeye çalışıyor ve
   `invalid ELF header` ile düşüyor.

`tools/deploy/build-bundle.sh` bunların hepsini yapıyor; elle kurmak yerine
onu çalıştır.

**Pakette olmayan iki dosya sunucuda kalır:** `.env` (sırlar) ve `start.sh`
(mutlak sunucu yolları taşıyor). Yeni paketi açtıktan sonra ikisini de eski
kurulumdan kopyala — yoksa pm2 `Script not found` verip sessizce durur.

Göndermeden önce kapsanan platformları doğrula:

```bash
find <paket> -name "*.node" | sort
```

Listede her yerel modül için `linux-x64` / `debian-openssl-3.0.x` karşılığı
görünmeli; yalnızca `darwin-*` görünen bir modül sunucuda çalışmaz.
