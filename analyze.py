import csv

FILE_PATH = "seoul-apt-latest.csv"
TARGET_GU = "강남구"


def main():
    total_price = 0
    count = 0

    with open(FILE_PATH, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["자치구명"] != TARGET_GU:
                continue
            total_price += int(row["물건금액(만원)"])
            count += 1

    if count == 0:
        print(f"{TARGET_GU} 거래 데이터가 없습니다.")
        return

    avg_price_man = total_price / count
    avg_price_eok = round(avg_price_man / 10000, 1)

    print(f"{TARGET_GU} 평균 거래가: {avg_price_eok}억 원")
    print(f"{TARGET_GU} 거래 건수: {count}건")


if __name__ == "__main__":
    main()
