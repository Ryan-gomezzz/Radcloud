# Marketing site copy — Tech stack (Bedrock)

Use this on **https://bytemyops.ahadullabaig.in/** (or the RADCloud marketing site) in the Tech Stack section.

## Replace the old “Claude API” card

**Before:**  
“Claude API — LLM reasoning backbone powering all 5 agents”

**After:**  
**AWS Bedrock (Claude)** — LLM reasoning backbone powering all 5 agents via Amazon Bedrock’s managed inference.

Optional longer blurb for tooltips or detail pages:

> Multi-agent orchestration uses **Anthropic Claude** through **AWS Bedrock** (`invoke_model`), keeping inference AWS-native and aligned with the migration target platform.

This repo’s backend implements Bedrock in [`backend/llm.py`](../backend/llm.py) with model ID from [`backend/config.py`](../backend/config.py).
