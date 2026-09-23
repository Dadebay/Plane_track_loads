import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Image, View, Text, StyleSheet } from "@react-pdf/renderer";
import { COLOR } from "./tokens";

/**
 * The airline's mark on a document.
 *
 * The bird roundel ships with the package (`assets/airline-logo.png`) and
 * the wordmark is set as text beside it, the way it reads on the crew's own
 * sheets. `DOCUMENTS_LOGO_PATH` overrides the bundled file — a repaint, or a
 * second carrier, needs no code change. If neither file is readable a plain
 * green disc stands in, so a document can still be produced rather than the
 * render failing.
 *
 * The bundled file is the operator's artwork **flattened onto white**;
 * their original is kept beside it as `airline-logo-source.png`. In that
 * original the bird is not white ink but a hole punched through the green
 * disc, so it only looks like a bird where something white shows through.
 * On screen the page does that. A printer's RIP does not: it dropped the
 * soft mask and put a solid dark disc on the paper. Documents are always
 * light, so white is the surface this mark is printed on in every one of
 * them and baking it in costs nothing. Replace both files together if the
 * artwork ever changes.
 *
 * Resolved at render time from the filesystem, so the same file always
 * produces the same bytes and determinism is preserved.
 */

const ASSET = path.join("packages", "documents", "assets", "airline-logo.png");

/**
 * Where the bundled mark might be, in the order worth trying.
 *
 * `import.meta.url` alone is not enough. Webpack resolves it at build time
 * and inlines the **build machine's** absolute path, so a bundle built on a
 * laptop looked for /Users/... on the pilot server, found nothing, and fell
 * through to the plain disc — which is what reached the operator's printer.
 * It stays first because it is exact when the package runs from source.
 *
 * `process.cwd()` covers the standalone bundle, whose root holds the traced
 * copy of packages/documents/assets (see apps/web/next.config.ts), and the
 * entry beneath it covers being started from apps/web instead.
 */
function logoCandidates(): string[] {
  return [
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "airline-logo.png"),
    path.join(process.cwd(), ASSET),
    path.join(process.cwd(), "..", "..", ASSET),
  ];
}

let warned = false;

const styles = StyleSheet.create({
  block: { flexDirection: "row", alignItems: "center", gap: 5 },
  image: { objectFit: "contain" },
  fallbackMark: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLOR.brand },
  wordmark: { fontSize: 8, fontWeight: 700, color: COLOR.brand, lineHeight: 1.15 },
});

/** The logo file in use, or null when neither the override nor the bundled
 * asset is readable. */
export function logoPath(): string | null {
  const override = process.env.DOCUMENTS_LOGO_PATH;
  if (override && existsSync(override)) return override;

  const candidates = logoCandidates();
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found) return found;

  // Falling back is quiet on the page and loud nowhere else — the document
  // still prints, carrying a mark that is not the airline's. Say so once, so
  // a deployment that lost the asset is diagnosable from the logs instead of
  // from a photograph of a printout.
  if (!warned) {
    warned = true;
    console.warn(`[documents] airline logo not found; using the plain mark. Tried:\n  ${candidates.join("\n  ")}`);
  }
  return null;
}

export function AirlineLogo({ height = 26 }: { height?: number }) {
  const file = logoPath();
  return (
    <View style={styles.block}>
      {file ? (
        <Image src={file} style={[styles.image, { width: height, height }]} />
      ) : (
        <View style={styles.fallbackMark} />
      )}
      <Text style={styles.wordmark}>
        Turkmenistan{"\n"}Airlines
      </Text>
    </View>
  );
}
