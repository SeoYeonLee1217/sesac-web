import csv
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
CSV_PATH = os.path.join(ROOT, "seoul-apt-latest.csv")
DATA_DIR = os.path.join(ROOT, "data")

GU_LIST = ["강남구", "서초구", "송파구"]
GU_INDEX = {gu: i for i, gu in enumerate(GU_LIST)}


def load_rows():
    rows = []
    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["gu"] not in GU_INDEX:
                continue
            if row["deal_type"] != "매매":
                continue
            price = row["price"].strip()
            if not price:
                continue
            try:
                rows.append(
                    {
                        "ym": row["contract_ym"],
                        "d": row["contract_date"],
                        "g": GU_INDEX[row["gu"]],
                        "n": row["dong"],
                        "c": row["complex"],
                        "a": float(row["area_m2"]),
                        "f": int(row["floor"]),
                        "p": int(price.replace(",", "")),
                        "pp": int(row["price_per_pyeong"].replace(",", "")),
                    }
                )
            except ValueError:
                continue
    return rows


def build_summary(rows):
    months = sorted({r["ym"] for r in rows})
    by_gu = {}

    for gu in GU_LIST:
        gu_rows = [r for r in rows if r["g"] == GU_INDEX[gu]]
        count = len(gu_rows)
        avg_price = round(sum(r["p"] for r in gu_rows) / count)
        avg_ppy = round(sum(r["pp"] for r in gu_rows) / count)
        top = max(gu_rows, key=lambda r: r["p"])

        monthly = []
        for ym in months:
            m_rows = [r for r in gu_rows if r["ym"] == ym]
            m_count = len(m_rows)
            m_avg = round(sum(r["p"] for r in m_rows) / m_count) if m_count else 0
            monthly.append({"ym": ym, "count": m_count, "avg_price": m_avg})

        by_gu[gu] = {
            "count": count,
            "avg_price": avg_price,
            "avg_price_per_pyeong": avg_ppy,
            "max_deal": {
                "price": top["p"],
                "complex": top["c"],
                "area_m2": top["a"],
                "contract_date": top["d"],
            },
            "monthly": monthly,
        }

    return {
        "meta": {
            "period": {"from": months[0], "to": months[-1]},
            "total_deals": len(rows),
            "gu_list": GU_LIST,
            "source": "국토교통부 아파트 실거래가 (매매)",
        },
        "by_gu": by_gu,
    }


def build_deals(rows):
    fields = ["d", "g", "n", "c", "a", "f", "p", "pp"]
    out_rows = [[r[k] for k in fields] for r in rows]
    return {"fields": fields, "gu_list": GU_LIST, "rows": out_rows}


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    rows = load_rows()

    summary = build_summary(rows)
    with open(os.path.join(DATA_DIR, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, separators=(",", ":"))

    deals = build_deals(rows)
    with open(os.path.join(DATA_DIR, "deals.json"), "w", encoding="utf-8") as f:
        json.dump(deals, f, ensure_ascii=False, separators=(",", ":"))

    print(f"rows: {len(rows)}")
    print(f"summary.json, deals.json written to {DATA_DIR}")


if __name__ == "__main__":
    main()
