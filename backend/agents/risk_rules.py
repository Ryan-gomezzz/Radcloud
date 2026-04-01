"""Deterministic risk detection rules — catches known GCP→AWS incompatibilities without Claude."""


def detect_deterministic_risks(gcp_inventory: list, aws_mapping: list) -> list:
    """Detect risks from mapping data without calling Claude.

    Returns (risks_list, next_risk_counter).
    """
    risks = []
    risk_counter = 1

    # Rule 1: Any partial or no-equivalent mapping is a risk
    for mapping in aws_mapping:
        confidence = mapping.get("mapping_confidence", "direct")
        if confidence == "partial":
            risks.append({
                "id": f"RISK-{risk_counter:03d}",
                "category": "service_compatibility",
                "severity": "medium",
                "title": f"{mapping.get('gcp_service', mapping.get('gcp_resource', '?'))} has only a partial AWS equivalent ({mapping.get('aws_service', '?')})",
                "description": mapping.get("gap_notes", "Partial mapping — review required."),
                "affected_resources": [mapping.get("gcp_resource_id", mapping.get("gcp_resource", "unknown"))],
                "aws_alternative": mapping.get("aws_service", "Unknown"),
                "migration_impact": "May require configuration changes or application modifications.",
                "mitigation": f"Evaluate whether {mapping.get('aws_service', 'the target service')} meets all requirements. Plan for testing.",
                "estimated_effort_days": 5,
            })
            risk_counter += 1
        elif confidence == "none":
            risks.append({
                "id": f"RISK-{risk_counter:03d}",
                "category": "service_compatibility",
                "severity": "high",
                "title": f"{mapping.get('gcp_service', mapping.get('gcp_resource', '?'))} has no direct AWS equivalent",
                "description": mapping.get("gap_notes", "No direct AWS equivalent. Requires rearchitecting."),
                "affected_resources": [mapping.get("gcp_resource_id", mapping.get("gcp_resource", "unknown"))],
                "aws_alternative": mapping.get("aws_service", "Requires evaluation"),
                "migration_impact": "Significant rearchitecting required. Application code changes likely.",
                "mitigation": "Conduct a detailed technical spike to evaluate alternatives before migration begins.",
                "estimated_effort_days": 15,
            })
            risk_counter += 1

    # Rule 2: IAM bindings always get a risk (GCP and AWS IAM are fundamentally different)
    iam_resources = [
        r for r in gcp_inventory
        if r.get("resource_type", r.get("type", "")) in ("iam_binding", "service_account", "google_service_account", "google_project_iam_binding")
    ]
    if iam_resources:
        risks.append({
            "id": f"RISK-{risk_counter:03d}",
            "category": "iam_model",
            "severity": "medium",
            "title": f"IAM model translation required for {len(iam_resources)} IAM resources",
            "description": "GCP uses project-level role bindings attached to members. AWS uses policy-based IAM with users, roles, and groups. This is not a 1:1 mapping and requires careful redesign.",
            "affected_resources": [r.get("name", "unknown") for r in iam_resources],
            "aws_alternative": "AWS IAM Roles + Policies",
            "migration_impact": "All service-to-service authentication must be redesigned. Application code that uses Application Default Credentials will need updates.",
            "mitigation": "Map each GCP service account to an AWS IAM role with equivalent permissions. Use IAM Access Analyzer to validate least-privilege.",
            "estimated_effort_days": 5,
        })
        risk_counter += 1

    # Rule 3: Firewall rules to security groups
    firewall_resources = [
        r for r in gcp_inventory
        if r.get("resource_type", r.get("type", "")) in ("firewall_rule", "google_compute_firewall")
    ]
    if firewall_resources:
        risks.append({
            "id": f"RISK-{risk_counter:03d}",
            "category": "networking",
            "severity": "medium",
            "title": f"Firewall rules to Security Groups translation ({len(firewall_resources)} rules)",
            "description": "GCP firewall rules are network-level and use target tags. AWS security groups are instance-level and stateful. NACLs are subnet-level and stateless. This difference can cause unexpected connectivity issues.",
            "affected_resources": [r.get("name", "unknown") for r in firewall_resources],
            "aws_alternative": "VPC Security Groups + Network ACLs",
            "migration_impact": "Network security posture may change silently. Applications may lose connectivity if security groups are too restrictive or gain unintended access if too permissive.",
            "mitigation": "Create a firewall rule mapping document. Test each rule individually in a staging VPC before cutover.",
            "estimated_effort_days": 3,
        })
        risk_counter += 1

    # Rule 4: Database migration always gets a risk
    db_resources = [
        r for r in gcp_inventory
        if r.get("resource_type", r.get("type", "")) in ("cloud_sql", "google_sql_database_instance")
    ]
    if db_resources:
        risks.append({
            "id": f"RISK-{risk_counter:03d}",
            "category": "data_migration",
            "severity": "high",
            "title": "Database migration requires careful planning for data integrity and minimal downtime",
            "description": "Migrating production databases between cloud providers carries risk of data loss, extended downtime, and replication lag. Read replicas add complexity.",
            "affected_resources": [r.get("name", "unknown") for r in db_resources],
            "aws_alternative": "RDS PostgreSQL with AWS DMS for migration",
            "migration_impact": "Requires a maintenance window for final cutover. Application connection strings must be updated atomically.",
            "mitigation": "Use AWS Database Migration Service (DMS) for continuous replication. Perform dry-run migration in staging. Plan a cutover window of 1-2 hours during low-traffic period.",
            "estimated_effort_days": 10,
        })
        risk_counter += 1

    # Rule 5: Egress cost surprise
    risks.append({
        "id": f"RISK-{risk_counter:03d}",
        "category": "cost_surprise",
        "severity": "medium",
        "title": "AWS data transfer egress pricing may increase networking costs",
        "description": "AWS charges for data transfer out to the internet and between regions/AZs. GCP pricing for egress differs. Cross-AZ traffic in AWS ($0.01/GB each way) can add up for high-throughput applications.",
        "affected_resources": ["all-networking"],
        "aws_alternative": "N/A — inherent platform difference",
        "migration_impact": "Monthly networking costs may be 10-20% higher than GCP depending on traffic patterns.",
        "mitigation": "Analyze current GCP egress patterns. Use VPC endpoints for AWS service traffic. Consider single-AZ deployment for non-critical workloads to reduce cross-AZ charges.",
        "estimated_effort_days": 2,
    })
    risk_counter += 1

    return risks, risk_counter
