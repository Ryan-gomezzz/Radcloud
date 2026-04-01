"""Discovery Agent — extracts structured GCP inventory from Terraform / YAML.

Reads ``context["gcp_config_raw"]`` (Terraform HCL, YAML, or gcloud output),
uses Claude via AWS Bedrock to parse it into a normalised JSON inventory,
and writes the result to ``context["gcp_inventory"]``.

If the LLM call fails, writes an empty inventory with an error record.
A hardcoded NovaPay demo fallback is added separately in step 2.3.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from llm import call_llm_async
from agents.gcp_services import GCP_SERVICES, KNOWN_RESOURCE_TYPES, TERRAFORM_TYPE_TO_RESOURCE

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt — built once at module load from gcp_services registry.
# ---------------------------------------------------------------------------

# Build a Terraform type → canonical type mapping string for the prompt.
_TF_TYPE_LINES = "\n".join(
    f"  {info['terraform_type']}  →  resource_type \"{rtype}\",  service \"{info['service']}\""
    for rtype, info in sorted(GCP_SERVICES.items())
)

DISCOVERY_SYSTEM_PROMPT = f"""\
You are a GCP infrastructure analyst. You will receive raw infrastructure \
configuration — typically Terraform HCL, but it may also be YAML or gcloud \
CLI output. Your job is to extract **every** GCP resource into a structured \
JSON inventory.

### Terraform resource type mapping

When you encounter a Terraform ``resource`` block, map the Terraform type \
to the canonical ``resource_type`` and ``service`` name using this table:

{_TF_TYPE_LINES}

If the Terraform type is not in this table, set ``resource_type`` to \
``"other"`` and put the original Terraform type in ``config.terraform_type``. \
Still capture all visible configuration.

### Output schema

Return a **JSON array** where each element is an object with exactly these keys:

```
{{
  "resource_id":   "<unique id derived from the resource name in the config>",
  "resource_type": "<canonical type from the table above, or \\"other\\">",
  "service":       "<GCP service name, e.g. \\"Compute Engine\\", \\"Cloud SQL\\">",
  "name":          "<human-readable name from the config>",
  "config":        {{ <dict of migration-relevant config fields> }}
}}
```

### Rules for the ``config`` dict

- Include fields such as: ``machine_type``, ``region``, ``zone``, \
``disk_size_gb``, ``disk_type``, ``database_version``, ``tier``, \
``storage_class``, ``runtime``, ``memory``, ``cpu``, ``labels``, \
``availability_type``, ``ip_cidr_range``, ``source_ranges``, \
``target_tags``, ``direction``, ``ports``, ``versioning``, etc. — \
whatever is present in the source config.
- For nested blocks (``boot_disk``, ``network_interface``, ``settings``, \
``template.spec.containers``), flatten the key fields into the ``config`` \
dict — do **not** preserve the nesting.
- Derive ``region`` from ``zone`` when only zone is given \
(e.g. ``us-central1-a`` → ``region: "us-central1"``).
- For Cloud SQL read replicas, include ``replica_of`` with the master \
instance name in ``config``.

### Critical rules

1. Extract **ALL** resources — do not skip any, even trivial ones.
2. If the config uses Terraform modules, extract the module source and \
visible parameters. Set ``resource_type`` to ``"terraform_module"``.
3. Respond with **ONLY** the JSON array. No markdown, no explanation, \
no code fences, no backticks, no surrounding text.
"""


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def run(context: dict) -> dict:
    """Run the Discovery Agent.

    Reads ``gcp_config_raw`` from *context*, calls Claude to extract a
    structured GCP inventory, and writes the result to ``gcp_inventory``.
    """
    gcp_config: str = context.get("gcp_config_raw", "")

    if not gcp_config or not gcp_config.strip():
        context["gcp_inventory"] = []
        context.setdefault("errors", []).append({
            "agent": "discovery",
            "error": "No GCP configuration provided",
        })
        return context

    # --- Call Claude via Bedrock ---
    try:
        raw_text = await call_llm_async(
            system=DISCOVERY_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": (
                    "Extract all GCP resources from this infrastructure "
                    "configuration:\n\n" + gcp_config
                ),
            }],
            max_tokens=8192,
            temperature=0.0,
        )
    except Exception as exc:
        logger.exception("Discovery agent: Bedrock call failed")
        context["gcp_inventory"] = []
        context.setdefault("errors", []).append({
            "agent": "discovery",
            "error": f"LLM call failed: {exc}",
        })
        return context

    # --- Parse and validate the response ---
    inventory = _parse_llm_response(raw_text)

    if inventory is None:
        logger.error(
            "Discovery agent: could not parse LLM response (len=%d)",
            len(raw_text) if raw_text else 0,
        )
        context["gcp_inventory"] = []
        context.setdefault("errors", []).append({
            "agent": "discovery",
            "error": "Failed to parse LLM response as JSON",
        })
        return context

    # Normalise resource types against our registry.
    inventory = [_normalise_resource(r) for r in inventory]

    context["gcp_inventory"] = inventory
    return context


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_llm_response(raw_text: str) -> list[dict[str, Any]] | None:
    """Parse Claude's text response into a list of resource dicts.

    Handles the most common LLM output quirks:
      - Markdown code fences  (```json ... ```)
      - Leading / trailing whitespace
      - Response wrapped in an object instead of a bare array
    """
    if not raw_text:
        return None

    text = raw_text.strip()

    # --- Strip markdown code fences ---
    if text.startswith("```"):
        # Remove opening fence line (```json or ``` or ```hcl etc.)
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1:]
        # Remove closing fence
        last_fence = text.rfind("```")
        if last_fence != -1:
            text = text[:last_fence].rstrip()

    text = text.strip()

    # --- Attempt JSON parse ---
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        # Sometimes Claude adds trailing commas or comments.  Try a
        # second pass stripping trailing commas before closing brackets.
        cleaned = _strip_trailing_commas(text)
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            logger.error("Discovery agent: JSON decode failed after cleanup")
            return None

    # --- Unwrap if Claude returned an object wrapper ---
    if isinstance(parsed, dict):
        for key in ("gcp_inventory", "inventory", "resources", "data"):
            if key in parsed and isinstance(parsed[key], list):
                return parsed[key]
        # Dict with no recognisable key — not useful.
        logger.error(
            "Discovery agent: LLM returned dict without inventory key, "
            "keys=%s",
            list(parsed.keys()),
        )
        return None

    if isinstance(parsed, list):
        return parsed

    logger.error(
        "Discovery agent: unexpected response type %s", type(parsed).__name__
    )
    return None


def _strip_trailing_commas(text: str) -> str:
    """Remove trailing commas before ``]`` or ``}`` — a common LLM quirk."""
    import re
    return re.sub(r",\s*([}\]])", r"\1", text)


def _normalise_resource(resource: dict[str, Any]) -> dict[str, Any]:
    """Ensure a resource dict has all required fields and a valid type.

    - Fills missing ``resource_id``, ``name``, ``service`` from available data.
    - Normalises ``resource_type`` against our registry.
    - Ensures ``config`` is always a dict.
    """
    rtype = resource.get("resource_type", "other")

    # If Claude used a Terraform type name instead of our canonical key,
    # translate it (e.g. "google_compute_instance" → "compute_instance").
    if rtype in TERRAFORM_TYPE_TO_RESOURCE:
        rtype = TERRAFORM_TYPE_TO_RESOURCE[rtype]

    # Validate against known types; fall back to "other".
    if rtype not in KNOWN_RESOURCE_TYPES and rtype not in ("other", "terraform_module"):
        # Store the original type the LLM gave us in config for reference.
        config = resource.get("config") or {}
        config["original_resource_type"] = rtype
        resource["config"] = config
        rtype = "other"

    resource["resource_type"] = rtype

    # Fill service from registry if missing or wrong.
    if rtype in GCP_SERVICES:
        resource.setdefault("service", GCP_SERVICES[rtype]["service"])

    # Ensure required keys exist.
    resource.setdefault("resource_id", resource.get("name", "unknown"))
    resource.setdefault("name", resource.get("resource_id", "unknown"))
    resource.setdefault("config", {})
    resource.setdefault("service", "Other")

    return resource
