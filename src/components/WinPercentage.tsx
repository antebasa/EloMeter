import React, {useEffect, useState} from 'react';
import {
  Alert,
  AlertIcon,
  Avatar,
  Badge,
  Box,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  HStack,
  Progress,
  SimpleGrid,
  Spinner,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  VStack
} from '@chakra-ui/react';
import {supabase} from '../supabaseClient';

interface WinPercentageStats {
  blue_wins: number;
  white_wins: number;
  total_matches: number;
  blue_percentage: number;
  white_percentage: number;
}

interface PlayerTeamStats {
  id: number;
  name: string;
  avatar_url?: string;
  wins_as_blue_defense: number;
  wins_as_blue_offense: number;
  wins_as_white_defense: number;
  wins_as_white_offense: number;
  total_blue_defense: number;
  total_blue_offense: number;
  total_white_defense: number;
  total_white_offense: number;
}

type SortKey = 'name' | 'wins' | 'total' | 'winPercentage';
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

const positionColor = (position: number): string | undefined => {
  if (position === 0) return "#b5a64255"; // Gold
  else if (position === 1) return "#c0c0c0aa"; // Silver
  else if (position === 2) return "#cd7f3255"; // Bronze
  return undefined;
};

export const WinPercentage: React.FC = () => {
  const [stats, setStats] = useState<WinPercentageStats | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerTeamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Separate sort configs for each table
  const [blueDefenseSortConfig, setBlueDefenseSortConfig] = useState<SortConfig>({ key: 'wins', direction: 'descending' });
  const [blueOffenseSortConfig, setBlueOffenseSortConfig] = useState<SortConfig>({ key: 'wins', direction: 'descending' });
  const [whiteDefenseSortConfig, setWhiteDefenseSortConfig] = useState<SortConfig>({ key: 'wins', direction: 'descending' });
  const [whiteOffenseSortConfig, setWhiteOffenseSortConfig] = useState<SortConfig>({ key: 'wins', direction: 'descending' });

  const cardBg = useColorModeValue('white', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const tableBg = useColorModeValue("white", "gray.750");
  const headerBg = useColorModeValue("gray.50", "gray.800");
  const rowHoverBg = useColorModeValue("gray.100", "gray.700");
  const playerNameColor = useColorModeValue("gray.800", "whiteAlpha.900");

  useEffect(() => {
    fetchWinPercentageStats();
  }, []);

  const fetchWinPercentageStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Query to get win percentage statistics
      const { data, error: queryError } = await supabase
        .from('Match')
        .select('team_blue_score, team_white_score');

      if (queryError) {
        throw queryError;
      }

      if (!data || data.length === 0) {
        setStats({
          blue_wins: 0,
          white_wins: 0,
          total_matches: 0,
          blue_percentage: 0,
          white_percentage: 0
        });
        setPlayerStats([]);
        return;
      }

      // Calculate statistics
      const blueWins = data.filter(match => match.team_blue_score === 10).length;
      const whiteWins = data.filter(match => match.team_white_score === 10).length;
      const totalMatches = data.length;

      const bluePercentage = totalMatches > 0 ? Math.round((blueWins * 100.0) / totalMatches * 100) / 100 : 0;
      const whitePercentage = totalMatches > 0 ? Math.round((whiteWins * 100.0) / totalMatches * 100) / 100 : 0;

      setStats({
        blue_wins: blueWins,
        white_wins: whiteWins,
        total_matches: totalMatches,
        blue_percentage: bluePercentage,
        white_percentage: whitePercentage
      });

      // Fetch player statistics
      await fetchPlayerTeamStats();

    } catch (err) {
      console.error('Error fetching win percentage stats:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayerTeamStats = async () => {
    try {
      // Get all users first
      const { data: users, error: usersError } = await supabase
        .from('User')
        .select('id, name, avatar_url');

      if (usersError) {
        throw usersError;
      }

      if (!users || users.length === 0) {
        setPlayerStats([]);
        return;
      }

      // Get all player match stats with team and match details
      const { data: playerMatchStats, error: statsError } = await supabase
        .from('PlayerMatchStats')
        .select(`
          user_id,
          scored,
          conceded,
          team_id!inner (
            id,
            player_defense_id,
            player_offense_id
          ),
          match_id!inner (
            id,
            white_team_id,
            blue_team_id,
            team_white_score,
            team_blue_score
          )
        `);

      if (statsError) {
        throw statsError;
      }

      // Process player statistics
      const playerStatsMap = new Map<number, PlayerTeamStats>();

      // Initialize all users
      users.forEach(user => {
        playerStatsMap.set(user.id, {
          id: user.id,
          name: user.name,
          avatar_url: user.avatar_url,
          wins_as_blue_defense: 0,
          wins_as_blue_offense: 0,
          wins_as_white_defense: 0,
          wins_as_white_offense: 0,
          total_blue_defense: 0,
          total_blue_offense: 0,
          total_white_defense: 0,
          total_white_offense: 0
        });
      });

      // Cast the result to handle the joined data structure
      const typedPlayerMatchStats = playerMatchStats as unknown as Array<{
        user_id: number;
        scored: number;
        conceded: number;
        team_id: {
          id: number;
          player_defense_id: number;
          player_offense_id: number;
        };
        match_id: {
          id: number;
          white_team_id: number;
          blue_team_id: number;
          team_white_score: number;
          team_blue_score: number;
        };
      }>;

      // Process each match stat
      typedPlayerMatchStats?.forEach((stat) => {
        const playerStat = playerStatsMap.get(stat.user_id);
        if (!playerStat) return;

        const match = stat.match_id;
        const team = stat.team_id;
        const isBlueTeam = team.id === match.blue_team_id;
        const isWhiteTeam = team.id === match.white_team_id;
        const isDefense = team.player_defense_id === stat.user_id;
        const isOffense = team.player_offense_id === stat.user_id;

        // Determine if this was a win (team scored 10)
        const teamWon = (isBlueTeam && match.team_blue_score === 10) ||
                       (isWhiteTeam && match.team_white_score === 10);

        // Update totals
        if (isBlueTeam && isDefense) {
          playerStat.total_blue_defense++;
          if (teamWon) playerStat.wins_as_blue_defense++;
        } else if (isBlueTeam && isOffense) {
          playerStat.total_blue_offense++;
          if (teamWon) playerStat.wins_as_blue_offense++;
        } else if (isWhiteTeam && isDefense) {
          playerStat.total_white_defense++;
          if (teamWon) playerStat.wins_as_white_defense++;
        } else if (isWhiteTeam && isOffense) {
          playerStat.total_white_offense++;
          if (teamWon) playerStat.wins_as_white_offense++;
        }
      });

      setPlayerStats(Array.from(playerStatsMap.values()));

    } catch (err) {
      console.error('Error fetching player team stats:', err);
    }
  };

  const getWinPercentage = (wins: number, total: number): string => {
    if (total === 0) return '0.00';
    return ((wins / total) * 100).toFixed(2);
  };

  const getSortConfig = (position: 'defense' | 'offense', teamColor: 'blue' | 'white'): SortConfig => {
    if (teamColor === 'blue' && position === 'defense') return blueDefenseSortConfig;
    if (teamColor === 'blue' && position === 'offense') return blueOffenseSortConfig;
    if (teamColor === 'white' && position === 'defense') return whiteDefenseSortConfig;
    return whiteOffenseSortConfig;
  };

  const setSortConfig = (position: 'defense' | 'offense', teamColor: 'blue' | 'white', config: SortConfig) => {
    if (teamColor === 'blue' && position === 'defense') setBlueDefenseSortConfig(config);
    else if (teamColor === 'blue' && position === 'offense') setBlueOffenseSortConfig(config);
    else if (teamColor === 'white' && position === 'defense') setWhiteDefenseSortConfig(config);
    else setWhiteOffenseSortConfig(config);
  };

  const handleSort = (key: SortKey, position: 'defense' | 'offense', teamColor: 'blue' | 'white') => {
    const currentConfig = getSortConfig(position, teamColor);
    let direction: SortDirection = 'ascending';
    if (currentConfig.key === key && currentConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig(position, teamColor, { key, direction });
  };

  const sortPlayers = (players: PlayerTeamStats[], position: 'defense' | 'offense', teamColor: 'blue' | 'white'): PlayerTeamStats[] => {
    const config = getSortConfig(position, teamColor);

    return [...players].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (config.key) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'wins':
          aValue = teamColor === 'blue'
            ? (position === 'defense' ? a.wins_as_blue_defense : a.wins_as_blue_offense)
            : (position === 'defense' ? a.wins_as_white_defense : a.wins_as_white_offense);
          bValue = teamColor === 'blue'
            ? (position === 'defense' ? b.wins_as_blue_defense : b.wins_as_blue_offense)
            : (position === 'defense' ? b.wins_as_white_defense : b.wins_as_white_offense);
          break;
        case 'total':
          aValue = teamColor === 'blue'
            ? (position === 'defense' ? a.total_blue_defense : a.total_blue_offense)
            : (position === 'defense' ? a.total_white_defense : a.total_white_offense);
          bValue = teamColor === 'blue'
            ? (position === 'defense' ? b.total_blue_defense : b.total_blue_offense)
            : (position === 'defense' ? b.total_white_defense : b.total_white_offense);
          break;
        case 'winPercentage':
          const aWins = teamColor === 'blue'
            ? (position === 'defense' ? a.wins_as_blue_defense : a.wins_as_blue_offense)
            : (position === 'defense' ? a.wins_as_white_defense : a.wins_as_white_offense);
          const aTotal = teamColor === 'blue'
            ? (position === 'defense' ? a.total_blue_defense : a.total_blue_offense)
            : (position === 'defense' ? a.total_white_defense : a.total_white_offense);
          const bWins = teamColor === 'blue'
            ? (position === 'defense' ? b.wins_as_blue_defense : b.wins_as_blue_offense)
            : (position === 'defense' ? b.wins_as_white_defense : b.wins_as_white_offense);
          const bTotal = teamColor === 'blue'
            ? (position === 'defense' ? b.total_blue_defense : b.total_blue_offense)
            : (position === 'defense' ? b.total_white_defense : b.total_white_offense);
          aValue = aTotal > 0 ? (aWins / aTotal) * 100 : 0;
          bValue = bTotal > 0 ? (bWins / bTotal) * 100 : 0;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return config.direction === 'ascending'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (config.direction === 'ascending') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  };

  const renderSortIcon = (key: SortKey, position: 'defense' | 'offense', teamColor: 'blue' | 'white') => {
    const config = getSortConfig(position, teamColor);
    if (config.key !== key) return null;
    return config.direction === 'ascending' ? ' ↑' : ' ↓';
  };

  const renderPlayerTable = (players: PlayerTeamStats[], position: 'defense' | 'offense', teamColor: 'blue' | 'white') => {
    const sortedPlayers = sortPlayers(players, position, teamColor);
    const sortConfig = getSortConfig(position, teamColor);
    const headerColor = teamColor === 'blue' ? 'blue.400' : 'gray.300';

    return (
      <Card key={`${teamColor}-${position}`} bg={cardBg} shadow="md">
        <CardHeader pb={2}>
          <Heading size={{ base: "sm", md: "md" }} color={headerColor}>
            {teamColor === 'blue' ? 'Blue' : 'White'} {position === 'defense' ? 'Defense' : 'Offense'}
          </Heading>
        </CardHeader>
        <CardBody pt={2}>
          <Table variant="simple" size={{ base: "sm", md: "md" }}>
            <Thead>
              <Tr>
                <Th
                  cursor="pointer"
                  onClick={() => handleSort('name', position, teamColor)}
                  color={textColor}
                  fontSize={{ base: "xs", md: "sm" }}
                >
                  Player{renderSortIcon('name', position, teamColor)}
                </Th>
                <Th
                  cursor="pointer"
                  onClick={() => handleSort('wins', position, teamColor)}
                  isNumeric
                  color={textColor}
                  fontSize={{ base: "xs", md: "sm" }}
                >
                  Wins{renderSortIcon('wins', position, teamColor)}
                </Th>
                <Th
                  cursor="pointer"
                  onClick={() => handleSort('total', position, teamColor)}
                  isNumeric
                  color={textColor}
                  fontSize={{ base: "xs", md: "sm" }}
                >
                  Total{renderSortIcon('total', position, teamColor)}
                </Th>
                <Th
                  cursor="pointer"
                  onClick={() => handleSort('winPercentage', position, teamColor)}
                  isNumeric
                  color={textColor}
                  fontSize={{ base: "xs", md: "sm" }}
                >
                  Win %{renderSortIcon('winPercentage', position, teamColor)}
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {sortedPlayers.slice(0, 10).map((player, idx) => {
                const wins = teamColor === 'blue'
                  ? (position === 'defense' ? player.wins_as_blue_defense : player.wins_as_blue_offense)
                  : (position === 'defense' ? player.wins_as_white_defense : player.wins_as_white_offense);
                const total = teamColor === 'blue'
                  ? (position === 'defense' ? player.total_blue_defense : player.total_blue_offense)
                  : (position === 'defense' ? player.total_white_defense : player.total_white_offense);

                return (
                  <Tr
                    key={`${player.id}-${teamColor}-${position}`}
                    _hover={{ bg: rowHoverBg }}
                    transition="background-color 0.2s ease-in-out"
                    backgroundColor={positionColor(idx)}
                  >
                    <Td>
                      <Flex align="center">
                        <Text mr={'15px'} fontWeight="medium" color={playerNameColor} fontSize={{ base: "xs", md: "sm" }}>
                          {idx + 1}.
                        </Text>
                        <Avatar
                          size={{ base: "xs", md: "sm" }}
                          name={player.name}
                          mr={2}
                          src={player.avatar_url ? `${import.meta.env.VITE_SUPABASE_URL}/${player.avatar_url}` : undefined}
                        />
                        <Text color={playerNameColor} fontSize={{ base: "xs", md: "sm" }} fontWeight="medium">
                          {player.name}
                        </Text>
                      </Flex>
                    </Td>
                    <Td isNumeric>
                      <Text fontSize={{ base: "xs", md: "sm" }}>{wins}</Text>
                    </Td>
                    <Td isNumeric>
                      <Text color={textColor} fontSize={{ base: "xs", md: "sm" }}>{total}</Text>
                    </Td>
                    <Td isNumeric>
                      <Text color={textColor} fontWeight="bold" fontSize={{ base: "xs", md: "sm" }}>
                        {getWinPercentage(wins, total)}%
                      </Text>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
          {sortedPlayers.length === 0 && (
            <Text textAlign="center" color={textColor} py={4} fontSize={{ base: "sm", md: "md" }}>
              No players found for this position
            </Text>
          )}
        </CardBody>
      </Card>
    );
  };

  if (loading) {
    return (
      <Flex justify="center" align="center" h="200px">
        <Spinner size="xl" color="blue.500" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        Error loading win percentage data: {error}
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Alert status="info">
        <AlertIcon />
        No match data available.
      </Alert>
    );
  }

  return (
    <Box p={{ base: 4, md: 6 }}>
      <VStack spacing={{ base: 4, md: 6 }} align="stretch">
        <Heading size={{ base: "md", md: "lg" }} textAlign="center" color="white">
          Team Win Percentage Statistics
        </Heading>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={{ base: 4, md: 6 }}>
          {/* Blue Team Stats */}
          <Card bg={cardBg} shadow="lg">
            <CardHeader pb={2}>
              <Flex align="center" justify="space-between">
                <Heading size={{ base: "sm", md: "md" }} color="blue.400">
                  Blue Team
                </Heading>
                <Badge colorScheme="blue" fontSize={{ base: "xs", md: "sm" }}>
                  {stats.blue_wins} wins
                </Badge>
              </Flex>
            </CardHeader>
            <CardBody pt={2}>
              <VStack spacing={{ base: 2, md: 4 }} align="stretch">
                <Stat>
                  <StatLabel color={textColor} fontSize={{ base: "sm", md: "md" }}>Win Percentage</StatLabel>
                  <StatNumber fontSize={{ base: "2xl", md: "3xl" }} color="blue.400">
                    {stats.blue_percentage}%
                  </StatNumber>
                  <StatHelpText color={textColor} fontSize={{ base: "xs", md: "sm" }}>
                    {stats.blue_wins} wins out of {stats.total_matches} matches
                  </StatHelpText>
                </Stat>
                <Progress
                  value={stats.blue_percentage}
                  colorScheme="blue"
                  size={{ base: "md", md: "lg" }}
                  borderRadius="md"
                />
              </VStack>
            </CardBody>
          </Card>

          {/* White Team Stats */}
          <Card bg={cardBg} shadow="lg">
            <CardHeader pb={2}>
              <Flex align="center" justify="space-between">
                <Heading size={{ base: "sm", md: "md" }} color="gray.500">
                  White Team
                </Heading>
                <Badge colorScheme="gray" fontSize={{ base: "xs", md: "sm" }}>
                  {stats.white_wins} wins
                </Badge>
              </Flex>
            </CardHeader>
            <CardBody pt={2}>
              <VStack spacing={{ base: 2, md: 4 }} align="stretch">
                <Stat>
                  <StatLabel color={textColor} fontSize={{ base: "sm", md: "md" }}>Win Percentage</StatLabel>
                  <StatNumber fontSize={{ base: "2xl", md: "3xl" }} color="gray.300">
                    {stats.white_percentage}%
                  </StatNumber>
                  <StatHelpText color={textColor} fontSize={{ base: "xs", md: "sm" }}>
                    {stats.white_wins} wins out of {stats.total_matches} matches
                  </StatHelpText>
                </Stat>
                <Progress
                  value={stats.white_percentage}
                  colorScheme="gray"
                  size={{ base: "md", md: "lg" }}
                  borderRadius="md"
                />
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Summary Card */}
        <Card bg={cardBg} shadow="lg">
          <CardHeader>
            <Heading size={{ base: "sm", md: "md" }} textAlign="center" color="white">
              Overall Summary
            </Heading>
          </CardHeader>
          <CardBody>
            <Stat textAlign="center">
              <StatLabel color={textColor} fontSize={{ base: "sm", md: "md" }}>Total Matches</StatLabel>
              <StatNumber color={textColor} fontSize={{ base: "xl", md: "2xl" }}>{stats.total_matches}</StatNumber>
            </Stat>
            <SimpleGrid columns={{ base: 2, md: 2 }} spacing={{ base: 2, md: 4 }}>
              <Stat textAlign="center">
                <StatLabel color={textColor} fontSize={{ base: "xs", md: "sm" }}>Blue Wins</StatLabel>
                <StatNumber color="blue.400" fontSize={{ base: "lg", md: "xl" }}>{stats.blue_wins}</StatNumber>
              </Stat>
              <Stat textAlign="center">
                <StatLabel color={textColor} fontSize={{ base: "xs", md: "sm" }}>White Wins</StatLabel>
                <StatNumber color="gray.300" fontSize={{ base: "lg", md: "xl" }}>{stats.white_wins}</StatNumber>
              </Stat>
            </SimpleGrid>

            {stats.total_matches > 0 && (
              <Box mt={{ base: 4, md: 6 }}>
                <Text textAlign="center" color={textColor} mb={2} fontSize={{ base: "sm", md: "md" }}>
                  Win Distribution
                </Text>
                <HStack spacing={0} borderRadius="md" overflow="hidden">
                  <Box
                    bg="blue.400"
                    h="20px"
                    flex={stats.blue_percentage}
                    minW={stats.blue_percentage > 0 ? "20px" : "0"}
                  />
                  <Box
                    bg="gray.400"
                    h="20px"
                    flex={stats.white_percentage}
                    minW={stats.white_percentage > 0 ? "20px" : "0"}
                  />
                  <Box
                    bg="yellow.400"
                    h="20px"
                    flex={100 - stats.blue_percentage - stats.white_percentage}
                    minW={100 - stats.blue_percentage - stats.white_percentage > 0 ? "20px" : "0"}
                  />
                </HStack>
                <HStack justify="space-between" mt={2} fontSize="sm" color={textColor}>
                  <Text>Blue: {stats.blue_percentage}%</Text>
                  <Text>White: {stats.white_percentage}%</Text>
                </HStack>
              </Box>
            )}
          </CardBody>
        </Card>

        {/* Player Statistics Tables */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 4, md: 6 }}>
          {renderPlayerTable(playerStats, 'defense', 'blue')}
          {renderPlayerTable(playerStats, 'offense', 'blue')}
          {renderPlayerTable(playerStats, 'defense', 'white')}
          {renderPlayerTable(playerStats, 'offense', 'white')}
        </SimpleGrid>
      </VStack>
    </Box>
  );
};
