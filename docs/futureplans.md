# RADCloud — Future Additions
## From Hackathon Prototype to Production Platform

---

## Document Purpose

This document outlines the production roadmap for RADCloud beyond the 24-hour hackathon prototype. It covers the fully automated migration pipeline, the RAG implementation for improved AI decision-making, and the security architecture required to handle real cloud credentials safely.

**Current prototype note:** Multi-agent reasoning already uses **Claude through Amazon Bedrock** (not the direct Anthropic API). Future phases below extend Bedrock usage (e.g. Knowledge Bases, Titan embeddings) in the same AWS-native direction.

---

## Phase 1: Secure Cloud Connectivity (Weeks 1–4)

### The Problem with Direct Credentials

The hackathon prototype uses file uploads (Terraform config + billing CSV). A production version needs to connect directly to live GCP and AWS accounts. However, taking raw login credentials (username/password, root access keys) is a security anti-pattern that no enterprise customer would accept. Here's the safe way to do it.

### GCP Connection — Read-Only Service Account

Instead of asking for a user's GCP login, RADCloud should use a dedicated read-only GCP service account. The onboarding flow works as follows.

The user creates a new GCP service account in their project with the minimum required roles: Viewer (roles/viewer) for resource inventory, Billing Account Viewer (roles/billing.viewer) for billing data, and Security Reviewer (roles/iam.securityReviewer) for IAM policy analysis. The user downloads the service account JSON key and uploads it to RADCloud. RADCloud stores this key in AWS Secrets Manager (encrypted at rest with KMS), never in a database or config file. RADCloud uses the service account to call GCP APIs: Cloud Asset Inventory API for resource discovery, Cloud Billing API for billing export, and Resource Manager API for project/org structure.

The key security properties: the service account has read-only access (cannot modify the user's GCP infrastructure), credentials are stored encrypted in AWS Secrets Manager with automatic rotation, and the user can revoke the service account at any time from their GCP console.

### AWS Connection — Cross-Account IAM Role

For AWS, the pattern is even cleaner. Instead of taking AWS access keys, RADCloud uses cross-account IAM role assumption. The onboarding flow works as follows.

RADCloud provides the user with a CloudFormation template (or Terraform module) that creates an IAM role in their AWS account with a trust policy allowing RADCloud's AWS account to assume it. The role has two policy sets: a read-only set for analysis (Cost Explorer, CloudWatch, EC2 Describe, RDS Describe, S3 List, etc.) and a write set for migration execution (EC2, RDS, S3, VPC, IAM — only activated when the user explicitly approves a migration plan). RADCloud assumes this role using AWS STS AssumeRole, receiving temporary credentials that expire after 1 hour. No permanent AWS keys are stored anywhere.

The key security properties: no permanent credentials stored, temporary credentials expire automatically, the user controls the IAM policy (can restrict permissions further), all actions are logged in the user's AWS CloudTrail, and the user can delete the role to revoke access instantly.

### The Onboarding Wizard

The user experience is a guided wizard with the following steps.

Step 1 — Connect GCP: the user downloads a pre-configured Terraform module that creates the read-only service account in their GCP project, runs `terraform apply`, and uploads the generated service account key to RADCloud.

Step 2 — Connect AWS: RADCloud provides a one-click CloudFormation launch button. The user clicks it, reviews the IAM role being created (all permissions are visible), and approves. RADCloud detects the role and tests connectivity.

Step 3 — Verify: RADCloud runs a connectivity check on both clouds, confirming it can read GCP resources and reach the AWS target account. Displays a green "Connected" status for both.

Step 4 — Analyze: the existing RADCloud pipeline runs, but now pulling live data instead of uploaded files. The Discovery Agent calls GCP APIs directly, the FinOps Agent pulls real billing data, and the Mapping Agent generates architecture proposals based on actual infrastructure.

---

## Phase 2: Full Automation Pipeline (Weeks 4–8)

### Automated GCP Discovery (replacing file upload)

Instead of parsing uploaded Terraform files, the Discovery Agent calls GCP APIs directly.

The Cloud Asset Inventory API returns every resource in the project with full configuration details. The Compute Engine API provides instance metadata, disk configurations, networking. The Cloud SQL Admin API gives database versions, sizes, replication configs. The Cloud Storage API returns bucket configurations, lifecycle rules, storage classes. The Cloud Functions and Cloud Run APIs provide serverless configurations. The IAM API returns all role bindings, service accounts, and policies.

This gives the Discovery Agent a complete, accurate, real-time view of the infrastructure — no Terraform file needed, no risk of the file being outdated or incomplete.

### Automated Migration Execution

After the user reviews and approves the migration plan, RADCloud can execute it in phases with human checkpoints.

Phase 1 — Infrastructure Provisioning: RADCloud runs `terraform apply` on the generated AWS Terraform in the user's AWS account (via the cross-account IAM role). Every resource creation is logged. The user can watch in real-time via a deployment dashboard. Automatic rollback if any resource fails to create.

Phase 2 — Data Migration: this is the most complex phase. For databases (Cloud SQL → RDS), RADCloud sets up AWS Database Migration Service (DMS) with continuous replication. It starts full-load migration, then switches to CDC (Change Data Capture) mode for ongoing replication. When the user is ready for cutover, RADCloud stops writes to GCP, waits for replication lag to hit zero, promotes the RDS instance, and updates application connection strings. For object storage (GCS → S3), RADCloud uses AWS DataSync or S3 Transfer Acceleration for large buckets. It runs checksum verification after transfer. For lifecycle rules and versioning, the mapping is already done by the Mapping Agent.

Phase 3 — DNS Cutover: RADCloud updates Route 53 records to point to AWS endpoints. Uses low TTL (60 seconds) set 24 hours before cutover. Monitors health checks on both GCP and AWS endpoints during transition. Automatic rollback if AWS health checks fail within the first hour.

Phase 4 — Verification: RADCloud runs automated health checks: endpoint latency, database query performance, storage accessibility. Compares metrics against GCP baselines. Generates a migration completion report.

Phase 5 — Decommission (optional, user-triggered): after a configurable soak period (default 30 days), RADCloud can generate a GCP decommission plan. Lists all GCP resources still running, their costs, and a recommended shutdown order. The user manually approves each decommission batch. RADCloud never auto-deletes GCP resources without explicit approval.

### Human Checkpoints

Every phase transition requires explicit user approval. RADCloud never moves from "plan" to "execute" automatically. The UX shows a clear approval gate with a summary of what will happen, estimated cost, estimated duration, and a list of resources being affected. The user clicks "Approve Phase X" to proceed. Every action is logged with the user's identity and timestamp.

---

## Phase 3: RAG Implementation for Intelligent Decision-Making (Weeks 6–10)

### Why RAG Is Needed in Production

The hackathon prototype uses hardcoded mapping tables and pricing data. This works for a demo but has limitations. AWS pricing changes frequently — the hardcoded tables go stale. New AWS services launch regularly. Best-practice migration patterns evolve as AWS releases new features. Edge cases in service compatibility need deep documentation knowledge.

RAG (Retrieval-Augmented Generation) solves this by giving the AI agents access to a searchable knowledge base of up-to-date documentation, pricing data, and migration patterns.

### Knowledge Base Architecture

RADCloud should implement two separate knowledge bases.

#### Knowledge Base 1: Static Reference Knowledge

This contains curated, chunked, and embedded documents that change infrequently.

Data sources include AWS official documentation (service descriptions, pricing pages, best practices, limits), GCP official documentation (service descriptions, feature comparisons), AWS Well-Architected Framework (all 6 pillars — operational excellence, security, reliability, performance, cost optimization, sustainability), GCP-to-AWS migration guides (both Google's and AWS's official guides), Terraform provider documentation (both google and aws providers — resource types, arguments, attributes), AWS re:Post and knowledge center articles on common migration issues, and CIS benchmarks and security baselines for both clouds.

The total corpus is approximately 50,000–100,000 documents. Chunking strategy: 512-token chunks with 50-token overlap, preserving section headers as metadata. Embedding model: Amazon Titan Embeddings v2 (available natively in Bedrock — no external API needed). Vector store: Amazon OpenSearch Serverless with vector search (fully AWS-native, no external dependencies).

The indexing pipeline runs weekly: scrape documentation sources, chunk, embed, upsert into OpenSearch. Store metadata per chunk including source URL, last updated date, AWS service name, and document type (pricing/guide/reference/best-practice).

#### Knowledge Base 2: Dynamic Per-Customer Context

This stores customer-specific data that grows over time.

Data sources include the customer's GCP infrastructure snapshots (taken at each analysis run), historical migration decisions and their outcomes, past FinOps recommendations and whether they were accepted or rejected, Watchdog agent observations and anomaly patterns, and customer-specific preferences (e.g., "we prefer Fargate over EKS", "we need HIPAA compliance").

Storage: Amazon DynamoDB for structured data (decisions, preferences), OpenSearch for searchable text (analysis reports, agent reasoning logs). This knowledge base is scoped per customer — Customer A's data is never visible to Customer B's agents.

### How Each Agent Uses RAG

#### Discovery Agent + RAG

Before analyzing a GCP resource, the Discovery Agent queries the static knowledge base for the latest documentation on that GCP service. This helps it understand edge cases: for example, if a customer uses Cloud Spanner with multi-region configuration, the agent retrieves documentation about Spanner's specific consistency model to understand what needs to be preserved in the migration.

Example query: "Cloud Spanner multi-region consistency guarantees vs Aurora Global Database"

#### Mapping Agent + RAG

The Mapping Agent queries both knowledge bases. Static KB: "What is the best AWS equivalent for GCP Cloud Dataflow batch processing?" retrieves documentation comparing Glue, EMR, and Step Functions. Dynamic KB: "Has this customer previously migrated a Dataflow job? What approach did they use?" retrieves past decisions.

This eliminates the hardcoded mapping table and replaces it with dynamic, up-to-date recommendations.

#### Risk Agent + RAG

The Risk Agent queries the static KB for known migration pitfalls. Example: "Common issues migrating GCP IAM to AWS IAM" retrieves re:Post articles about permission translation failures, service account key rotation differences, and organization policy conflicts.

It also queries the dynamic KB: "Have similar infrastructure configurations caused issues in past migrations?" If a previous customer with a similar Pub/Sub-to-BigQuery pipeline had issues, that knowledge propagates (anonymized) to future risk assessments.

#### FinOps Agent + RAG

The FinOps Agent queries the static KB for current AWS pricing. Instead of hardcoded pricing tables, it retrieves: "Current EC2 m5.xlarge on-demand price us-east-1" and gets the latest number. It also retrieves: "EC2 Reserved Instance pricing comparison 1-year vs 3-year All Upfront vs No Upfront" to provide more nuanced recommendations.

The pricing data in the static KB is refreshed daily from the AWS Pricing API, ensuring recommendations are always current.

#### Watchdog Agent + RAG

The Watchdog Agent queries the dynamic KB for historical patterns: "What optimization actions have been applied to this customer's account in the past 30 days? Did any cause issues?" This prevents the agent from re-applying a fix that was previously rolled back.

### RAG Infrastructure Stack (fully AWS-native)

The entire RAG stack runs on AWS services, which strengthens the hackathon narrative of being an AWS-native solution.

Amazon Bedrock Knowledge Bases handles the end-to-end RAG pipeline: document ingestion, chunking, embedding with Titan Embeddings, and storage in OpenSearch Serverless. This is actually the simplest path — Bedrock Knowledge Bases is a managed RAG service that requires minimal code.

Amazon OpenSearch Serverless stores the vector embeddings and supports hybrid search (vector similarity + keyword matching).

Amazon S3 stores the raw source documents (PDFs, HTML, markdown).

AWS Lambda runs the weekly indexing pipeline (scrape → chunk → embed → upsert).

Amazon DynamoDB stores structured per-customer data (decisions, preferences, metadata).

The integration with agents is straightforward: each agent calls Bedrock's RetrieveAndGenerate API, which searches the knowledge base and returns relevant chunks that are automatically injected into Claude's context before generating a response.

### RAG Implementation Priority

For the first production release, implement RAG for the FinOps Agent first (live pricing data), then the Mapping Agent (dynamic service mapping), then the Risk Agent (known pitfalls database), then the Discovery Agent (service documentation), and finally the Watchdog Agent (historical patterns). The FinOps Agent benefits most from RAG because pricing data goes stale fastest.

---

## Phase 4: Enterprise Features (Weeks 10–16)

### Multi-Project / Multi-Account Support

Support migrating multiple GCP projects into a single AWS organization with an AWS Landing Zone structure (Control Tower). The Mapping Agent understands org-level patterns: shared VPCs, centralized logging, cross-project IAM.

### Approval Workflows

Integration with enterprise approval systems: Slack (approve/reject migration steps via Slack buttons), Jira (create migration tasks, track progress), email (approval emails with one-click approve/reject links), and SSO/SAML integration for enterprise identity.

### Compliance Mode

For regulated industries (finance, healthcare), RADCloud adds a compliance overlay: HIPAA compliance checks (ensure RDS encryption, VPC isolation, CloudTrail logging), SOC 2 controls mapping (GCP controls → AWS controls), PCI DSS requirements validation, and data residency enforcement (ensure no cross-region data transfer violations).

### Cost Guardrails

Set budget limits that the Watchdog Agent enforces. If AWS spend exceeds a threshold, the Watchdog Agent alerts the user and optionally auto-scales down non-critical workloads. Integration with AWS Budgets and CloudWatch Billing Alarms.

---

## Phase 5: Multi-Cloud Expansion (Weeks 16+)

### Beyond GCP-to-AWS

Expand to support Azure-to-AWS migration using the same agent architecture. The Discovery Agent adds Azure Resource Graph queries. The Mapping Agent adds Azure-to-AWS service mappings. The FinOps Agent adds Azure pricing data.

Eventually, support any-cloud-to-any-cloud migrations — but start with GCP-to-AWS (the hackathon scope) and Azure-to-AWS (the largest enterprise demand).

### Reverse Migration

Support AWS-to-GCP migration for organizations moving in the other direction. This reuses 80% of the agent infrastructure — the mapping tables just run in reverse.

---

## Architecture Diagram: Production RADCloud

```
┌─────────────────────────────────────────────────────────────┐
│                     RADCloud Platform                        │
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │ Frontend  │◄──►│ API Gateway  │◄──►│ Orchestrator     │   │
│  │ (React)   │    │ (API GW)     │    │ (ECS Fargate)    │   │
│  └──────────┘    └──────────────┘    └──────┬───────────┘   │
│                                              │               │
│                    ┌─────────────────────────┼──────────┐    │
│                    │         Agent Layer      │          │    │
│                    │  ┌──────┐ ┌──────┐ ┌────┴─┐       │    │
│                    │  │Disc. │ │Map.  │ │Risk  │       │    │
│                    │  └──┬───┘ └──┬───┘ └──┬───┘       │    │
│                    │  ┌──┴───┐ ┌──┴───┐                 │    │
│                    │  │FinOps│ │Watch.│                  │    │
│                    │  └──┬───┘ └──┬───┘                  │    │
│                    └─────┼────────┼──────────────────────┘    │
│                          │        │                           │
│  ┌───────────────────────┼────────┼────────────────────┐     │
│  │         Intelligence Layer     │                    │     │
│  │  ┌──────────────┐  ┌──────────┴───────┐            │     │
│  │  │ Bedrock      │  │ Bedrock          │            │     │
│  │  │ (Claude LLM) │  │ Knowledge Bases  │            │     │
│  │  └──────────────┘  │ (RAG)            │            │     │
│  │                     └──────────────────┘            │     │
│  │  ┌──────────────┐  ┌──────────────────┐            │     │
│  │  │ OpenSearch    │  │ DynamoDB         │            │     │
│  │  │ (Vectors)     │  │ (Customer Data)  │            │     │
│  │  └──────────────┘  └──────────────────┘            │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │         Security Layer                              │     │
│  │  ┌──────────────┐  ┌──────────────┐               │     │
│  │  │ Secrets Mgr  │  │ STS          │               │     │
│  │  │ (GCP keys)   │  │ (AWS roles)  │               │     │
│  │  └──────────────┘  └──────────────┘               │     │
│  │  ┌──────────────┐  ┌──────────────┐               │     │
│  │  │ CloudTrail   │  │ Cognito      │               │     │
│  │  │ (Audit)      │  │ (Auth)       │               │     │
│  │  └──────────────┘  └──────────────┘               │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌──────────────────┐  ┌────────────────────────────┐       │
│  │ Source Cloud      │  │ Target Cloud               │       │
│  │ (GCP — read-only)│  │ (AWS — scoped IAM role)    │       │
│  └──────────────────┘  └────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary: What Exists Now vs. What's Planned

| Capability | Hackathon (now) | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|-----------|----------------|---------|---------|---------|---------|
| GCP input | File upload | Live API via service account | Live API | Live API | Live API |
| AWS output | Generated Terraform (download) | Cross-account IAM role | Auto-deploy Terraform | Auto-deploy | Auto-deploy |
| Data migration | Not implemented | Not implemented | DMS + DataSync automated | Automated + verified | Automated + compliance |
| AI reasoning | Hardcoded tables + Claude prompts | Same | Same | RAG-augmented decisions | RAG + historical learning |
| Pricing data | Hardcoded reference tables | Same | Same | Live via RAG + AWS Pricing API | Real-time |
| Security | No credentials handled | Encrypted secrets + scoped roles | Same + audit trail | Same + compliance | SOC 2 / HIPAA |
| Post-migration | Watchdog dashboard (simulated) | Same | Watchdog with live CloudWatch | Watchdog with anomaly ML | Watchdog + auto-remediation |
| Multi-cloud | GCP → AWS only | GCP → AWS only | GCP → AWS only | GCP → AWS | GCP/Azure → AWS |