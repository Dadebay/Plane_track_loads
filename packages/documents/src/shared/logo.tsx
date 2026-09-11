import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Image, View, Text, StyleSheet } from "@react-pdf/renderer";
import { COLOR } from "./tokens";

/**
 * The airline's mark on a document.
 *
 * The bird roundel ships with the package (`assets/airline-logo.png`,
 * supplied by the operator) and the wordmark is set as text beside it, the
 * way it reads on the crew's own sheets. `DOCUMENTS_LOGO_PATH` overrides the
 * bundled file — a repaint, or a second carrier, needs no code change. If
 * neither file is readable a plain green disc stands in, so a document can
 * still be produced rather than the render failing.
 *
 * Resolved at render time from the filesystem, so the same file always
 * produces the same bytes and determinism is preserved.
 */

const BUNDLED_LOGO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "airline-logo.png");

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
  return existsSync(BUNDLED_LOGO) ? BUNDLED_LOGO : null;
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
