"""LLM calls: AWS Bedrock (Claude) first; optional OpenAI fallback via OPENAI_API_KEY."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any

import boto3
from botocore.exceptions import ClientError

from config import BEDROCK_MODEL_ID, BEDROCK_REGION

logger = logging.getLogger(__name__)

_bedrock_client = None

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip() or None
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
# auto | bedrock | openai
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "auto").strip().lower()


def _get_bedrock_client():
    global _bedrock_client
    if _bedrock_client is None:
        _bedrock_client = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)
    return _bedrock_client


def _format_messages_for_bedrock(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    formatted: list[dict[str, Any]] = []
    for msg in messages:
        content = msg["content"]
        if isinstance(content, str):
            content = [{"type": "text", "text": content}]
        formatted.append({"role": msg["role"], "content": content})
    return formatted


def _call_bedrock(
    messages: list[dict[str, Any]],
    system: str = "",
    max_tokens: int = 4096,
    temperature: float = 0.0,
    max_retries: int = 2,
) -> str:
    formatted_messages = _format_messages_for_bedrock(messages)
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


def _flatten_openai_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
            elif isinstance(block, dict) and "text" in block:
                parts.append(str(block["text"]))
        return "\n".join(parts) if parts else str(content)
    return str(content)


def _call_openai(
    messages: list[dict[str, Any]],
    system: str = "",
    max_tokens: int = 4096,
    temperature: float = 0.0,
) -> str:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not set")

    try:
        from openai import OpenAI
    except ImportError as e:
        raise RuntimeError("openai package not installed; pip install openai") from e

    client = OpenAI(api_key=OPENAI_API_KEY)
    oa_messages: list[dict[str, str]] = []
    if system:
        oa_messages.append({"role": "system", "content": system})
    for m in messages:
        role = m.get("role", "user")
        if role not in ("user", "assistant", "system"):
            role = "user"
        text = _flatten_openai_content(m.get("content", ""))
        oa_messages.append({"role": role, "content": text})

    r = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=oa_messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    choice = r.choices[0].message
    return (choice.content or "").strip()


def call_llm(
    messages: list[dict[str, Any]],
    system: str = "",
    max_tokens: int = 4096,
    temperature: float = 0.0,
    max_retries: int = 2,
) -> str:
    """
    Invoke the configured LLM. Default: try Bedrock, then OpenAI if OPENAI_API_KEY is set.
    Set LLM_PROVIDER=openai to force OpenAI; LLM_PROVIDER=bedrock to force Bedrock only.
    """
    if LLM_PROVIDER == "openai":
        return _call_openai(messages, system=system, max_tokens=max_tokens, temperature=temperature)
    if LLM_PROVIDER == "bedrock":
        return _call_bedrock(
            messages,
            system=system,
            max_tokens=max_tokens,
            temperature=temperature,
            max_retries=max_retries,
        )

    try:
        return _call_bedrock(
            messages,
            system=system,
            max_tokens=max_tokens,
            temperature=temperature,
            max_retries=max_retries,
        )
    except Exception as e:
        logger.warning("Bedrock call failed (%s); checking OpenAI fallback", e)
        if OPENAI_API_KEY:
            return _call_openai(
                messages, system=system, max_tokens=max_tokens, temperature=temperature
            )
        raise


async def call_llm_async(
    messages: list[dict[str, Any]],
    system: str = "",
    max_tokens: int = 4096,
    temperature: float = 0.0,
    max_retries: int = 2,
) -> str:
    """Run sync LLM clients in the default executor."""
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
