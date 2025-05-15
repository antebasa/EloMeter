import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Select,
  SimpleGrid,
  Heading,
  useToast,
  Text,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Alert,
  AlertIcon,
  AlertDescription
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { getUsers, saveMatch } from "../lib/supabase";
import type { User, MatchData } from "../lib/supabase";

interface EnterScoreProps {
  onSubmit?: (formData: MatchData) => void;
}

export const EnterScore = ({ onSubmit }: EnterScoreProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [formData, setFormData] = useState<MatchData>({
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset previous states
    setError(null);
    setSuccess(false);

    // Validate player selection
    const playerIds = [
      formData.team1Defense,
      formData.team1Offense,
      formData.team2Defense,
      formData.team2Offense
    ];

    // Check if all players are selected
    if (playerIds.some(id => !id)) {
      setError("Please select all players");
      return;
    }

    // Check for duplicate players
    const uniquePlayerIds = new Set(playerIds);
    if (uniquePlayerIds.size !== 4) {
      setError("Players cannot play multiple positions");
      return;
    }

    // Open confirmation modal
    onOpen();
  };

  const confirmAndSaveMatch = async () => {
    try {
      setSaving(true);

      // Call the saveMatch function from supabase.ts
      const result = await saveMatch(formData);

      console.log(result)
      if (!result.success) {
        throw new Error(result.error || "Failed to save match");
      }

      // Show success message
      setSuccess(true);
      toast({
        title: "Match saved",
        description: "Match result has been saved successfully",
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      // Reset form
      setFormData({
        team1Defense: "",
        team1Offense: "",
        team2Defense: "",
        team2Offense: "",
        team1Score: 0,
        team2Score: 0
      });

      // Call the onSubmit callback if provided
      if (onSubmit) {
        onSubmit(formData);
      }

      // Close the modal
      onClose();
    } catch (error) {
      console.error("Error saving match:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred");
      toast({
        title: "Error saving match",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const getPlayerName = (id: string): string => {
    if (!id) return "";
    const player = users.find(user => user.id.toString() === id);
    return player ? player.name : "";
  };

  return (
    <Box maxWidth="500px" mx="auto" mt={10} p={6} borderRadius="lg" boxShadow="md" bg="white">
      <Flex align="center" mb={6}>
        <Heading as="h2" size="lg" textAlign="center" flex="1">New Foosball Match</Heading>
      </Flex>

      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert status="success" mb={4} borderRadius="md">
          <AlertIcon />
          <AlertDescription>Match saved successfully!</AlertDescription>
        </Alert>
      )}

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
                isDisabled={loading || saving}
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
                isDisabled={loading || saving}
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
                isDisabled={loading || saving}
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
                isDisabled={loading || saving}
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
            max={10}
            value={formData.team1Score}
            onChange={(_, value) => handleScoreChange('team1Score', value)}
            width="80px"
            isDisabled={saving}
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
            max={10}
            value={formData.team2Score}
            onChange={(_, value) => handleScoreChange('team2Score', value)}
            width="80px"
            isDisabled={saving}
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
          isLoading={loading || saving}
          isDisabled={loading || saving ||
                     !formData.team1Defense ||
                     !formData.team1Offense ||
                     !formData.team2Defense ||
                     !formData.team2Offense ||
                     (formData.team1Score === 0 && formData.team2Score === 0)}
        >
          Save Result
        </Button>
      </Box>

      {/* Confirmation Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Confirm Match Result</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontWeight="bold" mb={4}>Are you sure you want to save this match result?</Text>

            <SimpleGrid columns={2} spacing={4} mb={4}>
              <Box>
                <Text fontWeight="semibold">Team 1</Text>
                <Text>Defense: {getPlayerName(formData.team1Defense)}</Text>
                <Text>Offense: {getPlayerName(formData.team1Offense)}</Text>
                <Text fontWeight="bold" mt={2}>Score: {formData.team1Score}</Text>
              </Box>
              <Box>
                <Text fontWeight="semibold">Team 2</Text>
                <Text>Defense: {getPlayerName(formData.team2Defense)}</Text>
                <Text>Offense: {getPlayerName(formData.team2Offense)}</Text>
                <Text fontWeight="bold" mt={2}>Score: {formData.team2Score}</Text>
              </Box>
            </SimpleGrid>

            <Text fontSize="sm" color="gray.500">
              This will update player statistics and ELO ratings based on the result.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="red" mr={3} onClick={onClose} isDisabled={saving}>
              Cancel
            </Button>
            <Button colorScheme="green" onClick={confirmAndSaveMatch} isLoading={saving}>
              Confirm & Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};
