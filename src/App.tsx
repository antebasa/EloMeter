import { useState } from 'react';
import { Layout } from './components/Layout';
import { EnterScore } from './components/EnterScore';
import { MatchOdds } from './components/MatchOdds';
import { History } from './components/History';
import { OptimalTeams } from './components/OptimalTeams';
import { Players } from './components/Players';
import { AddPlayer } from './components/AddPlayer';
import { ImportMatches } from './components/ImportMatches';
import type { MatchData } from "./lib/supabase";

function App() {
  const [activeNavItem, setActiveNavItem] = useState<string>('EnterScore');
  const [selectedPlayerIdForHistory, setSelectedPlayerIdForHistory] = useState<number | null>(null);

  const handleSubmit = (data: MatchData) => {
    console.log('Form submitted with data:', data);
    // Handle form submission here, potentially with data typed as MatchData
  };

  const handleNavigateToHistoryWithPlayer = (playerId: number) => {
    setSelectedPlayerIdForHistory(playerId);
    setActiveNavItem('History');
  };

  const clearSelectedPlayerIdForHistory = () => {
    setSelectedPlayerIdForHistory(null);
  };

  const renderContent = () => {
    switch (activeNavItem) {
      case 'EnterScore':
        return <EnterScore onSubmit={handleSubmit} />;
      case 'MatchOdds':
        return <MatchOdds />;
      case 'History':
        return <History selectedPlayerIdProp={selectedPlayerIdForHistory} onDoneWithSelectedPlayer={clearSelectedPlayerIdForHistory} />;
      case 'OptimalTeams':
        return <OptimalTeams />;
      case 'Players':
        return <Players onPlayerClick={handleNavigateToHistoryWithPlayer} />;
      case 'AddPlayer':
        return <AddPlayer />;
      case 'ImportMatches':
        return <ImportMatches />;
      default:
        return <EnterScore onSubmit={handleSubmit} />;
    }
  };

  return (
    <Layout 
      activeNavItem={activeNavItem} 
      onNavItemClick={(item) => {
        if (item !== 'History') {
            clearSelectedPlayerIdForHistory();
        }
        setActiveNavItem(item);
      }}
    >
      {renderContent()}
    </Layout>
  );
}

export default App
