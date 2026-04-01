import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import {
  useAnalysisStore,
  PIPELINE_AGENTS,
} from "../../stores/analysisStore";
import { getSampleData } from "../../api";
import { ChatJourneyRail } from "./ChatJourneyRail";
import { AgentStrip } from "./AgentStrip";
import { useChat } from "../../hooks/useChat";
import { useTTS } from "../../hooks/useTTS";
import { 
  Send as SendIcon, 
  Volume2 as Volume2Icon, 
  VolumeX as VolumeXIcon,
  FileCode as FileCodeIcon,
  UploadCloud as UploadCloudIcon,
  Loader as LoaderIcon
} from "lucide-react";
import { ChatPipelineStatus } from "./ChatPipelineStatus";
import { ChatResultsCard } from "./ChatResultsCard";

const AGENT_LABELS = {
  discovery: "Discovery",
  mapping: "Mapping",
  risk: "Risk",
  finops: "FinOps",
  watchdog: "Watchdog",
};

export function ChatOnboarding() {
  const tts = useTTS();
  const { messages, state, sendMessage, busy: chatBusy } = useChat(tts);
  
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  const setTerraformConfig = useAnalysisStore((s) => s.setTerraformConfig);
  const setBillingCSV = useAnalysisStore((s) => s.setBillingCSV);
  const setUseSampleInfra = useAnalysisStore((s) => s.setUseSampleInfra);
  const setUseSampleBilling = useAnalysisStore((s) => s.setUseSampleBilling);
  const runAnalysis = useAnalysisStore((s) => s.runAnalysis);
  const results = useAnalysisStore((s) => s.results);

  const [phase, setPhase] = useState("chat"); // chat, running, results
  const [pipelineAgents, setPipelineAgents] = useState([]);
  const [pipelineMessage, setPipelineMessage] = useState("");
  const progressTimerRef = useRef(null);
  
  const [terraformInput, setTerraformInput] = useState("");
  const [infraBusy, setInfraBusy] = useState(false);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, state, phase, pipelineAgents, pipelineMessage]);

  const clearTimer = () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };
  useEffect(() => () => clearTimer(), []);

  const handleSend = () => {
    if (!input.trim() || chatBusy) return;
    sendMessage(input.trim());
    setInput("");
  };

  const startPipelineSimulation = useCallback(() => {
    clearTimer();
    let step = 0;
    const updateAgents = (completedKeys, currentKey) =>
      PIPELINE_AGENTS.map((name) => ({
        name: AGENT_LABELS[name] || name,
        status: completedKeys.includes(name) ? "complete" : currentKey === name ? "running" : "pending",
      }));

    setPipelineAgents(updateAgents([], PIPELINE_AGENTS[0]));
    setPipelineMessage("Starting discovery...");

    progressTimerRef.current = window.setInterval(() => {
      step += 1;
      if (step < PIPELINE_AGENTS.length) {
        const completed = PIPELINE_AGENTS.slice(0, step);
        const current = PIPELINE_AGENTS[step];
        setPipelineAgents(updateAgents(completed, current));
        setPipelineMessage(`Running ${AGENT_LABELS[current] || current}...`);
      } else {
        setPipelineAgents(PIPELINE_AGENTS.map((name) => ({ name: AGENT_LABELS[name] || name, status: "complete" })));
        setPipelineMessage("");
        clearTimer();
      }
    }, 750);
  }, []);

  const handleRunAnalysis = () => {
    setPhase("running");
    startPipelineSimulation();
    runAnalysis()
      .then(() => {
        clearTimer();
        setPipelineAgents(PIPELINE_AGENTS.map((name) => ({ name: AGENT_LABELS[name] || name, status: "complete" })));
        setPipelineMessage("");
        window.setTimeout(() => setPhase("results"), 1500);
      })
      .catch((e) => {
        clearTimer();
        console.error(e);
        setPhase("chat");
      });
  };

  const handleSubmitTerraform = async () => {
    if (!terraformInput.trim() || infraBusy) return;
    setInfraBusy(true);
    setUseSampleInfra(false);
    setTerraformConfig(terraformInput);
    await sendMessage("I have submitted my Terraform configuration via the form.");
    setInfraBusy(false);
  };
  
  const handleBillingUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || infraBusy) return;
    setInfraBusy(true);
    setUseSampleBilling(false);
    setBillingCSV(file, file.name);
    await sendMessage(`I have uploaded my billing CSV file: ${file.name}`);
    setInfraBusy(false);
  };

  useEffect(() => {
    if (state.wants_sample_data && !infraBusy) {
      setInfraBusy(true);
      getSampleData().then((data) => {
        setTerraformConfig(data.terraform);
        setUseSampleInfra(true);
        const blob = new Blob([data.billing_csv], { type: "text/csv" });
        const file = new File([blob], "sample_billing.csv", { type: "text/csv" });
        setBillingCSV(file, "sample_billing.csv");
        setUseSampleBilling(true);
        setInfraBusy(false);
      }).catch(e => {
        console.error(e);
        setInfraBusy(false);
      });
    }
  }, [state.wants_sample_data]); // eslint-disable-next-line
  
  return (
    <div className="flex h-[calc(100vh-60px)] flex-col bg-[#0a0a0f] overflow-hidden md:flex-row"
         style={{ backgroundImage: `url('/images/onboard-bg.png')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundBlendMode: 'overlay' }}>
      <ChatJourneyRail phase={phase} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#0a0a0f]/80 backdrop-blur-md">
        <AgentStrip activeKey={null} pulse={phase === "running"} />
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a3e] bg-[#12121a]/80">
          <h2 className="text-lg font-medium text-[#d1d5db]">Cloud Migration Assistant</h2>
          <button onClick={tts.toggle} className={`p-2 rounded-md transition-all ${tts.enabled ? 'bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20' : 'text-[#6b7280] hover:text-[#d1d5db] border border-transparent'}`} title={tts.enabled ? 'Voice enabled' : 'Enable voice'}>
            {tts.enabled ? <Volume2Icon size={16} /> : <VolumeXIcon size={16} />}
          </button>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="max-w-3xl mx-auto space-y-6 pb-32">
            {messages.map((msg, idx) => {
               const isAi = msg.role === 'assistant';
               return (
                 <div key={idx} className={`flex flex-col ${isAi ? 'items-start' : 'items-end'}`}>
                   <div className={`max-w-[85%] rounded-2xl px-5 py-3 ${isAi ? 'bg-[#12121a] border border-[#2a2a3e] text-[#d1d5db]' : 'bg-gradient-to-r from-[#00d4aa] to-[#00b894] text-[#0a0a0f]'}`}>
                     <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                     {isAi && (
                        <button onClick={() => tts.speak(msg.content)} className="mt-2 p-1 text-[#6b7280] hover:text-[#00d4aa] transition-colors" title="Read aloud">
                          <Volume2Icon size={14} className={tts.speaking ? "animate-pulse text-[#00d4aa]" : ""} />
                        </button>
                     )}
                   </div>
                   
                   {isAi && idx === messages.length - 1 && phase === "chat" && (
                     <div className="mt-4 w-full">
                       {state.has_terraform === false && !state.ready_to_analyze && !state.wants_sample_data && (
                         <div className="ml-11 mt-3 max-w-[85%]">
                           <div className="bg-[#12121a] border border-[#2a2a3e] rounded-lg overflow-hidden">
                             <div className="px-4 py-2 border-b border-[#2a2a3e] flex items-center gap-2">
                               <FileCodeIcon size={14} className="text-[#6b7280]" />
                               <span className="text-[12px] text-[#6b7280] font-medium">Paste your Terraform or YAML configuration</span>
                             </div>
                             <textarea value={terraformInput} onChange={e => setTerraformInput(e.target.value)} className="w-full bg-transparent p-4 text-[13px] font-mono text-[#d1d5db] placeholder:text-[#4b5563] resize-none focus:outline-none" rows={10} placeholder={'resource "google_compute_instance" "web_server" {\n  name         = "web-server-1"\n  machine_type = "n1-standard-4"\n  ...\n}'} />
                             <div className="px-4 py-3 border-t border-[#2a2a3e] bg-[#16161f] flex justify-end">
                               <button disabled={infraBusy} onClick={handleSubmitTerraform} className="px-4 py-2 bg-[#00d4aa]/10 border border-[#00d4aa]/30 rounded-md text-[13px] font-medium text-[#00d4aa] hover:bg-[#00d4aa]/20 hover:border-[#00d4aa]/50 transition-all disabled:opacity-50">
                                 {infraBusy ? <LoaderIcon size={14} className="animate-spin" /> : "Submit configuration"}
                               </button>
                             </div>
                           </div>
                         </div>
                       )}
                       
                       {state.has_billing === false && state.has_terraform !== false && !state.ready_to_analyze && !state.wants_sample_data && (
                         <div className="ml-11 mt-3 max-w-[85%]">
                           <label className="block p-8 bg-[#12121a] border border-dashed border-[#2a2a3e] rounded-xl hover:border-[#00d4aa]/50 hover:bg-[#16161f] transition-all cursor-pointer text-center group">
                             <div className="w-12 h-12 rounded-full bg-[#1a1a2e] flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                               <UploadCloudIcon size={24} className="text-[#00d4aa]" />
                             </div>
                             <p className="text-[14px] font-medium text-[#d1d5db]">Drop your GCP billing export CSV here</p>
                             <p className="text-[13px] text-[#6b7280] mt-2">or click to browse your files</p>
                             <p className="text-[11px] text-[#4b5563] mt-4 uppercase tracking-wider font-semibold">CSV format • 6-12 months recommended</p>
                             <input type="file" accept=".csv" className="hidden" disabled={infraBusy} onChange={handleBillingUpload} />
                           </label>
                         </div>
                       )}
                     </div>
                   )}
                 </div>
               );
            })}
            
            {chatBusy && (
               <div className="flex items-start">
                 <div className="max-w-[85%] rounded-2xl px-5 py-4 bg-[#12121a] border border-[#2a2a3e] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00d4aa] animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-[#00d4aa] animate-bounce delay-100" />
                    <span className="w-2 h-2 rounded-full bg-[#00d4aa] animate-bounce delay-200" />
                 </div>
               </div>
            )}
            
            {phase === "running" && (
                <ChatPipelineStatus agents={pipelineAgents} currentMessage={pipelineMessage} />
            )}

            {phase === "results" && results && (
                <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <ChatResultsCard results={results} />
                </div>
            )}
          </div>
        </div>

        {phase === "chat" && state.ready_to_analyze ? (
          <div className="p-4 border-t border-[#2a2a3e] bg-[#12121a] shrink-0 animate-in slide-in-from-bottom-4">
            <div className="max-w-3xl mx-auto flex items-center justify-between p-4 bg-gradient-to-r from-[#00d4aa]/10 to-[#00b894]/10 border border-[#00d4aa]/30 rounded-xl">
              <div>
                <h3 className="text-[#d1d5db] font-medium text-[15px]">Ready to analyze infrastructure</h3>
                <p className="text-[#6b7280] text-[13px] mt-1">Goal: {state.goal || 'Analysis'}, AWS: {state.has_existing_aws ? 'Existing' : 'Fresh Start'}</p>
              </div>
              <button onClick={handleRunAnalysis} className="px-6 py-2.5 bg-gradient-to-r from-[#00d4aa] to-[#00b894] hover:brightness-110 text-[#0a0a0f] text-[14px] font-semibold rounded-lg shadow-lg shadow-[#00d4aa]/20 transition-all">
                Run analysis Now
              </button>
            </div>
          </div>
        ) : phase === "chat" ? (
          <div className="p-4 border-t border-[#2a2a3e] bg-[#12121a]/90 backdrop-blur-sm shrink-0">
            <div className="max-w-3xl mx-auto flex gap-3 items-center">
              <input type="text" value={input} disabled={chatBusy} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()} placeholder="Type your message..." className="flex-1 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl px-5 py-3.5 text-[15px] text-[#d1d5db] placeholder:text-[#4b5563] focus:outline-none focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa]/50 transition-all shadow-inner" />
              <button disabled={chatBusy || !input.trim()} onClick={handleSend} className="p-3.5 bg-gradient-to-r from-[#00d4aa] to-[#00b894] rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-[#0a0a0f] shadow-lg shadow-[#00d4aa]/20">
                <SendIcon size={20} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
