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
  HStack,
  Alert,
  AlertIcon
} from "@chakra-ui/react";
import { getUsers } from "../lib/supabase";
import type { User } from "../lib/supabase";

// Extended player interface with skill ratings
interface PlayerWithSkills extends User {
  defenseSkill: number;
  offenseSkill: number;
}

// Generate the best team combinations for balanced gameplay
const generateBalancedTeams = (selectedPlayers: PlayerWithSkills[]) => {
  if (selectedPlayers.length !== 4) {
    return null;
  }

  // Calculate team rating using player skills
  const calculateTeamRating = (players: PlayerWithSkills[]) => {
    const team = assignRoles(players);
    return (team.defense.defenseSkill * 4 + team.offense.offenseSkill * 6) / 10;
  };

  // All possible team combinations (6 possible combinations with 4 players)
  const combinations = [
    [0, 1, 2, 3], // team 1: players 0,1; team 2: players 2,3
    [0, 2, 1, 3], // team 1: players 0,2; team 2: players 1,3
    [0, 3, 1, 2], // team 1: players 0,3; team 2: players 1,2
  ];

  let bestCombination = null;
  let smallestRatingDifference = Infinity;

  // Find the most balanced team combination
  for (const [p1, p2, p3, p4] of combinations) {
    const team1 = [selectedPlayers[p1], selectedPlayers[p2]];
    const team2 = [selectedPlayers[p3], selectedPlayers[p4]];

    const team1Rating = calculateTeamRating(team1);
    const team2Rating = calculateTeamRating(team2);
    const ratingDifference = Math.abs(team1Rating - team2Rating);

    if (ratingDifference < smallestRatingDifference) {
      smallestRatingDifference = ratingDifference;
      bestCombination = {
        team1: team1,
        team2: team2,
        team1Roles: assignRoles(team1),
        team2Roles: assignRoles(team2),
        team1Rating: team1Rating,
        team2Rating: team2Rating,
        ratingDifference: ratingDifference
      };
    }
  }

  return bestCombination;
};

// Calculate player skill metrics based on their stats
const calculatePlayerSkills = (player: User): PlayerWithSkills => {
  // Use played games to adjust skill weighting
  const gamesPlayed = player.played || 0;
  const experienceFactor = Math.min(gamesPlayed / 10, 1); // Max experience factor is 1

  // Use the actual ELO values directly
  const defenseElo = player.elo_defense || 1400;
  const offenseElo = player.elo_offense || 1400;
  
  // Scale ELO to 1-10 skill range
  // Assuming 1300-1700 as the typical ELO range, map to 1-10
  const defenseSkill = Math.max(1, Math.min(10, (defenseElo - 1300) / 400 * 9 + 1));
  const offenseSkill = Math.max(1, Math.min(10, (offenseElo - 1300) / 400 * 9 + 1));

  return {
    ...player,
    defenseSkill: Math.round(defenseSkill * 10) / 10, // Round to 1 decimal place
    offenseSkill: Math.round(offenseSkill * 10) / 10  // Round to 1 decimal place
  };
};

// Helper function to assign defense/offense roles
const assignRoles = (team: PlayerWithSkills[]) => {
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

// Calculate team strength using a combination of offense and defense ELO ratings
const calculateTeamStrength = (defenderElo: number, attackerElo: number): number => {
  // You can adjust these weights based on importance of offense vs defense
  const defenseWeight = 0.4;
  const offenseWeight = 0.6;
  
  return Math.round((defenderElo * defenseWeight) + (attackerElo * offenseWeight));
};

export const OptimalTeams = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [playersWithSkills, setPlayersWithSkills] = useState<PlayerWithSkills[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [optimalTeams, setOptimalTeams] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsers() {
      try {
        const fetchedUsers = await getUsers();
        setUsers(fetchedUsers);
        
        // Calculate skills for all users based on their stats
        const withSkills = fetchedUsers.map(calculatePlayerSkills);
        setPlayersWithSkills(withSkills);
      } catch (error) {
        console.error("Error loading users:", error);
        setError("Failed to load players. Please try again later.");
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
      const selectedPlayers = playersWithSkills.filter(
        player => selectedPlayerIds.includes(player.id.toString())
      );
      const teams = generateBalancedTeams(selectedPlayers);
      setOptimalTeams(teams);
    }
  };

  return (
    <Box maxWidth="900px" mx="auto" p={6} borderRadius="lg" boxShadow="md" bg="white">
      <Heading as="h2" size="lg" mb={6}>Optimal Teams Generator</Heading>
      
      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          <Text>{error}</Text>
        </Alert>
      )}
      
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
                {playersWithSkills.map(player => (
                  <Checkbox 
                    key={player.id} 
                    value={player.id.toString()}
                    isDisabled={selectedPlayerIds.length >= 4 && !selectedPlayerIds.includes(player.id.toString())}
                  >
                    <HStack>
                      <Text>{player.name}</Text>
                      <Badge colorScheme="green" mr={1}>O: {player.elo_offense || 1400}</Badge>
                      <Badge colorScheme="blue">D: {player.elo_defense || 1400}</Badge>
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
              
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
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
              
                <Card variant="filled" bg="orange.50">
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
                      
                      <Stat mt={2} p={2} bg="orange.100" borderRadius="md">
                        <StatLabel>Team Rating</StatLabel>
                        <StatNumber>{Math.round(optimalTeams.team2Rating)}</StatNumber>
                      </Stat>
                    </VStack>
                  </CardBody>
                </Card>
              </SimpleGrid>
              
              <Box textAlign="center" mt={6} py={4} bg="gray.50" borderRadius="md">
                <Text fontWeight="bold">Rating Difference: {optimalTeams.ratingDifference.toFixed(2)}</Text>
                <Text fontSize="sm" color="gray.600">
                  {optimalTeams.ratingDifference < 1
                    ? "These teams are very evenly matched!"
                    : optimalTeams.ratingDifference < 2
                    ? "These teams are well balanced."
                    : "This is the most balanced combination possible with these players."}
                </Text>
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}; 