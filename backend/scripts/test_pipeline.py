"""Quick smoke test of the full FinOps pipeline."""
import csv
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.billing_parser import parse_billing_csv
from agents.pattern_analyzer import analyze_patterns
from agents.cost_engine import estimate_aws_costs
from agents.cost_comparison import build_monthly_comparison

# 1. Load billing CSV
csv_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "sample_billing.csv")
with open(csv_path, encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
print(f"Rows loaded: {len(rows)}")

# 2. Parse
df = parse_billing_csv(rows)
print(f"DataFrame shape: {df.shape}")
print(f"Columns: {list(df.columns)}")
print(f"Months: {sorted(df['month'].unique())}")

# 3. Analyze patterns
patterns = analyze_patterns(df)
print(f"\nPatterns ({len(patterns)}):")
for p in patterns:
    print(f"  {p['gcp_service']:20s} -> {p['pattern']:15s} (CV={p['coefficient_of_variation']:.3f}, rec={p['recommendation']})")

# 4. Cost engine
mappings = [
    {"gcp_resource": "web-server-1", "aws_service": "EC2", "suggested_shape": "m5.xlarge"},
    {"gcp_resource": "main-db", "aws_service": "RDS PostgreSQL", "suggested_shape": "db.m5.large"},
]
cost = estimate_aws_costs(patterns, mappings)
print(f"\nCost results:")
print(f"  GCP monthly:     ${cost['total_monthly_gcp']:,.2f}")
print(f"  AWS on-demand:   ${cost['total_monthly_ondemand']:,.2f}")
print(f"  AWS optimised:   ${cost['total_monthly_optimized']:,.2f}")
print(f"  Monthly savings: ${cost['total_monthly_savings']:,.2f}")
print(f"  First-year:      ${cost['total_first_year_savings']:,.2f}")
print(f"  Obs window:      ${cost['savings_vs_observation_window']:,.2f}")

# 5. Validate hero number
ri_sum = sum(r["annual_savings"] for r in cost["ri_recommendations"])
hero = cost["total_first_year_savings"]
match = abs(ri_sum - hero) < 0.01
print(f"\nMATH CHECK: sum(RI annual) = ${ri_sum:,.2f}, hero = ${hero:,.2f}, match = {match}")

# 6. RI recommendations
print(f"\nRI Recommendations ({len(cost['ri_recommendations'])}):")
for r in cost["ri_recommendations"]:
    print(f"  {r['quantity']}x {r['instance_type']} {r['aws_service']} ({r['term']}, {r['payment_option']}) -> saves ${r['annual_savings']:,.2f}/yr")

# 7. Monthly comparison
comp = build_monthly_comparison(df, cost)
print(f"\nMonthly comparison ({len(comp)} months):")
for c in comp[:3]:
    print(f"  {c['month']}: GCP ${c['gcp_cost']:,.2f} | AWS OD ${c['aws_ondemand']:,.2f} | AWS Opt ${c['aws_optimized']:,.2f}")
print("  ...")

# 8. Sanity checks
annual_gcp = cost["total_monthly_gcp"] * 12
savings_pct = (cost["total_first_year_savings"] / annual_gcp * 100) if annual_gcp > 0 else 0
print(f"\nSanity: savings = {savings_pct:.1f}% of annual GCP spend (should be < 40%)")
print(f"Sanity: hero number in $30K-$50K range? {30000 <= hero <= 50000}")

if not match:
    print("\n!!! MATH INVARIANT FAILED !!!")
    sys.exit(1)
else:
    print("\n=== ALL CHECKS PASSED ===")
