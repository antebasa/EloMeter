import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  Select,
  Button,
  Grid,
  GridItem,
  Card,
  CardBody,
  CardHeader,
  Avatar,
  Badge,
  VStack,
  HStack,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  useColorModeValue,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Divider,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tag,
  Switch,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Area,
  AreaChart,
} from 'recharts';
import { getUsers, getPlayerEloHistory, getPlayerMatchHistory, getHeadToHeadMatches } from '../lib/supabase';
import type { User } from '../lib/supabase';

interface PlayerWithStats extends User {
  winPercentage: number;
  winPercentageOffense?: number;
  winPercentageDefense?: number;
  recentFormDetailed: any[];
  elo_overall?: number;
  scoredAsDefense?: number;
  concededAsDefense?: number;
  matchesAsDefense?: number;
  winsAsDefense?: number;
  scoredAsOffense?: number;
  concededAsOffense?: number;
  matchesAsOffense?: number;
  winsAsOffense?: number;
  avgGoalsPerMatch?: number;
  avgConcededPerMatch?: number;
  goalDifference?: number;
}

interface ComparisonData {
  player1: PlayerWithStats | null;
  player2: PlayerWithStats | null;
  player1EloHistory: any[];
  player2EloHistory: any[];
  player1MatchHistory: any[];
  player2MatchHistory: any[];
  headToHeadMatches: any[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export const PlayerComparison: React.FC = () => {
  const [players, setPlayers] = useState<User[]>([]);
  const [selectedPlayer1Id, setSelectedPlayer1Id] = useState<string>('');
  const [selectedPlayer2Id, setSelectedPlayer2Id] = useState<string>('');
  const [comparisonData, setComparisonData] = useState<ComparisonData>({
    player1: null,
    player2: null,
    player1EloHistory: [],
    player2EloHistory: [],
    player1MatchHistory: [],
    player2MatchHistory: [],
    headToHeadMatches: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOffenseElo, setShowOffenseElo] = useState(true);
  const [showDefenseElo, setShowDefenseElo] = useState(true);

  const cardBg = useColorModeValue('white', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'whiteAlpha.900');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      const fetchedPlayers = await getUsers();
      setPlayers(fetchedPlayers);
    } catch (err) {
      console.error('Error loading players:', err);
      setError('Failed to load players');
    }
  };

  const calculatePlayerStats = (player: User, matchHistory: any[]): PlayerWithStats => {
    const wins = player.wins || 0;
    const played = player.played || 0;
    const scored = player.scored || 0;
    const conceded = player.conceded || 0;

    const winPercentage = played > 0 ? Math.round((wins / played) * 100) : 0;
    const avgGoalsPerMatch = played > 0 ? Math.round((scored / played) * 100) / 100 : 0;
    const avgConcededPerMatch = played > 0 ? Math.round((conceded / played) * 100) / 100 : 0;
    const goalDifference = scored - conceded;

    const offenseElo = player.elo_offense ?? 1400;
    const defenseElo = player.elo_defense ?? 1400;
    const overallElo = Math.round((offenseElo + defenseElo) / 2);

    // Calculate recent form (last 10 matches)
    const recentMatches = matchHistory.slice(0, 10);
    const recentWins = recentMatches.filter(match => match.result === 'Win').length;
    const recentWinPercentage = recentMatches.length > 0 ? Math.round((recentWins / recentMatches.length) * 100) : 0;

    return {
      ...player,
      winPercentage,
      winPercentageOffense: 0, // Will be calculated from match history if needed
      winPercentageDefense: 0, // Will be calculated from match history if needed
      recentFormDetailed: recentMatches,
      elo_overall: overallElo,
      avgGoalsPerMatch,
      avgConcededPerMatch,
      goalDifference,
      scoredAsDefense: 0,
      concededAsDefense: 0,
      matchesAsDefense: 0,
      winsAsDefense: 0,
      scoredAsOffense: 0,
      concededAsOffense: 0,
      matchesAsOffense: 0,
      winsAsOffense: 0,
    };
  };

  const handleCompare = async () => {
    if (!selectedPlayer1Id || !selectedPlayer2Id) {
      setError('Please select both players to compare');
      return;
    }

    if (selectedPlayer1Id === selectedPlayer2Id) {
      setError('Please select two different players');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const player1 = players.find(p => p.id === parseInt(selectedPlayer1Id));
      const player2 = players.find(p => p.id === parseInt(selectedPlayer2Id));

      if (!player1 || !player2) {
        throw new Error('Selected players not found');
      }

      // Fetch additional data for both players
      const [
        player1EloHistory,
        player2EloHistory,
        player1MatchHistory,
        player2MatchHistory,
        headToHeadMatches,
      ] = await Promise.all([
        getPlayerEloHistory(player1.id),
        getPlayerEloHistory(player2.id),
        getPlayerMatchHistory(player1.id),
        getPlayerMatchHistory(player2.id),
        getHeadToHeadMatches(player1.id, player2.id),
      ]);

      const player1WithStats = calculatePlayerStats(player1, player1MatchHistory);
      const player2WithStats = calculatePlayerStats(player2, player2MatchHistory);

      setComparisonData({
        player1: player1WithStats,
        player2: player2WithStats,
        player1EloHistory,
        player2EloHistory,
        player1MatchHistory,
        player2MatchHistory,
        headToHeadMatches,
      });
    } catch (err) {
      console.error('Error comparing players:', err);
      setError('Failed to load comparison data');
    } finally {
      setLoading(false);
    }
  };

  const renderPlayerCard = (player: PlayerWithStats, playerNumber: number) => {
    const isPlayer1 = playerNumber === 1;
    const cardColor = isPlayer1 ? 'blue.500' : 'green.500';

    return (
      <Card bg={cardBg} borderColor={cardColor} borderWidth="2px">
        <CardHeader>
          <Flex align="center" gap={4}>
            <Avatar name={player.name} size="lg" />
            <VStack align="start" spacing={1}>
              <Heading size="md" color={textColor}>{player.name}</Heading>
              <Badge colorScheme={isPlayer1 ? 'blue' : 'green'}>
                Player {playerNumber}
              </Badge>
            </VStack>
          </Flex>
        </CardHeader>
        <CardBody>
          <Grid templateColumns="repeat(2, 1fr)" gap={4}>
            <Stat>
              <StatLabel>Overall ELO</StatLabel>
              <StatNumber>{player.elo_overall}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Win Rate</StatLabel>
              <StatNumber>{player.winPercentage}%</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Matches Played</StatLabel>
              <StatNumber>{player.played || 0}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Goal Difference</StatLabel>
              <StatNumber color={player.goalDifference! >= 0 ? 'green.500' : 'red.500'}>
                {player.goalDifference! >= 0 ? '+' : ''}{player.goalDifference}
              </StatNumber>
            </Stat>
          </Grid>
        </CardBody>
      </Card>
    );
  };

  const renderEloComparisonChart = () => {
    if (!comparisonData.player1 || !comparisonData.player2) return null;

    const data = [
      {
        category: 'Offense ELO',
        [comparisonData.player1.name]: comparisonData.player1.elo_offense || 1400,
        [comparisonData.player2.name]: comparisonData.player2.elo_offense || 1400,
      },
      {
        category: 'Defense ELO',
        [comparisonData.player1.name]: comparisonData.player1.elo_defense || 1400,
        [comparisonData.player2.name]: comparisonData.player2.elo_defense || 1400,
      },
      {
        category: 'Overall ELO',
        [comparisonData.player1.name]: comparisonData.player1.elo_overall || 1400,
        [comparisonData.player2.name]: comparisonData.player2.elo_overall || 1400,
      },
    ];

    return (
      <Card bg={cardBg}>
        <CardHeader>
          <Heading size="md" color={textColor}>ELO Comparison</Heading>
        </CardHeader>
        <CardBody>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={comparisonData.player1.name} fill="#3182CE" />
              <Bar dataKey={comparisonData.player2.name} fill="#38A169" />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    );
  };

  const renderStatsRadarChart = () => {
    if (!comparisonData.player1 || !comparisonData.player2) return null;

    const maxValues = {
      winRate: 100,
      avgGoals: Math.max(comparisonData.player1.avgGoalsPerMatch || 0, comparisonData.player2.avgGoalsPerMatch || 0, 10),
      eloOffense: Math.max(comparisonData.player1.elo_offense || 1400, comparisonData.player2.elo_offense || 1400, 1600),
      eloDefense: Math.max(comparisonData.player1.elo_defense || 1400, comparisonData.player2.elo_defense || 1400, 1600),
      matchesPlayed: Math.max(comparisonData.player1.played || 0, comparisonData.player2.played || 0, 50),
    };

    const data = [
      {
        subject: 'Win Rate',
        [comparisonData.player1.name]: (comparisonData.player1.winPercentage / maxValues.winRate) * 100,
        [comparisonData.player2.name]: (comparisonData.player2.winPercentage / maxValues.winRate) * 100,
        fullMark: 100,
      },
      {
        subject: 'Avg Goals',
        [comparisonData.player1.name]: ((comparisonData.player1.avgGoalsPerMatch || 0) / maxValues.avgGoals) * 100,
        [comparisonData.player2.name]: ((comparisonData.player2.avgGoalsPerMatch || 0) / maxValues.avgGoals) * 100,
        fullMark: 100,
      },
      {
        subject: 'Offense ELO',
        [comparisonData.player1.name]: ((comparisonData.player1.elo_offense || 1400) / maxValues.eloOffense) * 100,
        [comparisonData.player2.name]: ((comparisonData.player2.elo_offense || 1400) / maxValues.eloOffense) * 100,
        fullMark: 100,
      },
      {
        subject: 'Defense ELO',
        [comparisonData.player1.name]: ((comparisonData.player1.elo_defense || 1400) / maxValues.eloDefense) * 100,
        [comparisonData.player2.name]: ((comparisonData.player2.elo_defense || 1400) / maxValues.eloDefense) * 100,
        fullMark: 100,
      },
      {
        subject: 'Experience',
        [comparisonData.player1.name]: ((comparisonData.player1.played || 0) / maxValues.matchesPlayed) * 100,
        [comparisonData.player2.name]: ((comparisonData.player2.played || 0) / maxValues.matchesPlayed) * 100,
        fullMark: 100,
      },
    ];

    return (
      <Card bg={cardBg}>
        <CardHeader>
          <Heading size="md" color={textColor}>Performance Radar</Heading>
        </CardHeader>
        <CardBody>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={data}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar
                name={comparisonData.player1.name}
                dataKey={comparisonData.player1.name}
                stroke="#3182CE"
                fill="#3182CE"
                fillOpacity={0.3}
              />
              <Radar
                name={comparisonData.player2.name}
                dataKey={comparisonData.player2.name}
                stroke="#38A169"
                fill="#38A169"
                fillOpacity={0.3}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    );
  };

  const renderWinLossChart = () => {
    if (!comparisonData.player1 || !comparisonData.player2) return null;

    const player1Data = [
      { name: 'Wins', value: comparisonData.player1.wins || 0 },
      { name: 'Losses', value: comparisonData.player1.losses || 0 },
    ];

    const player2Data = [
      { name: 'Wins', value: comparisonData.player2.wins || 0 },
      { name: 'Losses', value: comparisonData.player2.losses || 0 },
    ];

    return (
      <Card bg={cardBg}>
        <CardHeader>
          <Heading size="md" color={textColor}>Win/Loss Distribution</Heading>
        </CardHeader>
        <CardBody>
          <Grid templateColumns="repeat(2, 1fr)" gap={4}>
            <Box>
              <Text textAlign="center" mb={2} fontWeight="bold">
                {comparisonData.player1.name}
              </Text>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={player1Data}
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {player1Data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#38A169' : '#E53E3E'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Box>
              <Text textAlign="center" mb={2} fontWeight="bold">
                {comparisonData.player2.name}
              </Text>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={player2Data}
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {player2Data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#38A169' : '#E53E3E'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Grid>
        </CardBody>
      </Card>
    );
  };

  const renderEloHistoryChart = () => {
    if (!comparisonData.player1EloHistory.length || !comparisonData.player2EloHistory.length) return null;

    // Process ELO history data for both players
    const processEloHistory = (history: any[], playerName: string) => {
      const offenseData = history.filter(entry => entry.type === 'offense').map(entry => ({
        date: new Date(entry.x).getTime(),
        [`${playerName}_offense`]: entry.y,
      }));

      const defenseData = history.filter(entry => entry.type === 'defense').map(entry => ({
        date: new Date(entry.x).getTime(),
        [`${playerName}_defense`]: entry.y,
      }));

      return { offenseData, defenseData };
    };

    const player1History = processEloHistory(comparisonData.player1EloHistory, comparisonData.player1!.name);
    const player2History = processEloHistory(comparisonData.player2EloHistory, comparisonData.player2!.name);

    // Combine and sort by date
    const allDates = [
      ...player1History.offenseData.map(d => d.date),
      ...player1History.defenseData.map(d => d.date),
      ...player2History.offenseData.map(d => d.date),
      ...player2History.defenseData.map(d => d.date),
    ].sort((a, b) => a - b);

    const uniqueDates = [...new Set(allDates)];

    const combinedData = uniqueDates.map(date => {
      const result: any = { date };

      // Find closest data points for each player and type
      const findClosestValue = (data: any[], targetDate: number, key: string) => {
        const closest = data.reduce((prev, curr) =>
          Math.abs(curr.date - targetDate) < Math.abs(prev.date - targetDate) ? curr : prev
        );
        return closest[key];
      };

      if (player1History.offenseData.length > 0) {
        result[`${comparisonData.player1!.name}_offense`] = findClosestValue(
          player1History.offenseData,
          date,
          `${comparisonData.player1!.name}_offense`
        );
      }

      if (player1History.defenseData.length > 0) {
        result[`${comparisonData.player1!.name}_defense`] = findClosestValue(
          player1History.defenseData,
          date,
          `${comparisonData.player1!.name}_defense`
        );
      }

      if (player2History.offenseData.length > 0) {
        result[`${comparisonData.player2!.name}_offense`] = findClosestValue(
          player2History.offenseData,
          date,
          `${comparisonData.player2!.name}_offense`
        );
      }

      if (player2History.defenseData.length > 0) {
        result[`${comparisonData.player2!.name}_defense`] = findClosestValue(
          player2History.defenseData,
          date,
          `${comparisonData.player2!.name}_defense`
        );
      }

      return result;
    });

    // Calculate Y-axis domain for better readability
    const allEloValues = combinedData.flatMap(entry =>
      Object.keys(entry)
        .filter(key => key !== 'date')
        .map(key => entry[key])
        .filter(value => typeof value === 'number')
    );

    const minElo = Math.min(...allEloValues);
    const maxElo = Math.max(...allEloValues);
    const padding = (maxElo - minElo) * 0.1; // 10% padding
    const yAxisMin = Math.max(1000, Math.floor((minElo - padding) / 50) * 50); // Round to nearest 50, min 1000
    const yAxisMax = Math.ceil((maxElo + padding) / 50) * 50; // Round to nearest 50

    return (
      <Card bg={cardBg}>
        <CardHeader>
          <Flex justify="space-between" align="center" mb={4}>
            <Heading size="md" color={textColor}>ELO History Comparison</Heading>
            <HStack spacing={6}>
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="offense-toggle" mb="0" fontSize="sm">
                  Offense ELO
                </FormLabel>
                <Switch
                  id="offense-toggle"
                  isChecked={showOffenseElo}
                  onChange={(e) => setShowOffenseElo(e.target.checked)}
                  colorScheme="blue"
                />
              </FormControl>
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="defense-toggle" mb="0" fontSize="sm">
                  Defense ELO
                </FormLabel>
                <Switch
                  id="defense-toggle"
                  isChecked={showDefenseElo}
                  onChange={(e) => setShowDefenseElo(e.target.checked)}
                  colorScheme="green"
                />
              </FormControl>
            </HStack>
          </Flex>
        </CardHeader>
        <CardBody>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={combinedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis
                domain={[yAxisMin, yAxisMax]}
                tickCount={8}
                tickFormatter={(value) => Math.round(value).toString()}
              />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value: any, name: any) => [Math.round(value), name]}
              />
              <Legend />
              {showOffenseElo && (
                <Line
                  type="monotone"
                  dataKey={`${comparisonData.player1!.name}_offense`}
                  stroke="#3182CE"
                  name={`${comparisonData.player1!.name} (Offense)`}
                  strokeWidth={2}
                />
              )}
              {showDefenseElo && (
                <Line
                  type="monotone"
                  dataKey={`${comparisonData.player1!.name}_defense`}
                  stroke="#38A169"
                  name={`${comparisonData.player1!.name} (Defense)`}
                  strokeWidth={2}
                />
              )}
              {showOffenseElo && (
                <Line
                  type="monotone"
                  dataKey={`${comparisonData.player2!.name}_offense`}
                  stroke="#D69E2E"
                  name={`${comparisonData.player2!.name} (Offense)`}
                  strokeWidth={2}
                />
              )}
              {showDefenseElo && (
                <Line
                  type="monotone"
                  dataKey={`${comparisonData.player2!.name}_defense`}
                  stroke="#E53E3E"
                  name={`${comparisonData.player2!.name} (Defense)`}
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    );
  };

  const renderGoalsComparisonChart = () => {
    if (!comparisonData.player1 || !comparisonData.player2) return null;

    const player1Goals = comparisonData.player1.scored || 0;
    const player2Goals = comparisonData.player2.scored || 0;
    const totalGoals = player1Goals + player2Goals;

    if (totalGoals === 0) {
      return (
        <Card bg={cardBg}>
          <CardHeader>
            <Heading size="md" color={textColor}>Goals Comparison</Heading>
          </CardHeader>
          <CardBody>
            <Text textAlign="center" color="gray.500">No goals data available</Text>
          </CardBody>
        </Card>
      );
    }

    const data = [
      {
        name: comparisonData.player1.name,
        value: player1Goals,
        percentage: Math.round((player1Goals / totalGoals) * 100),
      },
      {
        name: comparisonData.player2.name,
        value: player2Goals,
        percentage: Math.round((player2Goals / totalGoals) * 100),
      },
    ];

    return (
      <Card bg={cardBg}>
        <CardHeader>
          <Heading size="md" color={textColor}>Goals Comparison</Heading>
          <Text fontSize="sm" color="gray.500">
            Total Goals: {totalGoals} | {comparisonData.player1.name}: {player1Goals} ({data[0].percentage}%) | {comparisonData.player2.name}: {player2Goals} ({data[1].percentage}%)
          </Text>
        </CardHeader>
        <CardBody>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, value, percentage }) => `${name}: ${value} (${percentage}%)`}
              >
                <Cell fill="#3182CE" />
                <Cell fill="#38A169" />
              </Pie>
              <Tooltip formatter={(value, name) => [`${value} goals`, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    );
  };

  const renderHeadToHeadSection = () => {
    if (!comparisonData.headToHeadMatches.length) {
      return (
        <Card bg={cardBg}>
          <CardHeader>
            <Heading size="md" color={textColor}>Head-to-Head & Team Performance</Heading>
          </CardHeader>
          <CardBody>
            <Text textAlign="center" color="gray.500">
              No matches found between these players
            </Text>
          </CardBody>
        </Card>
      );
    }

    // Separate matches by relationship
    const opponentMatches = comparisonData.headToHeadMatches.filter(match => !match.sameTeam);
    const teammateMatches = comparisonData.headToHeadMatches.filter(match => match.sameTeam);

    // Head-to-Head (Opponents) Stats - no draws possible in first-to-10
    const h2hPlayer1Wins = opponentMatches.filter(match => match.player1Result === 'Win').length;
    const h2hPlayer2Wins = opponentMatches.filter(match => match.player2Result === 'Win').length;

    // Team Performance Stats - count team wins/losses (no draws possible)
    const teamWins = teammateMatches.filter(match => match.player1Result === 'Win').length;
    const teamLosses = teammateMatches.filter(match => match.player1Result === 'Loss').length;

    return (
      <VStack spacing={6} align="stretch">
        {/* Head-to-Head (Opponents) Section */}
        {opponentMatches.length > 0 && (
          <Card bg={cardBg}>
            <CardHeader>
              <Heading size="md" color={textColor}>Head-to-Head (As Opponents)</Heading>
              <HStack spacing={4} mt={2}>
                <Stat size="sm">
                  <StatLabel>Total H2H</StatLabel>
                  <StatNumber>{opponentMatches.length}</StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>{comparisonData.player1!.name} Wins</StatLabel>
                  <StatNumber color="blue.500">{h2hPlayer1Wins}</StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>{comparisonData.player2!.name} Wins</StatLabel>
                  <StatNumber color="green.500">{h2hPlayer2Wins}</StatNumber>
                </Stat>
              </HStack>
            </CardHeader>
            <CardBody>
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Date</Th>
                    <Th textAlign="center">{comparisonData.player1!.name}</Th>
                    <Th textAlign="center">{comparisonData.player2!.name}</Th>
                    <Th textAlign="center">Final Score</Th>
                    <Th textAlign="center">Winner</Th>
                    <Th textAlign="center">ELO Change</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {opponentMatches.slice(0, 10).map((match, index) => (
                    <Tr key={index}>
                      <Td>{new Date(match.date).toLocaleDateString()}</Td>
                      <Td textAlign="center">
                        <VStack spacing={0}>
                          <Text
                            fontWeight={match.player1Result === 'Win' ? 'bold' : 'normal'}
                            color={match.player1Result === 'Win' ? 'green.500' : 'red.500'}
                          >
                            {match.player1Score}
                          </Text>
                          <Text fontSize="xs" color="gray.500">{match.player1Result}</Text>
                        </VStack>
                      </Td>
                      <Td textAlign="center">
                        <VStack spacing={0}>
                          <Text
                            fontWeight={match.player2Result === 'Win' ? 'bold' : 'normal'}
                            color={match.player2Result === 'Win' ? 'green.500' : 'red.500'}
                          >
                            {match.player2Score}
                          </Text>
                          <Text fontSize="xs" color="gray.500">{match.player2Result}</Text>
                        </VStack>
                      </Td>
                      <Td textAlign="center">
                        <Text fontSize="sm">
                          {match.teamWhiteScore} - {match.teamBlueScore}
                        </Text>
                      </Td>
                      <Td textAlign="center">
                        <Tag
                          size="sm"
                          colorScheme={match.player1Result === 'Win' ? 'blue' : 'green'}
                        >
                          {match.player1Result === 'Win' ? comparisonData.player1!.name : comparisonData.player2!.name}
                        </Tag>
                      </Td>
                      <Td textAlign="center">
                        <VStack spacing={0}>
                          <Text
                            fontSize="xs"
                            color={match.player1EloChange >= 0 ? 'green.500' : 'red.500'}
                          >
                            {match.player1EloChange >= 0 ? '+' : ''}{Math.round(match.player1EloChange)}
                          </Text>
                          <Text
                            fontSize="xs"
                            color={match.player2EloChange >= 0 ? 'green.500' : 'red.500'}
                          >
                            {match.player2EloChange >= 0 ? '+' : ''}{Math.round(match.player2EloChange)}
                          </Text>
                        </VStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              {opponentMatches.length > 10 && (
                <Text fontSize="sm" color="gray.500" mt={2} textAlign="center">
                  Showing latest 10 of {opponentMatches.length} opponent matches
                </Text>
              )}
            </CardBody>
          </Card>
        )}

        {/* Team Performance (Teammates) Section */}
        {teammateMatches.length > 0 && (
          <Card bg={cardBg}>
            <CardHeader>
              <Heading size="md" color={textColor}>Playing Together (As Teammates)</Heading>
              <HStack spacing={4} mt={2}>
                <Stat size="sm">
                  <StatLabel>Total Together</StatLabel>
                  <StatNumber>{teammateMatches.length}</StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Team Wins</StatLabel>
                  <StatNumber color="green.500">{teamWins}</StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Team Losses</StatLabel>
                  <StatNumber color="red.500">{teamLosses}</StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Win Rate</StatLabel>
                  <StatNumber color="blue.500">
                    {teammateMatches.length > 0 ? Math.round((teamWins / teammateMatches.length) * 100) : 0}%
                  </StatNumber>
                </Stat>
              </HStack>
            </CardHeader>
            <CardBody>
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Date</Th>
                    <Th textAlign="center">Team Score</Th>
                    <Th textAlign="center">Opponent Score</Th>
                    <Th textAlign="center">Result</Th>
                    <Th textAlign="center">{comparisonData.player1!.name} Goals</Th>
                    <Th textAlign="center">{comparisonData.player2!.name} Goals</Th>
                    <Th textAlign="center">ELO Change</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {teammateMatches.slice(0, 10).map((match, index) => (
                    <Tr key={index}>
                      <Td>{new Date(match.date).toLocaleDateString()}</Td>
                      <Td textAlign="center">
                        <Text
                          fontWeight="bold"
                          color={match.player1Result === 'Win' ? 'green.500' : 'red.500'}
                        >
                          {match.player1Score}
                        </Text>
                      </Td>
                      <Td textAlign="center">
                        <Text
                          fontWeight="bold"
                          color={match.player1Result === 'Win' ? 'red.500' : 'green.500'}
                        >
                          {match.player2Score}
                        </Text>
                      </Td>
                      <Td textAlign="center">
                        <Tag
                          size="sm"
                          colorScheme={match.player1Result === 'Win' ? 'green' : 'red'}
                        >
                          {match.player1Result === 'Win' ? 'Team Win' : 'Team Loss'}
                        </Tag>
                      </Td>
                      <Td textAlign="center">
                        <Text fontSize="sm">{match.player1Score}</Text>
                      </Td>
                      <Td textAlign="center">
                        <Text fontSize="sm">{match.player2Score}</Text>
                      </Td>
                      <Td textAlign="center">
                        <VStack spacing={0}>
                          <Text
                            fontSize="xs"
                            color={match.player1EloChange >= 0 ? 'green.500' : 'red.500'}
                          >
                            {match.player1EloChange >= 0 ? '+' : ''}{Math.round(match.player1EloChange)}
                          </Text>
                          <Text
                            fontSize="xs"
                            color={match.player2EloChange >= 0 ? 'green.500' : 'red.500'}
                          >
                            {match.player2EloChange >= 0 ? '+' : ''}{Math.round(match.player2EloChange)}
                          </Text>
                        </VStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              {teammateMatches.length > 10 && (
                <Text fontSize="sm" color="gray.500" mt={2} textAlign="center">
                  Showing latest 10 of {teammateMatches.length} teammate matches
                </Text>
              )}
            </CardBody>
          </Card>
        )}

        {/* No Data Message */}
        {opponentMatches.length === 0 && teammateMatches.length === 0 && (
          <Card bg={cardBg}>
            <CardBody>
              <Text textAlign="center" color="gray.500">
                No head-to-head or teammate matches found between these players
              </Text>
            </CardBody>
          </Card>
        )}
      </VStack>
    );
  };

  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        <Heading size="lg" color={'white'} textAlign="center">
          Player Comparison
        </Heading>

        {/* Player Selection */}
        <Card bg={cardBg}>
          <CardHeader>
            <Heading size="md" color={textColor}>Select Players to Compare</Heading>
          </CardHeader>
          <CardBody>
            <Grid templateColumns="repeat(3, 1fr)" gap={4} alignItems="end">
              <Box>
                <Text mb={2} color={textColor}>Player 1</Text>
                <Select
                  placeholder="Select first player"
                  value={selectedPlayer1Id}
                  onChange={(e) => setSelectedPlayer1Id(e.target.value)}
                >
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </Select>
              </Box>
              <Box>
                <Text mb={2} color={textColor}>Player 2</Text>
                <Select
                  placeholder="Select second player"
                  value={selectedPlayer2Id}
                  onChange={(e) => setSelectedPlayer2Id(e.target.value)}
                >
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </Select>
              </Box>
              <Button
                colorScheme="blue"
                onClick={handleCompare}
                isLoading={loading}
                loadingText="Comparing..."
                isDisabled={!selectedPlayer1Id || !selectedPlayer2Id}
              >
                Compare Players
              </Button>
            </Grid>
          </CardBody>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert status="error">
            <AlertIcon />
            <AlertTitle>Error!</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading Spinner */}
        {loading && (
          <Flex justify="center" p={8}>
            <Spinner size="xl" color="blue.500" />
          </Flex>
        )}

        {/* Comparison Results */}
        {comparisonData.player1 && comparisonData.player2 && !loading && (
          <VStack spacing={6} align="stretch">
            {/* Player Cards */}
            <Grid templateColumns="repeat(2, 1fr)" gap={6}>
              <GridItem>
                {renderPlayerCard(comparisonData.player1, 1)}
              </GridItem>
              <GridItem>
                {renderPlayerCard(comparisonData.player2, 2)}
              </GridItem>
            </Grid>

            {/* Charts Grid */}
            <Grid templateColumns="repeat(2, 1fr)" gap={6}>
              <GridItem>
                {renderEloComparisonChart()}
              </GridItem>
              <GridItem>
                {renderWinLossChart()}
              </GridItem>
              <GridItem>
                {renderGoalsComparisonChart()}
              </GridItem>
              <GridItem>
                {renderStatsRadarChart()}
              </GridItem>
            </Grid>

            {/* Full Width Charts */}
            <Grid templateColumns="1fr" gap={6}>
              <GridItem>
                {renderEloHistoryChart()}
              </GridItem>
              <GridItem>
                {renderHeadToHeadSection()}
              </GridItem>
            </Grid>
          </VStack>
        )}
      </VStack>
    </Box>
  );
};
