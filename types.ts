export enum AppView {
  HOME = 'HOME',
  ARENA = 'ARENA',
  SUMMARY = 'SUMMARY'
}

export interface GeneratedImage {
  url: string;
  timestamp: string;
  prompt: string;
}

export interface TranscriptEntry {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface SessionData {
  duration: string;
  topic: string;
  transcript: TranscriptEntry[];
  images: GeneratedImage[];
}

export interface SessionAnalysis {
  intensity: string;
  coherence: string;
  mood: string;
  takeaways: { t: string; d: string }[];
  chartData: { time: string; val: number }[];
}
