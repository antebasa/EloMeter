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
  SkeletonText,
  Tabs, 
  TabList, 
  TabPanels, 
  Tab, 
  TabPanel,
  Switch,
  FormControl,
  FormLabel,
  Checkbox
} from "@chakra-ui/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getUsers, getPlayerMatchHistory, getPlayerEloHistory } from "../lib/supabase";
import type { User } from "../lib/supabase";

// Helper function to format dates
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

export const History = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [eloHistory, setEloHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPlayerData, setCurrentPlayerData] = useState<User | null>(null);
  const [showOffenseElo, setShowOffenseElo] = useState<boolean>(true);
  const [showDefenseElo, setShowDefenseElo] = useState<boolean>(true);
  
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
        
        console.log('Received ELO history data:', elo);
        
        // Check if we got valid data
        if (!elo || !Array.isArray(elo) || elo.length === 0) {
          console.error('No ELO history data received');
          setError('Failed to load ELO history data');
        }
        
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

  // Format the chart data - group by date and separate offense/defense
  const chartData = eloHistory && eloHistory.length > 0 ? eloHistory.reduce((acc: any[], item: any) => {
    console.log('Processing ELO history item:', item);
    
    // Format the date for display
    const formattedDate = formatDate(item.x);
    
    // Check if there's already an entry for this date
    const existingEntry = acc.find(entry => entry.name === formattedDate);
    
    if (existingEntry) {
      // Update existing entry with this type of ELO
      if (item.type === 'offense') {
        existingEntry.offenseELO = item.y;
      } else if (item.type === 'defense') {
        existingEntry.defenseELO = item.y;
      }
    } else {
      // Create a new entry for this date
      const newEntry: any = { name: formattedDate };
      if (item.type === 'offense') {
        newEntry.offenseELO = item.y;
      } else if (item.type === 'defense') {
        newEntry.defenseELO = item.y;
      }
      acc.push(newEntry);
    }
    
    return acc;
  }, []) : [];
  
  // Sort chart data by date
  if (chartData.length > 0) {
    chartData.sort((a: any, b: any): number => {
      const dateA = new Date(a.name);
      const dateB = new Date(b.name);
      return dateA.getTime() - dateB.getTime();
    });
  }
  
  console.log('Final chart data:', chartData);

  // Make sure there's a consistent y-axis range for the chart
  let minValue = 1300;
  let maxValue = 1500;
  
  if (eloHistory && eloHistory.length > 0) {
    const allRatings = eloHistory.map(item => item.y);
    minValue = Math.min(...allRatings) - 50;
    maxValue = Math.max(...allRatings) + 50;
  }
  
  const chartYDomain = [minValue, maxValue];

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
    elo_offense: currentPlayerData?.elo_offense || 1500,
    elo_defense: currentPlayerData?.elo_defense || 1500
  };

  // Calculate combined ELO (weighted average)
  const combinedElo = Math.round((playerStats.elo_offense * 0.6) + (playerStats.elo_defense * 0.4));

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
          <Flex direction={{ base: "row", md: "row" }} justify="space-around" flex="1">
            <Box textAlign="center">
              <Heading as="h4" size="md" color="gray.600">Offense ELO</Heading>
              <Text fontSize="2xl" fontWeight="bold" color="purple.600">
                {playerStats.elo_offense}
              </Text>
            </Box>
            <Box textAlign="center">
              <Heading as="h4" size="md" color="gray.600">Defense ELO</Heading>
              <Text fontSize="2xl" fontWeight="bold" color="blue.600">
                {playerStats.elo_defense}
              </Text>
            </Box>
            <Box textAlign="center">
              <Heading as="h4" size="md" color="gray.600">Combined</Heading>
              <Text fontSize="2xl" fontWeight="bold" color="teal.600">
                {combinedElo}
              </Text>
            </Box>
          </Flex>
          <Box textAlign="center" ml={{ base: 0, md: 4 }}>
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
            <Flex justify="space-between" align="center" mb={2}>
              <Heading as="h3" size="md">ELO Rating History</Heading>
              <HStack spacing={3}>
                <FormControl display="flex" alignItems="center" width="auto">
                  <Checkbox 
                    id="show-offense-elo" 
                    isChecked={showOffenseElo} 
                    onChange={() => setShowOffenseElo(!showOffenseElo)}
                    colorScheme="purple"
                  >
                    <Text fontSize="sm">Offense</Text>
                  </Checkbox>
                </FormControl>
                <FormControl display="flex" alignItems="center" width="auto">
                  <Checkbox 
                    id="show-defense-elo" 
                    isChecked={showDefenseElo} 
                    onChange={() => setShowDefenseElo(!showDefenseElo)}
                    colorScheme="blue"
                  >
                    <Text fontSize="sm">Defense</Text>
                  </Checkbox>
                </FormControl>
              </HStack>
            </Flex>
            
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
                    <Legend />
                    
                    {showOffenseElo && (
                      <Line 
                        type="monotone" 
                        dataKey="offenseELO" 
                        name="Offense ELO"
                        stroke="#8884d8" 
                        strokeWidth={3}
                        dot={{ r: 6 }}
                        activeDot={{ r: 8 }}
                      />
                    )}
                    
                    {showDefenseElo && (
                      <Line 
                        type="monotone" 
                        dataKey="defenseELO" 
                        name="Defense ELO"
                        stroke="#3182CE" 
                        strokeWidth={3}
                        dot={{ r: 6 }}
                        activeDot={{ r: 8 }}
                      />
                    )}
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
                {matchHistory.map((match, index) => {
                  const result = match.result; // Win, Draw, or Loss
                  const isWin = result === "Win";
                  const isDraw = result === "Draw";
                  const isLoss = result === "Loss";
                  
                  return (
                    <Flex 
                      key={index} 
                      p={3} 
                      borderRadius="md" 
                      bg={isWin ? "blue.50" : isDraw ? "gray.100" : "gray.50"}
                      borderLeft={`4px solid ${isWin ? "#3182CE" : isDraw ? "#718096" : "#A0AEC0"}`}
                      justify="space-between"
                      align="center"
                    >
                      <VStack align="flex-start" spacing={0}>
                        <Text fontWeight="medium">
                          <Text as="span" fontWeight="bold">
                            {currentPlayerData?.name || ""}
                          </Text>
                          {match.teammate && (
                            <>
                              {" & "}
                              <Text as="span" fontWeight="normal">{match.teammate}</Text>
                            </>
                          )}
                          {" vs "}
                          <Text as="span" fontWeight="normal">{match.opponents}</Text>
                        </Text>
                        <Text fontSize="sm" color="gray.600">{formatDate(match.date)}</Text>
                      </VStack>
                      
                      <HStack>
                        <Badge colorScheme={isWin ? "green" : isDraw ? "gray" : "red"}>
                          {result}
                        </Badge>
                        <Text fontWeight="medium">{match.score}</Text>
                        <Text 
                          color={(match.eloChange > 0) ? "green.500" : "red.500"} 
                          fontWeight="bold"
                        >
                          {match.eloChange > 0 ? `+${match.eloChange}` : match.eloChange}
                        </Text>
                      </HStack>
                    </Flex>
                  );
                })}
              </VStack>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}; 