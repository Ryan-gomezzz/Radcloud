"""AWS connectivity — STS identity verification + assume-role support."""
from __future__ import annotations

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

from cloud.credential_store import CloudCredentials


def connect_with_keys(
    creds: CloudCredentials,
    access_key_id: str,
    secret_access_key: str,
    region: str = "us-east-1",
) -> dict:
    """Verify access keys via STS GetCallerIdentity. Updates creds in-place."""
    try:
        session = boto3.Session(
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=region,
        )
        sts = session.client("sts")
        identity = sts.get_caller_identity()

        # Try to get account alias
        iam = session.client("iam")
        aliases = []
        try:
            resp = iam.list_account_aliases()
            aliases = resp.get("AccountAliases", [])
        except Exception:
            pass

        creds.aws_access_key_id = access_key_id
        creds.aws_secret_access_key = secret_access_key
        creds.aws_account_id = identity["Account"]
        creds.aws_account_alias = aliases[0] if aliases else None
        creds.aws_region = region
        creds.aws_connected = True

        return {
            "connected": True,
            "account_id": identity["Account"],
            "account_alias": creds.aws_account_alias,
            "arn": identity["Arn"],
            "region": region,
        }
    except (ClientError, NoCredentialsError) as e:
        creds.aws_connected = False
        return {"connected": False, "error": str(e)}


def connect_with_role(
    creds: CloudCredentials,
    role_arn: str,
    region: str = "us-east-1",
) -> dict:
    """Assume a cross-account IAM role via STS. Updates creds in-place."""
    try:
        sts = boto3.client("sts", region_name=region)
        assumed = sts.assume_role(
            RoleArn=role_arn,
            RoleSessionName="RADCloud",
            DurationSeconds=3600,
        )
        temp = assumed["Credentials"]

        # Verify with temp creds
        temp_sts = boto3.client(
            "sts",
            aws_access_key_id=temp["AccessKeyId"],
            aws_secret_access_key=temp["SecretAccessKey"],
            aws_session_token=temp["SessionToken"],
            region_name=region,
        )
        identity = temp_sts.get_caller_identity()

        creds.aws_access_key_id = temp["AccessKeyId"]
        creds.aws_secret_access_key = temp["SecretAccessKey"]
        creds.aws_session_token = temp["SessionToken"]
        creds.aws_role_arn = role_arn
        creds.aws_account_id = identity["Account"]
        creds.aws_region = region
        creds.aws_connected = True

        return {
            "connected": True,
            "account_id": identity["Account"],
            "arn": identity["Arn"],
            "region": region,
            "role_arn": role_arn,
        }
    except (ClientError, NoCredentialsError) as e:
        creds.aws_connected = False
        return {"connected": False, "error": str(e)}


def get_boto3_session(creds: CloudCredentials) -> boto3.Session:
    """Return a boto3 Session using stored credentials."""
    return boto3.Session(
        aws_access_key_id=creds.aws_access_key_id,
        aws_secret_access_key=creds.aws_secret_access_key,
        aws_session_token=creds.aws_session_token,
        region_name=creds.aws_region,
    )
