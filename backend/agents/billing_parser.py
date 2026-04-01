"""GCP billing CSV parser — normalises varied column names and cleans data."""

from __future__ import annotations

import pandas as pd

# Maps our canonical column names to common variants found in GCP exports
EXPECTED_COLUMNS: dict[str, list[str]] = {
    "service": [
        "Service description", "service_description", "Service", "service",
    ],
    "sku": [
        "SKU description", "sku_description", "SKU", "sku",
    ],
    "usage_start": [
        "Usage start date", "usage_start_date", "start_date", "date",
    ],
    "usage_end": [
        "Usage end date", "usage_end_date", "end_date",
    ],
    "usage_amount": [
        "Usage amount", "usage_amount", "usage",
    ],
    "usage_unit": [
        "Usage unit", "usage_unit", "unit",
    ],
    "cost": [
        "Cost ($)", "cost", "Cost", "amount",
    ],
}


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Map whatever column names exist to canonical names."""
    column_map: dict[str, str] = {}
    for standard_name, variants in EXPECTED_COLUMNS.items():
        for variant in variants:
            if variant in df.columns:
                column_map[variant] = standard_name
                break
    return df.rename(columns=column_map)


def parse_billing_csv(raw_rows: list[dict]) -> pd.DataFrame:
    """Convert the list-of-dicts from a CSV upload into a clean DataFrame.

    Parameters
    ----------
    raw_rows:
        Each dict represents one CSV row (as produced by ``csv.DictReader``).

    Returns
    -------
    pd.DataFrame with normalised columns, parsed dates, and numeric cost/usage.
    """
    if not raw_rows:
        return pd.DataFrame()

    df = pd.DataFrame(raw_rows)
    df = normalize_columns(df)

    # Parse dates
    if "usage_start" in df.columns:
        df["usage_start"] = pd.to_datetime(df["usage_start"], errors="coerce")
        df["month"] = df["usage_start"].dt.to_period("M").astype(str)

    # Parse cost — strip dollar signs & commas, coerce to float
    if "cost" in df.columns:
        df["cost"] = pd.to_numeric(
            df["cost"]
            .astype(str)
            .str.replace("$", "", regex=False)
            .str.replace(",", "", regex=False),
            errors="coerce",
        ).fillna(0.0)

    # Parse usage amount
    if "usage_amount" in df.columns:
        df["usage_amount"] = pd.to_numeric(
            df["usage_amount"], errors="coerce"
        ).fillna(0.0)

    return df
