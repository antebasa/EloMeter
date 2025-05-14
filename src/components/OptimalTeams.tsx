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

// Enhanced player type with additional skills
interface PlayerWithSkills extends User {
  defenseSkill: number;
  offenseSkill: number;
}

// Function to generate balanced teams
const generateBalancedTeams = (selectedPlayers: PlayerWithSkills[]) => {
  if (selectedPlayers.length < 4) return null;

  const calculateTeamRating = (players: PlayerWithSkills[]) => {
    return players.reduce((total, player) => total + (player.elo_score || 1500), 0) / players.length;
  };

  // Try all possible combinations of 2 teams of 2 players each
  let bestCombination: {
    team1: PlayerWithSkills[];
    team2: PlayerWithSkills[];
    team1Rating: number;
    team2Rating: number;
    difference: number;
    team1Roles?: {
      defense: PlayerWithSkills;
      offense: PlayerWithSkills;
    };
    team2Roles?: {
      defense: PlayerWithSkills;
      offense: PlayerWithSkills;
    };
  } | null = null;
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

// Calculate player skill metrics based on their stats
const calculatePlayerSkills = (player: User): PlayerWithSkills => {
  // Use played games to adjust skill weighting
  const gamesPlayed = player.played || 0;
  const experienceFactor = Math.min(gamesPlayed / 10, 1); // Max experience factor is 1

  // Base values start at 5 (average)
  let defenseSkill = 5;
  let offenseSkill = 5;

  // If we have actual stats, use them to calculate skill levels
  if (player.elo_score && player.wins !== undefined && player.losses !== undefined) {
    // Defense skill - players who concede fewer goals are better at defense
    const totalGames = player.played || 0;
    const goalsScored = player.goals || 0;
    const goalsConceded = player.conceded || 0;
    
    // Avg goals conceded per game - lower is better for defense
    const avgConceded = totalGames > 0 ? goalsConceded / totalGames : 0;
    
    // Avg goals scored per game - higher is better for offense
    const avgScored = totalGames > 0 ? goalsScored / totalGames : 0;
    
    // Win ratio affects both offense and defense
    const winRatio = totalGames > 0 ? (player.wins / totalGames) : 0;
    
    // ELO rating relative to base 1500 affects both skills
    const eloModifier = player.elo_score > 1500 ? 
      (player.elo_score - 1500) / 200 : // Positive modifier
      (player.elo_score - 1500) / 300;  // Negative modifier (less impact)
    
    // Calculate defense skill (scale 1-10)
    defenseSkill = 5; // Base value
    
    // Lower conceded goals improves defense skill
    defenseSkill += totalGames > 0 ? (1 - Math.min(avgConceded / 5, 1)) * 2 : 0;
    
    // Win ratio improves skill
    defenseSkill += winRatio * 2;
    
    // ELO rating adjustment
    defenseSkill += eloModifier;
    
    // Calculate offense skill (scale 1-10)
    offenseSkill = 5; // Base value
    
    // Higher scored goals improves offense skill
    offenseSkill += Math.min(avgScored, 3) / 3 * 3;
    
    // Win ratio improves skill
    offenseSkill += winRatio * 2;
    
    // ELO rating adjustment
    offenseSkill += eloModifier;
  }
  
  // Apply experience factor - more experienced players have more reliable skill ratings
  defenseSkill = 5 + (defenseSkill - 5) * experienceFactor;
  offenseSkill = 5 + (offenseSkill - 5) * experienceFactor;
  
  // Ensure skills stay in range 1-10
  defenseSkill = Math.max(1, Math.min(10, Math.round(defenseSkill * 10) / 10));
  offenseSkill = Math.max(1, Math.min(10, Math.round(offenseSkill * 10) / 10));

  return {
    ...player,
    defenseSkill,
    offenseSkill
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
                      <Badge colorScheme="purple">{player.elo_score || 1500}</Badge>
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
                        <StatHelpText>
                          {optimalTeams.difference < 50 ? 'Very Balanced' : 
                            optimalTeams.difference < 100 ? 'Balanced' : 'Imbalanced'}
                        </StatHelpText>
                      </Stat>
                    </VStack>
                  </CardBody>
                </Card>
              </SimpleGrid>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}; 