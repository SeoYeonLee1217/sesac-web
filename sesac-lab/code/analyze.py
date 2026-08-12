import csv
import os

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "seoul-apt-latest.csv")
TARGET_GU = "강남구"


def main():
    deals = []

    with open(DATA_PATH, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["gu"] != TARGET_GU:
                continue
            price = row["price"].strip()
            if not price:
                continue
            deals.append((row["complex"], int(price.replace(",", "")), row["contract_date"]))

    if not deals:
        print(f"{TARGET_GU} 데이터가 없습니다.")
        return

    deals.sort(key=lambda d: d[1], reverse=True)

    print(f"{TARGET_GU} 물건금액 상위 5건")
    for name, price, contract_date in deals[:5]:
        print(f"{name} | {price}만원 | {contract_date}")


if __name__ == "__main__":
    main()
