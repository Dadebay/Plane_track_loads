# nginx — akbulut.com.tm/load

The pilot moved off alybabanew (1 core, 957 MB RAM, no swap, 29 GB free)
onto akbulut (2 cores, 1.9 GB + 2 GB swap, 103 GB free, nginx 1.28.0).

## Shape: sub-path under the existing certificate

`akbulut.com.tm/load`, via the location block in `load.conf`, inside the
server block that already serves the main site over TLS (Sectigo, CN
`akbulut.com.tm`, SAN `akbulut.com.tm` + `www.akbulut.com.tm`, expires
2027-04-21).

A sub-domain (`load.akbulut.com.tm`) was the first choice and is the
cleaner shape — no `basePath`, cookies isolated from the main site,
portable to another host without changing the URL. It was ruled out for one
practical reason: `akbulut.com.tm`'s DNS is authoritative at Turkmentelecom
(`webns1.telecom.tm`, `webns2.telecom.tm`) and the operator cannot add
records there. No A record, no sub-domain. A certificate would have been
available — the host reaches `acme-v02.api.letsencrypt.org` (200) and
`certbot` is installed — but that is moot without the name.

So the prefix is carried by Next's `basePath`, set from
`NEXT_PUBLIC_BASE_PATH` at build time (`apps/web/next.config.ts`). It is a
build-time value: Next bakes the prefix into every asset URL, so a bundle
built without it cannot be mounted under a prefix later, and a bundle built
with it cannot be served from the root. Unset — the default, and what the
Docker compose files use — it changes nothing.

Two things the prefix does not come for free:

- **Middleware redirects.** Next prefixes the URLs it generates itself but
  not a redirect built inside middleware, and `middleware.ts` redirects on
  every unauthenticated request. `src/lib/base-path.ts`'s `withBasePath`
  covers it. Verified on a standalone build: `/load/uld` ->
  `302 /load/en/login`, `/load/tk/flights` -> `302 /load/tk/login`,
  `/load/api/health` -> 200, and `/uld` -> 404.
- **The mount point itself.** `/load` answers 404 and `/load/` 308s to it,
  so `load.conf` has two exact-match locations sending both to `/load/en`.

## Install

1. `sudo nginx -T` and find the block with `server_name akbulut.com.tm`.
2. Paste the three locations from `load.conf` into it.
3. `sudo nginx -t && sudo systemctl reload nginx`

No certbot step: this rides the certificate the main site already has and
the operator already renews.

## Port choice

3000, bound to 127.0.0.1. Not 8080 — on akbulut nginx itself listens there
and proxies to 95.85.117.158. 3000, 8081 and 8090 were all free. And unlike
the old pilot, where next-server sat on 0.0.0.0:8080 and was reachable over
plain HTTP bypassing TLS entirely, loopback binding leaves nginx as the only
way in.
