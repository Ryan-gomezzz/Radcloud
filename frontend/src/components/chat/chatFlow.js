/** Scripted onboarding copy helpers — no LLM. */

export const GOAL_OPTIONS = [
  {
    id: "migration",
    label: "Migrate from GCP to AWS",
    description: "Full migration plan and mapping",
  },
  {
    id: "finops",
    label: "Optimize existing AWS costs",
    description: "Day-0 FinOps from GCP billing + config",
  },
  {
    id: "both",
    label: "Migration + cost optimization",
    description: "Combined migration and FinOps analysis",
  },
];

export const AWS_PRESENCE_OPTIONS = [
  { id: "yes", label: "Yes, we have some AWS presence" },
  { id: "no", label: "No, this is a fresh migration" },
];

export const CONFIG_SOURCE_OPTIONS = [
  { id: "paste", label: "Paste Terraform / YAML config" },
  { id: "sample", label: "Use sample data (demo)" },
];

export const CONFIRM_OPTIONS = [
  { id: "run", label: "Run analysis" },
  { id: "back", label: "Go back and change inputs" },
];

export function goalFollowUpText(goalId) {
  if (goalId === "finops") {
    return "You want to optimize AWS costs using your GCP baseline and billing history. I'll analyze usage patterns and produce Day-0 Reserved Instance and rightsizing recommendations.";
  }
  if (goalId === "both") {
    return "You want both migration planning and cost optimization. I'll map GCP to AWS, assess risks, and surface Day-0 FinOps savings.";
  }
  return "You're looking to migrate from Google Cloud Platform to AWS. I'll analyze your GCP infrastructure and generate a complete migration plan with Day-0 cost optimizations.";
}

export function pipelineCompletionMessages(results) {
  const inv = results?.gcp_inventory?.length ?? 0;
  const services = new Set(
    (results?.gcp_inventory || []).map((r) => r.service).filter(Boolean)
  ).size;
  const arch = results?.aws_architecture || {};
  const direct = arch.direct_mappings ?? 0;
  const partial = arch.partial_mappings ?? 0;
  const gaps = arch.no_equivalent ?? 0;
  const risks = results?.risk_summary?.total_risks ?? 0;
  const high = results?.risk_summary?.high ?? 0;
  const savings = results?.finops?.total_first_year_savings ?? 0;

  return [
    `Discovery complete. Found ${inv} GCP resources across ${services || "multiple"} services.`,
    `Mapping complete. ${direct} direct mappings, ${partial} partial, ${gaps} gaps identified.`,
    `Risk assessment complete. ${risks} risks identified (${high} high severity).`,
    `FinOps analysis complete. $${Number(savings).toLocaleString()} in Day-0 savings identified.`,
    "Watchdog setup complete. Monitoring plan and Terraform generated.",
  ];
}
