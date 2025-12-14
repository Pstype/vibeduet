
import React, { useEffect, useState } from 'react';
import { 
  Share2, 
  User, 
  RotateCcw, 
  Zap, 
  Activity, 
  MessageSquare, 
  Smile,
  Loader2
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { SessionData, SessionAnalysis } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { APP_CONFIG, SYSTEM_PROMPTS } from '../constants';

interface SummaryViewProps {
  data: SessionData;
  onRestart: () => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({ data, onRestart }) => {
  const [analysis, setAnalysis] = useState<SessionAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const analyzeSession = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const transcriptText = data.transcript.map(t => `${t.role}: ${t.text}`).join('\n');
        
        const response = await ai.models.generateContent({
          model: APP_CONFIG.GEMINI_MODELS.TEXT_ANALYSIS,
          contents: `${SYSTEM_PROMPTS.ANALYSIS_TASK} Transcript: ${transcriptText}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                intensity: { type: Type.STRING, description: "One word description of intensity (e.g. High, Medium, Calm)" },
                coherence: { type: Type.STRING, description: "Percentage string e.g. 85%" },
                mood: { type: Type.STRING, description: "One word mood description" },
                takeaways: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      t: { type: Type.STRING, description: "Title of takeaway" },
                      d: { type: Type.STRING, description: "Description of takeaway" }
                    }
                  }
                },
                chartData: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      time: { type: Type.STRING, description: "Time label e.g. 0:00" },
                      val: { type: Type.NUMBER, description: "Sentiment value 0-100" }
                    }
                  }
                }
              }
            }
          }
        });

        if (response.text) {
          setAnalysis(JSON.parse(response.text));
        }
      } catch (error) {
        console.error("Analysis failed", error);
        // Fallback or error state could be handled here
      } finally {
        setLoading(false);
      }
    };

    if (data.transcript.length > 0) {
        analyzeSession();
    } else {
        setLoading(false);
    }
  }, [data]);

  return (
    <div className="min-h-screen bg-[#0a100c] text-white p-4 md:p-8 font-sans">
      
      {/* Top Header */}
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="font-bold text-xs">AI</span>
            </div>
            <span className="font-semibold">AI Session Report</span>
        </div>
        <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-[#1a2e22] text-white font-medium rounded-full text-sm hover:bg-[#254230] transition-colors border border-green-900">
                <Share2 size={16} /> Share
            </button>
            <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center">
                 <User size={18} className="text-orange-900" />
            </div>
        </div>
      </header>

      {/* Main Title Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 pb-8 border-b border-white/5">
        <div>
            <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-0.5 bg-green-900/40 text-green-400 text-[10px] font-bold uppercase tracking-wider rounded border border-green-800">Completed</span>
                <span className="text-zinc-500 text-sm">{new Date().toLocaleDateString()} • {data.duration} Duration</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight">{data.topic || "Untitled Session"}</h1>
            <p className="text-zinc-400 max-w-xl text-sm leading-relaxed">
               {data.transcript.length} turns in conversation.
            </p>
        </div>
        <button onClick={onRestart} className="mt-4 md:mt-0 flex items-center gap-2 px-6 py-2.5 border border-white/10 rounded-full hover:bg-white/5 text-sm font-medium transition-colors">
            <RotateCcw size={16} /> Restart Session
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
           <Loader2 className="animate-spin text-green-500" size={48} />
           <span className="ml-4 text-zinc-400">Analyzing session data...</span>
        </div>
      ) : analysis ? (
        <>
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[
                { label: 'INTENSITY', val: analysis.intensity, sub: 'Based on tone', icon: <Zap size={16} className="text-green-400"/>, color: 'text-white' },
                { label: 'COHERENCE', val: analysis.coherence, sub: 'Argument Logic', icon: <Activity size={16} className="text-green-400"/>, color: 'text-white' },
                { label: 'TURNS', val: data.transcript.length, sub: 'Interactions', icon: <MessageSquare size={16} className="text-zinc-400"/>, color: 'text-zinc-200' },
                { label: 'MOOD', val: analysis.mood, sub: 'Overall Sentiment', icon: <Smile size={16} className="text-green-400"/>, color: 'text-white' },
            ].map((stat, i) => (
                <div key={i} className="bg-[#121915] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">{stat.label}</span>
                        {stat.icon}
                    </div>
                    <div className={`text-3xl font-bold mb-1 ${stat.color}`}>{stat.val}</div>
                    <div className="text-xs text-zinc-400">{stat.sub}</div>
                </div>
            ))}
        </div>

        {/* Middle Section: Chart & Takeaways */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            
            {/* Chart */}
            <div className="lg:col-span-2 bg-[#121915] border border-white/5 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-semibold text-lg">Sentiment Timeline</h3>
                    <div className="flex gap-4 text-xs font-medium">
                        <span className="flex items-center gap-1.5 text-zinc-500"><div className="w-2 h-2 rounded-full bg-zinc-600"></div> Neutral</span>
                        <span className="flex items-center gap-1.5 text-green-400"><div className="w-2 h-2 rounded-full bg-green-500"></div> Positive</span>
                    </div>
                </div>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analysis.chartData}>
                            <defs>
                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#52525b', fontSize: 10}} />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip contentStyle={{backgroundColor: '#18181b', border: 'none', borderRadius: '8px'}} itemStyle={{color: '#fff'}} />
                            <Area type="monotone" dataKey="val" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Key Takeaways */}
            <div className="bg-[#121915] border border-white/5 rounded-2xl p-6 flex flex-col">
                <h3 className="font-semibold text-lg mb-6">Key Takeaways</h3>
                <div className="space-y-6 flex-1">
                    {analysis.takeaways?.map((item, i) => (
                        <div key={i} className="flex gap-4">
                            <div className="mt-1.5 min-w-[6px] h-[6px] rounded-full bg-green-500"></div>
                            <div>
                                <span className="text-white font-medium text-sm">{item.t}: </span>
                                <span className="text-zinc-400 text-sm">{item.d}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
        </>
      ) : (
          <div className="text-center text-zinc-500 mt-20">No analysis available.</div>
      )}
      
      <footer className="text-center text-xs text-zinc-600 border-t border-white/5 pt-8 pb-4">
        Session Demo • Confidential
      </footer>
    </div>
  );
};

export default SummaryView;
