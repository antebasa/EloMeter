import { useState, useEffect } from "react";
import { 
  Box, 
  Heading, 
  Text, 
  Button, 
  SimpleGrid, 
  Checkbox, 
  CheckboxGroup, 
  VStack, 
  Card, 
  CardHeader, 
  CardBody, 
  Stat, 
  StatLabel, 
  StatNumber, 
  StatHelpText,
  Flex,
  Spinner,
  Divider,
  Badge,
  HStack
} from "@chakra-ui/react";
import { getUsers } from "../lib/supabase";
import type { User } from "../lib/supabase";

// Mock player ratings with skills 
interface PlayerWithRating extends User {
  rating: number;
  defenseSkill: number;
  offenseSkill: number;
}

// Generate mock player ratings
const generatePlayerRatings = (users: User[]): PlayerWithRating[] => {
  return users.map(user => ({
    ...user,
    rating: Math.round(1400 + Math.random() * 200), // Random rating between 1400-1600
    defenseSkill: Math.round(1 + Math.random() * 9), // Random skill 1-10
    offenseSkill: Math.round(1 + Math.random() * 9) // Random skill 1-10
  }));
};

// Function to generate balanced teams
const generateBalancedTeams = (selectedPlayers: PlayerWithRating[]) => {
  if (selectedPlayers.length < 4) return null;

  const calculateTeamRating = (players: PlayerWithRating[]) => {
    return players.reduce((total, player) => total + player.rating, 0) / players.length;
  };

  // Try all possible combinations of 2 teams of 2 players each
  let bestCombination = null;
  let smallestDifference = Infinity;

  // We know we have 4 players, find the most balanced teams
  for (let i = 0; i < selectedPlayers.length - 1; i++) {
    for (let j = i + 1; j < selectedPlayers.length; j++) {
      // Create two teams
      const team1 = [selectedPlayers[i], selectedPlayers[j]];
      const team2 = selectedPlayers.filter((_, index) => index !== i && index !== j);

      // Calculate team ratings
      const team1Rating = calculateTeamRating(team1);
      const team2Rating = calculateTeamRating(team2);

      // Calculate the difference in ratings
      const difference = Math.abs(team1Rating - team2Rating);

      // Update best combination if this one is more balanced
      if (difference < smallestDifference) {
        smallestDifference = difference;
        bestCombination = {
          team1,
          team2,
          team1Rating,
          team2Rating,
          difference
        };
      }
    }
  }

  // Optimize roles based on offense/defense skills
  if (bestCombination) {
    // For each team, assign the player with higher defense skill to defense
    bestCombination.team1Roles = assignRoles(bestCombination.team1);
    bestCombination.team2Roles = assignRoles(bestCombination.team2);
  }

  return bestCombination;
};

// Helper function to assign defense/offense roles
const assignRoles = (team: PlayerWithRating[]) => {
  // If player 1 has better defense skill relative to their offense skill
  // compared to player 2, make player 1 defense
  const player1DefenseAdvantage = team[0].defenseSkill - team[0].offenseSkill;
  const player2DefenseAdvantage = team[1].defenseSkill - team[1].offenseSkill;

  if (player1DefenseAdvantage >= player2DefenseAdvantage) {
    return {
      defense: team[0],
      offense: team[1]
    };
  } else {
    return {
      defense: team[1],
      offense: team[0]
    };
  }
};

export const OptimalTeams = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [playersWithRatings, setPlayersWithRatings] = useState<PlayerWithRating[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [optimalTeams, setOptimalTeams] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      try {
        const fetchedUsers = await getUsers();
        setUsers(fetchedUsers);
        // Generate mock ratings for all users
        const withRatings = generatePlayerRatings(fetchedUsers);
        setPlayersWithRatings(withRatings);
      } catch (error) {
        console.error("Error loading users:", error);
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  const handlePlayerSelection = (values: string[]) => {
    // Limit selection to 4 players
    if (values.length <= 4) {
      setSelectedPlayerIds(values);
    }
  };

  const generateTeams = () => {
    // Only generate teams if exactly 4 players are selected
    if (selectedPlayerIds.length === 4) {
      const selectedPlayers = playersWithRatings.filter(
        player => selectedPlayerIds.includes(player.id.toString())
      );
      const teams = generateBalancedTeams(selectedPlayers);
      setOptimalTeams(teams);
    }
  };

  return (
    <Box maxWidth="900px" mx="auto" p={6} borderRadius="lg" boxShadow="md" bg="white">
      <Heading as="h2" size="lg" mb={6}>Optimal Teams Generator</Heading>
      
      {loading ? (
        <Flex justify="center" py={8}>
          <Spinner size="xl" />
        </Flex>
      ) : (
        <>
          <Box mb={6}>
            <Heading as="h3" size="md" mb={4}>Select 4 Players</Heading>
            <CheckboxGroup 
              colorScheme="blue" 
              value={selectedPlayerIds}
              onChange={handlePlayerSelection}
            >
              <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={3}>
                {playersWithRatings.map(player => (
                  <Checkbox 
                    key={player.id} 
                    value={player.id.toString()}
                    isDisabled={selectedPlayerIds.length >= 4 && !selectedPlayerIds.includes(player.id.toString())}
                  >
                    <HStack>
                      <Text>{player.name}</Text>
                      <Badge colorScheme="purple">{player.rating}</Badge>
                    </HStack>
                  </Checkbox>
                ))}
              </SimpleGrid>
            </CheckboxGroup>
          </Box>
          
          <Button 
            colorScheme="blue" 
            size="lg" 
            mb={8} 
            onClick={generateTeams}
            isDisabled={selectedPlayerIds.length !== 4}
          >
            Generate Optimal Teams
          </Button>
          
          {optimalTeams && (
            <Box>
              <Divider mb={6} />
              <Heading as="h3" size="md" mb={6} textAlign="center">Optimal Teams</Heading>
              
              <SimpleGrid columns={2} spacing={6}>
                <Card variant="filled" bg="blue.50">
                  <CardHeader pb={0}>
                    <Heading size="md" textAlign="center">Team 1</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <Box p={3} bg="white" borderRadius="md">
                        <Text fontWeight="bold">Defense</Text>
                        <Flex justify="space-between" align="center">
                          <Text>{optimalTeams.team1Roles.defense.name}</Text>
                          <HStack>
                            <Badge colorScheme="blue">D: {optimalTeams.team1Roles.defense.defenseSkill}</Badge>
                            <Badge colorScheme="green">O: {optimalTeams.team1Roles.defense.offenseSkill}</Badge>
                          </HStack>
                        </Flex>
                      </Box>
                      
                      <Box p={3} bg="white" borderRadius="md">
                        <Text fontWeight="bold">Offense</Text>
                        <Flex justify="space-between" align="center">
                          <Text>{optimalTeams.team1Roles.offense.name}</Text>
                          <HStack>
                            <Badge colorScheme="blue">D: {optimalTeams.team1Roles.offense.defenseSkill}</Badge>
                            <Badge colorScheme="green">O: {optimalTeams.team1Roles.offense.offenseSkill}</Badge>
                          </HStack>
                        </Flex>
                      </Box>
                      
                      <Stat mt={2} p={2} bg="blue.100" borderRadius="md">
                        <StatLabel>Team Rating</StatLabel>
                        <StatNumber>{Math.round(optimalTeams.team1Rating)}</StatNumber>
                      </Stat>
                    </VStack>
                  </CardBody>
                </Card>
                
                <Card variant="filled" bg="rgba(245, 240, 225, 0.5)" borderColor="gray.200" borderWidth="1px">
                  <CardHeader pb={0}>
                    <Heading size="md" textAlign="center">Team 2</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <Box p={3} bg="white" borderRadius="md">
                        <Text fontWeight="bold">Defense</Text>
                        <Flex justify="space-between" align="center">
                          <Text>{optimalTeams.team2Roles.defense.name}</Text>
                          <HStack>
                            <Badge colorScheme="blue">D: {optimalTeams.team2Roles.defense.defenseSkill}</Badge>
                            <Badge colorScheme="green">O: {optimalTeams.team2Roles.defense.offenseSkill}</Badge>
                          </HStack>
                        </Flex>
                      </Box>
                      
                      <Box p={3} bg="white" borderRadius="md">
                        <Text fontWeight="bold">Offense</Text>
                        <Flex justify="space-between" align="center">
                          <Text>{optimalTeams.team2Roles.offense.name}</Text>
                          <HStack>
                            <Badge colorScheme="blue">D: {optimalTeams.team2Roles.offense.defenseSkill}</Badge>
                            <Badge colorScheme="green">O: {optimalTeams.team2Roles.offense.offenseSkill}</Badge>
                          </HStack>
                        </Flex>
                      </Box>
                      
                      <Stat mt={2} p={2} bg="blue.100" borderRadius="md">
                        <StatLabel>Team Rating</StatLabel>
                        <StatNumber>{Math.round(optimalTeams.team2Rating)}</StatNumber>
                      </Stat>
                    </VStack>
                  </CardBody>
                </Card>
              </SimpleGrid>
              
              <Box textAlign="center" mt={6}>
                <Text>
                  Rating Difference: <Badge fontSize="md" colorScheme="purple">{Math.round(optimalTeams.difference)}</Badge>
                </Text>
                <Text fontSize="sm" color="gray.600" mt={2}>
                  These teams are optimized for balanced ratings and optimal player positions.
                </Text>
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}; 