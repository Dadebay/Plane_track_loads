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

```bash
docker exec plane_track_loads-postgres-1 pg_dump -U tua -d tua_load_control \
  --clean --if-exists \
  --exclude-table-data=load_plans --exclude-table-data=load_items \
  --exclude-table-data=documents --exclude-table-data=wnb_calculations \
  --exclude-table-data=fuel_records --exclude-table-data=fuel_tank_allocations \
  --exclude-table-data=audit_logs --exclude-table-data=uld_movements \
  > ~/Downloads/tua-clean-bench.sql
```
