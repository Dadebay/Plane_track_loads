#!/usr/bin/env python3
"""
Extract all 15 fuel density index tables from AHM 560 (printed pages 17-46).

Column positions are derived from the DATA words themselves (clustered by
x0), not from the "Fuel Weight / Index Value" header label positions — the
offset between a header label's x0 and its column's actual data x0 varies
from ~12pt to ~40pt across pages (font/kerning differences per page), which
made a header-anchored tolerance approach silently drop rows on some pages.
Rows are matched by nearest `top` within each of the two (weight, index)
column pairs rather than a shared rounding grid, since a weight word and
its index word on the same visual row can differ in `top` by ~1pt — enough
to fall in different buckets right at a rounding boundary.

Usage:
    .venv/bin/python3 extract_fuel.py "/path/to/AHM 560 -AIRBUS_A330_200P2F_APPROVED_FINAL.pdf"
"""

import json
import re
import sys
from pathlib import Path

import pdfplumber

HEADER_SEARCH_MIN = 250
HEADER_SEARCH_MAX = 330
DATA_TOP_MAX = 700  # excludes page footer / page-number text
X0_CLUSTER_GAP = 20  # a gap this wide in sorted x0 marks a new column
ROW_MATCH_TOLERANCE = 5.0  # max |top diff| to pair a weight word with its index word


def extract_density(page) -> str | None:
    text = page.extract_text() or ""
    m = re.search(r"FUEL DENSITY:\s*([0-9.]+)", text)
    return m.group(1) if m else None


def find_header_bottom(page) -> float:
    words = page.extract_words()
    header_words = [
        w
        for w in words
        if HEADER_SEARCH_MIN <= w["top"] <= HEADER_SEARCH_MAX and w["text"] in ("Fuel", "Index")
    ]
    fuel_headers = [w for w in header_words if w["text"] == "Fuel"]
    index_headers = [w for w in header_words if w["text"] == "Index"]
    if len(fuel_headers) != 2 or len(index_headers) != 2:
        raise ValueError(
            f"Expected 2 'Fuel' and 2 'Index' headers, got {len(fuel_headers)} and {len(index_headers)} "
            f"(tops found: {sorted(round(w['top'], 1) for w in header_words)})"
        )
    return max(w["bottom"] for w in header_words)


def cluster_by_x0(words: list[dict]) -> list[list[dict]]:
    ordered = sorted(words, key=lambda w: w["x0"])
    clusters: list[list[dict]] = []
    for w in ordered:
        if clusters and (w["x0"] - clusters[-1][-1]["x0"]) <= X0_CLUSTER_GAP:
            clusters[-1].append(w)
        else:
            clusters.append([w])
    return clusters


def pair_by_nearest_top(weights: list[dict], indices: list[dict]) -> list[tuple[str, str]]:
    weights = sorted(weights, key=lambda w: w["top"])
    indices = sorted(indices, key=lambda w: w["top"])
    pairs: list[tuple[str, str]] = []
    used_idx: set[int] = set()
    for w in weights:
        best_j, best_d = None, 1e9
        for j, ix in enumerate(indices):
            if j in used_idx:
                continue
            d = abs(w["top"] - ix["top"])
            if d < best_d:
                best_j, best_d = j, d
        if best_j is not None and best_d <= ROW_MATCH_TOLERANCE:
            used_idx.add(best_j)
            pairs.append((w["text"], indices[best_j]["text"]))
        else:
            raise ValueError(f"No index match within tolerance for weight word {w!r}")
    if len(used_idx) != len(indices):
        unmatched = [ix["text"] for j, ix in enumerate(indices) if j not in used_idx]
        raise ValueError(f"Unmatched index words left over: {unmatched}")
    return pairs


def extract_page_pairs(page) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """Returns (left_column_pairs, right_column_pairs), each top-to-bottom."""
    header_bottom = find_header_bottom(page)
    words = page.extract_words()
    data_words = [w for w in words if header_bottom < w["top"] <= DATA_TOP_MAX]

    clusters = cluster_by_x0(data_words)
    if len(clusters) != 4:
        widths = [(round(c[0]["x0"], 1), round(c[-1]["x0"], 1), len(c)) for c in clusters]
        raise ValueError(f"Expected 4 x0 clusters (weight/index x2), got {len(clusters)}: {widths}")

    left_weight, left_index, right_weight, right_index = clusters  # sorted left-to-right by x0

    left_pairs = pair_by_nearest_top(left_weight, left_index)
    right_pairs = pair_by_nearest_top(right_weight, right_index)
    return left_pairs, right_pairs


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    out_dir = (
        Path(__file__).resolve().parents[2]
        / "packages"
        / "ahm-data"
        / "data"
        / "a330-243p2f"
        / "ed1-rev0"
    )
    out_dir.mkdir(parents=True, exist_ok=True)

    tables: dict[str, list[dict[str, str]]] = {}

    with pdfplumber.open(pdf_path) as pdf:
        # PDF pages are 0-indexed; printed page N (fuel tables run 17-46)
        # sits at pdf.pages[N] because the cover page is unnumbered.
        for printed_page in range(17, 47):
            page = pdf.pages[printed_page]
            density = extract_density(page)
            if density is None:
                raise ValueError(f"No FUEL DENSITY found on printed page {printed_page}")

            try:
                left, right = extract_page_pairs(page)
            except ValueError as e:
                raise ValueError(f"printed page {printed_page} (density {density}): {e}") from e

            entries = tables.setdefault(density, [])
            for w, i in left + right:
                entries.append({"fuelWeight": w, "index": i})

    ordered = {d: tables[d] for d in sorted(tables.keys(), key=float)}

    out_file = out_dir / "fuel-index.json"
    out_file.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n")

    print(f"Densities extracted: {len(ordered)}")
    for density, entries in ordered.items():
        print(f"  {density}: {len(entries)} rows (last: {entries[-1] if entries else None})")
    print(f"Written to {out_file}")


if __name__ == "__main__":
    main()
