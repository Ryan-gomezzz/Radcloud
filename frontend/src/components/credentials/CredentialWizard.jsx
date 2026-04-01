import { useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useCredentialStore } from "../../stores/credentialStore";
import { Badge } from "../shared/Badge";

const STEPS = [
  { id: 0, label: "GCP" },
  { id: 1, label: "AWS" },
  { id: 2, label: "Verify" },
  { id: 3, label: "Summary" },
];

const cardClass =
  "rounded-xl border border-[#1e293b] bg-[#12121a] p-6 text-[#d1d5db]";

export function CredentialWizard() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const step = useCredentialStore((s) => s.step);
  const gcp = useCredentialStore((s) => s.gcp);
  const aws = useCredentialStore((s) => s.aws);
  const setStep = useCredentialStore((s) => s.setStep);
  const nextStep = useCredentialStore((s) => s.nextStep);
  const prevStep = useCredentialStore((s) => s.prevStep);
  const setGcpFile = useCredentialStore((s) => s.setGcpFile);
  const testGcpConnection = useCredentialStore((s) => s.testGcpConnection);
  const setAwsMode = useCredentialStore((s) => s.setAwsMode);
  const setAwsCredentials = useCredentialStore((s) => s.setAwsCredentials);
  const testAwsConnection = useCredentialStore((s) => s.testAwsConnection);

  const onDrop = useCallback(
    async (e) => {
      e.preventDefault();
      const f = e.dataTransfer.files?.[0];
      if (!f || !f.name.toLowerCase().endsWith(".json")) return;
      setGcpFile(f);
      await testGcpConnection();
    },
    [setGcpFile, testGcpConnection]
  );

  const onFilePick = useCallback(
    async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setGcpFile(f);
      await testGcpConnection();
    },
    [setGcpFile, testGcpConnection]
  );

  const canNextFromGcp = gcp.status === "connected";
  const canNextFromAws = aws.status === "connected";

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#0a0a0f] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#d1d5db]">
          Connect cloud credentials
        </h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Link GCP and AWS so RADCloud can run discovery and execution safely.
        </p>

        <div className="mt-8 flex items-center justify-between gap-2">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  i === step
                    ? "bg-[#22d3ee] text-[#0a0a0f]"
                    : i < step
                      ? "bg-[#00d4aa]/20 text-[#00d4aa] ring-1 ring-[#00d4aa]/40"
                      : "bg-[#12121a] text-[#6b7280] ring-1 ring-[#1e293b]"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-[11px] font-medium uppercase tracking-wider ${
                  i === step ? "text-[#22d3ee]" : "text-[#6b7280]"
                }`}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-2 h-px bg-[#1e293b]" />

        <div className="mt-10 space-y-8">
          {step === 0 && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-[#d1d5db]">
                GCP service account
              </h2>
              <p className="mt-1 text-sm text-[#6b7280]">
                Upload a JSON key with read-only discovery permissions.
              </p>
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#1e293b] bg-[#0a0a0f] px-6 py-14 transition-colors hover:border-[#22d3ee]/50"
              >
                <Upload className="size-10 text-[#22d3ee]" aria-hidden />
                <p className="mt-3 text-sm font-medium text-[#d1d5db]">
                  Drop service account JSON here
                </p>
                <p className="mt-1 text-xs text-[#6b7280]">
                  or click to browse
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={onFilePick}
                />
              </div>

              {gcp.fileName && (
                <p className="mt-4 text-xs text-[#6b7280]">
                  Selected:{" "}
                  <span className="font-mono text-[#d1d5db]">{gcp.fileName}</span>
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {gcp.status === "testing" && (
                  <div className="flex items-center gap-2 text-sm text-[#22d3ee]">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Testing connection…
                  </div>
                )}
                {gcp.status === "connected" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="direct">Connected</Badge>
                    <span className="flex items-center gap-1 text-sm text-[#00d4aa]">
                      <CheckCircle2 className="size-4" aria-hidden />
                      {gcp.accountName} · {gcp.resourceCount} resources
                    </span>
                  </div>
                )}
                {gcp.status === "failed" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="high">Failed</Badge>
                    <span className="flex items-center gap-1 text-sm text-[#ef4444]">
                      <XCircle className="size-4" aria-hidden />
                      {gcp.error}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={!gcp.file || gcp.status === "testing"}
                onClick={() => testGcpConnection()}
                className="mt-4 rounded-lg border border-[#1e293b] px-4 py-2 text-sm font-medium text-[#d1d5db] transition-colors hover:border-[#22d3ee] hover:text-[#22d3ee] disabled:opacity-50"
              >
                Test connection again
              </button>
            </div>
          )}

          {step === 1 && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-[#d1d5db]">
                AWS connection
              </h2>
              <p className="mt-1 text-sm text-[#6b7280]">
                Choose how RADCloud assumes access to your AWS account.
              </p>

              <div className="mt-6 flex rounded-lg border border-[#1e293b] bg-[#0a0a0f] p-1">
                <button
                  type="button"
                  onClick={() => setAwsMode("keys")}
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                    aws.mode === "keys"
                      ? "bg-[#22d3ee]/15 text-[#22d3ee]"
                      : "text-[#6b7280]"
                  }`}
                >
                  Access keys
                </button>
                <button
                  type="button"
                  onClick={() => setAwsMode("role")}
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                    aws.mode === "role"
                      ? "bg-[#22d3ee]/15 text-[#22d3ee]"
                      : "text-[#6b7280]"
                  }`}
                >
                  Assume role
                </button>
              </div>

              {aws.mode === "keys" ? (
                <div className="mt-6 space-y-4">
                  <div>
                    <label
                      htmlFor="ak"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#6b7280]"
                    >
                      Access Key ID
                    </label>
                    <input
                      id="ak"
                      type="password"
                      autoComplete="off"
                      value={aws.accessKeyId}
                      onChange={(e) =>
                        setAwsCredentials({ accessKeyId: e.target.value })
                      }
                      className="w-full rounded-lg border border-[#1e293b] bg-[#0a0a0f] px-3 py-2.5 font-mono text-sm text-[#d1d5db] focus:border-[#22d3ee] focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/40"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sk"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#6b7280]"
                    >
                      Secret Access Key
                    </label>
                    <input
                      id="sk"
                      type="password"
                      autoComplete="off"
                      value={aws.secretAccessKey}
                      onChange={(e) =>
                        setAwsCredentials({ secretAccessKey: e.target.value })
                      }
                      className="w-full rounded-lg border border-[#1e293b] bg-[#0a0a0f] px-3 py-2.5 font-mono text-sm text-[#d1d5db] focus:border-[#22d3ee] focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/40"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div>
                    <label
                      htmlFor="rn"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#6b7280]"
                    >
                      Role ARN
                    </label>
                    <input
                      id="rn"
                      type="text"
                      value={aws.roleArn}
                      onChange={(e) =>
                        setAwsCredentials({ roleArn: e.target.value })
                      }
                      placeholder="arn:aws:iam::123456789012:role/RADCloudDiscovery"
                      className="w-full rounded-lg border border-[#1e293b] bg-[#0a0a0f] px-3 py-2.5 font-mono text-sm text-[#d1d5db] placeholder:text-[#4b5563] focus:border-[#22d3ee] focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/40"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ex"
                      className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#6b7280]"
                    >
                      External ID (optional)
                    </label>
                    <input
                      id="ex"
                      type="text"
                      value={aws.externalId}
                      onChange={(e) =>
                        setAwsCredentials({ externalId: e.target.value })
                      }
                      className="w-full rounded-lg border border-[#1e293b] bg-[#0a0a0f] px-3 py-2.5 font-mono text-sm text-[#d1d5db] focus:border-[#22d3ee] focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/40"
                    />
                  </div>
                  <a
                    href="#"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#22d3ee] hover:underline"
                  >
                    Launch CloudFormation stack
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => testAwsConnection()}
                  disabled={aws.status === "testing"}
                  className="rounded-lg bg-[#22d3ee] px-4 py-2.5 text-sm font-semibold text-[#0a0a0f] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {aws.status === "testing" ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Testing…
                    </span>
                  ) : (
                    "Test connection"
                  )}
                </button>
                {aws.status === "connected" && (
                  <div className="flex items-center gap-2">
                    <Badge variant="direct">Connected</Badge>
                    <span className="text-sm text-[#00d4aa]">
                      {aws.accountName} · {aws.resourceCount} resources
                    </span>
                  </div>
                )}
                {aws.status === "failed" && (
                  <div className="flex items-center gap-2 text-sm text-[#ef4444]">
                    <XCircle className="size-4" aria-hidden />
                    {aws.error}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={cardClass}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[#d1d5db]">GCP</h3>
                  <CheckCircle2 className="size-6 text-[#00d4aa]" aria-hidden />
                </div>
                <p className="mt-4 text-[11px] uppercase tracking-wider text-[#6b7280]">
                  Account
                </p>
                <p className="mt-1 font-mono text-sm text-[#d1d5db]">
                  {gcp.accountName ?? "—"}
                </p>
                <p className="mt-4 text-[11px] uppercase tracking-wider text-[#6b7280]">
                  Resources discovered
                </p>
                <p className="mt-1 text-2xl font-bold text-[#22d3ee]">
                  {gcp.resourceCount ?? "—"}
                </p>
              </div>
              <div className={cardClass}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[#d1d5db]">AWS</h3>
                  <CheckCircle2 className="size-6 text-[#00d4aa]" aria-hidden />
                </div>
                <p className="mt-4 text-[11px] uppercase tracking-wider text-[#6b7280]">
                  Account
                </p>
                <p className="mt-1 font-mono text-sm text-[#d1d5db]">
                  {aws.accountName ?? "—"}
                </p>
                <p className="mt-4 text-[11px] uppercase tracking-wider text-[#6b7280]">
                  Resources discovered
                </p>
                <p className="mt-1 text-2xl font-bold text-[#22d3ee]">
                  {aws.resourceCount ?? "—"}
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-[#d1d5db]">
                Ready to analyze
              </h2>
              <ul className="mt-6 space-y-3 text-sm text-[#d1d5db]">
                <li className="flex justify-between border-b border-[#1e293b] pb-2">
                  <span className="text-[#6b7280]">GCP</span>
                  <span className="font-mono">{gcp.accountName}</span>
                </li>
                <li className="flex justify-between border-b border-[#1e293b] pb-2">
                  <span className="text-[#6b7280]">GCP resources</span>
                  <span>{gcp.resourceCount}</span>
                </li>
                <li className="flex justify-between border-b border-[#1e293b] pb-2">
                  <span className="text-[#6b7280]">AWS</span>
                  <span className="font-mono">{aws.accountName}</span>
                </li>
                <li className="flex justify-between pb-2">
                  <span className="text-[#6b7280]">AWS resources</span>
                  <span>{aws.resourceCount}</span>
                </li>
              </ul>
              <button
                type="button"
                onClick={() => navigate("/app/onboarding")}
                className="mt-8 w-full rounded-lg bg-gradient-to-r from-[#22d3ee] to-[#00d4aa] py-3 text-sm font-semibold text-[#0a0a0f] shadow-lg shadow-[#22d3ee]/20 transition-opacity hover:opacity-90"
              >
                Start analysis
              </button>
            </div>
          )}
        </div>

        <div className="mt-10 flex justify-between">
          <button
            type="button"
            onClick={() => (step === 0 ? navigate(-1) : prevStep())}
            className="inline-flex items-center gap-2 rounded-lg border border-[#1e293b] px-4 py-2 text-sm font-medium text-[#d1d5db] hover:border-[#22d3ee] hover:text-[#22d3ee]"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Back
          </button>
          {step < 3 && (
            <button
              type="button"
              disabled={
                (step === 0 && !canNextFromGcp) ||
                (step === 1 && !canNextFromAws) ||
                (step === 2 && (!canNextFromGcp || !canNextFromAws))
              }
              onClick={() => nextStep()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#0a0a0f] disabled:opacity-40"
            >
              Next
              <ChevronRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
