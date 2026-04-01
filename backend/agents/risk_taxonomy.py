"""Risk categories and severity criteria for GCP-to-AWS migration risk analysis."""

RISK_CATEGORIES = {
    "service_compatibility": {
        "description": "GCP services with no direct or only partial AWS equivalent",
        "severity_rules": {
            "high": "No AWS equivalent exists, requires rearchitecting",
            "medium": "Partial equivalent exists, requires configuration changes",
            "low": "Direct equivalent exists but with minor behavioral differences",
        },
    },
    "iam_model": {
        "description": "Differences between GCP project-level IAM and AWS policy-based IAM",
        "severity_rules": {
            "high": "Complex IAM bindings with cross-project references",
            "medium": "Standard IAM bindings that need restructuring",
            "low": "Simple service account to IAM role conversion",
        },
    },
    "networking": {
        "description": "VPC topology, firewall rules, and connectivity changes",
        "severity_rules": {
            "high": "Network topology incompatibility (e.g., auto-mode VPC, shared VPC)",
            "medium": "Firewall rule to security group translation with behavioral changes",
            "low": "Simple subnet and CIDR mapping",
        },
    },
    "data_migration": {
        "description": "Risks around moving data between clouds",
        "severity_rules": {
            "high": "Large database migration with zero-downtime requirement",
            "medium": "Object storage migration with lifecycle rules",
            "low": "Small dataset transfer",
        },
    },
    "downtime": {
        "description": "Potential service interruption during migration",
        "severity_rules": {
            "high": "Stateful services requiring cutover window",
            "medium": "Services that can be migrated with brief interruption",
            "low": "Stateless services with blue-green deployment option",
        },
    },
    "cost_surprise": {
        "description": "Unexpected cost differences between GCP and AWS",
        "severity_rules": {
            "high": "Service pricing model fundamentally different",
            "medium": "Egress costs or hidden fees",
            "low": "Minor pricing differences",
        },
    },
}
