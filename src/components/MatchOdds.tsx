import { useState, useEffect } from "react";
import { 
  Box, 
  Heading, 
  Text, 
  Select, 
  FormControl, 
  FormLabel, 
  SimpleGrid, 
  Stat, 
  StatLabel, 
  StatNumber, 
  StatHelpText,
  Progress,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Divider,
  Flex,
  HStack,
  VStack,
  Alert,
  AlertIcon,
  Spinner
} from "@chakra-ui/react";
import { getUsers } from "../lib/supabase";
import type { User } from "../lib/supabase";

// Calculate the win probability based on team ratings (ELO)
const calculateWinProbability = (team1Rating: number, team2Rating: number): number => {
  return 1 / (1 + Math.pow(10, (team2Rating - team1Rating) / 400));
};

// Calculate combined team strength using position-specific ELO
const calculateTeamStrength = (
  defenseElo: number, 
  offenseElo: number, 
  offenseWeight: number = 0.6
): number => {
  const defenseWeight = 1 - offenseWeight;
  return (offenseElo * offenseWeight) + (defenseElo * defenseWeight);
};

export const MatchOdds = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState({
    team1Defense: '',
    team1Offense: '',
    team2Defense: '',
    team2Offense: ''
  });
  const [matchPrediction, setMatchPrediction] = useState({
    team1Probability: 50,
    team2Probability: 50,
    team1Rating: 1500,
    team2Rating: 1500,
    predictedScore: { team1: 5, team2: 5 }
  });

  useEffect(() => {
    async function loadUsers() {
      try {
        const fetchedUsers = await getUsers();
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Error loading users:", error);
        setError("Could not load users from database");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  // Calculate match prediction when players are selected
  useEffect(() => {
    if (selectedPlayers.team1Defense && 
        selectedPlayers.team1Offense && 
        selectedPlayers.team2Defense && 
        selectedPlayers.team2Offense) {
      
      // Get player objects
      const team1DefensePlayer = users.find(u => u.id.toString() === selectedPlayers.team1Defense);
      const team1OffensePlayer = users.find(u => u.id.toString() === selectedPlayers.team1Offense);
      const team2DefensePlayer = users.find(u => u.id.toString() === selectedPlayers.team2Defense);
      const team2OffensePlayer = users.find(u => u.id.toString() === selectedPlayers.team2Offense);
      
      // Get ELO ratings, defaulting to 1500 if not available
      const team1DefenseElo = team1DefensePlayer?.elo_defense || 1500;
      const team1OffenseElo = team1OffensePlayer?.elo_offense || 1500;
      const team2DefenseElo = team2DefensePlayer?.elo_defense || 1500;
      const team2OffenseElo = team2OffensePlayer?.elo_offense || 1500;

      // Calculate team ratings with position-specific ELO weighting
      const team1Rating = calculateTeamStrength(team1DefenseElo, team1OffenseElo);
      const team2Rating = calculateTeamStrength(team2DefenseElo, team2OffenseElo);

      // Calculate win probability
      const team1WinProbability = calculateWinProbability(team1Rating, team2Rating);
      const team1Percentage = Math.round(team1WinProbability * 100);
      const team2Percentage = 100 - team1Percentage;

      // Predict score based on win probability
      // This is a simple model - more games predicted for the team with higher probability
      const totalGames = 10; // Assuming games go up to 10
      const spread = Math.abs(team1Percentage - team2Percentage) / 100;
      let team1Score, team2Score;

      if (team1Percentage > team2Percentage) {
        team1Score = Math.min(10, Math.round(totalGames * (0.5 + spread/2)));
        team2Score = totalGames - team1Score;
      } else {
        team2Score = Math.min(10, Math.round(totalGames * (0.5 + spread/2)));
        team1Score = totalGames - team2Score;
      }

      setMatchPrediction({
        team1Probability: team1Percentage,
        team2Probability: team2Percentage,
        team1Rating: Math.round(team1Rating),
        team2Rating: Math.round(team2Rating),
        predictedScore: { team1: team1Score, team2: team2Score }
      });
    }
  }, [selectedPlayers, users]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSelectedPlayers(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getPlayerName = (id: string): string => {
    if (!id) return "Select player";
    const player = users.find(user => user.id.toString() === id);
    return player ? player.name : "Unknown player";
  };

  const getPlayerStats = (id: string) => {
    if (!id) return null;
    const player = users.find(user => user.id.toString() === id);
    if (!player) return null;

    return {
      name: player.name,
      offenseElo: player.elo_offense || 1500,
      defenseElo: player.elo_defense || 1500,
      wins: player.wins || 0,
      losses: player.losses || 0,
      played: player.played || 0,
      winRate: player.played ? Math.round((player.wins || 0) / player.played * 100) : 0
    };
  };

  return (
    <Box maxWidth="900px" mx="auto" p={6} borderRadius="lg" boxShadow="md" bg="white">
      <Heading as="h2" size="lg" mb={6}>Match Odds Prediction</Heading>
      
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
          <Box mb={8}>
            <Heading as="h3" size="md" mb={4}>Team Selection</Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <Box bg="blue.50" p={4} borderRadius="md">
                <Heading as="h4" size="sm" mb={4} textAlign="center">Team 1</Heading>
                <FormControl mb={3}>
                  <FormLabel>Defense Player</FormLabel>
                  <Select
                    name="team1Defense"
                    value={selectedPlayers.team1Defense}
                    onChange={handleChange}
                    placeholder="Select player"
                    isDisabled={loading}
                  >
                    {users.map(user => (
                      <option key={`team1Defense-${user.id}`} value={user.id.toString()}>
                        {user.name} (DEF: {user.elo_defense || 1500})
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Offense Player</FormLabel>
                  <Select
                    name="team1Offense"
                    value={selectedPlayers.team1Offense}
                    onChange={handleChange}
                    placeholder="Select player"
                    isDisabled={loading}
                  >
                    {users.map(user => (
                      <option key={`team1Offense-${user.id}`} value={user.id.toString()}>
                        {user.name} (OFF: {user.elo_offense || 1500})
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              
              <Box bg="rgba(245, 240, 225, 0.5)" p={4} borderRadius="md" borderColor="gray.200" borderWidth="1px">
                <Heading as="h4" size="sm" mb={4} textAlign="center">Team 2</Heading>
                <FormControl mb={3}>
                  <FormLabel>Defense Player</FormLabel>
                  <Select
                    name="team2Defense"
                    value={selectedPlayers.team2Defense}
                    onChange={handleChange}
                    placeholder="Select player"
                    isDisabled={loading}
                  >
                    {users.map(user => (
                      <option key={`team2Defense-${user.id}`} value={user.id.toString()}>
                        {user.name} (DEF: {user.elo_defense || 1500})
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Offense Player</FormLabel>
                  <Select
                    name="team2Offense"
                    value={selectedPlayers.team2Offense}
                    onChange={handleChange}
                    placeholder="Select player"
                    isDisabled={loading}
                  >
                    {users.map(user => (
                      <option key={`team2Offense-${user.id}`} value={user.id.toString()}>
                        {user.name} (OFF: {user.elo_offense || 1500})
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </SimpleGrid>
          </Box>
          
          {selectedPlayers.team1Defense && 
           selectedPlayers.team1Offense && 
           selectedPlayers.team2Defense && 
           selectedPlayers.team2Offense && (
            <>
              <Divider my={6} />
              <Box mb={8}>
                <Heading as="h3" size="md" mb={4}>Win Probability</Heading>
                <Flex direction={{ base: "column", md: "row" }} gap={4}>
                  <Stat flex="1" border="1px" borderColor="blue.100" p={3} borderRadius="md" bg="blue.50">
                    <StatLabel>Team 1</StatLabel>
                    <StatNumber>{matchPrediction.team1Probability}%</StatNumber>
                    <StatHelpText>
                      {getPlayerName(selectedPlayers.team1Defense)} & {getPlayerName(selectedPlayers.team1Offense)}
                    </StatHelpText>
                  </Stat>
                  <Stat flex="1" border="1px" borderColor="gray.200" p={3} borderRadius="md" bg="rgba(245, 240, 225, 0.5)">
                    <StatLabel>Team 2</StatLabel>
                    <StatNumber>{matchPrediction.team2Probability}%</StatNumber>
                    <StatHelpText>
                      {getPlayerName(selectedPlayers.team2Defense)} & {getPlayerName(selectedPlayers.team2Offense)}
                    </StatHelpText>
                  </Stat>
                </Flex>
              </Box>
              
              <Box mb={8}>
                <Heading as="h3" size="md" mb={4}>Predicted Score</Heading>
                <Flex 
                  p={4} 
                  borderRadius="lg" 
                  bg="gray.50" 
                  justify="center"
                  align="center"
                  fontSize="2xl"
                  fontWeight="bold"
                >
                  <Text color="blue.500">{matchPrediction.predictedScore.team1}</Text>
                  <Text mx={4}>-</Text>
                  <Text color="orange.500">{matchPrediction.predictedScore.team2}</Text>
                </Flex>
              </Box>
              
              <Box>
                <Heading as="h3" size="md" mb={4}>Team Comparison</Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                  <Box>
                    <Text fontWeight="bold" mb={2}>Team 1 (Average ELO: {matchPrediction.team1Rating})</Text>
                    <Table variant="simple" size="sm" mt={4}>
                      <Thead>
                        <Tr>
                          <Th>Player</Th>
                          <Th isNumeric>Rating</Th>
                          <Th isNumeric>Role</Th>
                          <Th isNumeric>Games</Th>
                          <Th isNumeric>Win %</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        <Tr>
                          <Td>{getPlayerName(selectedPlayers.team1Defense)}</Td>
                          <Td isNumeric>{getPlayerStats(selectedPlayers.team1Defense)?.defenseElo}</Td>
                          <Td isNumeric>Defense</Td>
                          <Td isNumeric>{getPlayerStats(selectedPlayers.team1Defense)?.played}</Td>
                          <Td isNumeric>{getPlayerStats(selectedPlayers.team1Defense)?.winRate}%</Td>
                        </Tr>
                        <Tr>
                          <Td>{getPlayerName(selectedPlayers.team1Offense)}</Td>
                          <Td isNumeric>{getPlayerStats(selectedPlayers.team1Offense)?.offenseElo}</Td>
                          <Td isNumeric>Offense</Td>
                          <Td isNumeric>{getPlayerStats(selectedPlayers.team1Offense)?.played}</Td>
                          <Td isNumeric>{getPlayerStats(selectedPlayers.team1Offense)?.winRate}%</Td>
                        </Tr>
                      </Tbody>
                    </Table>
                  </Box>
                  
                  <Box>
                    <Text fontWeight="bold" mb={2}>Team 2 (Average ELO: {matchPrediction.team2Rating})</Text>
                    <Table variant="simple" size="sm" mt={4}>
                      <Thead>
                        <Tr>
                          <Th>Player</Th>
                          <Th isNumeric>Rating</Th>
                          <Th isNumeric>Role</Th>
                          <Th isNumeric>Games</Th>
                          <Th isNumeric>Win %</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        <Tr>
                          <Td>{getPlayerName(selectedPlayers.team2Defense)}</Td>
                          <Td isNumeric>{getPlayerStats(selectedPlayers.team2Defense)?.defenseElo}</Td>
                          <Td isNumeric>Defense</Td>
                          <Td isNumeric>{getPlayerStats(selectedPlayers.team2Defense)?.played}</Td>
                          <Td isNumeric>{getPlayerStats(selectedPlayers.team2Defense)?.winRate}%</Td>
                        </Tr>
                        <Tr>
                          <Td>{getPlayerName(selectedPlayers.team2Offense)}</Td>
                          <Td isNumeric>{getPlayerStats(selectedPlayers.team2Offense)?.offenseElo}</Td>
                          <Td isNumeric>Offense</Td>
                          <Td isNumeric>{getPlayerStats(selectedPlayers.team2Offense)?.played}</Td>
                          <Td isNumeric>{getPlayerStats(selectedPlayers.team2Offense)?.winRate}%</Td>
                        </Tr>
                      </Tbody>
                    </Table>
                  </Box>
                </SimpleGrid>
              </Box>
            </>
          )}
        </>
      )}
    </Box>
  );
}; 