import { useState, useEffect } from "react";
import { API_BASE, authHeaders } from "../api";

export const useChat = (tts) => {
  const [messages, setMessages] = useState([]);
  const [state, setState] = useState({
    goal: null, 
    has_existing_aws: null,
    has_terraform: false, 
    has_billing: false,
    wants_sample_data: false, 
    ready_to_analyze: false,
  });
  const [busy, setBusy] = useState(false);

  const sendMessage = async (userText) => {
    setBusy(true);
    let updatedMessages = [...messages];
    
    if (userText) {
      updatedMessages.push({ role: 'user', content: userText });
      setMessages(updatedMessages);
    }

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ messages: updatedMessages }),
      });
      
      if (!response.ok) {
         throw new Error(`Chat API error: ${response.status}`);
      }
      
      const data = await response.json();

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.message }
      ]);
      setState(prev => ({ ...prev, ...data.state }));

      if (tts && tts.enabled) {
        tts.speak(data.message);
      }
    } catch (e) {
      console.error("Chat error", e);
      
      // Fallback state progression if backend is down
      const demoState = { ...state };
      if (!demoState.goal) demoState.goal = "migration";
      else if (demoState.has_existing_aws === null) demoState.has_existing_aws = false;
      else if (!demoState.has_terraform) demoState.has_terraform = true;
      else if (!demoState.has_billing) demoState.has_billing = true;
      else demoState.ready_to_analyze = true;
      
      const fallbackMsg = "(Offline mode) I understand. Please continue to provide the required files, or request sample data, so we can proceed with the analysis.";
      
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: fallbackMsg }
      ]);
      setState(demoState);
      
      if (tts && tts.enabled) {
        tts.speak(fallbackMsg);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    sendMessage(''); // trigger initial greeting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { messages, state, sendMessage, busy };
};
