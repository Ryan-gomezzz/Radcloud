"""Bedrock Titan Embeddings v2 wrapper for RAG."""
from __future__ import annotations

import json
import logging

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

_EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0"
_EMBEDDING_DIM = 1024  # Titan v2 output dimension


def get_embedding(text: str, region: str = "us-east-1") -> list[float] | None:
    """Return embedding vector for a text string using Bedrock Titan v2."""
    try:
        client = boto3.client("bedrock-runtime", region_name=region)
        body = json.dumps({
            "inputText": text[:8000],  # Titan v2 max input
            "dimensions": _EMBEDDING_DIM,
            "normalize": True,
        })
        response = client.invoke_model(
            modelId=_EMBEDDING_MODEL_ID,
            body=body,
            contentType="application/json",
            accept="application/json",
        )
        result = json.loads(response["body"].read())
        return result.get("embedding")
    except ClientError as e:
        logger.warning("Bedrock embedding failed: %s", e)
        return None
    except Exception as e:
        logger.warning("Embedding error: %s", e)
        return None


def embedding_dimension() -> int:
    return _EMBEDDING_DIM
