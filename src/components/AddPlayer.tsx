import {useCallback, useState} from 'react';
import { Box, Button, FormControl, FormLabel, Input, VStack, useToast } from '@chakra-ui/react';
import { supabase } from '../lib/supabase';

export const AddPlayer = () => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleAddPlayer = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
        .from('User')
        .insert([
          { name },
        ])
        .select()


    setLoading(false);

    if (error) {
      toast({
        title: 'Error adding player',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
    else {
      toast({
        title: 'Player added',
        description: `Player ${name} added successfully!`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      setName('');
    }
  }, [name]);

  return (
    <Box maxWidth="400px" mx="auto" mt={10} p={6} borderRadius="lg" boxShadow="md" bg="white">
      <VStack spacing={4} align="stretch">
        <FormControl isRequired>
          <FormLabel>Name</FormLabel>
          <Input
            placeholder="Enter player's name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormControl>

        <Button
          colorScheme="blue"
          onClick={handleAddPlayer}
          isLoading={loading}
          isDisabled={!name}
        >
          Add Player
        </Button>
      </VStack>
    </Box>
  );
};
