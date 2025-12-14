import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Mic, MicOff, PhoneOff, 
  MousePointer2, Pen, StickyNote, Square, 
  Undo, Hand, Plus, AlertCircle, Loader2
} from 'lucide-react';
import { SessionData, TranscriptEntry } from '../types';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import html2canvas from 'html2canvas';

interface ArenaViewProps {
  onEnd: (data: SessionData) => void;
  topic: string;
  initialImage: string;
}

// ----------------------------------------------------------------------
// AUDIO UTILS (Encoding/Decoding)
// ----------------------------------------------------------------------

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Float32 (WebAudio) to Int16 (API expectation)
function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true); // little-endian
  }
  return buffer;
}

// ----------------------------------------------------------------------
// SUB-COMPONENTS
// ----------------------------------------------------------------------

// 1. AI Atom Visualizer
const AtomVisualizer: React.FC<{ speaking: boolean; color?: string }> = ({ speaking, color = "#06b6d4" }) => {
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      {/* Nucleus */}
      <div 
        className={`absolute w-4 h-4 rounded-full bg-white shadow-[0_0_15px_${color}] z-10 transition-all duration-300 ${speaking ? 'scale-125' : 'scale-100'}`} 
      />
      
      {/* Shells */}
      {[0, 60, 120].map((deg, i) => (
        <div
          key={i}
          className="absolute w-full h-8 border-[1.5px] border-transparent rounded-[50%]"
          style={{
            borderColor: color,
            transform: `rotate(${deg}deg)`,
            opacity: 0.6,
            animation: `spin-orbit-${i} ${speaking ? '1s' : '8s'} linear infinite`
          }}
        />
      ))}
      
      <style>{`
        @keyframes spin-orbit-0 { from { transform: rotate(0deg) rotateX(70deg) rotate(0deg); } to { transform: rotate(0deg) rotateX(70deg) rotate(360deg); } }
        @keyframes spin-orbit-1 { from { transform: rotate(60deg) rotateX(70deg) rotate(0deg); } to { transform: rotate(60deg) rotateX(70deg) rotate(360deg); } }
        @keyframes spin-orbit-2 { from { transform: rotate(120deg) rotateX(70deg) rotate(0deg); } to { transform: rotate(120deg) rotateX(70deg) rotate(360deg); } }
      `}</style>

      {/* Glow Halo when speaking */}
      <div className={`absolute inset-0 bg-cyan-500/20 rounded-full blur-2xl transition-opacity duration-300 ${speaking ? 'opacity-100' : 'opacity-0'}`}></div>
    </div>
  );
};

// 2. Whiteboard Toolbar
const WhiteboardToolbar: React.FC<{ 
  tool: string; 
  setTool: (t: any) => void;
  undo: () => void;
  activeColor: string;
  setColor: (c: string) => void;
  toggleColorPicker: () => void;
  showColorPicker: boolean;
}> = ({ tool, setTool, undo, activeColor, setColor, toggleColorPicker, showColorPicker }) => {
  const tools = [
    { id: 'cursor', icon: <MousePointer2 size={20} />, label: 'Select' },
    { id: 'hand', icon: <Hand size={20} />, label: 'Pan' },
    { id: 'pen', icon: <Pen size={20} />, label: 'Draw' },
    { id: 'note', icon: <StickyNote size={20} />, label: 'Comment' },
    { id: 'shape', icon: <Square size={20} />, label: 'Shape' },
  ];

  const colors = [
    '#ef4444', // Red
    '#22c55e', // Green
    '#3b82f6', // Blue
    '#eab308', // Yellow
    '#ffffff', // White
  ];

  return (
    <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-30 pointer-events-auto">
        <div className="flex flex-col gap-3 p-2 bg-zinc-900/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                tool === t.id 
                  ? 'bg-green-500 text-black shadow-lg shadow-green-500/20' 
                  : 'text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
          
          <div className="h-[1px] w-full bg-white/10 my-1" />
          
          <div className="relative">
             <button
               onClick={toggleColorPicker}
               className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${showColorPicker ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}
             >
                 <div className="w-5 h-5 rounded-full border-2 border-white" style={{ backgroundColor: activeColor }} />
             </button>
             
             {showColorPicker && (
               <div className="absolute left-14 top-0 bg-zinc-900/90 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-xl grid grid-cols-2 gap-2 w-32 animate-in fade-in slide-in-from-left-2 z-50">
                  {colors.map(c => (
                    <button
                        key={c}
                        onClick={() => { setColor(c); toggleColorPicker(); }}
                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${activeColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                    />
                  ))}
                  <label className="w-8 h-8 rounded-full border-2 border-zinc-600 flex items-center justify-center cursor-pointer hover:border-white bg-black relative overflow-hidden">
                      <Plus size={14} className="text-zinc-400" />
                      <input 
                        type="color" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={(e) => { setColor(e.target.value); toggleColorPicker(); }} 
                      />
                  </label>
               </div>
             )}
          </div>

          <div className="h-[1px] w-full bg-white/10 my-1" />

          <button 
            onClick={undo}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10"
            title="Undo"
          >
            <Undo size={20} />
          </button>
        </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// MAIN VIEW
// ----------------------------------------------------------------------

const ArenaView: React.FC<ArenaViewProps> = ({ onEnd, topic, initialImage }) => {
  // --- STATE ---
  // Live API State
  const [connectionState, setConnectionState] = useState<'initializing' | 'connected' | 'error' | 'disconnected'>('initializing');
  const [errorMessage, setErrorMessage] = useState('');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  
  // Canvas State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Tools State
  const [activeTool, setActiveTool] = useState<'cursor' | 'hand' | 'pen' | 'note' | 'shape'>('hand'); 
  const [activeColor, setActiveColor] = useState('#ef4444');
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // Content State
  const [paths, setPaths] = useState<{ d: string; color: string; width: number }[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [notes, setNotes] = useState<{ x: number; y: number; text: string }[]>([]);
  const [shapes, setShapes] = useState<{ x: number; y: number; color: string }[]>([]);

  // Session State
  const [isMuted, setIsMuted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null); // Output (24kHz)
  const inputAudioContextRef = useRef<AudioContext | null>(null); // Input (16kHz)
  const nextStartTimeRef = useRef<number>(0);
  const sourceNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  // --- LIVE API IMPLEMENTATION ---

  const connectToLiveAPI = useCallback(async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // 1. Setup Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      // Input: 16kHz for Microphone
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      
      // Output: 24kHz for Gemini response
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

      // 2. Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = inputAudioContextRef.current.createMediaStreamSource(stream);
      const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      // 3. Connect Session
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: `You are a brilliant, creative product co-founder in a "VibeDuet" session. 
          You are looking at a shared digital whiteboard where the user is visualizing an idea about: "${topic}".
          Listen to the user, offer constructive feedback, ask clarifying questions, and help refine the concept.
          You can see the whiteboard content. Refer to specific shapes, notes, or drawings if relevant.
          Be concise, energetic, and encouraging. Keep responses relatively short to maintain a conversational flow.`,
        },
        callbacks: {
          onopen: () => {
            console.log("Session Connected");
            setConnectionState('connected');
            
            // Start Audio Processing Pipeline
            processor.onaudioprocess = (e) => {
              if (isMuted) return; // Don't send if muted
              
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Calculate volume for visualizer
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i]*inputData[i];
              setVolumeLevel(Math.sqrt(sum / inputData.length));

              // Convert to Int16 PCM
              const pcmData = floatTo16BitPCM(inputData);
              const base64Data = arrayBufferToBase64(pcmData);
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                   media: {
                     mimeType: 'audio/pcm;rate=16000',
                     data: base64Data
                   }
                });
              });
            };
            
            source.connect(processor);
            processor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Audio Output
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
               setIsAiSpeaking(true);
               const ctx = audioContextRef.current!;
               const byteArr = base64ToUint8Array(audioData);
               
               // Decode Custom (PCM -> AudioBuffer)
               // The API sends raw PCM 24kHz.
               const dataInt16 = new Int16Array(byteArr.buffer);
               const float32 = new Float32Array(dataInt16.length);
               for(let i=0; i<dataInt16.length; i++) {
                 float32[i] = dataInt16[i] / 32768.0;
               }
               
               const buffer = ctx.createBuffer(1, float32.length, 24000);
               buffer.copyToChannel(float32, 0);

               const audioSource = ctx.createBufferSource();
               audioSource.buffer = buffer;
               audioSource.connect(ctx.destination);
               
               // Schedule
               const currentTime = ctx.currentTime;
               // If nextStartTime is in the past, reset it to now
               if (nextStartTimeRef.current < currentTime) {
                 nextStartTimeRef.current = currentTime;
               }
               
               audioSource.start(nextStartTimeRef.current);
               nextStartTimeRef.current += buffer.duration;
               
               sourceNodesRef.current.add(audioSource);
               audioSource.onended = () => {
                 sourceNodesRef.current.delete(audioSource);
                 if (sourceNodesRef.current.size === 0) {
                    setIsAiSpeaking(false);
                 }
               };
            }

            // Handle Turn Complete (Logging)
            if (msg.serverContent?.turnComplete) {
               // We don't get the text transcript back automatically in this mode unless configured.
               // For now, we just log a generic event.
               transcriptRef.current.push({
                 role: 'model',
                 text: '(Audio Response)',
                 timestamp: Date.now()
               });
            }

            // Handle Interruption
            if (msg.serverContent?.interrupted) {
               console.log("Interrupted!");
               setIsAiSpeaking(false);
               nextStartTimeRef.current = 0;
               sourceNodesRef.current.forEach(node => {
                 try { node.stop(); } catch(e) {}
               });
               sourceNodesRef.current.clear();
            }
          },
          onclose: () => {
            console.log("Session Closed");
            setConnectionState('disconnected');
          },
          onerror: (err) => {
            console.error("Session Error", err);
            setErrorMessage("Connection Error. Please restart.");
            setConnectionState('error');
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;

    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "Failed to initialize audio.");
      setConnectionState('error');
    }
  }, [topic, isMuted]);

  // --- WHITEBOARD CAPTURE ---
  // Periodically capture the whiteboard and send to Gemini
  useEffect(() => {
    if (connectionState !== 'connected') return;
    
    const captureInterval = setInterval(async () => {
       // Only capture if we have the reference
       if (!worldRef.current || !sessionPromiseRef.current) return;
       
       try {
         // We capture the 'world' content div.
         // Note: html2canvas can be slow. We limit scale for performance.
         const canvas = await html2canvas(worldRef.current, {
           scale: 0.5, // Lower resolution for speed
           useCORS: true,
           logging: false,
           backgroundColor: null // transparent
         });
         
         const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
         
         sessionPromiseRef.current.then(session => {
            session.sendRealtimeInput({
               media: {
                 mimeType: 'image/jpeg',
                 data: base64Data
               }
            });
         });
         
       } catch (err) {
         console.warn("Screen capture failed", err);
       }
    }, 3000); // Every 3 seconds is enough for "real-time" context without killing CPU

    return () => clearInterval(captureInterval);
  }, [connectionState]);


  // --- LIFECYCLE ---

  // Initial Connection
  useEffect(() => {
    if (connectionState === 'initializing') {
        connectToLiveAPI();
    }
    
    // Cleanup
    return () => {
       if (sessionPromiseRef.current) {
          sessionPromiseRef.current.then(s => s.close());
       }
       if (inputAudioContextRef.current) {
         inputAudioContextRef.current.close();
       }
       if (audioContextRef.current) {
         audioContextRef.current.close();
       }
    };
  }, []); // Run once on mount

  // Clock
  useEffect(() => {
    const timer = setInterval(() => {
        setElapsedTime(p => p + 1);
        setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Set Viewport
  useEffect(() => {
    if (containerRef.current) {
        setViewportSize({ 
            w: containerRef.current.clientWidth, 
            h: containerRef.current.clientHeight 
        });
    }
  }, []);

  // --- INTERACTION LOGIC (Canvas) ---
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const cx = viewportSize.w / 2;
    const cy = viewportSize.h / 2;
    const rect = containerRef.current?.getBoundingClientRect();
    const relX = screenX - (rect?.left || 0);
    const relY = screenY - (rect?.top || 0);

    return {
        x: (relX - cx - offset.x) / scale,
        y: (relY - cy - offset.y) / scale
    };
  }, [offset, scale, viewportSize]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const newScale = Math.min(Math.max(0.1, scale - e.deltaY * zoomSensitivity), 5);
      setScale(newScale);
    } else {
      setOffset(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  }, [scale]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'hand') {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (activeTool === 'pen') {
      setIsDragging(true);
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setCurrentPath(`M ${worldPos.x} ${worldPos.y}`);
    } else if (activeTool === 'note') {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setNotes(prev => [...prev, { x: worldPos.x, y: worldPos.y, text: '' }]);
      setActiveTool('cursor'); 
    } else if (activeTool === 'shape') {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setShapes(prev => [...prev, { x: worldPos.x - 50, y: worldPos.y - 50, color: activeColor }]);
      setActiveTool('cursor');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    if (activeTool === 'hand') {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY }); 
    } else if (activeTool === 'pen') {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setCurrentPath(prev => `${prev} L ${worldPos.x} ${worldPos.y}`);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (activeTool === 'pen' && currentPath) {
      setPaths(prev => [...prev, { d: currentPath, color: activeColor, width: 3 }]);
      setCurrentPath('');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- RENDER ---
  const cx = viewportSize.w / 2;
  const cy = viewportSize.h / 2;
  const transform = `translate(${cx + offset.x}px, ${cy + offset.y}px) scale(${scale})`;

  // Loading / Error Overlay
  if (connectionState === 'initializing') {
    return (
        <div className="h-screen w-full bg-[#050a07] text-white flex flex-col items-center justify-center">
            <Loader2 size={48} className="animate-spin text-green-500 mb-4" />
            <h2 className="text-xl font-bold">Establishing Secure Uplink...</h2>
            <p className="text-zinc-500 mt-2">Connecting to Gemini Live Neural Network</p>
        </div>
    );
  }

  if (connectionState === 'error') {
    return (
        <div className="h-screen w-full bg-[#050a07] text-white flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle size={64} className="text-red-500 mb-6" />
            <h2 className="text-2xl font-bold mb-2">Connection Interrupted</h2>
            <p className="text-zinc-400 mb-8 max-w-md">{errorMessage}</p>
            <button 
                onClick={() => { setConnectionState('initializing'); connectToLiveAPI(); }}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-full font-bold transition-colors"
            >
                Retry Connection
            </button>
            <button 
                onClick={() => onEnd({ duration: '0:00', topic, transcript: [], images: [] })}
                className="mt-4 text-zinc-500 hover:text-white underline text-sm"
            >
                Return to Home
            </button>
        </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#050a07] text-white overflow-hidden relative font-sans select-none">
      
      {/* 1. TOP AI INDICATOR */}
      <div className="absolute top-0 left-0 w-full flex justify-center pt-6 z-20 pointer-events-none">
        <div className="flex flex-col items-center gap-2">
           <AtomVisualizer speaking={isAiSpeaking} />
           <div className={`px-4 py-1.5 rounded-full text-xs font-mono backdrop-blur-sm transition-all border flex items-center gap-2 ${
               isAiSpeaking 
                 ? 'bg-cyan-900/40 text-cyan-300 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]' 
                 : 'bg-zinc-900/60 text-zinc-400 border-white/10'
           }`}>
             <div className={`w-2 h-2 rounded-full ${isAiSpeaking ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-600'}`} />
             {isAiSpeaking ? 'CO-FOUNDER SPEAKING' : 'LISTENING...'}
           </div>
        </div>
      </div>

      {/* 2. TOP LEFT: TOPIC */}
      <div className="absolute top-6 left-6 max-w-sm p-4 rounded-xl border border-white/10 bg-black/20 backdrop-blur-md z-30 pointer-events-none select-text">
        <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Session Topic</h2>
        <p className="text-white font-medium leading-relaxed text-sm shadow-black drop-shadow-md">{topic}</p>
      </div>

      {/* 3. TOP RIGHT: CLOCK */}
      <div className="absolute top-6 right-6 p-4 rounded-xl border border-white/10 bg-black/20 backdrop-blur-md z-30 pointer-events-none">
         <div className="text-3xl font-mono font-light tracking-widest text-white shadow-black drop-shadow-md tabular-nums">
           {currentTime.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
         </div>
      </div>

      {/* 4. CANVAS */}
      <div 
        ref={containerRef}
        className={`absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a231e] to-[#050a07] ${activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : activeTool === 'pen' ? 'cursor-crosshair' : 'cursor-default'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* WORLD CONTAINER (Captured by html2canvas) */}
        <div 
          className="w-0 h-0 absolute top-0 left-0 will-change-transform overflow-visible"
          style={{ transform }}
        >
             {/* We wrap the content in a specific ref for capture */}
             {/* To properly capture, we might need to apply the transform to this inner div or just capture the visible area. 
                 Since html2canvas captures DOM, we wrap everything in a div that represents the "Virtual Board" 
             */}
             <div ref={worldRef} className="relative w-[3000px] h-[3000px] -translate-x-1/2 -translate-y-1/2">
                 
                 {/* The Generated Infographic (Centered at world 0,0 which is center of this huge div) */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] bg-white p-4 rounded-xl shadow-2xl pointer-events-none">
                    <div className="absolute -top-6 -left-2 bg-yellow-400 text-black px-3 py-1 font-bold text-[10px] uppercase rotate-[-2deg] shadow-sm rounded-sm">
                       Generated Context
                    </div>
                    {/* Using crossOrigin anonymous to allow html2canvas to capture if external */}
                    <img src={initialImage} alt="Context" className="w-full h-auto rounded-lg" draggable={false} crossOrigin="anonymous" />
                 </div>

                 {/* Shapes Layer */}
                 {shapes.map((shape, i) => (
                    <div 
                      key={i}
                      className="absolute w-[100px] h-[100px] border-2 shadow-lg"
                      style={{ 
                          // Adjust coordinates relative to the huge world container
                          left: `calc(50% + ${shape.x}px)`, 
                          top: `calc(50% + ${shape.y}px)`, 
                          borderColor: shape.color,
                          backgroundColor: `${shape.color}20` 
                      }}
                    />
                 ))}

                 {/* Stickies Layer */}
                 {notes.map((note, i) => (
                   <div 
                     key={i}
                     className="absolute w-40 h-40 bg-yellow-200 text-black p-4 shadow-xl rounded-sm font-handwriting rotate-1 transform origin-top-left"
                     style={{ 
                        left: `calc(50% + ${note.x}px)`, 
                        top: `calc(50% + ${note.y}px)` 
                     }}
                   >
                     <textarea 
                       className="w-full h-full bg-transparent resize-none outline-none text-sm font-medium placeholder-yellow-600/50"
                       placeholder="Add note..."
                       onClick={(e) => e.stopPropagation()}
                       defaultValue={note.text}
                     />
                   </div>
                 ))}

                 {/* Drawing SVG Overlay */}
                 <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none">
                     <g transform="translate(1500, 1500)"> {/* Offset to center of world */}
                        {paths.map((p, i) => (
                        <path key={i} d={p.d} stroke={p.color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        ))}
                        {currentPath && (
                        <path d={currentPath} stroke={activeColor} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                     </g>
                 </svg>
             </div>
        </div>
        
        {/* Zoom Indicator */}
        <div className="absolute bottom-8 right-8 bg-zinc-900/80 backdrop-blur text-zinc-400 px-3 py-1.5 rounded-full text-xs font-mono border border-white/10 select-none pointer-events-none">
          {(scale * 100).toFixed(0)}%
        </div>
      </div>

      {/* 5. FLOATING TOOLBAR */}
      <WhiteboardToolbar 
        tool={activeTool} 
        setTool={setActiveTool} 
        undo={() => setPaths(p => p.slice(0, -1))}
        activeColor={activeColor}
        setColor={setActiveColor}
        toggleColorPicker={() => setShowColorPicker(!showColorPicker)}
        showColorPicker={showColorPicker}
      />

      {/* 6. CONTROL BAR */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-4">
        
        {/* Status Text */}
        <div className="text-[10px] font-mono text-green-500/80 uppercase tracking-wider bg-black/50 px-2 py-1 rounded backdrop-blur">
             LIVE UPLINK ACTIVE • {formatTime(elapsedTime)}
        </div>

        <div className="flex items-center gap-4">
            {/* User Input Visualizer (Mic) */}
            <div className={`h-14 px-2 rounded-full flex items-center gap-2 border transition-all duration-300 ${
                isMuted 
                ? 'bg-zinc-900/90 border-zinc-800 shadow-xl' 
                : 'bg-zinc-900/80 backdrop-blur-md border-green-500/30 shadow-[0_0_30px_-5px_rgba(34,197,94,0.3)]'
            }`}>
                <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isMuted ? 'bg-zinc-800 text-zinc-500' : 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.6)]'
                    }`}
                >
                    {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                
                {/* Real-time Audio Waveform */}
                {!isMuted && (
                    <div className="flex gap-0.5 items-center h-full px-2">
                        {[1,2,3,4,5,4,3,2].map((i) => (
                            <div 
                              key={i} 
                              className="w-1 bg-green-500/80 rounded-full transition-all duration-75" 
                              style={{ 
                                  height: `${Math.max(4, Math.min(30, volumeLevel * 100 * (i%2 ===0 ? 1 : 0.5) + 4))}px`, 
                                  opacity: 0.5 + Math.min(0.5, volumeLevel * 5)
                              }} 
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* End Session */}
            <button 
                onClick={() => onEnd({
                duration: formatTime(elapsedTime),
                topic,
                transcript: transcriptRef.current,
                images: []
                })}
                className="h-14 px-6 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 border border-red-500/20 rounded-full font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-[0_0_20px_-5px_rgba(239,68,68,0.2)] hover:shadow-[0_0_30px_-5px_rgba(239,68,68,0.4)]"
            >
                <PhoneOff size={16} fill="currentColor" />
                <span>End Session</span>
            </button>
        </div>
      </div>

    </div>
  );
};

export default ArenaView;