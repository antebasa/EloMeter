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
  VStack
} from "@chakra-ui/react";
import { getUsers } from "../lib/supabase";
import type { User } from "../lib/supabase";

// Mock player ratings with string keys
const PLAYER_RATINGS: Record<string, { rating: number, games: number }> = {
  "1": { rating: 1450, games: 45 },
  "2": { rating: 1485, games: 37 },
  "3": { rating: 1418, games: 28 },
  "4": { rating: 1372, games: 31 },
  "5": { rating: 1520, games: 40 },
  "6": { rating: 1395, games: 25 },
  "7": { rating: 1442, games: 33 },
  "8": { rating: 1408, games: 30 },
  "9": { rating: 1465, games: 42 },
  "10": { rating: 1405, games: 29 }
};

// Calculate win probability using ELO formula
const calculateWinProbability = (team1Rating: number, team2Rating: number): number => {
  return 1 / (1 + Math.pow(10, (team2Rating - team1Rating) / 400));
};

export const MatchOdds = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayers, setSelectedPlayers] = useState({
    team1Defense: "",
    team1Offense: "",
    team2Defense: "",
    team2Offense: ""
  });

  const [matchPrediction, setMatchPrediction] = useState({
    team1Probability: 50,
    team2Probability: 50,
    team1Rating: 0,
    team2Rating: 0,
    predictedScore: { team1: 0, team2: 0 }
  });

  useEffect(() => {
    async function loadUsers() {
      try {
        const fetchedUsers = await getUsers();
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Error loading users:", error);
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  useEffect(() => {
    // Calculate match odds when player selection changes
    if (
      selectedPlayers.team1Defense && 
      selectedPlayers.team1Offense && 
      selectedPlayers.team2Defense && 
      selectedPlayers.team2Offense
    ) {
      const team1DefenseId = selectedPlayers.team1Defense;
      const team1OffenseId = selectedPlayers.team1Offense;
      const team2DefenseId = selectedPlayers.team2Defense;
      const team2OffenseId = selectedPlayers.team2Offense;

      // Get ratings from mock data
      const team1DefenseRating = PLAYER_RATINGS[team1DefenseId]?.rating || 1400;
      const team1OffenseRating = PLAYER_RATINGS[team1OffenseId]?.rating || 1400;
      const team2DefenseRating = PLAYER_RATINGS[team2DefenseId]?.rating || 1400;
      const team2OffenseRating = PLAYER_RATINGS[team2OffenseId]?.rating || 1400;

      // Calculate team ratings (average)
      const team1Rating = (team1DefenseRating + team1OffenseRating) / 2;
      const team2Rating = (team2DefenseRating + team2OffenseRating) / 2;

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
  }, [selectedPlayers]);

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

  return (
    <Box maxWidth="900px" mx="auto" p={6} borderRadius="lg" boxShadow="md" bg="white">
      <Heading as="h2" size="lg" mb={6}>Match Odds Prediction</Heading>
      
      <Box mb={8}>
        <Heading as="h3" size="md" mb={4}>Team Selection</Heading>
        <SimpleGrid columns={2} spacing={6}>
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
                    {user.name}
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
                    {user.name}
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
                    {user.name}
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
                    {user.name}
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
            
            <Box mt={4}>
              <Progress 
                value={matchPrediction.team1Probability} 
                colorScheme="blue" 
                height="24px" 
                borderRadius="md"
              />
            </Box>
          </Box>
          
          <Box mb={6}>
            <Heading as="h3" size="md" mb={4}>Team Ratings</Heading>
            <HStack justifyContent="space-between" mb={2}>
              <Text fontWeight="bold">Team 1: {matchPrediction.team1Rating}</Text>
              <Text fontWeight="bold">Team 2: {matchPrediction.team2Rating}</Text>
            </HStack>
            <Text fontSize="sm" color="gray.600" mb={6}>
              Team ratings are calculated as the average of player ratings.
            </Text>
            
            <Heading as="h3" size="md" mb={4}>Predicted Score</Heading>
            <HStack justifyContent="center" spacing={8}>
              <VStack>
                <Text fontWeight="bold">Team 1</Text>
                <Text fontSize="3xl">{matchPrediction.predictedScore.team1}</Text>
              </VStack>
              <Text fontSize="2xl">-</Text>
              <VStack>
                <Text fontWeight="bold">Team 2</Text>
                <Text fontSize="3xl">{matchPrediction.predictedScore.team2}</Text>
              </VStack>
            </HStack>
          </Box>
        </>
      )}
      
      {!selectedPlayers.team1Defense || 
       !selectedPlayers.team1Offense || 
       !selectedPlayers.team2Defense || 
       !selectedPlayers.team2Offense && (
        <Box textAlign="center" p={8} color="gray.500">
          <Text>Select all players to see match predictions</Text>
        </Box>
      )}
    </Box>
  );
}; 