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
  useToast
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { getUsers, insertSampleUsers } from "../lib/supabase";
import type { User } from "../lib/supabase";

interface EnterScoreProps {
  onSubmit: (formData: FormData) => void;
}

interface FormData {
  player1: string;
  player2: string;
  player3: string;
  player4: string;
  score: string;
}

export const EnterScore = ({ onSubmit }: EnterScoreProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const [formData, setFormData] = useState<FormData>({
    player1: "",
    player2: "",
    player3: "",
    player4: "",
    score: ""
  });

  useEffect(() => {
    async function loadUsers() {
      try {
        // Try to insert sample users first (this will only insert if table is empty)
        await insertSampleUsers();
        // Then fetch all users
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Box>
      <Heading as="h2" size="lg" mb={6}>Enter Score</Heading>
      <Box as="form" onSubmit={handleSubmit} width="100%" maxWidth="600px" mx="auto" p={6} borderRadius="lg" boxShadow="md" bg="white">
        <VStack spacing={6} align="stretch">
          <SimpleGrid columns={2} spacing={4}>
            <FormControl isRequired>
              <FormLabel>Player 1</FormLabel>
              <Select
                name="player1"
                value={formData.player1}
                onChange={handleChange}
                placeholder="Select player"
                isDisabled={loading}
              >
                {users.map(user => (
                  <option key={`player1-${user.id}`} value={user.id.toString()}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </FormControl>
            
            <FormControl isRequired>
              <FormLabel>Player 2</FormLabel>
              <Select
                name="player2"
                value={formData.player2}
                onChange={handleChange}
                placeholder="Select player"
                isDisabled={loading}
              >
                {users.map(user => (
                  <option key={`player2-${user.id}`} value={user.id.toString()}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </FormControl>
          </SimpleGrid>

          <SimpleGrid columns={2} spacing={4}>
            <FormControl isRequired>
              <FormLabel>Player 3</FormLabel>
              <Select
                name="player3"
                value={formData.player3}
                onChange={handleChange}
                placeholder="Select player"
                isDisabled={loading}
              >
                {users.map(user => (
                  <option key={`player3-${user.id}`} value={user.id.toString()}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </FormControl>
            
            <FormControl isRequired>
              <FormLabel>Player 4</FormLabel>
              <Select
                name="player4"
                value={formData.player4}
                onChange={handleChange}
                placeholder="Select player"
                isDisabled={loading}
              >
                {users.map(user => (
                  <option key={`player4-${user.id}`} value={user.id.toString()}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </FormControl>
          </SimpleGrid>

          <FormControl isRequired>
            <FormLabel>Score</FormLabel>
            <Input
              name="score"
              value={formData.score}
              onChange={handleChange}
              placeholder="Enter score (e.g., 10-8)"
              type="text"
            />
          </FormControl>

          <Flex justify="flex-end">
            <Button 
              type="submit" 
              colorScheme="blue"
              isLoading={loading}
              isDisabled={loading || !formData.player1 || !formData.player2 || !formData.player3 || !formData.player4 || !formData.score}
            >
              Save Match Result
            </Button>
          </Flex>
        </VStack>
      </Box>
    </Box>
  );
}; 