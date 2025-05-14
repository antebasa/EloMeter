import {useCallback, useState} from 'react';
import { Box, Button, FormControl, FormLabel, Input, VStack, useToast, Heading, Text, FormErrorMessage, InputGroup, InputLeftElement, Icon, Flex, Alert, AlertIcon } from '@chakra-ui/react';
import { supabase } from '../lib/supabase';

export const AddPlayer = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const isNameInvalid = name.trim().length < 2;
  const isEmailInvalid = email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const resetForm = () => {
    setName('');
    setEmail('');
    setError(null);
  };

  const handleAddPlayer = useCallback(async () => {
    if (isNameInvalid) {
      setError('Name must be at least 2 characters long');
      return;
    }

    if (isEmailInvalid) {
      setError('Please enter a valid email address or leave it empty');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Prepare the player data
      const playerData: any = { 
        name,
        elo_score: 1500, // Default ELO score
        played: 0,
        wins: 0,
        losses: 0,
        goals: 0,
        conceded: 0
      };

      // Add email if provided
      if (email.trim() !== '') {
        playerData.email = email;
      }

      const { data, error: supabaseError } = await supabase
        .from('User')
        .insert([playerData])
        .select();

      if (supabaseError) {
        throw supabaseError;
      }

      // Show success message
      setSuccess(true);
      toast({
        title: 'Player added',
        description: `Player ${name} added successfully!`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Reset form
      resetForm();
    } catch (err: any) {
      console.error('Error adding player:', err);
      setError(err.message || 'Failed to add player');
      toast({
        title: 'Error adding player',
        description: err.message || 'Failed to add player',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [name, email, isNameInvalid, isEmailInvalid, toast]);

  return (
    <Box maxWidth="500px" mx="auto" mt={10} p={6} borderRadius="lg" boxShadow="md" bg="white">
      <Heading as="h2" size="lg" mb={6}>Add New Player</Heading>
      
      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          <Text>{error}</Text>
        </Alert>
      )}
      
      {success && (
        <Alert status="success" mb={4} borderRadius="md">
          <AlertIcon />
          <Text>Player added successfully!</Text>
        </Alert>
      )}
      
      <VStack spacing={4} align="stretch">
        <FormControl isRequired isInvalid={name.trim() !== '' && isNameInvalid}>
          <FormLabel>Player Name</FormLabel>
          <InputGroup>
            <InputLeftElement pointerEvents="none">
              👤
            </InputLeftElement>
            <Input
              placeholder="Enter player's name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </InputGroup>
          <FormErrorMessage>Name must be at least 2 characters.</FormErrorMessage>
        </FormControl>
        
        <FormControl isInvalid={email.trim() !== '' && isEmailInvalid}>
          <FormLabel>Email (optional)</FormLabel>
          <InputGroup>
            <InputLeftElement pointerEvents="none">
              ✉️
            </InputLeftElement>
            <Input
              placeholder="Enter player's email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
          </InputGroup>
          <FormErrorMessage>Please enter a valid email address.</FormErrorMessage>
        </FormControl>
        
        <Flex justify="space-between" mt={2}>
          <Button
            variant="outline"
            onClick={resetForm}
            isDisabled={loading || (!name && !email)}
          >
            Reset
          </Button>
          
          <Button
            colorScheme="blue"
            onClick={handleAddPlayer}
            isLoading={loading}
            isDisabled={loading || !name || (name.trim() !== '' && isNameInvalid) || isEmailInvalid}
          >
            Add Player
          </Button>
        </Flex>
      </VStack>
      
      <Text fontSize="sm" color="gray.500" mt={4}>
        New players start with a default ELO rating of 1500. Their rating will change as they play matches.
      </Text>
    </Box>
  );
};
