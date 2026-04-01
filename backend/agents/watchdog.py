"""Watchdog agent — stub: runbook, post-migration watchdog dashboard, IaC bundle."""

MAIN_TF = r"""# RADCloud Generated — AWS Infrastructure
# Source: NovaPay GCP Migration

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# --- VPC ---
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  tags = { Name = "novapay-vpc" }
}

resource "aws_subnet" "private_app" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "us-east-1a"
  tags = { Name = "private-app-subnet" }
}

# --- EC2 ---
resource "aws_instance" "web_server_1" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "m5.xlarge"
  subnet_id     = aws_subnet.private_app.id
  root_block_device {
    volume_size = 100
    volume_type = "gp3"
  }
  tags = { Name = "web-server-1", Environment = "production" }
}

# --- RDS ---
resource "aws_db_instance" "primary" {
  identifier        = "novapay-primary-db"
  engine            = "postgres"
  engine_version    = "14.9"
  instance_class    = "db.m5.xlarge"
  allocated_storage = 200
  storage_type      = "gp3"
  multi_az          = true
  tags = { Name = "novapay-primary-db" }
}
"""

VARIABLES_TF = r"""variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}
"""

OUTPUTS_TF = r"""output "vpc_id" {
  value = aws_vpc.main.id
}

output "web_server_ip" {
  value = aws_instance.web_server_1.public_ip
}

output "db_endpoint" {
  value = aws_db_instance.primary.endpoint
}
"""


async def run(context: dict, claude_client) -> dict:
    context["runbook"] = {
        "title": "GCP to AWS Migration Runbook — NovaPay",
        "estimated_total_duration": "8-12 weeks",
        "phases": [
            {
                "phase_number": 1,
                "name": "Pre-Migration",
                "duration": "1-2 weeks",
                "steps": [
                    {
                        "step_number": 1,
                        "action": "Set up AWS landing zone with VPC, subnets, and security groups",
                        "responsible": "Cloud Infrastructure Team",
                        "estimated_hours": 16,
                        "dependencies": [],
                        "rollback": "Delete AWS VPC and associated resources",
                        "notes": "Use target architecture from mapping output",
                    },
                    {
                        "step_number": 2,
                        "action": "Establish cross-cloud connectivity (VPN or Cloud Interconnect equivalent)",
                        "responsible": "Network Engineering",
                        "estimated_hours": 24,
                        "dependencies": [1],
                        "rollback": "Tear down interconnect; revert DNS if cutover not started",
                        "notes": "Validate latency to GCP during pilot",
                    },
                ],
            },
            {
                "phase_number": 2,
                "name": "Workload Migration",
                "duration": "3-5 weeks",
                "steps": [
                    {
                        "step_number": 1,
                        "action": "Replicate Cloud SQL to RDS with DMS or logical replication",
                        "responsible": "Database Team",
                        "estimated_hours": 40,
                        "dependencies": [],
                        "rollback": "Stop replication; keep GCP primary authoritative",
                        "notes": "Rehearse cutover twice before production",
                    },
                    {
                        "step_number": 2,
                        "action": "Deploy NovaPay API to ECS Fargate; migrate Cloud Run traffic",
                        "responsible": "Platform Team",
                        "estimated_hours": 32,
                        "dependencies": [1],
                        "rollback": "Route traffic back to Cloud Run via DNS",
                        "notes": "Align autoscaling with FinOps recommendations",
                    },
                ],
            },
        ],
        "rollback_plan": "Each phase has individual rollback steps; maintain GCP as fallback until validation gates pass.",
        "success_criteria": [
            "All services responding on AWS endpoints with <200ms latency",
            "Data integrity verified by checksum comparison",
            "Day-0 Reserved Instances purchased and active",
        ],
    }

    context["watchdog"] = {
        "monthly_aws_spend": 6387.00,
        "savings_identified": 2924.00,
        "resources_optimized_pct": 78,
        "active_agents": 5,
        "spend_by_service": [
            {"service": "EC2", "cost": 2950},
            {"service": "RDS", "cost": 1690},
            {"service": "S3", "cost": 1280},
            {"service": "Lambda", "cost": 586},
        ],
        "cost_trend": [
            {"month": "Month 1", "traditional": 10320, "radcloud": 6387},
            {"month": "Month 2", "traditional": 10150, "radcloud": 6250},
            {"month": "Month 3", "traditional": 9980, "radcloud": 6100},
            {"month": "Month 4", "traditional": 8900, "radcloud": 5950},
            {"month": "Month 5", "traditional": 7200, "radcloud": 5800},
            {"month": "Month 6", "traditional": 6900, "radcloud": 5650},
        ],
        "optimization_opportunities": [
            {
                "id": "OPT-001",
                "impact": "high",
                "title": "Right-size EC2 instances",
                "description": "14 instances oversized by >40%",
                "monthly_savings": 1180,
                "auto_fix": [
                    "Downsize 9x m5.xlarge → m5.large",
                    "Switch 3x c5.2xl → c6g.xl (Graviton)",
                    "Terminate 2x idle dev instances",
                ],
                "confidence": 97,
            },
            {
                "id": "OPT-002",
                "impact": "medium",
                "title": "S3 lifecycle policies",
                "description": "3.4 TB in expensive storage tiers",
                "monthly_savings": 520,
                "auto_fix": [
                    "Move 2.1 TB to S3 Infrequent Access",
                    "Archive 1.1 TB to S3 Glacier",
                    "Enable intelligent tiering on 4 buckets",
                ],
                "confidence": 94,
            },
            {
                "id": "OPT-003",
                "impact": "high",
                "title": "Reserved Instance strategy",
                "description": "Replace expiring GCP commitments with AWS RIs",
                "monthly_savings": 1224,
                "auto_fix": [
                    "Purchase 1yr RI for prod db.r5.xlarge",
                    "Convert 2x staging to db.t3.medium",
                    "Enable Aurora Serverless v2 scaling",
                ],
                "confidence": 91,
            },
        ],
        "remediation_pipeline": {
            "detect": "Scans for cost anomalies and waste patterns every 15 minutes",
            "evaluate": "Risk Agent ensures changes won't impact performance or availability",
            "apply": "Auto-applies safe changes: scaling, scheduling, RI purchases, tier adjustments",
            "verify": "Validates health metrics post-change and auto-rolls back if anomalies detected",
        },
    }

    context["iac_bundle"] = {
        "files": [
            {"filename": "main.tf", "language": "hcl", "content": MAIN_TF},
            {"filename": "variables.tf", "language": "hcl", "content": VARIABLES_TF},
            {"filename": "outputs.tf", "language": "hcl", "content": OUTPUTS_TF},
        ],
        "assumptions": [
            "AWS region set to us-east-1 (mapped from GCP us-central1)",
            "PostgreSQL 14 engine version preserved from Cloud SQL",
            "Multi-AZ enabled for production database (mapped from REGIONAL availability)",
            "gp3 EBS volumes used (mapped from pd-ssd)",
            "Security groups and IAM roles require manual review before deployment",
        ],
        "deployment_notes": "Run `terraform init && terraform plan` to validate before applying. Review security groups and IAM roles manually — auto-generated policies may be overly permissive.",
    }
    return context
