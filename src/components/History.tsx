import { useState, useEffect } from "react";
import { 
  Box, 
  Heading, 
  Text, 
  Select, 
  Flex, 
  VStack, 
  HStack, 
  Badge, 
  Tag, 
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Skeleton,
  SkeletonText
} from "@chakra-ui/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getUsers, getPlayerMatchHistory, getPlayerEloHistory } from "../lib/supabase";
import type { User } from "../lib/supabase";

export const History = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [eloHistory, setEloHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPlayerData, setCurrentPlayerData] = useState<User | null>(null);
  
  useEffect(() => {
    // Load the users when the component mounts
    async function loadUsers() {
      try {
        const fetchedUsers = await getUsers();
        setUsers(fetchedUsers);
        
        // Set the first user as default selected player if there are users
        if (fetchedUsers.length > 0) {
          setSelectedPlayer(fetchedUsers[0].id);
        }
      } catch (err) {
        console.error("Error loading users:", err);
        setError("Failed to load users. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  useEffect(() => {
    // Load the player's match and ELO history when the selected player changes
    async function loadPlayerData() {
      if (!selectedPlayer) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Get the current player data
        const currentPlayer = users.find(u => u.id === selectedPlayer) || null;
        setCurrentPlayerData(currentPlayer);
        
        const [matches, elo] = await Promise.all([
          getPlayerMatchHistory(selectedPlayer),
          getPlayerEloHistory(selectedPlayer)
        ]);
        
        setMatchHistory(matches);
        setEloHistory(elo);
      } catch (err) {
        console.error("Error loading player data:", err);
        setError("Failed to load player history. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
    
    loadPlayerData();
  }, [selectedPlayer]);

  // Format the chart data
  const chartData = eloHistory.map(item => ({
    name: item.date,
    ELO: item.rating
  }));

  // Make sure there's a consistent y-axis range for the chart
  const chartYDomain = eloHistory.length > 0 
    ? [(Math.min(...eloHistory.map(item => item.rating)) - 50), (Math.max(...eloHistory.map(item => item.rating)) + 50)]
    : [1450, 1550]; // Default range if no data

  // Handler for player selection change
  const handlePlayerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPlayer(parseInt(event.target.value, 10));
  };

  // Default zeros for any missing stats
  const playerStats = {
    played: currentPlayerData?.played || 0,
    wins: currentPlayerData?.wins || 0,
    losses: currentPlayerData?.losses || 0,
    goals: currentPlayerData?.goals || 0,
    conceded: currentPlayerData?.conceded || 0,
    elo_score: currentPlayerData?.elo_score || 1500
  };

  return (
    <Box maxWidth="900px" mx="auto" p={6} borderRadius="lg" boxShadow="md" bg="white">
      <Flex direction={{ base: "column", md: "row" }} align={{ base: "flex-start", md: "center" }} mb={6}>
        <Heading as="h2" size="lg" flex="1">Player History</Heading>
        <Box maxWidth="300px" w="100%">
          <Select 
            value={selectedPlayer || ""}
            onChange={handlePlayerChange}
            placeholder="Select player"
            isDisabled={loading || users.length === 0}
          >
            {users.map(player => (
              <option key={player.id} value={player.id}>{player.name}</option>
            ))}
          </Select>
        </Box>
      </Flex>
      
      {currentPlayerData && !loading && (
        <Flex 
          mb={6} 
          p={4} 
          bg="blue.50" 
          borderRadius="md" 
          align="center" 
          justify="space-between"
          direction={{ base: "column", sm: "row" }}
        >
          <Box mb={{ base: 4, sm: 0 }}>
            <Heading as="h3" size="md">{currentPlayerData.name}</Heading>
            <Text color="gray.600">
              {playerStats.played} matches played ({playerStats.wins} wins, {playerStats.losses} losses)
            </Text>
          </Box>
          <Box textAlign="center">
            <Heading as="h4" size="md" color="gray.600">Current ELO</Heading>
            <Text fontSize="2xl" fontWeight="bold" color="blue.600">
              {playerStats.elo_score}
            </Text>
          </Box>
          <Box textAlign="center">
            <Text fontWeight="bold">Goals</Text>
            <HStack spacing={4} justify="center">
              <Box>
                <Text fontWeight="bold" color="green.500">{playerStats.goals}</Text>
                <Text fontSize="sm">Scored</Text>
              </Box>
              <Box>
                <Text fontWeight="bold" color="red.500">{playerStats.conceded}</Text>
                <Text fontSize="sm">Conceded</Text>
              </Box>
            </HStack>
          </Box>
        </Flex>
      )}
      
      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {loading ? (
        <>
          <Box mb={8}>
            <Heading as="h3" size="md" mb={4}>ELO Rating History</Heading>
            <Skeleton height="300px" borderRadius="md" />
          </Box>
          
          <Box>
            <Heading as="h3" size="md" mb={4}>Recent Matches</Heading>
            <VStack spacing={2} align="stretch">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} height="60px" borderRadius="md" />
              ))}
            </VStack>
          </Box>
        </>
      ) : (
        <>
          <Box mb={8}>
            <Heading as="h3" size="md" mb={4}>ELO Rating History</Heading>
            {eloHistory.length === 0 ? (
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                <AlertDescription>No rating history available for this player.</AlertDescription>
              </Alert>
            ) : (
              <Box height="300px" bg="whiteAlpha.100" borderRadius="md" p={2}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={chartYDomain} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "#2D3748", 
                        borderColor: "#4A5568",
                        color: "white" 
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="ELO" 
                      stroke="#3182CE" 
                      strokeWidth={3}
                      dot={{ r: 6 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Box>
          
          <Box>
            <Heading as="h3" size="md" mb={4}>Recent Matches</Heading>
            {matchHistory.length === 0 ? (
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                <AlertDescription>No match history available for this player.</AlertDescription>
              </Alert>
            ) : (
              <VStack spacing={2} align="stretch">
                {matchHistory.map((match, index) => (
                  <Flex 
                    key={index} 
                    p={3} 
                    borderRadius="md" 
                    bg={match.result === "Win" ? "blue.50" : match.result === "Draw" ? "gray.100" : "gray.50"}
                    borderLeft={`4px solid ${match.result === "Win" ? "#3182CE" : match.result === "Draw" ? "#718096" : "#A0AEC0"}`}
                    justify="space-between"
                    align="center"
                  >
                    <VStack align="flex-start" spacing={0}>
                      <Text fontWeight="bold">{match.opponent}</Text>
                      <Text fontSize="sm" color="gray.600">{match.date}</Text>
                    </VStack>
                    
                    <HStack>
                      <Text>{match.score}</Text>
                      <Badge colorScheme={match.result === "Win" ? "green" : "red"}>
                        {match.result}
                      </Badge>
                      <Tag 
                        colorScheme={match.ratingChange.startsWith('+') ? "green" : "red"}
                      >
                        {match.ratingChange}
                      </Tag>
                    </HStack>
                  </Flex>
                ))}
              </VStack>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}; 