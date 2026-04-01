"""Shared Pydantic schemas for RADCloud agent pipeline context."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AgentError(BaseModel):
    agent: str
    error: str


class RADCloudContext(BaseModel):
    """Canonical context shape passed through the pipeline (subset; extend as agents land)."""

    model_config = ConfigDict(extra="allow")

    gcp_config_raw: str = ""
    gcp_billing_raw: list[dict[str, Any]] = Field(default_factory=list)
    status: str = "starting"
    errors: list[dict[str, Any]] = Field(default_factory=list)
    gcp_inventory: list[dict[str, Any]] | None = None
    aws_mapping: list[dict[str, Any]] | None = None
    aws_architecture: str | None = None
    risks: list[dict[str, Any]] | None = None
    finops: dict[str, Any] | None = None
    runbook: list[dict[str, Any]] | str | None = None
