
export const APP_CONFIG = {
  // Centralized Model Definitions - Easy to upgrade in the future
  GEMINI_MODELS: {
    IMAGE_GENERATION: 'gemini-2.5-flash-image',
    LIVE_INTERACTION: 'gemini-2.5-flash-native-audio-preview-09-2025',
    TEXT_ANALYSIS: 'gemini-2.5-flash',
  },
  
  // Audio & Capture Settings
  AUDIO: {
    VOICE_NAME: 'Zephyr', // Options: Puck, Charon, Kore, Fenrir, Zephyr
    SAMPLE_RATE_INPUT: 16000,
    SAMPLE_RATE_OUTPUT: 24000,
  },
  
  CAPTURE: {
    INTERVAL_MS: 3000, // Time between whiteboard snapshots sent to Gemini
    IMAGE_QUALITY: 0.6,
    SCALE: 0.5, // Reduced scale for performance
  },

  DEFAULTS: {
    FALLBACK_TOPIC: 'The Future of Human-AI Collaboration',
  }
};

// System Prompts - Kept separate from UI logic
export const SYSTEM_PROMPTS = {
  // Prompt for HomeView Infographic Generation
  INFOGRAPHIC: (topic: string) => `
    Generate a clean, high-quality, whiteboard-style infographic representing the concept of: "${topic}".
    
    Visual Style Guidelines:
    - Hand-drawn aesthetic on a clean white background.
    - Use marker colors: Black, Blue, Red, and Green.
    - Diagrammatic elements: arrows, mind-map nodes, simple icons, sticky notes.
    - Minimalist, organized, and clear.
    - No photorealism; it should look like a brilliant brainstorming session sketch.
    - Center composition.
    - The image should capture the essence of analyzing "${topic}" structurally.
  `,

  // Instruction for the Live Arena Persona
  LIVE_SESSION: (topic: string) => `
    You are a brilliant, creative product co-founder in a "VibeDuet" session. 
    You are looking at a shared digital whiteboard where the user is visualizing an idea about: "${topic}".
    
    Your Goals:
    1. Listen to the user's audio.
    2. Look at the periodic screen captures of the whiteboard to understand their visual thinking.
    3. Offer constructive feedback, ask clarifying questions, and help refine the concept.
    4. Refer to specific shapes, notes, or drawings if relevant (e.g., "That red square you drew...").
    5. Be concise, energetic, and encouraging. Keep responses relatively short (under 15 seconds speech) to maintain flow.
  `,

  // Prompt for Post-Session Analysis
  ANALYSIS_TASK: `Analyze this conversation transcript and provide a structured summary.`,
};

export const UI_CONSTANTS = {
  LOADING_MESSAGES: [
    "Analyzing semantic context...",
    "Spinning up Nano-Banana neural pathways...",
    "Synthesizing abstract visual metaphors...",
    "Calibrating audio-visual resonance...",
    "Establishing secure debate environment..."
  ]
};
