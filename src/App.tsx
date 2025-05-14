import { useState } from 'react';
import { Layout } from './components/Layout';
import { EnterScore } from './components/EnterScore';
import { MatchOdds } from './components/MatchOdds';
import { History } from './components/History';
import { OptimalTeams } from './components/OptimalTeams';
import { Players } from './components/Players';
import { AddPlayer } from './components/AddPlayer';

interface FormData {
  player1: string;
  player2: string;
  player3: string;
  player4: string;
  score: string;
}

function App() {
  const [activeNavItem, setActiveNavItem] = useState<string>('EnterScore');

  const handleSubmit = (data: FormData) => {
    console.log('Form submitted with data:', data);
    // Handle form submission here
  };

  const renderContent = () => {
    switch (activeNavItem) {
      case 'EnterScore':
        return <EnterScore onSubmit={handleSubmit} />;
      case 'MatchOdds':
        return <MatchOdds />;
      case 'History':
        return <History />;
      case 'OptimalTeams':
        return <OptimalTeams />;
      case 'Players':
        return <Players />;
      case 'AddPlayer':
        return <AddPlayer />;
      default:
        return <EnterScore onSubmit={handleSubmit} />;
    }
  };

  return (
    <Layout 
      activeNavItem={activeNavItem} 
      onNavItemClick={setActiveNavItem}
    >
      {renderContent()}
    </Layout>
  );
}

export default App
