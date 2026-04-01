"""One-off: write ../data/cached_response.json from stub agents."""
import asyncio
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from agents import discovery, finops, mapping, risk, watchdog  # noqa: E402


async def main() -> None:
    ctx: dict = {
        "gcp_config_raw": "",
        "gcp_billing_raw": [],
        "status": "starting",
        "errors": [],
    }
    for mod in (discovery, mapping, risk, finops, watchdog):
        ctx = await mod.run(ctx)
    ctx["status"] = "complete"
    out = pathlib.Path(__file__).resolve().parent.parent / "data" / "cached_response.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(ctx, indent=2), encoding="utf-8")
    print("Wrote", out)


if __name__ == "__main__":
    asyncio.run(main())
