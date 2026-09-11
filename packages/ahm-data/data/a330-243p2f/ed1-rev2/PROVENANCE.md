# AHM 560 — Airbus A330-243 P2F — Edition 1, Revision 2

Valid from **10.06.2025**.

Only the pages we physically hold for Rev.2 have been transcribed. Every other
file in this directory is **carried forward unchanged from Ed.1 Rev.0** because
an AHM revision reissues only the pages that changed — an unchanged file here is
not evidence that the page did not change, only that we have not seen the Rev.2
page yet.

| File | Rev.2 source | Status |
|---|---|---|
| `dow-doi-matrix.json` | s.6 §III (photographed page, "Valid from 10.06.2025 · Edition 1 · Revision 2 · Page 6") | ✅ transcribed from Rev.2 |
| `aircraft.json` | s.6 header only — `edition`/`revision`/`effectiveDate` updated | ⚠️ **partial**: `registrations[].bew` / `bewIndex` / `bewCgMac` still carry Rev.0 values. The DOW shift below implies the aircraft was reweighed, so these are almost certainly stale. |
| `positions.json` | — | ⚠️ inherited from Rev.0, unverified against Rev.2 |
| `fuel-index.json` | — | ⚠️ inherited from Rev.0, unverified against Rev.2 |
| `cg-limits.json` | — | ⚠️ inherited from Rev.0, unverified against Rev.2 |
| `compartments.json` | — | ⚠️ inherited from Rev.0, unverified against Rev.2 |
| `combined-load.json` | — | ⚠️ inherited from Rev.0, unverified against Rev.2 |
| `zone-mapping.json` | — | ⚠️ inherited from Rev.0, unverified against Rev.2 |
| `uld-types.json` | — | ⚠️ inherited from Rev.0, unverified against Rev.2 |
| `crew-index.json` | — | ⚠️ inherited from Rev.0, unverified against Rev.2 |
| `index-formula.json` | — | ⚠️ inherited from Rev.0, unverified against Rev.2 |
| `cargo-index-table.json` | — | ⚠️ inherited from Rev.0, unverified against Rev.2. Its Rev.0 source is solid: verified cell by cell against the approved AHM 560 PDF, Appendix I s.74. |
| `lmc-index-table.json` | — | ⚠️ inherited from Rev.0. Rev.0 source is the approved plate, Appendix I s.74; all 17 cells reproduce `positions.json` exactly. See AHM560_ERRATA.md Kayıt 9. |
| `loading-zones-harm.json` | — | ⚠️ inherited from Rev.0. Rev.0 source is the approved plate, Appendix I s.74; self-consistent and reproduces `positions.json` for zones A..P. |
| `lateral-imbalance.json` | — | ⚠️ inherited from Rev.0. Payload half verified from the approved plate; **fuel half not transcribed** — see AHM560_ERRATA.md Kayıt 10. |
| `position-configurations.json` | — | ⚠️ inherited from Rev.0. Approved plate s.74 plus the operator's laminated card as an independent second reading; agrees with `positions.json` on all 119 positions. |
| `fuel-tank-index.json` | — | ⚠️ inherited from Rev.0 and **provisional**: single reading of a ~174 ppi scan that cannot separate 6 from 8. Must not reach a calculation. See AHM560_ERRATA.md Kayıt 10. |

## Why this revision matters

`docs/AHM560_GROUND_TRUTH.md` Bulgu #2 recorded a 676 kg unexplained gap between
the AHM's DOW table and the DOW actually printed on the T5 692 loadsheet. Rev.2
closes it:

| Source | EZ-F430, crew 2/3 | DOW | DOI |
|---|---|---|---|
| T5 692 loadsheet (2026-08-11) | | 111 043,70 | 78,22 |
| AHM 560 Ed.1 **Rev.0** s.6 | | 111 720 | 77,74 |
| AHM 560 Ed.1 **Rev.2** s.6 | | **111 044** | **78,19** |

The remaining 0,30 kg is the loadsheet carrying a fractional basic empty weight
where the AHM table is printed to whole kg.

Independently corroborated by the operator's manual Excel sheet
(`AIRBUS TAZE SENTR.xlsx`, cell `U24` = 111224 for EZ-F430 crew 3/4), which
matches this table's 3/4 cell exactly and does not match Rev.0's.

## Open — pages still needed for Rev.2

- Basic weight / BEW page (aircraft.json registrations)
- Loading index / position index page (positions.json) — Bulgu #7's LIZFW gap of
  1,10 index units is still unexplained and most likely lives here
- Standard fuel index table (fuel-index.json) — Bulgu #7's 0,45 fuel-index gap
- CG limit tables (cg-limits.json)
- Appendix I s.74 (the LOAD AND TRIM SHEET plate, page 2) as reissued for Rev.2,
  if it was — the Rev.0 plate is verified and in place, but a Rev.2 reissue would
  move the cargo index table, the LMC/H-arm tables and the position index data
  together.
- **Appendix I s.75 (the plate's page 3) in a legible copy.** The approved PDF
  carries it at ~174 ppi, where 6 and 8 are not separable, so
  `FUEL LATERAL MOMENT PER TANK TABLE` could not be transcribed at all and
  `FUEL INDEX PER TANK TABLE` is only provisional. A photograph of the
  operator's laminated card — the same deck the standard fuel index and cargo
  index cards came from — would close both. Blocks tank-based fuel
  distribution and the lateral imbalance check.
