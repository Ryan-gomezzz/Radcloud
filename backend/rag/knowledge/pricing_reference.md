# AWS Pricing Reference (us-east-1, as of 2025)

## EC2 On-Demand Pricing (Linux, us-east-1)

### General Purpose (m7i family)
| Instance | vCPU | Memory | On-Demand/hr | 1yr RI (No Upfront) | 1yr RI (All Upfront) | 3yr RI (All Upfront) |
|---|---|---|---|---|---|---|
| m7i.large | 2 | 8 GB | $0.1008 | $0.0635 | $0.0568 | $0.0399 |
| m7i.xlarge | 4 | 16 GB | $0.2016 | $0.1270 | $0.1136 | $0.0799 |
| m7i.2xlarge | 8 | 32 GB | $0.4032 | $0.2540 | $0.2272 | $0.1597 |
| m7i.4xlarge | 16 | 64 GB | $0.8064 | $0.5080 | $0.4544 | $0.3194 |
| m7i.8xlarge | 32 | 128 GB | $1.6128 | $1.0160 | $0.9088 | $0.6389 |

### Compute Optimized (c7i family)
| Instance | vCPU | Memory | On-Demand/hr |
|---|---|---|---|
| c7i.large | 2 | 4 GB | $0.0850 |
| c7i.xlarge | 4 | 8 GB | $0.1700 |
| c7i.2xlarge | 8 | 16 GB | $0.3400 |
| c7i.4xlarge | 16 | 32 GB | $0.6800 |

### Memory Optimized (r7i family)
| Instance | vCPU | Memory | On-Demand/hr |
|---|---|---|---|
| r7i.large | 2 | 16 GB | $0.1512 |
| r7i.xlarge | 4 | 32 GB | $0.3024 |
| r7i.2xlarge | 8 | 64 GB | $0.6048 |
| r7i.4xlarge | 16 | 128 GB | $1.2096 |

## RI Discount Summary
| Term | Payment | Discount vs On-Demand |
|---|---|---|
| 1yr | No Upfront | ~37% |
| 1yr | Partial Upfront | ~40% |
| 1yr | All Upfront | ~43% |
| 3yr | No Upfront | ~50% |
| 3yr | Partial Upfront | ~56% |
| 3yr | All Upfront | ~60% |

**Recommendation**: For steady-state workloads, 1yr All Upfront provides good savings without long commitment. Use 3yr for database servers that won't change.

## RDS Pricing (PostgreSQL, us-east-1, Multi-AZ)

| Instance | vCPU | Memory | On-Demand/hr | 1yr RI (All Upfront) |
|---|---|---|---|---|
| db.t4g.medium | 2 | 4 GB | $0.136 | $0.079 |
| db.m6i.large | 2 | 8 GB | $0.342 | $0.196 |
| db.m6i.xlarge | 4 | 16 GB | $0.684 | $0.393 |
| db.m6i.2xlarge | 8 | 32 GB | $1.368 | $0.785 |
| db.r6i.large | 2 | 16 GB | $0.480 | $0.277 |
| db.r6i.xlarge | 4 | 32 GB | $0.960 | $0.554 |

**Storage**: $0.115/GB-month (gp3). $0.125/GB-month (io2). IOPS: $0.10/IOPS-month (io2 above 3000).
**Backup**: First free backup equal to DB storage. Additional: $0.095/GB-month.
**Aurora PostgreSQL**: db.r7g.large = $0.26/hr on-demand. Storage: $0.10/GB-month (auto-scales).

## ElastiCache (Redis, us-east-1)

| Instance | vCPU | Memory | On-Demand/hr | 1yr RI |
|---|---|---|---|---|
| cache.t4g.medium | 2 | 3.22 GB | $0.066 | $0.039 |
| cache.r7g.large | 2 | 13.07 GB | $0.226 | $0.133 |
| cache.r7g.xlarge | 4 | 26.32 GB | $0.452 | $0.267 |
| cache.r7g.2xlarge | 8 | 52.82 GB | $0.904 | $0.534 |

## ECS Fargate Pricing
- vCPU: $0.04048/vCPU-hour
- Memory: $0.004445/GB-hour
- Example: 1 vCPU + 2GB = $0.04048 + 2×$0.004445 = $0.04937/hr = ~$35.5/month

## Lambda Pricing
- Requests: $0.20 per 1M requests (first 1M free)
- Duration: $0.0000166667 per GB-second (first 400,000 GB-seconds free)
- Example: 1M requests/month × 1s × 256MB = 256,000 GB-seconds = ~$4.27/month

## S3 Pricing
| Storage Class | $/GB-month | Retrieval |
|---|---|---|
| Standard | $0.023 | Free |
| Intelligent-Tiering | $0.023 (frequent) / $0.0125 (infrequent) | Free |
| Standard-IA | $0.0125 | $0.01/GB |
| Glacier Instant | $0.004 | $0.03/GB |
| Glacier Deep Archive | $0.00099 | $0.02/GB |
**Requests**: PUT/COPY/POST/LIST: $0.005/1K. GET/SELECT: $0.0004/1K.
**Transfer out**: First 100GB free. $0.09/GB (100GB–10TB). $0.085/GB (10TB–50TB).

## Data Transfer
- Between AZs (same region): $0.01/GB each way
- To internet: $0.09/GB (first 10TB)
- To another AWS region: $0.02/GB
- CloudFront origin (from S3/EC2): $0.01/GB

## Common Cost Optimization Strategies

### Compute Savings Plans
- Compute Savings Plans: up to 66% off on-demand for EC2, Lambda, Fargate
- EC2 Instance Savings Plans: up to 72% off (instance family + region locked)
- Recommendation: Use Compute Savings Plans for flexibility, 1-year no-upfront for new workloads

### Auto Scaling
- Configure Auto Scaling for variable workloads to avoid over-provisioning
- Target tracking (e.g., 70% CPU) is simpler than step scaling
- Use scheduled scaling for predictable traffic patterns

### Storage Optimization
- Use S3 Intelligent-Tiering for data with unknown access patterns
- Enable S3 lifecycle policies to move old data to Glacier
- Use gp3 EBS volumes (same performance as gp2 at 20% lower cost)
- Delete unattached EBS volumes and unused snapshots

### Database Optimization
- RDS: right-size using Performance Insights. Stop non-production RDS outside business hours.
- ElastiCache: enable cluster mode for horizontal scaling instead of vertical
- Use Aurora Serverless v2 for dev/test environments

## GCP to AWS Cost Comparison (Typical Migration)
- Initial AWS on-demand cost is typically 5–15% higher than GCP equivalent
- After RI/SP optimization: 30–40% lower than GCP (AWS has better discount programs)
- 1-year total savings for 50+ resource environments: typically $40K–$200K
- Key savings drivers: RDS RI (60% off), EC2 RI (43% off), S3 vs GCS (S3 ~15% cheaper)
