# AWS Services Reference for Migration

## Compute

### EC2 (Elastic Compute Cloud)
Virtual servers. Key concepts:
- **Instance families**: General purpose (m7i, m6i), compute-optimized (c7i), memory-optimized (r7i), storage-optimized (i4i)
- **Instance sizes**: nano, micro, small, medium, large, xlarge, 2xlarge, 4xlarge, 8xlarge, 12xlarge, 16xlarge, 24xlarge, 48xlarge
- **AMIs**: Amazon Linux 2023, Ubuntu 22.04, Windows Server 2022
- **Tenancy**: On-demand, Reserved (1yr/3yr), Spot
- **Instance profiles**: IAM roles attached to EC2 for service access (no access keys needed)
- **Limits**: Soft limit of 32 vCPUs per region for on-demand (can request increase)

### ECS Fargate (Elastic Container Service)
Serverless container execution. No EC2 management.
- Task definition: CPU (256–16384 units), Memory (512MB–120GB)
- Task role: IAM role for container permissions
- Service: manages desired count, load balancer registration, rolling deployments
- Use for: microservices, API containers, worker processes

### Lambda
Serverless functions.
- Runtimes: Node.js 20, Python 3.12, Java 21, Go 1.x
- Memory: 128MB–10240MB
- Timeout: max 15 minutes
- Triggers: SQS, SNS, API Gateway, EventBridge, S3, DynamoDB streams
- Use for: event processing, API backends (with API Gateway), scheduled tasks

### EKS (Elastic Kubernetes Service)
Managed Kubernetes.
- Node groups: managed (EC2 auto-scaling groups), self-managed, Fargate profiles
- Add-ons: CoreDNS, kube-proxy, VPC CNI, EBS CSI driver
- Cluster autoscaler or Karpenter for node scaling

## Databases

### RDS (Relational Database Service)
Managed relational databases.
- Engines: PostgreSQL (15, 14, 13), MySQL (8.0), MariaDB, SQL Server, Oracle
- Multi-AZ: synchronous standby replica in different AZ (automatic failover ~1-2 min)
- Read replicas: asynchronous, up to 5, cross-region supported
- Storage: gp3 (default), io1, io2 (for high IOPS). Auto-scaling available
- Backups: automated (1–35 days retention) + manual snapshots
- Parameter groups: database engine configuration
- Important: RDS does NOT expose SSH/OS access. Only database connection.

### Aurora
PostgreSQL/MySQL-compatible, up to 5x faster than standard RDS.
- Shared storage cluster (separate from compute)
- Aurora Serverless v2: auto-scales compute in fractional ACU increments
- Global Database: cross-region replication with <1s RPO
- Storage auto-scales up to 128TB
- Use over RDS when: HA is critical, read-heavy workload, unpredictable load

### ElastiCache (Redis)
Managed Redis and Valkey.
- Cluster mode disabled: single shard, up to 5 read replicas
- Cluster mode enabled: up to 500 nodes, 500 shards
- Multi-AZ: automatic failover
- Encryption at rest (KMS) and in transit (TLS)
- Backup: daily automated snapshots
- Instance types: r7g.large (general), r7g.xlarge (high memory)

### DynamoDB
Serverless NoSQL key-value and document store.
- Partition key + optional sort key
- On-demand or provisioned capacity (RCU/WCU)
- Global Tables: multi-region active-active
- Streams: event-driven with Lambda integration
- DynamoDB Accelerator (DAX): in-memory cache (microsecond reads)
- TTL: automatic item expiration
- Use for: session storage, leaderboards, shopping carts, IoT data

## Storage

### S3 (Simple Storage Service)
Object storage. Unlimited capacity.
- Storage classes: Standard, Intelligent-Tiering, Standard-IA, Glacier Instant, Glacier Flexible, Glacier Deep Archive
- Versioning: protects against accidental deletion
- Lifecycle policies: auto-transition between storage classes
- Replication: same-region (SRR) or cross-region (CRR)
- Access: IAM policies, bucket policies, ACLs, pre-signed URLs
- Transfer: multipart upload (required >5GB), Transfer Acceleration (CloudFront edge upload)
- Encryption: SSE-S3 (default), SSE-KMS, SSE-C

### EFS (Elastic File System)
Managed NFS. Shared access from multiple EC2/ECS/Lambda.
- Performance modes: General Purpose, Max I/O
- Throughput modes: Bursting (scales with storage), Provisioned
- Storage classes: Standard, Infrequent Access (with lifecycle policies)
- Use for: shared content, CMS media, home directories

## Messaging

### SQS (Simple Queue Service)
Message queue.
- Standard: at-least-once, near-unlimited throughput
- FIFO: exactly-once, ordered, 3000 msg/s (or 300 without batching)
- Dead-letter queues (DLQ): capture failed messages
- Visibility timeout: how long a message is invisible after being received
- Long polling: reduce empty receives (WaitTimeSeconds up to 20s)
- Use for: decoupling services, worker queues, event buffering

### SNS (Simple Notification Service)
Pub/Sub messaging.
- Topics: message broadcast to multiple subscribers
- Subscribers: SQS, Lambda, email, HTTP/S, SMS, mobile push
- Message filtering: route to specific subscribers based on attributes
- FIFO topics: ordered delivery to FIFO SQS queues
- Use for: fan-out patterns, notifications, cross-service events

### EventBridge
Event bus for application integration.
- Default bus: receives all AWS service events
- Custom buses: for application events
- Rules: match event patterns, route to targets
- Scheduler: cron/rate-based scheduled invocations
- Use for: replacing Pub/Sub event routing, scheduled Lambda, service decoupling

## Monitoring

### CloudWatch
Metrics, logs, alarms, dashboards.
- Metrics: 1-second granularity, 15-month retention (1-min for 3 months)
- Alarms: threshold-based, anomaly detection, math expressions
- Log Groups: up to 50GB/day ingestion, variable retention (1 day–10 years)
- Insights: SQL-like query language for log analysis
- Container Insights: ECS/EKS metrics and logs
- Application Insights: pattern detection for .NET, Java, Ruby, Node.js

### X-Ray
Distributed tracing.
- Trace requests across services, Lambda, EC2, ECS
- Service map: visualize dependencies and latency
- Annotations and metadata for custom context

## Security

### IAM (Identity and Access Management)
- Policies: JSON documents attached to users, groups, or roles
- Roles: assumed by services, EC2 instance profiles, cross-account
- Principle of least privilege: start with deny-all, add explicit allows
- Conditions: restrict by IP, time, MFA, source service
- Permission boundaries: limit maximum permissions a role can have
- Resource-based policies: S3 bucket policies, SQS queue policies, Lambda resource policies

### KMS (Key Management Service)
- CMKs: customer-managed keys, AWS-managed keys, AWS-owned keys
- Envelope encryption: data keys encrypted by CMK
- Key policies: resource-based policy on the key itself
- Automatic rotation: annual for CMKs (optional)
- Multi-region keys: replicate key material across regions

### Secrets Manager
- Store and rotate database credentials, API keys, OAuth tokens
- Automatic rotation: Lambda function called on schedule
- Integration: RDS native rotation, custom rotation Lambda
- Cross-account access: resource-based policy

## Networking

### VPC Design for Migration
- CIDR: use /16 for the VPC (e.g., 10.0.0.0/16 gives 65,536 addresses)
- Public subnets (one per AZ): for load balancers, NAT gateways
- Private subnets (one per AZ): for EC2, RDS, ElastiCache
- Database subnets (one per AZ): for RDS only, no outbound internet
- NAT Gateways: one per AZ for private subnet outbound (not for cost savings)

### Security Groups
- Stateful: return traffic automatically allowed
- Rules: allow only (no explicit deny)
- Reference other security groups: preferred over CIDR for service-to-service
- Common pattern: web-sg (443 from 0.0.0.0/0) → app-sg (8080 from web-sg) → db-sg (5432 from app-sg)
