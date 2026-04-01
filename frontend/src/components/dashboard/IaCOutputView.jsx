import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, Terminal, FileCode2, DownloadCloud, AlertCircle } from "lucide-react";
import JSZip from "jszip";
import { useAnalysisStore } from "../../stores/analysisStore";

export function IaCOutputView() {
  const results = useAnalysisStore((s) => s.results);
  const bundle = results?.iac_bundle || {};
  const files = bundle.files || [];
  const date = new Date().toLocaleString();

  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const current = files[active];
  const lang = current?.language === "hcl" ? "hcl" : "terraform";

  const copyContent = async () => {
    if (!current?.content) return;
    await navigator.clipboard.writeText(current.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    for (const f of files) {
      if (f.filename && f.content != null) {
        zip.file(f.filename, f.content);
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "radcloud-terraform-bundle.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#d1d5db]">Infrastructure as Code</h1>
          <p className="text-[14px] text-[#6b7280]">Generated Terraform definitions</p>
        </div>
        <span className="text-[12px] text-[#4b5563]">Completed at {date}</span>
      </div>

      {files.length === 0 ? (
        <div className="py-16 text-center border border-[#2a2a3e] bg-[#16161f] rounded-xl flex flex-col items-center">
          <FileCode2 size={48} className="text-[#6b7280] mb-4 opacity-50" />
          <p className="text-[#d1d5db] font-medium text-[15px]">No code files generated</p>
          <p className="text-[#4b5563] text-[13px] mt-1">Run an analysis to generate infrastructure configurations.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main IDE area */}
          <div className="bg-[#12121a] border border-[#2a2a3e] rounded-xl overflow-hidden shadow-2xl flex flex-col h-[600px]">
             {/* IDE Header tabs */}
             <div className="flex bg-[#0a0a0f] border-b border-[#2a2a3e] overflow-x-auto">
                {files.map((f, i) => (
                   <button 
                     key={i} onClick={() => setActive(i)} 
                     className={`px-6 py-3 text-[13px] font-medium flex items-center gap-2 border-r border-[#2a2a3e] transition-colors whitespace-nowrap focus:outline-none ${i === active ? 'bg-[#12121a] text-[#00d4aa] border-b-2 border-b-[#00d4aa]' : 'text-[#6b7280] hover:bg-[#16161f] border-b-2 border-b-transparent hover:text-[#d1d5db]'}`}
                   >
                     <FileCode2 size={14} className={i === active ? "text-[#00d4aa]" : "text-[#4b5563]"} /> 
                     {f.filename}
                   </button>
                ))}
                <div className="flex-1" />
                <button onClick={copyContent} className="px-4 text-[#6b7280] hover:text-[#d1d5db] transition-colors border-l border-[#2a2a3e] bg-[#16161f] hover:bg-[#1a1a2e] flex items-center gap-2 text-[13px] font-medium">
                   {copied ? <><Check size={14} className="text-[#00d4aa]" /> Copied</> : <><Copy size={14} /> Copy Source</>}
                </button>
             </div>
             
             {/* Code Editor */}
             <div className="flex-1 overflow-auto bg-[#12121a] relative">
               <SyntaxHighlighter
                 language={lang}
                 style={oneDark}
                 customStyle={{ margin: 0, background: 'transparent', padding: '1.5rem', fontSize: '13px', lineHeight: '1.6' }}
                 codeTagProps={{ style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' } }}
                 showLineNumbers
                 lineNumberStyle={{ minWidth: '3em', paddingRight: '1em', color: '#4b5563', textAlign: 'right' }}
               >
                 {current?.content || ""}
               </SyntaxHighlighter>
             </div>
          </div>

          <div className="flex justify-end">
             <button onClick={downloadZip} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00d4aa] to-[#00b894] hover:brightness-110 text-[#0a0a0f] font-semibold text-[14px] rounded-lg shadow-lg shadow-[#00d4aa]/20 transition-all">
                <DownloadCloud size={18} /> Download Full Bundle (.zip)
             </button>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mt-6">
             {/* Assumptions Card */}
             <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl p-6">
                <h2 className="text-[13px] uppercase tracking-wider font-medium text-[#6b7280] mb-5 flex items-center gap-2">
                  <AlertCircle size={16} className="text-[#f59e0b]" /> Architecture Assumptions
                </h2>
                <ul className="space-y-4">
                  {(bundle.assumptions || ["Defaulting to equivalent instance families based on GCP machine types", "Using default VPC architecture since no custom routing was detected"]).map((a, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] mt-2 shrink-0" />
                      <span className="text-[14px] text-[#d1d5db] leading-relaxed">{a}</span>
                    </li>
                  ))}
                </ul>
             </div>

             {/* Deployment Notes */}
             <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl p-6">
                <h2 className="text-[13px] uppercase tracking-wider font-medium text-[#6b7280] mb-5 flex items-center gap-2">
                  <Terminal size={16} className="text-[#a855f7]" /> Deployment Notes
                </h2>
                <div className="p-4 bg-[#12121a] rounded-lg border border-[#2a2a3e] font-mono text-[13px] text-[#d1d5db] leading-relaxed whitespace-pre-wrap">
                  {bundle.deployment_notes || "terraform init\nterraform plan -out=tfplan\nterraform apply tfplan"}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
