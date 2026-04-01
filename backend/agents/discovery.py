"""Discovery Agent — extracts structured GCP inventory from Terraform / YAML.

Reads ``context["gcp_config_raw"]`` (Terraform HCL, YAML, or gcloud output),
uses Claude via AWS Bedrock to parse it into a normalised JSON inventory,
and writes the result to ``context["gcp_inventory"]``.

If the LLM call fails, writes an empty inventory with an error record.
A hardcoded NovaPay demo fallback is added separately in step 2.3.

Validation pipeline (per resource):
  1. ``_clean_resource_type``  — fuzzy-match type strings to canonical keys
  2. ``_normalise_resource``   — fill missing fields, translate TF types
  3. ``_validate_resource``    — strict check all 5 required fields present

``_validate_inventory`` runs this pipeline across the full list, keeps valid
resources, and logs/discards broken ones.
"""

from __future__ import annotations

import json
import logging
import re
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

    # Validate, normalise, and filter the inventory.
    inventory = _validate_inventory(inventory)

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
    return re.sub(r",\s*([}\]])", r"\1", text)


# ---------------------------------------------------------------------------
# Resource type cleaning / fuzzy matching
# ---------------------------------------------------------------------------

# Pre-build a lookup from every plausible variant to the canonical key.
# Covers: lowercase, stripped underscores/hyphens, and Terraform type names.
_TYPE_ALIASES: dict[str, str] = {}
for _rtype, _info in GCP_SERVICES.items():
    _TYPE_ALIASES[_rtype] = _rtype                                       # exact
    _TYPE_ALIASES[_rtype.replace("_", "")] = _rtype                       # no underscores
    _TYPE_ALIASES[_rtype.replace("_", "-")] = _rtype                      # kebab-case
    _TYPE_ALIASES[_info["terraform_type"]] = _rtype                       # TF type
    _TYPE_ALIASES[_info["terraform_type"].replace("google_", "")] = _rtype # TF without prefix
    _TYPE_ALIASES[_info["service"].lower()] = _rtype                      # service name


def _clean_resource_type(raw_type: str) -> str:
    """Fuzzy-match a raw resource type string to a canonical registry key.

    Handles common Claude variations:
      - PascalCase   ("ComputeInstance"  → "compute_instance")
      - kebab-case   ("compute-instance" → "compute_instance")
      - Terraform    ("google_compute_instance" → "compute_instance")
      - Service name ("Cloud SQL" → "cloud_sql")

    Returns the canonical type, or ``"other"`` if no match.
    """
    if not raw_type:
        return "other"

    # Fast path — already canonical.
    if raw_type in KNOWN_RESOURCE_TYPES or raw_type in ("other", "terraform_module"):
        return raw_type

    # Check the Terraform type → canonical mapping first.
    if raw_type in TERRAFORM_TYPE_TO_RESOURCE:
        return TERRAFORM_TYPE_TO_RESOURCE[raw_type]

    # Normalise: lowercase, convert PascalCase/camelCase to snake_case.
    normalised = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", raw_type).lower()
    normalised = normalised.replace("-", "_").replace(" ", "_").strip()

    # Exact match on normalised form?
    if normalised in KNOWN_RESOURCE_TYPES:
        return normalised

    # Alias lookup — try the normalised form first (with underscores),
    # then the compressed form (without underscores).
    if normalised in _TYPE_ALIASES:
        return _TYPE_ALIASES[normalised]
    compressed = normalised.replace("_", "")
    if compressed in _TYPE_ALIASES:
        return _TYPE_ALIASES[compressed]

    # Try without the "google_" prefix.
    if normalised.startswith("google_"):
        without_prefix = normalised[len("google_"):]
        if without_prefix in KNOWN_RESOURCE_TYPES:
            return without_prefix
        if without_prefix in _TYPE_ALIASES:
            return _TYPE_ALIASES[without_prefix]

    return "other"


# ---------------------------------------------------------------------------
# Resource normalisation
# ---------------------------------------------------------------------------

_REQUIRED_FIELDS = ("resource_id", "resource_type", "service", "name", "config")


def _normalise_resource(resource: dict[str, Any]) -> dict[str, Any]:
    """Normalise a single resource dict.

    1. Cleans ``resource_type`` via fuzzy matching.
    2. Fills missing fields from available data.
    3. Derives ``region`` from ``zone`` in config if absent.
    4. Ensures ``config`` is always a dict.
    """
    # --- Clean resource type ---
    raw_type = resource.get("resource_type", "other")
    rtype = _clean_resource_type(raw_type)

    # Store original type in config if it was translated to "other".
    if rtype == "other" and raw_type not in ("other", ""):
        config = resource.get("config") or {}
        config["original_resource_type"] = raw_type
        resource["config"] = config

    resource["resource_type"] = rtype

    # --- Fill service from registry ---
    if rtype in GCP_SERVICES:
        # Prefer registry service name over whatever Claude wrote.
        resource["service"] = GCP_SERVICES[rtype]["service"]

    # --- Ensure required keys exist ---
    resource.setdefault("resource_id", resource.get("name", "unknown"))
    resource.setdefault("name", resource.get("resource_id", "unknown"))
    resource.setdefault("service", "Other")

    # Ensure config is a dict (Claude sometimes returns a string or list).
    cfg = resource.get("config")
    if not isinstance(cfg, dict):
        resource["config"] = {"raw": cfg} if cfg else {}

    # --- Derive region from zone if missing ---
    cfg = resource["config"]
    if "region" not in cfg and "zone" in cfg:
        zone = cfg["zone"]
        parts = zone.split("-")
        if len(parts) > 2 and len(parts[-1]) == 1 and parts[-1].isalpha():
            cfg["region"] = "-".join(parts[:-1])

    return resource


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate_resource(resource: Any) -> tuple[bool, str]:
    """Check that a resource has all required fields with correct types.

    Returns ``(True, "")`` if valid, or ``(False, reason)`` if not.
    """
    if not isinstance(resource, dict):
        return False, f"resource is {type(resource).__name__}, expected dict"

    for field in _REQUIRED_FIELDS:
        if field not in resource:
            return False, f"missing required field '{field}'"

    if not isinstance(resource["resource_id"], str) or not resource["resource_id"]:
        return False, "resource_id must be a non-empty string"

    if not isinstance(resource["resource_type"], str) or not resource["resource_type"]:
        return False, "resource_type must be a non-empty string"

    if not isinstance(resource["name"], str) or not resource["name"]:
        return False, "name must be a non-empty string"

    if not isinstance(resource["service"], str) or not resource["service"]:
        return False, "service must be a non-empty string"

    if not isinstance(resource["config"], dict):
        return False, f"config must be a dict, got {type(resource['config']).__name__}"

    return True, ""


def _validate_inventory(raw_items: list) -> list[dict[str, Any]]:
    """Run the full normalise → validate pipeline on an inventory list.

    - Normalises every resource.
    - Validates each normalised resource.
    - Keeps valid resources; logs and discards broken ones.
    - Returns only the validated resources.
    """
    valid: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for idx, raw in enumerate(raw_items):
        # Skip non-dict entries entirely.
        if not isinstance(raw, dict):
            logger.warning(
                "Discovery agent: item %d is %s, skipping",
                idx, type(raw).__name__,
            )
            continue

        # Normalise first (fills missing fields, cleans types).
        resource = _normalise_resource(raw)

        # Validate the normalised resource.
        ok, reason = _validate_resource(resource)
        if not ok:
            logger.warning(
                "Discovery agent: dropping resource at index %d — %s",
                idx, reason,
            )
            continue

        # Deduplicate: if two resources share the same resource_id,
        # suffix the later one.
        rid = resource["resource_id"]
        if rid in seen_ids:
            counter = 2
            while f"{rid}-{counter}" in seen_ids:
                counter += 1
            resource["resource_id"] = f"{rid}-{counter}"
            logger.info(
                "Discovery agent: duplicate resource_id '%s' → renamed to '%s'",
                rid, resource["resource_id"],
            )
        seen_ids.add(resource["resource_id"])

        valid.append(resource)

    if len(valid) < len(raw_items):
        logger.warning(
            "Discovery agent: kept %d/%d resources after validation",
            len(valid), len(raw_items),
        )

    return valid
