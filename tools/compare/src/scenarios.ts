/**
 * Test scenario library (Faz 14, plan task 2). The 12 required scenarios,
 * per IMPLEMENTATION_PLAN.md's list. Eleven are PENDING_REFERENCE — each
 * needs a flight built in Aerometa (tua.aerometa.aero) and the matching
 * one built in our own system before it can be compared (the plan's
 * documented test workflow). T5 692 is the exception: its source PDFs
 * (LS/LIR/ENV_T5692_11082026_ED01.pdf) are Aerometa's actual production
 * output for a real flight, already transcribed into
 * docs/AHM560_GROUND_TRUTH.md §19 — so it's usable today without a new
 * reference PDF.
 *
 * T5 692's field set is intentionally narrower than a full ~30-field LS
 * comparison. Included: pure-arithmetic totals (exact by construction,
 * unaffected by any AHM-revision question) and the two resolved Aerometa
 * defects (Bulgu #1, #2) CLAUDE.md documents with concrete values on both
 * sides. Excluded for now: MACZFW/MACTOW/LIZFW/LITOW/STAB — packages/
 * wnb-core's own golden test (golden-t5692.test.ts Part 3, AHM560_ERRATA.md
 * "Kayıt 6") pins a genuine, still-open divergence between our bottom-up
 * AHM computation and the printed loadsheet's LIZFW/fuel index, distinct
 * from the CLAUDE.md advantage list — showing it here as a clean MATCH or
 * OUR_FIX would misstate an unresolved question as settled. It's tracked
 * as its own INVESTIGATE-classified field diff below instead.
 */

import { compareFields } from "./field-diff";
import type { FieldSpec, TestScenario } from "./types";

const t5692FieldSpecs: FieldSpec[] = [
  { field: "ttl", label: "TOTAL TRAFFIC LOAD" },
  { field: "zfw", label: "ZFW" },
  { field: "tow", label: "TOW" },
  { field: "ldw", label: "LDW" },
  { field: "taxiWeight", label: "TAXI WEIGHT" },
  { field: "dow", label: "DOW" },
  { field: "doi", label: "DOI" },
  { field: "underloadBeforeLmc", label: "UNDERLOAD BEFORE LMC" },
  {
    field: "lizfw",
    label: "LIZFW",
    investigateNote:
      "Bottom-up AHM 560 Ed.1/Rev.0 hesabı 104,97 veriyor, basılı loadsheet 106,07 — " +
      "AHM560_ERRATA.md 'Kayıt 6': formül doğrulandı (golden-t5692.test.ts Part 2), " +
      "kaynak veri revizyonu araştırılıyor. Çözülmüş bir hata değil, açık bir soru.",
  },
];

// docs/AHM560_GROUND_TRUTH.md §19.1/§19.2 — Aerometa's printed LS_T5692_11082026_ED01.pdf.
const t5692AerometaValues: Record<string, string | null> = {
  ttl: "35278",
  zfw: "146321.7",
  tow: "191021.7",
  ldw: "154361.7",
  taxiWeight: "191621.7",
  dow: "111720", // CLAUDE.md Bulgu #2 — doesn't match AHM 560's own crew table.
  doi: "77.74",
  underloadBeforeLmc: "24722", // CLAUDE.md Bulgu #1 — DOW rounded to 110 000.
  lizfw: "106.07",
};

// @tua/wnb-core's calculateWnb() output for the same input (packages/wnb-core/test/fixtures/t5692.ts).
const t5692OurValues: Record<string, string | null> = {
  ttl: "35278",
  zfw: "146321.7",
  tow: "191021.7",
  ldw: "154361.7",
  taxiWeight: "191621.7",
  dow: "111043.7", // CLAUDE.md advantage #2.
  doi: "78.22",
  underloadBeforeLmc: "23678.3", // CLAUDE.md advantage #1.
  lizfw: "104.97", // packages/wnb-core golden test Part 3 — pinned, open divergence (Kayıt 6).
};

const t5692: TestScenario = {
  id: "t5692-normal-load",
  name: "T5 692 — Normal yük (SGN → ASB)",
  description: "Altın test vakası — docs/AHM560_GROUND_TRUTH.md §19. Aerometa'nın gerçek üretim çıktısı.",
  status: "REFERENCE_AVAILABLE",
  report: compareFields("T5 692 — Normal yük", t5692FieldSpecs, t5692AerometaValues, t5692OurValues),
};

function pending(id: string, name: string, description: string): TestScenario {
  return { id, name, description, status: "PENDING_REFERENCE" };
}

/**
 * The 12 scenarios IMPLEMENTATION_PLAN.md's Faz 14 lists. Order matches
 * the plan. Each PENDING_REFERENCE entry needs: build the flight in
 * Aerometa, export its PDF; build the same flight here, export ours; feed
 * both field maps to compareFields and replace the entry's `report`.
 */
export const scenarios: TestScenario[] = [
  t5692,
  pending("light-load", "Hafif yük", "MZFW'nin belirgin altında bir yük — düşük ZFW/TOW ucu."),
  pending("heavy-load-mzfw", "Ağır yük (MZFW sınırı)", "ZFW, MZFW sınırına yakın veya eşit."),
  pending("forward-cg", "İleri CG", "Zarfın ileri (forward) sınırına yakın bir yükleme dağılımı."),
  pending("aft-cg", "Geri CG", "Zarfın geri (aft) sınırına yakın bir yükleme dağılımı."),
  pending("main-deck-only", "Sadece ana güverte", "Alt güvertede yük yok, tüm trafik yükü ana güvertede."),
  pending("lower-deck-only", "Sadece alt güverte", "Ana güvertede yük yok, tüm trafik yükü alt güvertede."),
  pending("pallet-16ft", "16ft palet", "16ft uzun palet pozisyonu ve zon dağılımı içeren bir yük."),
  pending("pallet-20ft", "20ft palet", "20ft uzun palet pozisyonu ve zon dağılımı içeren bir yük."),
  pending("with-lmc", "LMC'li", "Finalize edilmiş bir uçuşa son dakika değişikliği uygulanmış senaryo."),
  pending("ferry-no-cargo", "Ferry (kargosuz)", "Kargosuz, sadece mürettebat ve yakıtla yapılan ferry uçuşu."),
  pending("fuel-density-variant", "Farklı yakıt yoğunlukları", "0.785 dışında bir yakıt yoğunluğu (ör. 0.760 veya 0.800)."),
];

export function scenarioCoverage(): { total: number; withReference: number; pending: number } {
  const withReference = scenarios.filter((s) => s.status === "REFERENCE_AVAILABLE").length;
  return { total: scenarios.length, withReference, pending: scenarios.length - withReference };
}
