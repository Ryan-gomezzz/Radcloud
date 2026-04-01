"""GCP → AWS service mapping table with confidence levels.

Each entry maps a GCP resource type to its best AWS equivalent,
a confidence rating (direct / partial / none), and migration notes.
"""

SERVICE_MAP: dict[str, dict] = {
    "compute_instance": {
        "aws_service": "EC2",
        "aws_type": "instance",
        "confidence": "direct",
        "notes": "Direct equivalent. Map machine types to instance types.",
    },
    "cloud_sql": {
        "aws_service": "RDS",
        "aws_type": "db_instance",
        "confidence": "direct",
        "notes": "Direct equivalent. Supports same engines (PostgreSQL, MySQL).",
    },
    "gcs_bucket": {
        "aws_service": "S3",
        "aws_type": "bucket",
        "confidence": "direct",
        "notes": "Direct equivalent. Map storage classes.",
    },
    "cloud_run": {
        "aws_service": "ECS Fargate",
        "aws_type": "service",
        "confidence": "direct",
        "notes": "Closest equivalent for serverless containers. Alternative: App Runner.",
    },
    "cloud_function": {
        "aws_service": "Lambda",
        "aws_type": "function",
        "confidence": "direct",
        "notes": "Direct equivalent. Check runtime compatibility.",
    },
    "pubsub_topic": {
        "aws_service": "SNS",
        "aws_type": "topic",
        "confidence": "direct",
        "notes": "SNS for fan-out. If queue semantics needed, pair with SQS.",
    },
    "pubsub_subscription": {
        "aws_service": "SQS",
        "aws_type": "queue",
        "confidence": "partial",
        "notes": (
            "SQS for pull-based subscriptions. SNS+SQS for push. "
            "BigQuery streaming subscriptions require Kinesis Firehose + S3 + Athena."
        ),
    },
    "bigquery_dataset": {
        "aws_service": "Athena",
        "aws_type": "workgroup",
        "confidence": "partial",
        "notes": (
            "No single direct equivalent. Athena for ad-hoc queries, "
            "Redshift Serverless for data warehouse. Evaluate workload."
        ),
    },
    "bigquery_table": {
        "aws_service": "Glue Data Catalog",
        "aws_type": "table",
        "confidence": "partial",
        "notes": "Partitioning and clustering translate differently.",
    },
    "vpc_network": {
        "aws_service": "VPC",
        "aws_type": "vpc",
        "confidence": "direct",
        "notes": (
            "Direct equivalent. GCP auto-mode subnets have no AWS equivalent "
            "— must define subnets explicitly."
        ),
    },
    "vpc_subnet": {
        "aws_service": "VPC",
        "aws_type": "subnet",
        "confidence": "direct",
        "notes": "Direct equivalent. Map CIDR ranges.",
    },
    "firewall_rule": {
        "aws_service": "VPC Security Groups + NACLs",
        "aws_type": "security_group_rule",
        "confidence": "partial",
        "notes": (
            "GCP firewall rules are network-level with tags. AWS uses security "
            "groups (instance-level) + NACLs (subnet-level). Requires rethinking."
        ),
    },
    "cloud_dns_zone": {
        "aws_service": "Route 53",
        "aws_type": "hosted_zone",
        "confidence": "direct",
        "notes": "Direct equivalent.",
    },
    "memorystore_redis": {
        "aws_service": "ElastiCache",
        "aws_type": "redis_cluster",
        "confidence": "direct",
        "notes": "Direct equivalent. Map tier and node type.",
    },
    "iam_binding": {
        "aws_service": "IAM",
        "aws_type": "policy_attachment",
        "confidence": "partial",
        "notes": (
            "GCP uses project-level role bindings. AWS uses policy-based IAM "
            "with users/roles/groups. Requires IAM redesign."
        ),
    },
    "service_account": {
        "aws_service": "IAM",
        "aws_type": "role",
        "confidence": "partial",
        "notes": (
            "GCP service accounts map to AWS IAM roles with trust policies. "
            "Not a 1:1 mapping."
        ),
    },
    "spanner_instance": {
        "aws_service": "Aurora Global Database",
        "aws_type": "cluster",
        "confidence": "partial",
        "notes": (
            "No direct equivalent. Aurora Global is closest for multi-region "
            "relational. DynamoDB Global Tables for NoSQL use cases. "
            "Significant rearchitecting required."
        ),
    },
    "dataflow_job": {
        "aws_service": "AWS Glue / EMR / Kinesis Data Analytics",
        "aws_type": "job",
        "confidence": "partial",
        "notes": (
            "Depends on whether batch or streaming. Glue for batch ETL, "
            "Kinesis for streaming. May require code rewrite from Apache Beam."
        ),
    },
}

# Fallback entry for unknown GCP resource types.
DEFAULT_SERVICE_MAP_ENTRY: dict = {
    "aws_service": "Unknown",
    "aws_type": "unknown",
    "confidence": "none",
    "notes": "No known AWS equivalent in mapping table.",
}
