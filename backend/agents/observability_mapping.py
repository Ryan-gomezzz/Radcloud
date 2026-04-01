"""Per-AWS-service observability defaults for Watchdog integration.

Each entry defines the CloudWatch metrics, log groups, alarms, and
watchdog priority that the Mapping Agent attaches to every mapping row.
The Watchdog agent consumes these downstream to build its dashboard.
"""

OBSERVABILITY_MAP: dict[str, dict] = {
    "compute_instance": {
        "cloudwatch_metrics": [
            "CPUUtilization",
            "NetworkIn",
            "NetworkOut",
            "StatusCheckFailed",
            "DiskReadOps",
            "DiskWriteOps",
        ],
        "logs": [
            "/aws/ec2/application",
            "/aws/ec2/syslog",
        ],
        "alarms": [
            "cpu_high",
            "status_check_failed",
            "disk_usage_high",
        ],
        "watchdog_priority": "high",
    },
    "cloud_sql": {
        "cloudwatch_metrics": [
            "CPUUtilization",
            "FreeableMemory",
            "DatabaseConnections",
            "ReadIOPS",
            "WriteIOPS",
            "FreeStorageSpace",
            "ReplicaLag",
        ],
        "logs": [
            "/aws/rds/postgresql",
            "/aws/rds/audit",
        ],
        "alarms": [
            "cpu_high",
            "free_storage_low",
            "replica_lag_high",
            "connection_count_high",
        ],
        "watchdog_priority": "high",
    },
    "gcs_bucket": {
        "cloudwatch_metrics": [
            "BucketSizeBytes",
            "NumberOfObjects",
            "AllRequests",
            "4xxErrors",
            "5xxErrors",
        ],
        "logs": [
            "s3-access-logs",
        ],
        "alarms": [
            "4xx_spike",
            "5xx_spike",
        ],
        "watchdog_priority": "low",
    },
    "cloud_run": {
        "cloudwatch_metrics": [
            "CPUUtilization",
            "MemoryUtilization",
            "RunningTaskCount",
            "RequestCount",
        ],
        "logs": [
            "/aws/ecs/application",
        ],
        "alarms": [
            "cpu_high",
            "memory_high",
            "task_count_low",
        ],
        "watchdog_priority": "high",
    },
    "cloud_function": {
        "cloudwatch_metrics": [
            "Invocations",
            "Errors",
            "Duration",
            "Throttles",
            "ConcurrentExecutions",
        ],
        "logs": [
            "/aws/lambda/<function-name>",
        ],
        "alarms": [
            "error_rate_high",
            "throttle_rate_high",
            "duration_p99_high",
        ],
        "watchdog_priority": "medium",
    },
    "pubsub_topic": {
        "cloudwatch_metrics": [
            "NumberOfMessagesPublished",
            "PublishSize",
        ],
        "logs": [],
        "alarms": [
            "publish_failures",
        ],
        "watchdog_priority": "medium",
    },
    "pubsub_subscription": {
        "cloudwatch_metrics": [
            "ApproximateNumberOfMessagesVisible",
            "ApproximateAgeOfOldestMessage",
            "NumberOfMessagesReceived",
        ],
        "logs": [],
        "alarms": [
            "queue_depth_high",
            "message_age_high",
        ],
        "watchdog_priority": "medium",
    },
    "bigquery_dataset": {
        "cloudwatch_metrics": [
            "ProcessedBytes",
            "TotalExecutionTime",
        ],
        "logs": [
            "/aws/athena/queries",
        ],
        "alarms": [
            "query_cost_high",
        ],
        "watchdog_priority": "medium",
    },
    "bigquery_table": {
        "cloudwatch_metrics": [],
        "logs": [
            "/aws/glue/crawlers",
        ],
        "alarms": [],
        "watchdog_priority": "low",
    },
    "vpc_network": {
        "cloudwatch_metrics": [],
        "logs": [
            "vpc-flow-logs",
        ],
        "alarms": [],
        "watchdog_priority": "low",
    },
    "vpc_subnet": {
        "cloudwatch_metrics": [],
        "logs": [],
        "alarms": [],
        "watchdog_priority": "low",
    },
    "firewall_rule": {
        "cloudwatch_metrics": [],
        "logs": [
            "vpc-flow-logs",
        ],
        "alarms": [
            "rejected_connections_spike",
        ],
        "watchdog_priority": "medium",
    },
    "cloud_dns_zone": {
        "cloudwatch_metrics": [
            "DNSQueries",
        ],
        "logs": [
            "/aws/route53/query-logs",
        ],
        "alarms": [],
        "watchdog_priority": "low",
    },
    "memorystore_redis": {
        "cloudwatch_metrics": [
            "CPUUtilization",
            "EngineCPUUtilization",
            "CurrConnections",
            "CacheHitRate",
            "Evictions",
            "ReplicationLag",
        ],
        "logs": [
            "/aws/elasticache/redis",
        ],
        "alarms": [
            "cpu_high",
            "eviction_rate_high",
            "replication_lag_high",
        ],
        "watchdog_priority": "high",
    },
    "iam_binding": {
        "cloudwatch_metrics": [],
        "logs": [
            "cloudtrail",
        ],
        "alarms": [
            "unauthorized_api_calls",
        ],
        "watchdog_priority": "medium",
    },
    "service_account": {
        "cloudwatch_metrics": [],
        "logs": [
            "cloudtrail",
        ],
        "alarms": [
            "assume_role_failures",
        ],
        "watchdog_priority": "medium",
    },
    "spanner_instance": {
        "cloudwatch_metrics": [
            "CPUUtilization",
            "FreeableMemory",
            "AuroraReplicaLag",
        ],
        "logs": [
            "/aws/rds/audit",
        ],
        "alarms": [
            "cpu_high",
            "replica_lag_high",
        ],
        "watchdog_priority": "high",
    },
    "dataflow_job": {
        "cloudwatch_metrics": [
            "glue.driver.aggregate.bytesRead",
            "glue.driver.aggregate.elapsedTime",
        ],
        "logs": [
            "/aws/glue/jobs",
        ],
        "alarms": [
            "job_failure",
            "job_duration_high",
        ],
        "watchdog_priority": "medium",
    },
}

# Fallback for unknown resource types.
DEFAULT_OBSERVABILITY: dict = {
    "cloudwatch_metrics": [],
    "logs": [],
    "alarms": [],
    "watchdog_priority": "low",
}


def get_observability(resource_type: str) -> dict:
    """Return the observability config for a GCP resource type, or the default."""
    return OBSERVABILITY_MAP.get(resource_type, DEFAULT_OBSERVABILITY)
