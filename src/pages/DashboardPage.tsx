import React, {useCallback, useState} from 'react';
import {useAuth} from '../contexts/AuthContext';
import {Box} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
// Imports from old App.tsx
import {Layout} from '../components/Layout';
import {EnterScore} from '../components/EnterScore';
import {MatchOdds} from '../components/MatchOdds';
import {History} from '../components/History';
import {TeamSelection} from '../components/OptimalTeams';
import {Players} from '../components/Players';
import {AddPlayer} from '../components/AddPlayer';
import {WinPercentage} from '../components/WinPercentage';
import {PlayerComparison} from '../components/PlayerComparison';
import type {MatchData} from "../lib/supabase"; // Assuming supabase.ts exports this type

const DashboardPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // State and handlers from old App.tsx
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

    const renderContent = useCallback(() => {
        switch (activeNavItem) {
            case 'EnterScore':
                if (user?.user_metadata?.admin) {
                    return <EnterScore />;
                } else {
                    console.warn("Unauthorized access attempt to EnterScore");
                    return <Players onPlayerClick={handleNavigateToHistoryWithPlayer} />;
                }
            case 'MatchOdds':
                return <MatchOdds />;
            case 'LiveMatch':
                // Navigate to the live match page
                navigate('/app/live-match');
                return null;
            case 'History':
                return <History selectedPlayerIdProp={selectedPlayerIdForHistory} onDoneWithSelectedPlayer={clearSelectedPlayerIdForHistory} />;
            case 'OptimalTeams':
                return <TeamSelection />;
            case 'Players':
                return <Players onPlayerClick={handleNavigateToHistoryWithPlayer} />;
            case 'AddPlayer':
                if (user?.user_metadata?.admin) {
                    return <AddPlayer />;
                } else {
                    console.warn("Unauthorized access attempt to AddPlayer");
                    return <Players onPlayerClick={handleNavigateToHistoryWithPlayer} />;
                }
            case 'WinPercentage':
                return <WinPercentage />;
            case 'PlayerComparison':
                return <PlayerComparison />;
            default:
                return <Players onPlayerClick={handleNavigateToHistoryWithPlayer} />;
        }
    }, [
        user,
        activeNavItem,
        navigate,
        handleSubmit,
        selectedPlayerIdForHistory,
        clearSelectedPlayerIdForHistory,
        handleNavigateToHistoryWithPlayer,
        handleNavigateToHistoryWithPlayer
    ]);

    // The user info and sign out button could be part of the Layout component itself,
    // or passed to it, or displayed separately as shown here.
    // For simplicity, I'm keeping them separate for now but within the main Box.

    return (
        <Box>
            <Layout
                activeNavItem={activeNavItem}
                onNavItemClick={(item) => {
                    if (item !== 'History') {
                        clearSelectedPlayerIdForHistory();
                    }
                    console.log("ajmo", item)
                    setActiveNavItem(item);
                }}
            >
                {renderContent()}
            </Layout>
        </Box>
    );
};

export default DashboardPage;
