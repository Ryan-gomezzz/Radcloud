import { useMemo, useState } from "react";

const KW = new Set([
  "terraform",
  "provider",
  "resource",
  "variable",
  "output",
  "required_providers",
  "source",
  "version",
  "default",
  "description",
  "type",
  "string",
  "true",
  "false",
]);

function highlightHcl(code) {
  if (!code) return [];
  const lines = code.split("\n");
  return lines.map((line, li) => {
    const tokens = [];
    const re = /("[^"]*"|#.*|\b[a-zA-Z_][a-zA-Z0-9_]*\b|[{}[\]=]|[^\s"{}[\]=]+)/g;
    let m;
    let i = 0;
    while ((m = re.exec(line)) !== null) {
      const t = m[1];
      let cls = "text-[#d1d5db]";
      if (t.startsWith("#")) cls = "text-[#6b7280]";
      else if (t.startsWith('"')) cls = "text-[#a5d6ff]";
      else if (KW.has(t)) cls = "text-[#c792ea]";
      else if (t === "{" || t === "}" || t === "=") cls = "text-[#89ddff]";
      tokens.push(
        <span key={`${li}-${i++}`} className={cls}>
          {t}
        </span>,
      );
    }
    return (
      <div key={li} className="flex min-h-[1.5em]">
        <span className="w-10 shrink-0 select-none pr-3 text-right text-[#4b5563]">{li + 1}</span>
        <span className="whitespace-pre-wrap break-all">{tokens}</span>
      </div>
    );
  });
}

export function IaCOutputTab({ iacBundle }) {
  const files = iacBundle?.files || [];
  const [active, setActive] = useState(0);
  const current = files[active];

  const highlighted = useMemo(() => highlightHcl(current?.content || ""), [current?.content]);

  const copy = async () => {
    if (!current?.content) return;
    await navigator.clipboard.writeText(current.content);
  };

  const downloadBundle = () => {
    window.alert("Download bundle — connect to export API in production.");
  };

  if (!files.length) {
    return <p className="text-[#6b7280]">No IaC bundle yet.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-[#2a2a3e] pb-2">
        {files.map((f, i) => (
          <button
            key={f.filename}
            type="button"
            onClick={() => setActive(i)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              active === i
                ? "bg-[#1a1a2e] text-[#00d4aa]"
                : "text-[#6b7280] hover:text-[#d1d5db]"
            }`}
          >
            {f.filename}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#6b7280]">{current?.language?.toUpperCase()}</p>
        <div className="flex gap-2">
          <button type="button" className="btn-outline text-xs py-2 px-3" onClick={copy}>
            Copy file
          </button>
          <button type="button" className="btn-primary text-xs py-2 px-3" onClick={downloadBundle}>
            Download Terraform bundle
          </button>
        </div>
      </div>

      <div
        className="max-h-[480px] overflow-auto rounded-lg border border-[#2a2a3e] bg-[#12121a] p-4 font-mono-code text-xs leading-relaxed"
        style={{ tabSize: 2 }}
      >
        {highlighted}
      </div>

      {iacBundle?.assumptions?.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-[#f9fafb]">Assumptions</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[#9ca3af]">
            {iacBundle.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {iacBundle?.deployment_notes && (
        <div className="rounded-lg border border-[#2a2a3e] bg-[#12121a] p-4">
          <h4 className="mb-2 text-sm font-semibold text-[#f9fafb]">Deployment notes</h4>
          <p className="text-sm text-[#9ca3af]">{iacBundle.deployment_notes}</p>
        </div>
      )}
    </div>
  );
}
