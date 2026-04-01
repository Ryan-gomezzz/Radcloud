import { useState, useRef } from "react";

export const useTTS = () => {
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const synthRef = useRef(window.speechSynthesis);

  const speak = (text) => {
    if (!enabled || !text) return;

    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    const voices = synthRef.current.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Google') && v.lang.startsWith('en')
    ) || voices.find(v =>
      v.lang.startsWith('en') && v.localService
    ) || voices[0];

    if (preferred) utterance.voice = preferred;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const stop = () => {
    synthRef.current.cancel();
    setSpeaking(false);
  };

  const toggle = () => setEnabled(prev => !prev);

  return { enabled, speaking, speak, stop, toggle };
};
