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
  AlertDescription,
  VStack,
  HStack,
  Badge,
  Divider
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { getUsers, saveMatch } from "../lib/supabase";
import type { User, MatchData } from "../lib/supabase";
import { calculateImprovedEloFromMatchData } from "../lib/improvedElo";
import type { EloCalculationResult } from "../lib/improvedElo";

interface EnterScoreProps {
  onSubmit?: (formData: MatchData) => void;
}

export const EnterScore = ({ onSubmit }: EnterScoreProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [eloChanges, setEloChanges] = useState<EloCalculationResult | null>(null);
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

    // Calculate ELO changes before opening modal
    try {
      const userMap: Record<number, User> = {};
      users.forEach(user => {
        userMap[user.id] = user;
      });

      const eloResult = await calculateImprovedEloFromMatchData(formData, userMap);
      setEloChanges(eloResult);
    } catch (error) {
      console.error("Error calculating ELO changes:", error);
      setError("Failed to calculate ELO changes");
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

      // Clear ELO changes
      setEloChanges(null);

      // Call the onSubmit callback if provided
      if (onSubmit) {
        onSubmit(formData);
      }

      // Close the modal
      handleModalClose();
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

  const getPlayerElo = (id: string, position: 'defense' | 'offense'): number => {
    if (!id) return 1400;
    const player = users.find(user => user.id.toString() === id);
    if (!player) return 1400;
    return position === 'defense' ? (player.elo_defense || 1400) : (player.elo_offense || 1400);
  };

  const calculateTeamElos = () => {
    if (!formData.team1Defense || !formData.team1Offense || !formData.team2Defense || !formData.team2Offense) {
      return { team1Elo: 0, team2Elo: 0, eloDifference: 0 };
    }

    // Team 1 ELO calculation: 0.3 * stronger + 0.7 * weaker
    const t1DefElo = getPlayerElo(formData.team1Defense, 'defense');
    const t1OffElo = getPlayerElo(formData.team1Offense, 'offense');
    const team1WeakerElo = Math.min(t1DefElo, t1OffElo);
    const team1StrongerElo = Math.max(t1DefElo, t1OffElo);
    const team1Elo = team1StrongerElo * 0.3 + team1WeakerElo * 0.7;

    // Team 2 ELO calculation: 0.3 * stronger + 0.7 * weaker
    const t2DefElo = getPlayerElo(formData.team2Defense, 'defense');
    const t2OffElo = getPlayerElo(formData.team2Offense, 'offense');
    const team2WeakerElo = Math.min(t2DefElo, t2OffElo);
    const team2StrongerElo = Math.max(t2DefElo, t2OffElo);
    const team2Elo = team2StrongerElo * 0.3 + team2WeakerElo * 0.7;

    const eloDifference = Math.abs(team1Elo - team2Elo);

    return { 
      team1Elo: Math.round(team1Elo), 
      team2Elo: Math.round(team2Elo), 
      eloDifference: Math.round(eloDifference) 
    };
  };

  const handleModalClose = () => {
    setEloChanges(null);
    onClose();
  };

  return (
    <Box 
      maxWidth={{ base: "100%", md: "500px" }} 
      mx="auto" 
      mt={{ base: 5, md: 10 }} 
      p={{ base: 4, md: 6 }} 
      borderRadius="lg" 
      boxShadow="md" 
      bg="white"
    >
      <Flex align="center" mb={6}>
        <Heading as="h2" size="lg" textAlign="center" flex="1">Match result</Heading>
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
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
          <Box bg="white" borderWidth={'1px'} p={4} borderRadius="md">
            <Heading as="h3" size="md" mb={4} textAlign="center">Team White</Heading>
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
          <Box bg="blue.50" p={4} borderRadius="md" borderColor="gray.200" borderWidth="1px">
            <Heading as="h3" size="md" mb={4} textAlign="center">Team Blue</Heading>
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
          mb={{ base: 4, md: 0 }}
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
      <Modal isOpen={isOpen} onClose={handleModalClose} size="xl">
        <ModalOverlay />
        <ModalContent maxW="800px">
          <ModalHeader>Confirm Match Result</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontWeight="bold" mb={4}>Are you sure you want to save this match result?</Text>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
              <Box>
                <Text fontWeight="semibold">Team 1 (White)</Text>
                <Text>Defense: {getPlayerName(formData.team1Defense)}</Text>
                <Text>Offense: {getPlayerName(formData.team1Offense)}</Text>
                <Text fontWeight="bold" mt={2}>Score: {formData.team1Score}</Text>
              </Box>
              <Box>
                <Text fontWeight="semibold">Team 2 (Blue)</Text>
                <Text>Defense: {getPlayerName(formData.team2Defense)}</Text>
                <Text>Offense: {getPlayerName(formData.team2Offense)}</Text>
                <Text fontWeight="bold" mt={2}>Score: {formData.team2Score}</Text>
              </Box>
            </SimpleGrid>

            {/* Team ELO Information */}
            {formData.team1Defense && formData.team1Offense && formData.team2Defense && formData.team2Offense && (
              <>
                <Divider my={4} />
                <VStack spacing={3} align="stretch">
                  <Text fontWeight="bold" textAlign="center" color="purple.600">
                    Team ELO Ratings
                  </Text>
                  
                  <HStack justify="space-between" align="center">
                    <VStack spacing={1} align="start" flex={1}>
                      <Text fontSize="md" fontWeight="semibold">Team 1 (White)</Text>
                      <Text fontSize="sm" color="gray.600">
                        {getPlayerName(formData.team1Defense)} (D): {getPlayerElo(formData.team1Defense, 'defense')}
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        {getPlayerName(formData.team1Offense)} (O): {getPlayerElo(formData.team1Offense, 'offense')}
                      </Text>
                      <Text fontSize="lg" fontWeight="bold" color="purple.600">
                        Team ELO: {calculateTeamElos().team1Elo}
                      </Text>
                    </VStack>

                    <VStack spacing={2} align="center">
                      <Text fontSize="sm" color="gray.500">ELO Difference</Text>
                      <Badge 
                        colorScheme={calculateTeamElos().eloDifference > 75 ? "orange" : "green"}
                        variant="solid"
                        fontSize="lg"
                        px={3}
                        py={1}
                      >
                        {calculateTeamElos().eloDifference}
                      </Badge>
                      {calculateTeamElos().eloDifference > 75 && (
                        <Text fontSize="xs" color="orange.600" textAlign="center">
                          Protection active
                        </Text>
                      )}
                    </VStack>

                    <VStack spacing={1} align="end" flex={1}>
                      <Text fontSize="md" fontWeight="semibold">Team 2 (Blue)</Text>
                      <Text fontSize="sm" color="gray.600">
                        {getPlayerName(formData.team2Defense)} (D): {getPlayerElo(formData.team2Defense, 'defense')}
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        {getPlayerName(formData.team2Offense)} (O): {getPlayerElo(formData.team2Offense, 'offense')}
                      </Text>
                      <Text fontSize="lg" fontWeight="bold" color="purple.600">
                        Team ELO: {calculateTeamElos().team2Elo}
                      </Text>
                    </VStack>
                  </HStack>
                </VStack>
              </>
            )}

            {/* ELO Changes Display */}
            {eloChanges && (
              <>
                <Divider my={4} />
                <VStack spacing={3} align="stretch">
                  <Text fontWeight="bold" textAlign="center" color="blue.600">
                    ELO Rating Changes
                  </Text>
                  
                  <HStack justify="space-between" align="center">
                    <VStack spacing={1} align="start" flex={1}>
                      <Text fontSize="sm" fontWeight="semibold">Team 1 Players</Text>
                      <HStack>
                        <Text fontSize="sm">{getPlayerName(formData.team1Defense)} (D):</Text>
                        <Badge 
                          colorScheme={eloChanges.team1DefenseChange >= 0 ? "green" : "red"}
                          variant="solid"
                        >
                          {eloChanges.team1DefenseChange >= 0 ? '+' : ''}{eloChanges.team1DefenseChange}
                        </Badge>
                      </HStack>
                      <HStack>
                        <Text fontSize="sm">{getPlayerName(formData.team1Offense)} (O):</Text>
                        <Badge 
                          colorScheme={eloChanges.team1OffenseChange >= 0 ? "green" : "red"}
                          variant="solid"
                        >
                          {eloChanges.team1OffenseChange >= 0 ? '+' : ''}{eloChanges.team1OffenseChange}
                        </Badge>
                      </HStack>
                    </VStack>

                    <VStack spacing={1} align="end" flex={1}>
                      <Text fontSize="sm" fontWeight="semibold">Team 2 Players</Text>
                      <HStack>
                        <Text fontSize="sm">{getPlayerName(formData.team2Defense)} (D):</Text>
                        <Badge 
                          colorScheme={eloChanges.team2DefenseChange >= 0 ? "green" : "red"}
                          variant="solid"
                        >
                          {eloChanges.team2DefenseChange >= 0 ? '+' : ''}{eloChanges.team2DefenseChange}
                        </Badge>
                      </HStack>
                      <HStack>
                        <Text fontSize="sm">{getPlayerName(formData.team2Offense)} (O):</Text>
                        <Badge 
                          colorScheme={eloChanges.team2OffenseChange >= 0 ? "green" : "red"}
                          variant="solid"
                        >
                          {eloChanges.team2OffenseChange >= 0 ? '+' : ''}{eloChanges.team2OffenseChange}
                        </Badge>
                      </HStack>
                    </VStack>
                  </HStack>
                </VStack>
                <Divider my={4} />
              </>
            )}

            <Text fontSize="sm" color="gray.500">
              This will update player statistics and ELO ratings based on the result.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="red" mr={3} onClick={handleModalClose} isDisabled={saving}>
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
