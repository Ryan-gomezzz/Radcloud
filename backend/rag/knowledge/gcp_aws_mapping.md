# GCP to AWS Service Mapping Reference

## Compute

| GCP Service | AWS Equivalent | Confidence | Notes |
|---|---|---|---|
| Compute Engine (VM) | EC2 | Direct | Match instance family by vCPU/memory ratio. n2-standard-4 → m6i.xlarge |
| Google Kubernetes Engine (GKE) | EKS | Direct | Node pools → managed node groups. Autopilot → Fargate profiles |
| Cloud Run | ECS Fargate / App Runner | Direct | Serverless containers. Cloud Run → App Runner for simpler workloads |
| Cloud Functions | Lambda | Direct | Event-driven functions. Pub/Sub trigger → SQS/SNS trigger |
| App Engine Standard | Lambda + API Gateway | Partial | Consider App Runner for closer feature parity |
| App Engine Flex | ECS Fargate | Direct | |
| Cloud Batch | AWS Batch | Direct | |

## Databases

| GCP Service | AWS Equivalent | Confidence | Notes |
|---|---|---|---|
| Cloud SQL (PostgreSQL) | RDS PostgreSQL | Direct | Migrate with DMS. Enable Multi-AZ for HA equivalent |
| Cloud SQL (MySQL) | RDS MySQL / Aurora MySQL | Direct | Aurora offers better HA at similar cost |
| Cloud SQL (SQL Server) | RDS SQL Server | Direct | |
| Cloud Spanner | Aurora Global / DynamoDB Global | Partial | No direct equivalent. Spanner's external consistency has no AWS match |
| Firestore | DynamoDB | Partial | Different data model. DynamoDB streams ≈ Firestore real-time listeners |
| Bigtable | DynamoDB / Keyspaces | Partial | Bigtable is wide-column; DynamoDB is key-value. Keyspaces for Cassandra workloads |
| Memorystore (Redis) | ElastiCache (Redis) | Direct | Match version. Enable cluster mode if GCP uses cluster |
| Memorystore (Memcached) | ElastiCache (Memcached) | Direct | |
| AlloyDB | Aurora PostgreSQL | Direct | Both are PostgreSQL-compatible with enhanced performance |

## Storage

| GCP Service | AWS Equivalent | Confidence | Notes |
|---|---|---|---|
| Cloud Storage (Standard) | S3 Standard | Direct | Use DataSync or S3 Transfer Acceleration for migration |
| Cloud Storage (Nearline) | S3 Standard-IA | Direct | |
| Cloud Storage (Coldline) | S3 Glacier Instant Retrieval | Direct | |
| Cloud Storage (Archive) | S3 Glacier Deep Archive | Direct | |
| Persistent Disk (SSD) | EBS gp3 | Direct | |
| Persistent Disk (HDD) | EBS st1 | Direct | |
| Filestore | EFS | Direct | NFS-compatible file system |

## Networking

| GCP Service | AWS Equivalent | Confidence | Notes |
|---|---|---|---|
| VPC | VPC | Direct | GCP VPC is global; AWS VPC is regional. Plan for multiple subnets across AZs |
| Cloud Load Balancing (HTTP/S) | ALB | Direct | |
| Cloud Load Balancing (TCP/UDP) | NLB | Direct | |
| Cloud CDN | CloudFront | Direct | |
| Cloud DNS | Route 53 | Direct | Use low TTL (60s) 24h before cutover |
| Cloud NAT | NAT Gateway | Direct | |
| Cloud Armor | WAF + Shield | Direct | |
| VPN (Cloud VPN) | Site-to-Site VPN | Direct | |
| Interconnect | Direct Connect | Direct | |

## Messaging & Integration

| GCP Service | AWS Equivalent | Confidence | Notes |
|---|---|---|---|
| Pub/Sub | SNS + SQS | Direct | Pub/Sub topic → SNS topic + SQS queue per subscriber |
| Cloud Tasks | SQS + Lambda | Direct | |
| Cloud Scheduler | EventBridge Scheduler | Direct | |
| Eventarc | EventBridge | Direct | |
| Workflows | Step Functions | Direct | |

## Data & Analytics

| GCP Service | AWS Equivalent | Confidence | Notes |
|---|---|---|---|
| BigQuery | Athena + Glue | Partial | BigQuery is serverless; Athena+Glue requires more setup. Consider Redshift for heavy warehousing |
| Dataflow (Batch) | Glue ETL | Partial | Apache Beam (Dataflow) ≠ Spark (Glue). Rewrite may be required |
| Dataflow (Streaming) | Kinesis Data Streams + Flink | Partial | |
| Dataproc | EMR | Direct | Both run Apache Spark/Hadoop |
| Looker | QuickSight | Partial | Different BI tools. Exports required |
| Data Studio | QuickSight | Partial | |
| Cloud Composer (Airflow) | MWAA (Managed Airflow) | Direct | Same Airflow, different managed service |

## AI/ML

| GCP Service | AWS Equivalent | Confidence | Notes |
|---|---|---|---|
| Vertex AI | SageMaker | Direct | |
| Cloud Vision API | Rekognition | Direct | |
| Cloud Natural Language | Comprehend | Direct | |
| Cloud Translation | Translate | Direct | |
| Dialogflow | Lex | Partial | Different conversation design paradigms |

## Security & Identity

| GCP Service | AWS Equivalent | Confidence | Notes |
|---|---|---|---|
| Cloud IAM | IAM | Direct | Different policy syntax. GCP uses resource-level bindings; AWS uses JSON policies |
| Service Accounts | IAM Roles | Direct | GCP service accounts → AWS IAM roles with trust policies |
| Cloud KMS | KMS | Direct | |
| Secret Manager | Secrets Manager | Direct | |
| Cloud Armor | WAF | Direct | |
| Security Command Center | Security Hub + GuardDuty | Direct | |
| Binary Authorization | ECR image scanning + OPA | Partial | |

## Monitoring & Operations

| GCP Service | AWS Equivalent | Confidence | Notes |
|---|---|---|---|
| Cloud Monitoring | CloudWatch | Direct | |
| Cloud Logging | CloudWatch Logs | Direct | |
| Cloud Trace | X-Ray | Direct | |
| Cloud Profiler | CodeGuru Profiler | Direct | |
| Error Reporting | CloudWatch Alarms + Lambda | Partial | |
