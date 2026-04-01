"""Central Bedrock / AWS settings (override via environment variables)."""

import os

# Prefer Sonnet 4.6; override with BEDROCK_MODEL_ID if your account uses another inference profile.
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-sonnet-4-6")
BEDROCK_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
