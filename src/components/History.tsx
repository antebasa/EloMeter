import {useEffect, useState} from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Checkbox,
  Flex,
  FormControl,
  Heading,
  HStack,
  Icon,
  Select,
  Skeleton,
  Spinner,
  Text,
  VStack
} from "@chakra-ui/react";
import {GiCrossedSwords, GiShield} from 'react-icons/gi';
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import type {User as SupabaseUser} from "../lib/supabase";
import {getPlayerEloHistory, getPlayerMatchHistory, getUsers} from "../lib/supabase";

// Extend User type to include avatar_url
interface User extends SupabaseUser {
  avatar_url?: string;
}

// Helper function to format dates
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Define props for History component
interface HistoryProps {
  selectedPlayerIdProp?: number | null;
  onDoneWithSelectedPlayer?: () => void;
}

export const History = ({ selectedPlayerIdProp, onDoneWithSelectedPlayer }: HistoryProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [eloHistory, setEloHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPlayerData, setCurrentPlayerData] = useState<User | null>(null);
  const [showOffenseElo, setShowOffenseElo] = useState<boolean>(true);
  const [showDefenseElo, setShowDefenseElo] = useState<boolean>(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);
  console.log(error, selectedPlayerIdProp)
  useEffect(() => {
    // Load the users when the component mounts
    async function loadUsers() {
      try {
        const fetchedUsers = await getUsers();
        setUsers(fetchedUsers);

        // Set the first user as default selected player if there are users
        if (fetchedUsers.length > 0) {
          setSelectedPlayer(selectedPlayerIdProp ?? fetchedUsers[0].id);
        }
      } catch (err) {
        console.error("Error loading users:", err);
        setError("Failed to load users. Please try again later.");
      } finally {
        setInitialLoadComplete(true);
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

        // Role information is now included in the match data directly

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

    if (initialLoadComplete) {
      loadPlayerData();
    }
  }, [selectedPlayer, initialLoadComplete]);

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
    const playerId = parseInt(event.target.value, 10);
    setSelectedPlayer(playerId);
    if (onDoneWithSelectedPlayer) {
      onDoneWithSelectedPlayer();
    }
  };

  // Default zeros for any missing stats
  const playerStats = {
    played: currentPlayerData?.played || 0,
    wins: currentPlayerData?.wins || 0,
    losses: currentPlayerData?.losses || 0,
    scored: currentPlayerData?.scored || 0,
    conceded: currentPlayerData?.conceded || 0,
    elo_offense: currentPlayerData?.elo_offense || 1500,
    elo_defense: currentPlayerData?.elo_defense || 1500
  };

  // Calculate combined ELO (weighted average)
  const combinedElo = Math.round((playerStats.elo_offense + playerStats.elo_defense) / 2);

  if (!initialLoadComplete && !selectedPlayerIdProp) {
    return <Flex justify="center" align="center" height="200px"><Spinner size="xl" /></Flex>;
  }

  return (
    <Box
      maxWidth={{ base: "100%", md: "900px" }}
      mx="auto"
      p={{ base: 4, md: 6 }}
      borderRadius="lg"
      boxShadow="md"
      bg="white"
    >
      <Flex direction={{ base: "column", md: "row" }} align={{ base: "flex-start", md: "center" }} mb={6}>
        <Heading as="h2" size={{ base: "md", md: "lg" }} flex="1" mb={{ base: 4, md: 0 }}>Player History</Heading>
        <Box maxWidth={{ base: "100%", md: "300px" }} w="100%">
          <Select
            value={selectedPlayer === null ? "" : selectedPlayer.toString()}
            onChange={handlePlayerChange}
            placeholder="Select player"
            isDisabled={users.length === 0}
            size="md"
          >
            {users.map(player => (
              <option key={player.id} value={player.id.toString()}>{player.name}</option>
            ))}
          </Select>
        </Box>
      </Flex>

      {currentPlayerData && !loading && (
        <Flex
          mb={6}
          p={{ base: 3, md: 4 }}
          bg="blue.50"
          borderRadius="md"
          align="center"
          justify="space-between"
          direction={{ base: "column", sm: "row" }}
        >
          <Box mb={{ base: 4, sm: 0 }}>
            <Heading as="h3" size={{ base: "sm", md: "md" }}>{currentPlayerData.name}</Heading>
            <Text color="gray.600" fontSize={{ base: "sm", md: "md" }}>
              {playerStats.played} matches played ({playerStats.wins} wins, {playerStats.losses} losses)
            </Text>
          </Box>
          <Flex
            direction={{ base: "column", sm: "row" }}
            justify="space-around"
            flex="1"
            gap={{ base: 2, sm: 4 }}
            wrap="wrap"
          >
            <Box textAlign="center" minW={{ base: "auto", sm: "80px" }}>
              <Heading as="h4" size={{ base: "xs", md: "sm" }} color="gray.600">Offense ELO</Heading>
              <Text fontSize={{ base: "lg", md: "2xl" }} fontWeight="bold" color="purple.600">
                {playerStats.elo_offense}
              </Text>
            </Box>
            <Box textAlign="center" minW={{ base: "auto", sm: "80px" }}>
              <Heading as="h4" size={{ base: "xs", md: "sm" }} color="gray.600">Defense ELO</Heading>
              <Text fontSize={{ base: "lg", md: "2xl" }} fontWeight="bold" color="blue.600">
                {playerStats.elo_defense}
              </Text>
            </Box>
            <Box textAlign="center" minW={{ base: "auto", sm: "80px" }}>
              <Heading as="h4" size={{ base: "xs", md: "sm" }} color="gray.600">Combined</Heading>
              <Text fontSize={{ base: "lg", md: "2xl" }} fontWeight="bold" color="teal.600">
                {combinedElo}
              </Text>
            </Box>
          </Flex>
          <Box textAlign="center" ml={{ base: 0, md: 4 }} mt={{ base: 4, sm: 0 }}>
            <Text fontWeight="bold" fontSize={{ base: "sm", md: "md" }}>Goals</Text>
            <HStack spacing={{ base: 2, md: 4 }} justify="center">
              <Box>
                <Text fontWeight="bold" color="green.500">{playerStats.scored}</Text>
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
            <Flex justify="space-between" align="center" mb={2} direction={{ base: "column", md: "row" }}>
              <Heading as="h3" size={{ base: "sm", md: "md" }} mb={{ base: 2, md: 0 }}>ELO Rating History</Heading>
              <HStack spacing={3} flexWrap="wrap" justify={{ base: "center", md: "flex-end" }}>
                <FormControl display="flex" alignItems="center" width="auto">
                  <Checkbox
                    id="show-offense-elo"
                    isChecked={showOffenseElo}
                    onChange={() => setShowOffenseElo(!showOffenseElo)}
                    colorScheme="purple"
                  >
                    <Text fontSize={{ base: "xs", md: "sm" }}>Offense</Text>
                  </Checkbox>
                </FormControl>
                <FormControl display="flex" alignItems="center" width="auto">
                  <Checkbox
                    id="show-defense-elo"
                    isChecked={showDefenseElo}
                    onChange={() => setShowDefenseElo(!showDefenseElo)}
                    colorScheme="blue"
                  >
                    <Text fontSize={{ base: "xs", md: "sm" }}>Defense</Text>
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
              <Box height={{ base: "250px", md: "300px" }} bg="whiteAlpha.100" borderRadius="md" p={2}>
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
            <Heading as="h3" size={{ base: "sm", md: "md" }} mb={4}>Recent Matches</Heading>
            {matchHistory.length === 0 ? (
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                <AlertDescription>No match history available for this player.</AlertDescription>
              </Alert>
            ) : (
              <Box
                display="grid"
                gridTemplateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
                gap={3}
              >
                {matchHistory.map((match, index) => {
                  const result = match.result;
                  const isWin = result === "Win";
                  const isDraw = result === "Draw";
                  const score = match.score || "0-0";

                  // Parse opponent team to get roles
                  const parseOpponentTeam = (opponentString: string) => {
                    if (!opponentString) return [];
                    return opponentString.split(' & ').map(member => {
                      const isDefender = member.includes('(D)');
                      const name = member.replace(/\s*\([DO]\)\s*/g, '').trim();
                      return { name, isDefender };
                    });
                  };

                  const opponentTeam = parseOpponentTeam(match.opponents || "");
                  const currentPlayerName = currentPlayerData?.name || "";
                  const teammateName = match.teammate || "";

                  // Use the role information directly from the match data
                  const currentPlayerIsDefender = match.currentPlayerIsDefender;

                  return (
                    <Box
                      key={index}
                      p={3}
                      borderRadius="md"
                      bg={isWin ? "green.50" : isDraw ? "gray.50" : "red.50"}
                      border="2px solid"
                      borderColor={isWin ? "green.200" : isDraw ? "gray.200" : "red.200"}
                      _hover={{
                        borderColor: isWin ? "green.400" : isDraw ? "gray.400" : "red.400",
                        transform: "translateY(-1px)"
                      }}
                      transition="all 0.2s ease"
                    >
                      <VStack spacing={3}>
                        {/* Score */}
                        <Text fontSize="xl" fontWeight="bold" color="gray.800">
                          {score}
                        </Text>

                        {/* Your Team - Always show defender first, then offense */}
                        <VStack spacing={1} w="100%">
                          {/* Defender always on top */}
                          <HStack spacing={2} justify="center">
                            <Icon
                              as={GiShield}
                              boxSize={4}
                              color="blue.600"
                            />
                            <Text
                              fontSize="sm"
                              fontWeight={currentPlayerIsDefender ? "bold" : "medium"}
                              color="blue.700"
                            >
                              {currentPlayerIsDefender ? currentPlayerName : teammateName}
                            </Text>
                          </HStack>
                          {/* Offense always underneath */}
                          {teammateName && teammateName !== "-" && (
                            <HStack spacing={2} justify="center">
                              <Icon
                                as={GiCrossedSwords}
                                boxSize={4}
                                color="orange.600"
                              />
                              <Text
                                fontSize="sm"
                                fontWeight={!currentPlayerIsDefender ? "bold" : "medium"}
                                color="blue.600"
                              >
                                {currentPlayerIsDefender ? teammateName : currentPlayerName}
                              </Text>
                            </HStack>
                          )}
                        </VStack>

                        {/* VS */}
                        <Text fontSize="xs" color="gray.500" fontWeight="bold">VS</Text>

                        {/* Opponents - Always show defender first, then offense */}
                        <VStack spacing={1} w="100%">
                          {/* Sort opponents so defender is always first */}
                          {opponentTeam
                            .sort((a, b) => (b.isDefender ? 1 : 0) - (a.isDefender ? 1 : 0))
                            .map((opponent, idx) => (
                            <HStack key={idx} spacing={2} justify="center">
                              <Icon
                                as={opponent.isDefender ? GiShield : GiCrossedSwords}
                                boxSize={4}
                                color={opponent.isDefender ? "blue.600" : "orange.600"}
                              />
                              <Text fontSize="sm" fontWeight="medium" color="red.700">
                                {opponent.name}
                              </Text>
                            </HStack>
                          ))}
                        </VStack>

                        {/* ELO Change */}
                        <Text
                          fontSize="lg"
                          fontWeight="bold"
                          color={match.eloChange > 0 ? "green.600" : match.eloChange < 0 ? "red.600" : "gray.600"}
                        >
                          {match.eloChange > 0 ? `+${match.eloChange}` : match.eloChange}
                        </Text>
                      </VStack>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};
