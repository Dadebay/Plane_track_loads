#!/usr/bin/env bash
#
# Builds the pilot server's deploy bundle from a macOS checkout, without
# Docker. The emulated linux/amd64 Docker build in Dockerfile.bundle takes
# 20+ minutes on Apple Silicon; this does the same job in a couple, by
# building natively and then swapping in the Linux copies of the three
# native modules — they are already in node_modules (Prisma's binaryTargets
# emits the Linux engines, argon2 ships every platform's prebuild).
#
# Every step here exists because leaving it out produced a 500 on the
# server. tools/deploy/README.md records which failure each one prevents.
#
# Usage:  tools/deploy/build-bundle.sh [output.tar.gz]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:-$HOME/Downloads/tua-deploy.tar.gz}"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cd "$REPO_ROOT"

echo "==> Building"
pnpm build

echo "==> Assembling bundle at $STAGE"
cp -R apps/web/.next/standalone/. "$STAGE/"
mkdir -p "$STAGE/apps/web/.next"
cp -R apps/web/.next/static "$STAGE/apps/web/.next/static"
cp -R apps/web/public "$STAGE/apps/web/public"

# The process is started through server-guard.mjs, not server.js — it
# swallows the ECONNRESET Next throws when a client vanishes mid-response,
# which restarted the pilot server 311 times. Nothing imports it, so Next's
# tracing does not see it and a standalone build ships without it; pm2 then
# fails with "Script not found" or "Cannot find module".
cp apps/web/server-guard.mjs "$STAGE/apps/web/server-guard.mjs"

# --- Prisma -------------------------------------------------------------
# @prisma/client resolves its query engine relative to its own __dirname at
# runtime and looks in three different places depending on how the route was
# bundled. Missing any one of them is a 500 with "Query engine not found".
PRISMA_CLIENT_SRC="node_modules/.pnpm/$(ls node_modules/.pnpm | grep -m1 '^@prisma+client@')/node_modules/.prisma/client"
[ -d "$PRISMA_CLIENT_SRC" ] || PRISMA_CLIENT_SRC="node_modules/.prisma/client"

for dest in \
  "$STAGE/node_modules/.pnpm/$(ls node_modules/.pnpm | grep -m1 '^@prisma+client@')/node_modules/.prisma/client" \
  "$STAGE/apps/web/.prisma/client" \
  "$STAGE/apps/web/.next/server"
do
  mkdir -p "$dest"
  cp -R "$PRISMA_CLIENT_SRC/." "$dest/"
done

# --- argon2 -------------------------------------------------------------
# Next's tracing copies only the prebuild for the platform it built on, so a
# macOS build ships darwin-arm64 alone and the server dies with
# "No native build was found for platform=linux arch=x64".
ARGON2_PKG="$(ls node_modules/.pnpm | grep -m1 '^argon2@')"
ARGON2_SRC="node_modules/.pnpm/$ARGON2_PKG/node_modules/argon2/prebuilds"
ARGON2_DEST="$STAGE/node_modules/.pnpm/$ARGON2_PKG/node_modules/argon2/prebuilds"
if [ -d "$ARGON2_SRC" ]; then
  mkdir -p "$ARGON2_DEST"
  for plat in linux-x64 linux-arm64; do
    [ -d "$ARGON2_SRC/$plat" ] && cp -R "$ARGON2_SRC/$plat" "$ARGON2_DEST/"
  done
fi

# --- sharp --------------------------------------------------------------
# macOS-only binaries the app never loads (it does not use next/image).
find "$STAGE" -type d -name "*sharp*darwin*" -prune -exec rm -rf {} + 2>/dev/null || true
find "$STAGE" -type d -name "*img-squoosh*" -prune -exec rm -rf {} + 2>/dev/null || true

# --- runtime state ------------------------------------------------------
# apps/web/.data is where generated documents are stored at runtime, and
# Next's standalone output sweeps it up along with the build. Shipping it
# copies this machine's own test PDFs into the operator's document store,
# where they sit under real leg ids carrying whatever the logo looked like
# when they were made. Build output only.
rm -rf "$STAGE/apps/web/.data"

# --- AppleDouble --------------------------------------------------------
# macOS writes a "._name" sidecar next to every file when tarring with
# extended attributes. node-gyp-build scans the prebuilds directory in
# alphabetical order, finds "._argon2.glibc.node" first, and dies with
# "invalid ELF header". Strip them and tar with them disabled.
find "$STAGE" -name "._*" -delete

echo "==> Native modules in the bundle"
find "$STAGE" -name "*.node" | sed "s|$STAGE/||" | sort

if ! find "$STAGE" -name "*.node" | grep -q 'linux'; then
  echo "FAIL: no linux native binary in the bundle — the server would 500." >&2
  exit 1
fi

for required in apps/web/server.js apps/web/server-guard.mjs packages/documents/assets/airline-logo.png; do
  [ -f "$STAGE/$required" ] || { echo "FAIL: $required missing from the bundle." >&2; exit 1; }
done

if [ -e "$STAGE/apps/web/.data" ]; then
  echo "FAIL: apps/web/.data is runtime state and must not ship." >&2
  exit 1
fi

echo "==> Packing $OUT"
# --no-xattrs as well as COPYFILE_DISABLE: without it macOS writes each
# file's extended attributes into the archive and GNU tar on the server
# prints a warning per file while unpacking, burying anything real.
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$OUT" -C "$STAGE" .
ls -lh "$OUT"
