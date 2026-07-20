#!/usr/bin/env python3
"""
Generate a realistic financial dump file with 4 years of transactions (2023-2026).
Produces a JSON file matching the dump format expected by api-finance.
"""

import json
import uuid
import random
from datetime import datetime, timedelta, date

# ── Categories ──────────────────────────────────────────────────────────────

INCOME_CATEGORIES = [
    "stipendio",       # salary — monthly, main income
    "tredicesima",     # 13th-month salary — December
    "bonus",           # performance/project bonus — 1-2x/year
    "rimborsi",        # reimbursements — occasional
    "regali",          # gifts received — occasional
    "freelance",       # freelance/consulting income — occasional
    "interessi",       # interest/dividends — quarterly small
    "vendite",         # sales of personal items — rare
]

EXPENSE_CATEGORIES = [
    {"name": "affitto",       "freq": "monthly",    "min": 60000, "max": 65000},  # rent
    {"name": "spesa",         "freq": "weekly",     "min": 3000,  "max": 12000},  # groceries
    {"name": "bollette",      "freq": "monthly",    "min": 8000,  "max": 25000},  # utilities
    {"name": "ristorante",    "freq": "weekly",     "min": 2500,  "max": 8000},   # restaurants
    {"name": "trasporti",     "freq": "weekly",     "min": 1500,  "max": 5000},   # transport
    {"name": "palestra",      "freq": "monthly",    "min": 4000,  "max": 6000},   # gym
    {"name": "superfluo",     "freq": "weekly",     "min": 1000,  "max": 15000},  # discretionary
    {"name": "assicurazione", "freq": "monthly",    "min": 8000,  "max": 15000},  # insurance
    {"name": "tecnologia",    "freq": "rare",       "min": 10000, "max": 200000}, # tech
    {"name": "salute",        "freq": "occasional", "min": 2000,  "max": 50000},  # health
    {"name": "abbigliamento", "freq": "occasional", "min": 3000,  "max": 80000},  # clothing
    {"name": "viaggi",        "freq": "rare",       "min": 50000, "max": 300000}, # travel
    {"name": "regali",        "freq": "occasional", "min": 2000,  "max": 50000},  # gifts given
    {"name": "vino",          "freq": "weekly",     "min": 800,   "max": 4000},   # wine
    {"name": "birra",         "freq": "weekly",     "min": 500,   "max": 3000},   # beer
    {"name": "casa",          "freq": "occasional", "min": 5000,  "max": 150000}, # home maintenance
    {"name": "fitness",       "freq": "occasional", "min": 2000,  "max": 30000},  # fitness equipment
]

# ── Helpers ─────────────────────────────────────────────────────────────────

def random_date(start_year: int, end_year: int) -> date:
    """Return a random date between start_year-01-01 and end_year-12-31."""
    start = date(start_year, 1, 1)
    end = date(end_year, 12, 31)
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def random_day_in_month(year: int, month: int) -> int:
    """Return a random valid day for the given month."""
    if month == 2:
        if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0):
            return random.randint(1, 29)
        return random.randint(1, 28)
    elif month in (4, 6, 9, 11):
        return random.randint(1, 30)
    else:
        return random.randint(1, 31)


def gen_uuid() -> str:
    return str(uuid.uuid4())


def gen_created_at(year: int, month: int) -> str:
    """Generate a plausible createdAt timestamp around the given month."""
    # createdAt is usually close to when the transaction was recorded,
    # but for bulk generation we spread it a bit — mostly within the same month
    # or slightly before (for past transactions).
    day = random.randint(1, 28)
    hour = random.randint(8, 22)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return f"{year:04d}-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}:{second:02d}.{random.randint(100, 999)}Z"


# ── Transaction generators ─────────────────────────────────────────────────

def generate_salary(year: int, month: int, base: int) -> dict:
    """Monthly salary — always on the 1st or 18th, consistent amount."""
    day = 1 if random.random() < 0.5 or month == 1 else 18  # sometimes 1st, sometimes 18th
    amount = base + random.randint(-20000, 20000)  # vary by ±200€
    return {
        "type": "income",
        "amount": amount,
        "category": "stipendio",
        "date": f"{year:04d}-{month:02d}-{day:02d}",
        "id": gen_uuid(),
        "createdAt": gen_created_at(year, month),
    }


def generate_tredicesima(year: int) -> dict:
    """13th month salary in December."""
    base = 520000  # €5200
    amount = base + random.randint(-30000, 30000)
    day = random.randint(10, 22)
    return {
        "type": "income",
        "amount": amount,
        "category": "tredicesima",
        "date": f"{year:04d}-12-{day:02d}",
        "id": gen_uuid(),
        "createdAt": gen_created_at(year, 12),
    }


def generate_bonus(year: int) -> dict:
    """Bonus — 1-2 times per year."""
    amount = random.randint(100000, 500000)  # €1000-5000
    month = random.randint(1, 12)
    day = random_day_in_month(year, month)
    return {
        "type": "income",
        "amount": amount,
        "category": "bonus",
        "date": f"{year:04d}-{month:02d}-{day:02d}",
        "id": gen_uuid(),
        "createdAt": gen_created_at(year, month),
    }


def generate_occasional_income(year: int, month: int, category: str) -> dict:
    """Occasional income (freelance, rimborsi, regali, interessi, vendite)."""
    ranges = {
        "freelance":   (50000, 300000),
        "rimborsi":    (5000,  80000),
        "regali":      (10000, 100000),
        "interessi":   (500,   5000),
        "vendite":     (20000, 200000),
    }
    lo, hi = ranges.get(category, (5000, 50000))
    amount = random.randint(lo, hi)
    day = random_day_in_month(year, month)
    return {
        "type": "income",
        "amount": amount,
        "category": category,
        "date": f"{year:04d}-{month:02d}-{day:02d}",
        "id": gen_uuid(),
        "createdAt": gen_created_at(year, month),
    }


def generate_expense(year: int, month: int, cat_def: dict) -> dict:
    """Generate a single expense transaction."""
    amount = random.randint(cat_def["min"], cat_def["max"])
    day = random_day_in_month(year, month)

    # Generate a realistic description for some categories
    descriptions = {
        "spesa": ["Supermercato", "Alimentari", "Pescheria", "Macelleria", "Fruttivendolo", "Panetteria"],
        "ristorante": ["Pizza", "Sushi", "Cena fuori", "Pranzo", "Aperitivo", "Trattoria"],
        "trasporti": ["Abbonamento mensile", "Benzina", "Biglietto treno", "Parcheggio", "Taxi"],
        "superfluo": ["Cinema", "Concerto", "Libri", "Videogiochi", "Hobby", "Streaming"],
        "tecnologia": ["Computer", "Telefono", "Accessori", "Software", "Cuffie", "Caricatore"],
        "salute": ["Farmacia", "Visita medica", "Dentista", "Analisi", "Fisioterapia"],
        "abbigliamento": ["Scarpe", "Giacca", "Pantaloni", "Maglia", "Accessori"],
        "viaggi": ["Volo", "Hotel", "Zaino", "Prenotazione", "Noleggio auto"],
        "regali": ["Compleanno", "Natale", "Anniversario", "Festa"],
        "casa": ["Manutenzione", "Mobili", "Elettrodomestico", "Utensili", "Decorazione"],
        "fitness": ["Attrezzatura", "Integratori", "Abbigliamento sportivo"],
        "vino": ["Cantina", "Enoteca", "Vino rosso", "Vino bianco", "Bollicine"],
        "birra": ["Birrificio", "Birra artigianale", "Pub", "Lattina", "Fusto"],
    }

    desc = None
    if cat_def["name"] in descriptions:
        desc = random.choice(descriptions[cat_def["name"]])

    tx = {
        "type": "expense",
        "amount": amount,
        "category": cat_def["name"],
        "date": f"{year:04d}-{month:02d}-{day:02d}",
        "id": gen_uuid(),
        "createdAt": gen_created_at(year, month),
    }
    if desc and random.random() < 0.6:
        tx["description"] = desc
    return tx


# ── Main generation ─────────────────────────────────────────────────────────

def generate_transactions_for_year(year: int) -> list:
    """Generate all transactions for a single year."""
    transactions = []
    base_salary = random.choice([480000, 500000, 520000, 550000])  # €4800-5500

    for month in range(1, 13):
        # ── Income ──────────────────────────────────────
        # Salary every month
        transactions.append(generate_salary(year, month, base_salary))

        # Occasional extra income
        extra_income_roll = random.random()
        if extra_income_roll < 0.15:
            # Freelance or rimborsi
            cat = random.choice(["freelance", "rimborsi", "regali"])
            transactions.append(generate_occasional_income(year, month, cat))
        elif extra_income_roll < 0.20:
            # Small extra (interessi)
            transactions.append(generate_occasional_income(year, month, "interessi"))

        # ── Expenses ────────────────────────────────────
        # Monthly expenses (always 1 each)
        for cat_def in EXPENSE_CATEGORIES:
            if cat_def["freq"] == "monthly":
                transactions.append(generate_expense(year, month, cat_def))

        # Weekly expenses (3-5 per month)
        for cat_def in EXPENSE_CATEGORIES:
            if cat_def["freq"] == "weekly":
                n = random.randint(2, 5)
                for _ in range(n):
                    transactions.append(generate_expense(year, month, cat_def))

        # Occasional expenses (0-2 per month)
        for cat_def in EXPENSE_CATEGORIES:
            if cat_def["freq"] == "occasional":
                if random.random() < 0.35:
                    n = random.randint(1, 2)
                    for _ in range(n):
                        transactions.append(generate_expense(year, month, cat_def))

        # Rare expenses (0-1 every few months)
        for cat_def in EXPENSE_CATEGORIES:
            if cat_def["freq"] == "rare":
                if random.random() < 0.15:
                    transactions.append(generate_expense(year, month, cat_def))

    # ── Year-specific extras ──────────────────────────
    # 13th month salary in December
    transactions.append(generate_tredicesima(year))

    # Bonus 1-2 times per year
    n_bonus = random.randint(1, 2)
    for _ in range(n_bonus):
        transactions.append(generate_bonus(year))

    # One-off sales (rare)
    if random.random() < 0.3:
        transactions.append(generate_occasional_income(year, random.randint(1, 12), "vendite"))

    return transactions


def main():
    random.seed(42)
    all_transactions = []

    for year in range(2023, 2027):  # 2023, 2024, 2025, 2026
        txs = generate_transactions_for_year(year)
        all_transactions.extend(txs)
        print(f"  {year}: {len(txs)} transactions generated")

    # Sort by date then createdAt
    all_transactions.sort(key=lambda t: (t["date"], t["createdAt"]))

    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.") + f"{datetime.utcnow().microsecond // 1000:03d}Z"

    dump = {
        "schemaVersion": 1,
        "savedAt": now,
        "transactions": all_transactions,
    }

    output_path = "/home/alberto/repo/llm/openfinance/generated_dump.json"
    with open(output_path, "w") as f:
        json.dump(dump, f, indent=2, ensure_ascii=False)

    file_size = len(json.dumps(dump, ensure_ascii=False))
    print(f"\nTotal: {len(all_transactions)} transactions")
    print(f"File size: {file_size / 1024:.1f} KB")
    print(f"Output: {output_path}")

    # Summary stats
    income_txs = [t for t in all_transactions if t["type"] == "income"]
    expense_txs = [t for t in all_transactions if t["type"] == "expense"]
    total_income = sum(t["amount"] for t in income_txs)
    total_expenses = sum(t["amount"] for t in expense_txs)
    print(f"\nIncome transactions: {len(income_txs)} — total: €{total_income/100:.2f}")
    print(f"Expense transactions: {len(expense_txs)} — total: €{total_expenses/100:.2f}")
    print(f"Balance: €{(total_income - total_expenses)/100:.2f}")


if __name__ == "__main__":
    main()