# extract-ahm560

PDF → JSON çıkarım araçları. `docs/IMPLEMENTATION_PLAN.md` Faz 2'de kullanılır.

Girdi: `~/Downloads/AHM 560 -AIRBUS_A330_200P2F_APPROVED_FINAL.pdf` (repoya commit edilmez)
Çıktı: `packages/ahm-data/data/a330-243p2f/ed1-rev0/*.json`

Her sayısal değer `docs/AHM560_GROUND_TRUTH.md`'ye karşı test edilir
(`packages/ahm-data/test/ground-truth.test.ts`, Faz 2).

## Kurulum

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Çalıştırma

```bash
python extract.py "/path/to/AHM 560 -AIRBUS_A330_200P2F_APPROVED_FINAL.pdf"
```
