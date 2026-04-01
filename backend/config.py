"""Central Bedrock / AWS settings (override via environment variables)."""

import os

# Cross-region Claude 3.5 Sonnet v2 inference profile (on-demand compatible).
# Override with BEDROCK_MODEL_ID env var if your account uses a different model.
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-4-20250514-v1:0")
BEDROCK_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
