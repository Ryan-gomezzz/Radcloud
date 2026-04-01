"""Claude via AWS Bedrock (Anthropic Messages API on Bedrock)."""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import boto3
from botocore.exceptions import ClientError

from config import BEDROCK_MODEL_ID, BEDROCK_REGION

_bedrock_client = None


def _get_bedrock_client():
    global _bedrock_client
    if _bedrock_client is None:
        _bedrock_client = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)
    return _bedrock_client


def call_llm(
    messages: list[dict[str, Any]],
    system: str = "",
    max_tokens: int = 4096,
    temperature: float = 0.0,
    max_retries: int = 2,
) -> str:
    """
    Invoke Claude on Bedrock. Returns assistant text.

    `messages` items use `role` and `content` (string or Bedrock content blocks list).
    """
    formatted_messages: list[dict[str, Any]] = []
    for msg in messages:
        content = msg["content"]
        if isinstance(content, str):
            content = [{"type": "text", "text": content}]
        formatted_messages.append({"role": msg["role"], "content": content})

    request_body: dict[str, Any] = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": formatted_messages,
    }
    if system:
        request_body["system"] = system

    client = _get_bedrock_client()

    for attempt in range(max_retries + 1):
        try:
            response = client.invoke_model(
                modelId=BEDROCK_MODEL_ID,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(request_body),
            )
            response_body = json.loads(response["body"].read())
            blocks = response_body.get("content") or []
            if not blocks:
                return ""
            return blocks[0].get("text", "")
        except ClientError as e:
            code = (e.response.get("Error") or {}).get("Code", "")
            if code in ("ThrottlingException", "ModelTimeoutException") and attempt < max_retries:
                time.sleep(2**attempt)
                continue
            raise

    return ""


async def call_llm_async(
    messages: list[dict[str, Any]],
    system: str = "",
    max_tokens: int = 4096,
    temperature: float = 0.0,
    max_retries: int = 2,
) -> str:
    """Async wrapper: boto3 is sync, so run in the default executor."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None,
        lambda: call_llm(
            messages,
            system=system,
            max_tokens=max_tokens,
            temperature=temperature,
            max_retries=max_retries,
        ),
    )
