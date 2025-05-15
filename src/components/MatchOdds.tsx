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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Divider,
  Flex,
  VStack,
  Alert,
  AlertIcon,
  Spinner,
  Card,
  CardHeader,
  CardBody,
  Tag,
  StackDivider,
  useColorModeValue
} from "@chakra-ui/react";
import { getUsers, getMatchHistoryBetweenTeams, getHistoricalMatchupStatsByColor } from "../lib/supabase";
import type { User, HistoricalMatchupStats } from "../lib/supabase";

const DEFAULT_DISPLAY_ELO = 1400;

const calculateWinProbability = (team1Rating: number, team2Rating: number): number => {
  return 1 / (1 + Math.pow(10, (team2Rating - team1Rating) / 400));
};

const calculateTeamStrength = (defenseElo: number, offenseElo: number): number => {
  return (defenseElo + offenseElo) / 2;
};

const predictScore = (winProbabilityTeam1: number) => {
  let team1Score: number;
  let team2Score: number;

  if (Math.abs(winProbabilityTeam1 - 0.5) < 0.01) { 
    team1Score = 10;
    team2Score = 9;
  } else if (winProbabilityTeam1 > 0.5) {
    team1Score = 10;
    const loserScore = Math.round(10 * (1 - winProbabilityTeam1) / winProbabilityTeam1);
    team2Score = Math.max(0, Math.min(9, loserScore));
  } else {
    team2Score = 10;
    const loserScore = Math.round(10 * winProbabilityTeam1 / (1 - winProbabilityTeam1));
    team1Score = Math.max(0, Math.min(9, loserScore));
  }
  return { team1: team1Score, team2: team2Score };
};

interface PlayerDetails {
  id: string;
  name: string;
  elo_offense: number;
  elo_defense: number;
}

interface EloPredictionScenario {
  team1Name: string;
  team2Name: string;
  team1BaseElo: number;
  team2BaseElo: number;
  team1Probability: number;
  team2Probability: number;
  predictedScore: { team1: number; team2: number };
}

interface HistoricalPredictionScenario {
  scenarioTitle: string;
  teamName: string; // e.g., Team A (Selected Team 1)
  opponentName: string; // e.g., Team B (Selected Team 2)
  historicalWins: number;
  historicalLosses: number;
  historicalDraws: number;
  totalPlayed: number;
  winProbability: number; // Based on historical data
  predictedScore: { team1: number; team2: number };
}

export const MatchOdds = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState({
    team1Defense: '',
    team1Offense: '',
    team2Defense: '',
    team2Offense: ''
  });

  const [eloPrediction, setEloPrediction] = useState<EloPredictionScenario | null>(null);
  const [historicalPredictions, setHistoricalPredictions] = useState<HistoricalPredictionScenario[]>([]);
  
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);

  const cardBg = useColorModeValue("white", "gray.750");
  const headingColor = useColorModeValue("gray.700", "whiteAlpha.900");

  useEffect(() => {
    async function loadUsers() {
      try {
        const fetchedUsers = await getUsers();
        setUsers(fetchedUsers);
      } catch (err) {
        console.error("Error loading users:", err);
        setError("Could not load users from database");
      } finally {
        setLoadingUsers(false);
      }
    }
    loadUsers();
  }, []);

  useEffect(() => {
    const allPlayersSelected = selectedPlayers.team1Defense &&
                               selectedPlayers.team1Offense &&
                               selectedPlayers.team2Defense &&
                               selectedPlayers.team2Offense;

    if (allPlayersSelected) {
      const t1dUser = users.find(u => u.id.toString() === selectedPlayers.team1Defense);
      const t1oUser = users.find(u => u.id.toString() === selectedPlayers.team1Offense);
      const t2dUser = users.find(u => u.id.toString() === selectedPlayers.team2Defense);
      const t2oUser = users.find(u => u.id.toString() === selectedPlayers.team2Offense);

      if (!t1dUser || !t1oUser || !t2dUser || !t2oUser) return;

      const calculateAndSetPredictions = async () => {
        setLoadingPredictions(true);
        setError(null);
        setEloPrediction(null);
        setHistoricalPredictions([]);
        setRecentMatches([]);

        try {
          // ELO Based Prediction
          const t1DefElo = t1dUser.elo_defense || DEFAULT_DISPLAY_ELO;
          const t1OffElo = t1oUser.elo_offense || DEFAULT_DISPLAY_ELO;
          const t2DefElo = t2dUser.elo_defense || DEFAULT_DISPLAY_ELO;
          const t2OffElo = t2oUser.elo_offense || DEFAULT_DISPLAY_ELO;

          const team1Base = calculateTeamStrength(t1DefElo, t1OffElo);
          const team2Base = calculateTeamStrength(t2DefElo, t2OffElo);
          const team1ProbElo = calculateWinProbability(team1Base, team2Base);

          setEloPrediction({
            team1Name: `${t1dUser.name} & ${t1oUser.name}`,
            team2Name: `${t2dUser.name} & ${t2oUser.name}`,
            team1BaseElo: Math.round(team1Base),
            team2BaseElo: Math.round(team2Base),
            team1Probability: Math.round(team1ProbElo * 100),
            team2Probability: Math.round((1 - team1ProbElo) * 100),
            predictedScore: predictScore(team1ProbElo)
          });

          // Historical Predictions
          const historicalStats = await getHistoricalMatchupStatsByColor(
            t1dUser.id, t1oUser.id, 
            t2dUser.id, t2oUser.id
          );

          const newHistoricalPredictions: HistoricalPredictionScenario[] = [];
          
          // Scenario: Team 1 as White
          const { wins: t1AsWhiteWins, losses: t1AsWhiteLosses, draws: t1AsWhiteDraws, total_played: t1AsWhiteTotal } = historicalStats.teamA_as_white;
          let t1AsWhiteWinProb = 0.5; // Default to 0.5 if no historical data
          if (t1AsWhiteTotal > 0) {
            t1AsWhiteWinProb = (t1AsWhiteWins + 0.5 * t1AsWhiteDraws) / t1AsWhiteTotal; // Consider draws as half win
          }
          newHistoricalPredictions.push({
            scenarioTitle: `Team 1 (White) vs Team 2 (Blue) - Historical`,
            teamName: `${t1dUser.name} & ${t1oUser.name}`,
            opponentName: `${t2dUser.name} & ${t2oUser.name}`,
            historicalWins: t1AsWhiteWins,
            historicalLosses: t1AsWhiteLosses,
            historicalDraws: t1AsWhiteDraws,
            totalPlayed: t1AsWhiteTotal,
            winProbability: Math.round(t1AsWhiteWinProb * 100),
            predictedScore: predictScore(t1AsWhiteWinProb)
          });

          // Scenario: Team 1 as Blue
          const { wins: t1AsBlueWins, losses: t1AsBlueLosses, draws: t1AsBlueDraws, total_played: t1AsBlueTotal } = historicalStats.teamA_as_blue;
          let t1AsBlueWinProb = 0.5;
          if (t1AsBlueTotal > 0) {
            t1AsBlueWinProb = (t1AsBlueWins + 0.5 * t1AsBlueDraws) / t1AsBlueTotal;
          }
          newHistoricalPredictions.push({
            scenarioTitle: `Team 1 (Blue) vs Team 2 (White) - Historical`,
            teamName: `${t1dUser.name} & ${t1oUser.name}`,
            opponentName: `${t2dUser.name} & ${t2oUser.name}`,
            historicalWins: t1AsBlueWins,
            historicalLosses: t1AsBlueLosses,
            historicalDraws: t1AsBlueDraws,
            totalPlayed: t1AsBlueTotal,
            winProbability: Math.round(t1AsBlueWinProb * 100),
            predictedScore: predictScore(t1AsBlueWinProb)
          });
          setHistoricalPredictions(newHistoricalPredictions);

          // Fetch recent matches (overall, not color specific for this display part)
          const history = await getMatchHistoryBetweenTeams(
            t1dUser.id, t1oUser.id, 
            t2dUser.id, t2oUser.id,
            5 // limit to 5 recent matches
          );
          setRecentMatches(history);

        } catch (err) {
          console.error("Error calculating predictions:", err);
          setError("Could not calculate predictions.");
        } finally {
          setLoadingPredictions(false);
        }
      };
      calculateAndSetPredictions();

    } else {
      setEloPrediction(null);
      setHistoricalPredictions([]);
      setRecentMatches([]);
    }
  }, [selectedPlayers, users]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSelectedPlayers(prev => ({ ...prev, [name]: value }));
  };

  const getPlayerDetails = (id: string): PlayerDetails | null => {
    if (!id) return null;
    const player = users.find(user => user.id.toString() === id);
    return player ? {
      id: player.id.toString(),
      name: player.name,
      elo_offense: player.elo_offense || DEFAULT_DISPLAY_ELO,
      elo_defense: player.elo_defense || DEFAULT_DISPLAY_ELO
    } : null;
  };
  
  const renderPlayerSelect = (teamKey: 'team1' | 'team2', role: 'Defense' | 'Offense') => {
    const selectName = `${teamKey}${role}` as keyof typeof selectedPlayers;
    const value = selectedPlayers[selectName];
    return (
      <FormControl mb={3}>
        <FormLabel htmlFor={selectName}>{role} Player</FormLabel>
        <Select
          id={selectName}
          name={selectName}
          value={value}
          onChange={handleChange}
          placeholder="Select player"
          isDisabled={loadingUsers}
        >
          {users.map(user => (
            <option key={`${selectName}-${user.id}`} value={user.id.toString()}>
              {user.name} (D:{user.elo_defense || DEFAULT_DISPLAY_ELO}, O:{user.elo_offense || DEFAULT_DISPLAY_ELO})
            </option>
          ))}
        </Select>
      </FormControl>
    );
  };

  const renderPlayerCard = (playerId: string | null, role: string) => {
    if (!playerId) return <Text>No {role.toLowerCase()} player selected.</Text>;
    const player = getPlayerDetails(playerId);
    if (!player) return <Text>Player not found.</Text>;
    return (
      <Box borderWidth="1px" borderRadius="md" p={3} mb={2} bg={useColorModeValue("gray.50", "gray.800")}>
        <Text fontWeight="bold">{player.name} ({role})</Text>
        <Text fontSize="sm">Defense ELO: {player.elo_defense}</Text>
        <Text fontSize="sm">Offense ELO: {player.elo_offense}</Text>
      </Box>
    );
  };

  const renderEloPrediction = (prediction: EloPredictionScenario | null) => {
    if (!prediction) return null;
    return (
      <Card bg={cardBg} shadow="md" variant="outline" mb={6}>
        <CardHeader><Heading size="md" color={headingColor}>ELO Based Prediction (Overall)</Heading></CardHeader>
        <CardBody>
          <Flex justify="space-around" mb={4} direction={{base: "column", md: "row"}}>
            <Stat textAlign="center" p={2}>
              <StatLabel>{prediction.team1Name}</StatLabel>
              <StatNumber color="blue.500">{prediction.team1Probability}%</StatNumber>
              <StatHelpText>Team ELO: {prediction.team1BaseElo}</StatHelpText>
            </Stat>
            <Stat textAlign="center" p={2}>
              <StatLabel>{prediction.team2Name}</StatLabel>
              <StatNumber color="orange.500">{prediction.team2Probability}%</StatNumber>
              <StatHelpText>Team ELO: {prediction.team2BaseElo}</StatHelpText>
            </Stat>
          </Flex>
          <Text textAlign="center" fontWeight="bold" fontSize="lg">
            Predicted Score: {prediction.predictedScore.team1} - {prediction.predictedScore.team2}
          </Text>
        </CardBody>
      </Card>
    );
  };

  const renderHistoricalPrediction = (prediction: HistoricalPredictionScenario) => {
    return (
      <Card key={prediction.scenarioTitle} bg={cardBg} shadow="md" variant="outline" mb={6}>
        <CardHeader><Heading size="md" color={headingColor}>{prediction.scenarioTitle}</Heading></CardHeader>
        <CardBody>
          <Text fontSize="sm" mb={1}>Record: {prediction.historicalWins}W - {prediction.historicalLosses}L - {prediction.historicalDraws}D (Total: {prediction.totalPlayed})</Text>
          <Flex justify="space-around" mb={4} direction={{base: "column", md: "row"}}>
             <Stat textAlign="center" p={2}>
              <StatLabel>{prediction.teamName}</StatLabel>
              <StatNumber color="blue.500">{prediction.winProbability}%</StatNumber>
              <StatHelpText>Win Chance</StatHelpText>
            </Stat>
            <Stat textAlign="center" p={2}>
              <StatLabel>{prediction.opponentName}</StatLabel>
              <StatNumber color="orange.500">{100 - prediction.winProbability}%</StatNumber>
              <StatHelpText>Win Chance</StatHelpText>
            </Stat>
          </Flex>
          <Text textAlign="center" fontWeight="bold" fontSize="lg">
            Predicted Score: {prediction.predictedScore.team1} - {prediction.predictedScore.team2}
          </Text>
           {prediction.totalPlayed === 0 && <Text textAlign="center" fontSize="sm" color="gray.500" mt={2}>No historical matches found for this specific color configuration.</Text>}
        </CardBody>
      </Card>
    );
  };

  const allPlayersSelected = selectedPlayers.team1Defense && selectedPlayers.team1Offense && selectedPlayers.team2Defense && selectedPlayers.team2Offense;
  const team1DefPlayer = getPlayerDetails(selectedPlayers.team1Defense);
  const team1OffPlayer = getPlayerDetails(selectedPlayers.team1Offense);
  const team2DefPlayer = getPlayerDetails(selectedPlayers.team2Defense);
  const team2OffPlayer = getPlayerDetails(selectedPlayers.team2Offense);

  const team1DisplayName = team1DefPlayer && team1OffPlayer ? `${team1DefPlayer.name} & ${team1OffPlayer.name}` : "Team 1";
  const team2DisplayName = team2DefPlayer && team2OffPlayer ? `${team2DefPlayer.name} & ${team2OffPlayer.name}` : "Team 2";


  return (
    <Box maxWidth="1000px" mx="auto" p={6} >
      <Heading as="h2" size="xl" mb={6} textAlign="center" color={headingColor}>Match Predictor</Heading>
      
      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          <Text>{error}</Text>
        </Alert>
      )}
      
      {loadingUsers && (
        <Flex justify="center" py={10}><Spinner size="xl" color="teal.500" /></Flex>
      )}

      {!loadingUsers && (
        <>
          <Heading as="h3" size="lg" mb={4} color={headingColor} textAlign="center">Configure Teams</Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={8}>
            <Card bg={cardBg} variant="outline">
              <CardHeader pb={2}><Heading size="md" textAlign="center" color="blue.500">Team 1</Heading></CardHeader>
              <CardBody pt={2}>
                {renderPlayerSelect('team1', 'Defense')}
                {renderPlayerSelect('team1', 'Offense')}
              </CardBody>
            </Card>
            <Card bg={cardBg} variant="outline">
              <CardHeader pb={2}><Heading size="md" textAlign="center" color="orange.500">Team 2</Heading></CardHeader>
              <CardBody pt={2}>
                {renderPlayerSelect('team2', 'Defense')}
                {renderPlayerSelect('team2', 'Offense')}
              </CardBody>
            </Card>
          </SimpleGrid>

          {allPlayersSelected && (
            <VStack spacing={8} divider={<StackDivider borderColor={useColorModeValue("gray.200", "gray.600")} />}>
              <Box w="100%">
                <Heading as="h3" size="lg" mb={6} textAlign="center" color={headingColor}>Player Details</Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
                  <Card bg={cardBg} variant="outline">
                    <CardHeader><Heading size="md" color="blue.500">{team1DisplayName}</Heading></CardHeader>
                    <CardBody>
                      {renderPlayerCard(selectedPlayers.team1Defense, "Defense")}
                      {renderPlayerCard(selectedPlayers.team1Offense, "Offense")}
                      {eloPrediction && <Text mt={2} fontWeight="bold">Base Team ELO: <Tag colorScheme="blue">{eloPrediction.team1BaseElo}</Tag></Text>}
                    </CardBody>
                  </Card>
                  <Card bg={cardBg} variant="outline">
                    <CardHeader><Heading size="md" color="orange.500">{team2DisplayName}</Heading></CardHeader>
                    <CardBody>
                      {renderPlayerCard(selectedPlayers.team2Defense, "Defense")}
                      {renderPlayerCard(selectedPlayers.team2Offense, "Offense")}
                      {eloPrediction && <Text mt={2} fontWeight="bold">Base Team ELO: <Tag colorScheme="orange">{eloPrediction.team2BaseElo}</Tag></Text>}
                    </CardBody>
                  </Card>
                </SimpleGrid>
              </Box>

              {loadingPredictions ? (
                <Flex justify="center" py={10}><Spinner size="xl" color="teal.500" /></Flex>
              ) : (
                <Box w="100%">
                  <Heading as="h3" size="lg" mb={6} textAlign="center" color={headingColor}>Predictions</Heading>
                  {renderEloPrediction(eloPrediction)}
                  {historicalPredictions.map(renderHistoricalPrediction)}
                </Box>
              )}

              <Box w="100%">
                <Heading as="h4" size="md" mb={4} color={headingColor}>Recent Head-to-Head (Overall)</Heading>
                {loadingPredictions ? (
                  <Flex justify="center"><Spinner color="teal.500" /></Flex>
                ) : recentMatches.length > 0 ? (
                  <Table variant="simple" size="sm" bg={cardBg}>
                    <Thead>
                      <Tr>
                        <Th>Date</Th>
                        <Th textAlign="center">{team1DisplayName}</Th>
                        <Th textAlign="center">{team2DisplayName}</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {recentMatches.map((match, index) => (
                        <Tr key={index}>
                          <Td>{new Date(match.date).toLocaleDateString()}</Td>
                          <Td textAlign="center" fontWeight={match.team1Score > match.team2Score ? "bold" : "normal"} color={match.team1Score > match.team2Score ? "green.500" : "inherit"}>{match.team1Score}</Td>
                          <Td textAlign="center" fontWeight={match.team2Score > match.team1Score ? "bold" : "normal"} color={match.team2Score > match.team1Score ? "green.500" : "inherit"}>{match.team2Score}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                ) : (
                  !loadingPredictions && <Text>No recent direct encounters found between these exact teams.</Text>
                )}
              </Box>
            </VStack>
          )}
        </>
      )}
    </Box>
  );
}; 