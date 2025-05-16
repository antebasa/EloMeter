import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';

const DashboardPage: React.FC = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        // AuthProvider will update session, ProtectedRoute will redirect to /login
        // Or navigate('/login') explicitly if needed after signOut completes
    };

    return (
        <Box p={8}>
            <VStack spacing={4} alignItems="flex-start">
                <Heading>Welcome to the App!</Heading>
                {user && <Text>You are logged in as: {user.email}</Text>}
                <Button colorScheme="teal" onClick={handleSignOut}>
                    Sign Out
                </Button>
            </VStack>
        </Box>
    );
};

export default DashboardPage; 