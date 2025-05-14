import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Select,
  SimpleGrid,
  VStack,
  Heading,
  useToast,
  HStack,
  Text,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { getUsers, insertSampleUsers } from "../lib/supabase";
import type { User } from "../lib/supabase";

interface EnterScoreProps {
  onSubmit: (formData: FormData) => void;
}

interface FormData {
  team1Defense: string;
  team1Offense: string;
  team2Defense: string;
  team2Offense: string;
  team1Score: number;
  team2Score: number;
}

export const EnterScore = ({ onSubmit }: EnterScoreProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const [formData, setFormData] = useState<FormData>({
    team1Defense: "",
    team1Offense: "",
    team2Defense: "",
    team2Offense: "",
    team1Score: 0,
    team2Score: 0
  });

  useEffect(() => {
    async function loadUsers() {
      try {
        await insertSampleUsers();
        const fetchedUsers = await getUsers();
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Error loading users:", error);
        toast({
          title: "Error loading users",
          description: "Could not load users from database",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [toast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleScoreChange = (team: 'team1Score' | 'team2Score', value: number) => {
    setFormData(prev => ({
      ...prev,
      [team]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Box maxWidth="500px" mx="auto" mt={10} p={6} borderRadius="lg" boxShadow="md" bg="white">
      <Flex align="center" mb={6}>
        <Button variant="ghost" mr={2} leftIcon={<Text>←</Text>} />
        <Heading as="h2" size="lg" textAlign="center" flex="1">New Foosball Match</Heading>
      </Flex>
      <Box as="form" onSubmit={handleSubmit}>
        <SimpleGrid columns={2} spacing={6} mb={6}>
          <Box bg="blue.50" p={4} borderRadius="md">
            <Heading as="h3" size="md" mb={4} textAlign="center">Team 1</Heading>
            <FormControl mb={3} isRequired>
              <FormLabel>Defense Player</FormLabel>
              <Select
                name="team1Defense"
                value={formData.team1Defense}
                onChange={handleChange}
                placeholder="Select player"
                isDisabled={loading}
              >
                {users.map(user => (
                  <option key={`team1Defense-${user.id}`} value={user.id.toString()}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Offense Player</FormLabel>
              <Select
                name="team1Offense"
                value={formData.team1Offense}
                onChange={handleChange}
                placeholder="Select player"
                isDisabled={loading}
              >
                {users.map(user => (
                  <option key={`team1Offense-${user.id}`} value={user.id.toString()}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box bg="rgba(245, 240, 225, 0.5)" p={4} borderRadius="md" borderColor="gray.200" borderWidth="1px">
            <Heading as="h3" size="md" mb={4} textAlign="center">Team 2</Heading>
            <FormControl mb={3} isRequired>
              <FormLabel>Defense Player</FormLabel>
              <Select
                name="team2Defense"
                value={formData.team2Defense}
                onChange={handleChange}
                placeholder="Select player"
                isDisabled={loading}
              >
                {users.map(user => (
                  <option key={`team2Defense-${user.id}`} value={user.id.toString()}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Offense Player</FormLabel>
              <Select
                name="team2Offense"
                value={formData.team2Offense}
                onChange={handleChange}
                placeholder="Select player"
                isDisabled={loading}
              >
                {users.map(user => (
                  <option key={`team2Offense-${user.id}`} value={user.id.toString()}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </FormControl>
          </Box>
        </SimpleGrid>
        <Heading as="h3" size="md" mb={4} textAlign="center">Match Result</Heading>
        <Flex justify="center" mb={6} align="center">
          <NumberInput 
            min={0} 
            max={99} 
            value={formData.team1Score}
            onChange={(_, value) => handleScoreChange('team1Score', value)}
            width="80px"
          >
            <NumberInputField textAlign="center" fontSize="3xl" />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
          
          <Text fontSize="3xl" mx={4}>-</Text>
          
          <NumberInput 
            min={0} 
            max={99} 
            value={formData.team2Score}
            onChange={(_, value) => handleScoreChange('team2Score', value)}
            width="80px"
          >
            <NumberInputField textAlign="center" fontSize="3xl" />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </Flex>
        <Button 
          type="submit" 
          colorScheme="green"
          width="full"
          isLoading={loading}
          isDisabled={loading || !formData.team1Defense || !formData.team1Offense || !formData.team2Defense || !formData.team2Offense}
        >
          Save Result
        </Button>
      </Box>
    </Box>
  );
};
