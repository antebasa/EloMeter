import React, {useEffect, useState} from 'react';
import {supabase} from '../supabaseClient';
import {useAuth} from '../contexts/AuthContext';
import {Box, Button, FormControl, FormLabel, Heading, Input, Spinner, Text, useToast, VStack} from '@chakra-ui/react';

const PersonalInfo: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const [displayName, setDisplayName] = useState('');
    const [initialDisplayName, setInitialDisplayName] = useState('');
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    useEffect(() => {
        if (user) {
            // Check profiles table first, then user_metadata as fallback
            const fetchProfileDisplayName = async () => {
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('display_name')
                    .eq('id', user.id)
                    .single();

                if (profileData && profileData.display_name) {
                    setDisplayName(profileData.display_name);
                    setInitialDisplayName(profileData.display_name);
                } else if (user.user_metadata && user.user_metadata.display_name) {
                    // Fallback to user_metadata if not in profiles (e.g., older users or if profile creation failed)
                    setDisplayName(user.user_metadata.display_name);
                    setInitialDisplayName(user.user_metadata.display_name);
                    // Optionally, attempt to write this to profiles table if it's missing
                } else {
                    setDisplayName('');
                    setInitialDisplayName('');
                }
            };
            fetchProfileDisplayName();
        }
    }, [user]);

    const handleSave = async () => {
        if (!user) {
            toast({
                title: 'Error',
                description: 'You must be logged in to update your profile.',
                status: 'error',
                duration: 5000,
                isClosable: true,
                colorScheme: 'red'
            });
            return;
        }

        if (!displayName.trim()) {
            toast({
                title: 'Display Name Required',
                description: 'Display name cannot be empty.',
                status: 'error',
                duration: 5000,
                isClosable: true,
                colorScheme: 'red'
            });
            return;
        }

        setLoading(true);

        try {
            // Step 1: Upsert into profiles table (insert or update)
            // This table should have a UNIQUE constraint on display_name for true uniqueness
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({ id: user.id, display_name: displayName.trim() }, { onConflict: 'id' });

            if (profileError) {
                // Check for unique constraint violation (code 23505 for PostgreSQL)
                if (profileError.code === '23505') {
                    throw new Error('This display name is already taken. Please choose another.');
                } else {
                    throw profileError; // Re-throw other errors
                }
            }

            // Step 2: Update user_metadata as a fallback or for other parts of app that might still use it
            // Best practice is to primarily rely on the 'profiles' table for profile data.
            const {  error: userMetadataError } = await supabase.auth.updateUser({
                data: { display_name: displayName.trim() },
            });

            if (userMetadataError) {
                // If profile update succeeded but metadata failed, it's a partial success.
                // Decide on error handling: maybe log it, or inform user but consider main goal (profile update) done.
                console.warn("Error updating user_metadata:", userMetadataError);
                toast({
                    title: 'Profile updated (with warning)',
                    description: `Display name saved to profiles, but failed to update user_metadata: ${userMetadataError.message}`,
                    status: 'warning',
                    duration: 7000,
                    isClosable: true,
                });
            } else {
                toast({
                    title: 'Profile updated',
                    description: 'Your display name has been updated successfully.',
                    status: 'success',
                    duration: 5000,
                    isClosable: true,
                });
            }
            setInitialDisplayName(displayName.trim()); // Update initial state after successful save

        } catch (error: any) {
            toast({
                title: 'Error updating profile',
                description: error.message || 'An unexpected error occurred.',
                status: 'error',
                duration: 7000,
                isClosable: true,
                colorScheme: 'red'
            });
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <Box p={8} display="flex" justifyContent="center" alignItems="center" height="200px">
                <Spinner size="xl" color="white" />
                <Text ml={4} color="white">Loading user information...</Text>
            </Box>
        );
    }

    return (
        <Box p={8}>
            <VStack spacing={6} align="stretch" maxW="md" mx="auto">
                <Heading size="lg" color="white">Personal Information</Heading>
                <FormControl id="display-name">
                    <FormLabel color="white">Display Name</FormLabel>
                    <Input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter your display name"
                        color="white" // Text color for input
                        borderColor="gray.600" // Border color for input
                        _hover={{ borderColor: 'gray.500' }}
                        _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px teal.500' }}
                    />
                </FormControl>
                <Button
                    colorScheme="teal"
                    onClick={handleSave}
                    isLoading={loading}
                    isDisabled={loading || !displayName.trim() || displayName.trim() === initialDisplayName}
                >
                    Save Display Name
                </Button>
            </VStack>
        </Box>
    );
};

export default PersonalInfo;
