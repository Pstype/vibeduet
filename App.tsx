import React, { useState } from 'react';
import { AppView, SessionData } from './types';
import HomeView from './components/HomeView';
import ArenaView from './components/ArenaView';
import SummaryView from './components/SummaryView';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [topic, setTopic] = useState<string>('');
  const [initialInfographic, setInitialInfographic] = useState<string>('');
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  const handleStart = (selectedTopic: string, infographicUrl: string) => {
    setTopic(selectedTopic);
    setInitialInfographic(infographicUrl);
    setCurrentView(AppView.ARENA);
  };

  const handleEnd = (data: SessionData) => {
    setSessionData(data);
    setCurrentView(AppView.SUMMARY);
  };

  const handleRestart = () => {
    setTopic('');
    setInitialInfographic('');
    setSessionData(null);
    setCurrentView(AppView.HOME);
  };

  return (
    <main className="w-full h-full">
      {currentView === AppView.HOME && (
        <HomeView onStart={handleStart} />
      )}
      {currentView === AppView.ARENA && (
        <ArenaView 
          topic={topic} 
          initialImage={initialInfographic}
          onEnd={handleEnd} 
        />
      )}
      {currentView === AppView.SUMMARY && sessionData && (
        <SummaryView 
          data={sessionData}
          onRestart={handleRestart} 
        />
      )}
    </main>
  );
};

export default App;