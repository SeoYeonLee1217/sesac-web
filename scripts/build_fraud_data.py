import csv
import json
import os
import random

# 원본 CSV(150MB)는 이 저장소 밖(sesac-lab)에 있음 — 빌드 입력으로만 사용하고 커밋하지 않는다.
CSV_PATH = r"C:\Users\user\Projects\sesac-lab\creditcard.csv"
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT_PATH = os.path.join(ROOT, "data", "fraud_summary.json")

AMOUNT_BINS = [0, 10, 50, 100, 200, 500, 1000, float("inf")]
AMOUNT_LABELS = ["0-10", "10-50", "50-100", "100-200", "200-500", "500-1000", "1000+"]

random.seed(42)


def amount_bin_index(amount):
    for i in range(len(AMOUNT_BINS) - 1):
        if AMOUNT_BINS[i] <= amount < AMOUNT_BINS[i + 1]:
            return i
    return len(AMOUNT_BINS) - 2


def main():
    total = 0
    fraud_count = 0
    total_amount = 0.0
    fraud_amount = 0.0

    amount_hist = {0: [0] * len(AMOUNT_LABELS), 1: [0] * len(AMOUNT_LABELS)}
    hourly = {0: [0] * 24, 1: [0] * 24}

    normal_pool = []  # reservoir sample for scatter
    fraud_rows = []
    SAMPLE_SIZE = 1500

    with open(CSV_PATH, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1
            cls = int(row["Class"])
            amount = float(row["Amount"])
            time_sec = float(row["Time"])
            hour = int((time_sec % 86400) // 3600)

            total_amount += amount
            amount_hist[cls][amount_bin_index(amount)] += 1
            hourly[cls][hour] += 1

            if cls == 1:
                fraud_count += 1
                fraud_amount += amount
                fraud_rows.append(
                    {
                        "time_hr": round(time_sec / 3600, 1),
                        "amount": round(amount, 2),
                        "v14": round(float(row["V14"]), 3),
                        "v17": round(float(row["V17"]), 3),
                    }
                )
            else:
                # reservoir sampling for a representative normal-transaction sample
                if len(normal_pool) < SAMPLE_SIZE:
                    normal_pool.append(
                        {
                            "v14": round(float(row["V14"]), 3),
                            "v17": round(float(row["V17"]), 3),
                        }
                    )
                else:
                    j = random.randint(0, total - 1)
                    if j < SAMPLE_SIZE:
                        normal_pool[j] = {
                            "v14": round(float(row["V14"]), 3),
                            "v17": round(float(row["V17"]), 3),
                        }

    normal_count = total - fraud_count

    def normalize(counts, n):
        return [round(c / n * 100, 2) if n else 0 for c in counts]

    top_fraud = sorted(fraud_rows, key=lambda r: r["amount"], reverse=True)[:20]

    summary = {
        "meta": {
            "total": total,
            "fraud_count": fraud_count,
            "normal_count": normal_count,
            "fraud_rate": round(fraud_count / total * 100, 4),
            "total_amount": round(total_amount, 2),
            "fraud_amount": round(fraud_amount, 2),
            "avg_amount": round(total_amount / total, 2),
            "avg_fraud_amount": round(fraud_amount / fraud_count, 2),
            "avg_normal_amount": round((total_amount - fraud_amount) / normal_count, 2),
        },
        "amount_dist": {
            "labels": AMOUNT_LABELS,
            "normal_pct": normalize(amount_hist[0], normal_count),
            "fraud_pct": normalize(amount_hist[1], fraud_count),
        },
        "hourly_dist": {
            "hours": list(range(24)),
            "normal_pct": normalize(hourly[0], normal_count),
            "fraud_pct": normalize(hourly[1], fraud_count),
        },
        "scatter": {
            "normal_sample": normal_pool,
            "fraud_all": [{"v14": r["v14"], "v17": r["v17"]} for r in fraud_rows],
        },
        "top_fraud": top_fraud,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, separators=(",", ":"))

    print(f"total={total} fraud={fraud_count} ({summary['meta']['fraud_rate']}%)")
    print(f"written to {OUT_PATH}")


if __name__ == "__main__":
    main()
