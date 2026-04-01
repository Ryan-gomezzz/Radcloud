"""AWS Terraform module / resource hints per service type.

Used by the Mapping Agent to attach ``terraform_hints`` to each mapping
entry.  The Watchdog / IaC generator consumes these downstream to produce
the ``iac_bundle``.

Each entry provides:
  terraform_resource_type — the ``aws_*`` Terraform resource name
  module                  — suggested module path inside the generated scaffold
  required_inputs         — key Terraform arguments
  depends_on              — logical module dependencies
"""

IAC_HINTS: dict[str, dict] = {
    "compute_instance": {
        "terraform_resource_type": "aws_instance",
        "module": "modules/compute/ec2",
        "required_inputs": [
            "instance_type",
            "subnet_id",
            "security_group_ids",
            "ami",
        ],
        "depends_on": ["networking", "iam"],
    },
    "cloud_sql": {
        "terraform_resource_type": "aws_db_instance",
        "module": "modules/database/rds",
        "required_inputs": [
            "instance_class",
            "engine",
            "engine_version",
            "allocated_storage",
            "db_subnet_group_name",
            "vpc_security_group_ids",
        ],
        "depends_on": ["networking", "iam"],
    },
    "gcs_bucket": {
        "terraform_resource_type": "aws_s3_bucket",
        "module": "modules/storage/s3",
        "required_inputs": [
            "bucket",
            "acl",
        ],
        "depends_on": [],
    },
    "cloud_run": {
        "terraform_resource_type": "aws_ecs_service",
        "module": "modules/compute/ecs-fargate",
        "required_inputs": [
            "cluster",
            "task_definition",
            "desired_count",
            "subnets",
            "security_groups",
        ],
        "depends_on": ["networking", "iam", "ecr"],
    },
    "cloud_function": {
        "terraform_resource_type": "aws_lambda_function",
        "module": "modules/compute/lambda",
        "required_inputs": [
            "function_name",
            "handler",
            "runtime",
            "role",
            "filename",
        ],
        "depends_on": ["iam"],
    },
    "pubsub_topic": {
        "terraform_resource_type": "aws_sns_topic",
        "module": "modules/messaging/sns",
        "required_inputs": [
            "name",
        ],
        "depends_on": [],
    },
    "pubsub_subscription": {
        "terraform_resource_type": "aws_sqs_queue",
        "module": "modules/messaging/sqs",
        "required_inputs": [
            "name",
            "visibility_timeout_seconds",
        ],
        "depends_on": ["messaging/sns"],
    },
    "bigquery_dataset": {
        "terraform_resource_type": "aws_athena_workgroup",
        "module": "modules/analytics/athena",
        "required_inputs": [
            "name",
            "configuration",
        ],
        "depends_on": ["storage/s3"],
    },
    "bigquery_table": {
        "terraform_resource_type": "aws_glue_catalog_table",
        "module": "modules/analytics/glue",
        "required_inputs": [
            "name",
            "database_name",
            "table_type",
            "storage_descriptor",
        ],
        "depends_on": ["analytics/athena", "storage/s3"],
    },
    "vpc_network": {
        "terraform_resource_type": "aws_vpc",
        "module": "modules/networking/vpc",
        "required_inputs": [
            "cidr_block",
            "enable_dns_support",
            "enable_dns_hostnames",
        ],
        "depends_on": [],
    },
    "vpc_subnet": {
        "terraform_resource_type": "aws_subnet",
        "module": "modules/networking/subnets",
        "required_inputs": [
            "vpc_id",
            "cidr_block",
            "availability_zone",
        ],
        "depends_on": ["networking/vpc"],
    },
    "firewall_rule": {
        "terraform_resource_type": "aws_security_group_rule",
        "module": "modules/networking/security-groups",
        "required_inputs": [
            "security_group_id",
            "type",
            "from_port",
            "to_port",
            "protocol",
            "cidr_blocks",
        ],
        "depends_on": ["networking/vpc"],
    },
    "cloud_dns_zone": {
        "terraform_resource_type": "aws_route53_zone",
        "module": "modules/networking/dns",
        "required_inputs": [
            "name",
        ],
        "depends_on": [],
    },
    "memorystore_redis": {
        "terraform_resource_type": "aws_elasticache_replication_group",
        "module": "modules/database/elasticache",
        "required_inputs": [
            "replication_group_id",
            "node_type",
            "number_cache_clusters",
            "subnet_group_name",
            "security_group_ids",
        ],
        "depends_on": ["networking"],
    },
    "iam_binding": {
        "terraform_resource_type": "aws_iam_role_policy_attachment",
        "module": "modules/iam",
        "required_inputs": [
            "role",
            "policy_arn",
        ],
        "depends_on": [],
    },
    "service_account": {
        "terraform_resource_type": "aws_iam_role",
        "module": "modules/iam",
        "required_inputs": [
            "name",
            "assume_role_policy",
        ],
        "depends_on": [],
    },
    "spanner_instance": {
        "terraform_resource_type": "aws_rds_global_cluster",
        "module": "modules/database/aurora-global",
        "required_inputs": [
            "global_cluster_identifier",
            "engine",
            "engine_version",
        ],
        "depends_on": ["networking"],
    },
    "dataflow_job": {
        "terraform_resource_type": "aws_glue_job",
        "module": "modules/analytics/glue-etl",
        "required_inputs": [
            "name",
            "role_arn",
            "command",
        ],
        "depends_on": ["iam", "storage/s3"],
    },
}

# Fallback for unknown resource types.
DEFAULT_IAC_HINT: dict = {
    "terraform_resource_type": "unknown",
    "module": "modules/other",
    "required_inputs": [],
    "depends_on": [],
}


def get_iac_hint(resource_type: str) -> dict:
    """Return the IaC hint dict for a GCP resource type, or the default."""
    return IAC_HINTS.get(resource_type, DEFAULT_IAC_HINT)
