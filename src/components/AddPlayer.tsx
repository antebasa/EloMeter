import {useCallback, useState} from 'react';
import { Box, Button, FormControl, FormLabel, Input, VStack, useToast, Heading, Text, FormErrorMessage, InputGroup, InputLeftElement, Icon, Flex, Alert, AlertIcon, AlertDescription, NumberInput, NumberInputField, NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper } from '@chakra-ui/react';
import { supabase } from '../lib/supabase';

export const AddPlayer = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: ""
  });
  const [nameError, setNameError] = useState("");
  const toast = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear name error when typing
    if (name === "name" && nameError) {
      setNameError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate name
    if (!formData.name.trim()) {
      setNameError("Name is required");
      return;
    }

    try {
      setLoading(true);

      // Insert new player into the database
      const { data, error: insertError } = await supabase
        .from("User")
        .insert({
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          elo_offense: 1400, // Default offense ELO score
          elo_defense: 1400, // Default defense ELO score
          played: 0,
          wins: 0,
          losses: 0,
          goals: 0,
          conceded: 0
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Show success message
      setSuccess(true);
      toast({
        title: "Player added",
        description: `${formData.name} has been added successfully`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      // Reset form
      setFormData({
        name: "",
        email: ""
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      console.error("Error adding player:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
        <FormControl isRequired isInvalid={nameError !== ""}>
          <FormLabel>Player Name</FormLabel>
          <InputGroup>
            <InputLeftElement pointerEvents="none">
              👤
            </InputLeftElement>
            <Input
              placeholder="Enter player's name"
              name="name"
              value={formData.name}
              onChange={handleChange}
            />
          </InputGroup>
          <FormErrorMessage>{nameError}</FormErrorMessage>
        </FormControl>
        
        <FormControl isInvalid={formData.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)}>
          <FormLabel>Email (optional)</FormLabel>
          <InputGroup>
            <InputLeftElement pointerEvents="none">
              ✉️
            </InputLeftElement>
            <Input
              placeholder="Enter player's email (optional)"
              name="email"
              value={formData.email}
              onChange={handleChange}
              type="email"
            />
          </InputGroup>
          <FormErrorMessage>Please enter a valid email address.</FormErrorMessage>
        </FormControl>
        
        <Flex justify="space-between" mt={2}>
          <Button
            variant="outline"
            onClick={() => setFormData({ name: "", email: "" })}
            isDisabled={loading || (!formData.name && !formData.email)}
          >
            Reset
          </Button>
          
          <Button
            colorScheme="blue"
            onClick={handleSubmit}
            isLoading={loading}
            isDisabled={loading || !formData.name || (formData.email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))}
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
