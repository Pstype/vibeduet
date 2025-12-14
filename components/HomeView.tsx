import React, { useState, useEffect } from 'react';
import { ArrowRight, Bot, User, Loader2, Sparkles, Cpu, Radio } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface HomeViewProps {
  onStart: (topic: string, infographicUrl: string) => void;
}

const LOADING_MESSAGES = [
  "Analyzing semantic context...",
  "Spinning up Nano-Banana neural pathways...",
  "Synthesizing abstract visual metaphors...",
  "Calibrating audio-visual resonance...",
  "Establishing secure debate environment..."
];

const HomeView: React.FC<HomeViewProps> = ({ onStart }) => {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  // Cycle loading messages
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleStartInteraction = async () => {
    if (!topic.trim()) return;
    
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Robust Context-Aware Prompt for Infographic
      const systemPrompt = `
        Generate a clean, high-quality, whiteboard-style infographic representing the concept of: "${topic}".
        
        Visual Style Guidelines:
        - Hand-drawn aesthetic on a clean white background.
        - Use marker colors: Black, Blue, Red, and Green.
        - Diagrammatic elements: arrows, mind-map nodes, simple icons, sticky notes.
        - Minimalist, organized, and clear.
        - No photorealism; it should look like a brilliant brainstorming session sketch.
        - Center composition.
        - The image should capture the essence of analyzing "${topic}" structurally.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: systemPrompt }]
        }
      });

      let imageUrl = '';
      
      // Extract Image
      // Note: The structure requires iterating parts as per guidelines
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                break;
            }
        }
      }

      if (!imageUrl) {
        throw new Error("No image generated");
      }

      // Transition to Arena
      onStart(topic, imageUrl);

    } catch (error) {
      console.error("Error generating infographic:", error);
      setIsLoading(false);
      // Fallback if generation fails - allow user to retry or proceed without image could be handled here
      // For now, we just reset loading to let them try again
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f1612] flex flex-col items-center justify-center relative overflow-hidden text-white">
        {/* Background Ambient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-green-900/20 via-[#0f1612] to-[#0f1612] animate-pulse"></div>
        
        <div className="z-10 flex flex-col items-center gap-8 max-w-md text-center px-6">
           <div className="relative">
             <div className="absolute inset-0 bg-green-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
             <Loader2 size={64} className="text-green-400 animate-spin relative z-10" />
           </div>
           
           <div className="space-y-2">
             <h2 className="text-2xl font-bold tracking-tight text-white">Initializing VibeDuet</h2>
             <p className="text-green-400/80 font-mono text-sm h-6 transition-all duration-500">
               {LOADING_MESSAGES[loadingMsgIndex]}
             </p>
           </div>

           <div className="flex gap-4 mt-8 opacity-50">
              <Cpu size={20} className="text-zinc-500 animate-bounce delay-100" />
              <Radio size={20} className="text-zinc-500 animate-bounce delay-200" />
              <Sparkles size={20} className="text-zinc-500 animate-bounce delay-300" />
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1612] flex flex-col relative overflow-hidden text-white">
      {/* Header */}
      <header className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
            <Bot size={20} className="text-black" />
          </div>
          <span className="font-semibold text-lg tracking-tight">VibeDuet</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
          <User size={18} className="text-zinc-400" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 relative z-10">
        {/* Ambient Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-900/20 rounded-full blur-[120px] pointer-events-none" />

        <h1 className="text-5xl md:text-6xl font-bold text-center mb-2">
          What do you want to
        </h1>
        <h1 className="text-5xl md:text-6xl font-bold text-center mb-12">
          <span className="text-green-400">duet today?</span>
        </h1>

        <div className="w-full max-w-xl relative mb-12">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStartInteraction()}
            placeholder="E.g. The future of space travel..."
            className="w-full bg-transparent border-b border-zinc-700 text-3xl md:text-4xl py-4 text-center focus:outline-none focus:border-green-500 placeholder-zinc-600 transition-colors font-light"
          />
        </div>

        <button
          onClick={handleStartInteraction}
          disabled={!topic.trim()}
          className="group relative px-8 py-4 bg-green-500 text-black rounded-full font-bold text-lg flex items-center gap-3 hover:bg-green-400 transition-all shadow-[0_0_40px_-10px_rgba(34,197,94,0.6)] hover:shadow-[0_0_60px_-10px_rgba(34,197,94,0.8)] hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Conversation
          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </main>
    </div>
  );
};

export default HomeView;