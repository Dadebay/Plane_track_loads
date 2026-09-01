/**
 * Documented Aerometa defects — mirrors the "Bilinen Aerometa hataları"
 * table in CLAUDE.md. When a field mismatch's field key matches one of
 * these, compareFields classifies it OUR_FIX (a known, already-understood
 * difference) instead of INVESTIGATE (an unexplained one needing review) —
 * the distinction Faz 14's acceptance criteria requires for every diff.
 */

export interface KnownIssue {
  ref: string;
  field: string;
  description: string;
}

export const KNOWN_AEROMETA_ISSUES: KnownIssue[] = [
  {
    ref: "Bulgu #1",
    field: "underloadBeforeLmc",
    description: "UNDERLOAD BEFORE LMC yanlış — Aerometa DOW'u 110 000'e yuvarlıyor (CLAUDE.md #1).",
  },
  {
    ref: "Bulgu #2",
    field: "dow",
    description: "Loadsheet DOW, AHM 560'ın crew tablosuyla uyuşmuyor, revizyon takibi yok (CLAUDE.md #2).",
  },
  {
    ref: "Bulgu #2",
    field: "doi",
    description: "Loadsheet DOI, AHM 560'ın crew tablosuyla uyuşmuyor, revizyon takibi yok (CLAUDE.md #2).",
  },
  {
    ref: "Bulgu #5",
    field: "lilaw",
    description: "LILAW üretilmiyor — AHM 560 zorunlu kılıyor (CLAUDE.md #5).",
  },
  {
    ref: "Bulgu #5",
    field: "maclaw",
    description: "MACLAW üretilmiyor — AHM 560 zorunlu kılıyor (CLAUDE.md #5).",
  },
];

export function findKnownIssue(field: string): KnownIssue | null {
  return KNOWN_AEROMETA_ISSUES.find((issue) => issue.field === field) ?? null;
}
