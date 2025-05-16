import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
// import { useNavigate } from 'react-router-dom'; // Keep if direct navigation is still needed

// Imports from old App.tsx
import { Layout } from '../components/Layout';
import { EnterScore } from '../components/EnterScore';
import { MatchOdds } from '../components/MatchOdds';
import { History } from '../components/History';
import { OptimalTeams } from '../components/OptimalTeams';
import { Players } from '../components/Players';
import { AddPlayer } from '../components/AddPlayer';
import type { MatchData } from "../lib/supabase"; // Assuming supabase.ts exports this type

const DashboardPage: React.FC = () => {
    const { user, signOut } = useAuth();
    // const navigate = useNavigate(); // Keep if needed

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
            // case 'ImportMatches':
            //   return <ImportMatches />;
            default:
                return <EnterScore onSubmit={handleSubmit} />;
        }
    };

    const handleSignOut = async () => {
        await signOut();
        // AuthProvider will update session, ProtectedRoute will redirect to /login
    };

    // The user info and sign out button could be part of the Layout component itself,
    // or passed to it, or displayed separately as shown here.
    // For simplicity, I'm keeping them separate for now but within the main Box.

    return (
        <Box>
            <VStack alignItems="flex-start" p={4} bg="gray.100" w="full">
                {user && <Text>Logged in as: {user.email}</Text>}
                <Button colorScheme="teal" size="sm" onClick={handleSignOut}>
                    Sign Out
                </Button>
            </VStack>
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
        </Box>
    );
};

export default DashboardPage;
