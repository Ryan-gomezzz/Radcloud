# Cloud Migration Patterns and Playbooks

## Database Migration (Cloud SQL → RDS via AWS DMS)

### Overview
AWS Database Migration Service (DMS) supports full-load and ongoing replication (CDC — Change Data Capture) for PostgreSQL, MySQL, and SQL Server.

### DMS Migration Steps

1. **Create replication instance**: Choose size based on data volume. For < 500GB use dms.r5.large. For 500GB–2TB use dms.r5.xlarge.
2. **Create source endpoint**: Cloud SQL requires public IP (or private via Cloud SQL Auth Proxy) or VPN/Interconnect to the DMS replication subnet.
3. **Create target endpoint**: RDS instance in the target VPC.
4. **Full load phase**: DMS reads all existing data and writes to RDS. Replication lag shows progress.
5. **CDC phase**: DMS captures ongoing changes from PostgreSQL WAL / MySQL binary logs. Enable logical replication on Cloud SQL.
6. **Cutover**: Stop writes to Cloud SQL, wait for replication lag = 0, promote RDS as primary, update connection strings.

### Cloud SQL preparation for CDC
```sql
-- PostgreSQL: enable logical replication
ALTER SYSTEM SET wal_level = logical;
ALTER SYSTEM SET max_replication_slots = 10;
ALTER SYSTEM SET max_wal_senders = 10;
```

### DMS task settings for PostgreSQL
```json
{
  "TargetMetadata": {"TargetSchema": "public"},
  "FullLoadSettings": {"TargetTablePrepMode": "DROP_AND_CREATE"},
  "ChangeProcessingTuning": {"CommitTimeout": 1, "MemoryLimitTotal": 1024}
}
```

### Rollback strategy
Keep Cloud SQL running in parallel during CDC. If issues arise, revert connection strings back to Cloud SQL. DMS does not delete source data.

---

## Storage Migration (GCS → S3 via DataSync)

### AWS DataSync
DataSync is the recommended tool for migrating GCS buckets to S3.

**Steps:**
1. Create DataSync agent in a location with network access to both GCS and S3.
2. Create source location (GCS): requires GCS service account with Storage Object Viewer role.
3. Create destination location (S3): IAM role with s3:PutObject, s3:GetObject, s3:ListBucket.
4. Create and start task. DataSync handles checksums, bandwidth throttling, retry on failure.
5. Run final incremental sync after writes stop.

### Transfer Acceleration
For large datasets (>10TB), consider using S3 Transfer Acceleration or AWS Snow family.

### Checksum verification
DataSync automatically verifies data integrity via checksum comparison post-transfer. Review the TaskReport for any failed files.

---

## DNS Cutover Strategy

### Pre-cutover preparation (24–48 hours before)
1. Lower TTL on all DNS records to 60 seconds.
2. Create Route 53 hosted zone with identical records pointing to GCP endpoints.
3. Set up Route 53 health checks on AWS endpoints.

### Cutover window
1. T-0: Stop writes to GCP (maintenance mode or feature flag).
2. T+0: Wait for database replication lag = 0.
3. T+1: Update Route 53 A/CNAME records to AWS endpoints.
4. T+5: Verify health checks pass on all AWS endpoints.
5. T+10: Resume writes on AWS.

### Rollback (within first 60 minutes)
If AWS health checks fail: update Route 53 records back to GCP endpoints. Low TTL (60s) means rollback propagates in under 1 minute.

---

## Terraform Migration Execution

### Phase approach
```
Phase 1: Network (VPC, subnets, route tables, security groups, NAT gateways)
Phase 2: Storage (S3 buckets, EFS)
Phase 3: Compute foundation (IAM roles, key pairs, ECR repos)
Phase 4: Databases (RDS, ElastiCache)
Phase 5: Compute (EC2, ECS clusters, Lambda)
Phase 6: Load balancers and DNS
Phase 7: Monitoring (CloudWatch alarms, dashboards)
```

### Terraform state management
Always use remote state (S3 + DynamoDB lock table) for production:
```hcl
terraform {
  backend "s3" {
    bucket         = "radcloud-tfstate-{account_id}"
    key            = "migrations/{session_id}/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "radcloud-tfstate-lock"
    encrypt        = true
  }
}
```

### Rollback strategy
```bash
# Tag all resources with migration session ID
# On failure: terraform destroy -target=<failed_resource>
# For full rollback: terraform destroy (removes all managed resources)
```

---

## IAM Translation

### GCP Service Account → AWS IAM Role
GCP service accounts are identities attached to workloads. In AWS:
- Compute Engine service account → EC2 instance profile (IAM role attached to EC2)
- Cloud Run service account → ECS task role
- Cloud Functions service account → Lambda execution role

### GCP IAM Role → AWS IAM Policy
GCP uses predefined roles with broad permissions. AWS requires explicit policy documents.

Example translation:
- `roles/cloudsql.client` → `rds:Connect, rds:DescribeDBInstances, rds:ListTagsForResource`
- `roles/storage.objectViewer` → `s3:GetObject, s3:ListBucket`
- `roles/storage.objectAdmin` → `s3:GetObject, s3:PutObject, s3:DeleteObject, s3:ListBucket`

---

## Networking Migration

### VPC Design
GCP VPCs are global (one VPC across all regions). AWS VPCs are regional.
- Create one VPC per AWS region (at minimum).
- Match GCP subnet CIDR blocks where possible to avoid application reconfiguration.
- For multi-region GCP: create one AWS VPC per region + VPC peering or Transit Gateway.

### Security Groups vs Firewall Rules
GCP firewall rules are attached to the VPC and use network tags.
AWS security groups are attached to individual resources (EC2, RDS, etc.).

Translation approach:
1. Identify all GCP firewall rules.
2. Group by target (which instances use which rules).
3. Create one security group per "role" (web-tier, app-tier, db-tier).
4. Apply least-privilege inbound rules.

---

## Post-Migration Verification Checklist

- [ ] All health check endpoints return 200 OK
- [ ] Database connections established from application tier
- [ ] Queue consumers processing messages (SQS/SNS)
- [ ] Storage objects accessible (S3 signed URL test)
- [ ] CloudWatch metrics flowing (CPU, memory, request count)
- [ ] Error rates below pre-migration baseline (±5%)
- [ ] Latency within 10% of pre-migration baseline
- [ ] Cost Explorer shows expected resource costs
- [ ] CloudTrail logging active on all services
- [ ] Backup policies configured (RDS automated backups, S3 versioning)
