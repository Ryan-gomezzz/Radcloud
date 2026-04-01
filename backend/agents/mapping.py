"""Mapping agent — stub."""


async def run(context: dict, claude_client) -> dict:
    context["aws_mapping"] = [
        {
            "gcp_resource": "web-server-1",
            "aws_service": "EC2",
            "suggested_shape": "m5.xlarge",
            "notes": "Match vCPU/RAM; use AL2023 AMI",
        },
        {
            "gcp_resource": "main-db",
            "aws_service": "RDS PostgreSQL",
            "suggested_shape": "db.m5.large",
            "notes": "Multi-AZ for parity with HA Cloud SQL",
        },
    ]
    context["aws_architecture"] = (
        "Proposed landing: VPC with public ALB → EC2 web tier in private subnets; "
        "RDS in private DB subnets; S3 for object storage replacing GCS assets bucket."
    )
    return context
