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
  HStack,
  VStack,
  Alert,
  AlertIcon,
  Spinner,
  Card,
  CardHeader,
  CardBody,
  Tag
} from "@chakra-ui/react";
import { getUsers, getMatchHistoryBetweenTeams } from "../lib/supabase";
import type { User } from "../lib/supabase";

const DEFAULT_DISPLAY_ELO = 1400; // For display if ELO is null
const WHITE_COLOR_ELO_ADVANTAGE = 25; // Hypothetical ELO advantage for White team

// Calculate the win probability based on team ratings (ELO)
const calculateWinProbability = (team1Rating: number, team2Rating: number): number => {
  return 1 / (1 + Math.pow(10, (team2Rating - team1Rating) / 400));
};

// Calculate combined team strength using position-specific ELO
const calculateTeamStrength = (defenseElo: number, offenseElo: number): number => {
  return (defenseElo + offenseElo) / 2;
};

// Helper to predict a 10-point score based on win probability
const predictScore = (winProbabilityTeam1: number) => {
  let team1Score: number;
  let team2Score: number;

  if (Math.abs(winProbabilityTeam1 - 0.5) < 0.01) { // Corresponds to 49-51% win prob
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

interface TeamPredictionScenario {
  team1Probability: number;
  team2Probability: number;
  team1EffectiveRating: number;
  team2EffectiveRating: number;
  predictedScore: { team1: number; team2: number };
}

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

  const [baseTeam1Rating, setBaseTeam1Rating] = useState<number | null>(null);
  const [baseTeam2Rating, setBaseTeam2Rating] = useState<number | null>(null);
  const [eloDifference, setEloDifference] = useState<number | null>(null);
  
  const [scenarioTeam1White, setScenarioTeam1White] = useState<TeamPredictionScenario | null>(null);
  const [scenarioTeam2White, setScenarioTeam2White] = useState<TeamPredictionScenario | null>(null);

  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [loadingRecentMatches, setLoadingRecentMatches] = useState(false);

  useEffect(() => {
    async function loadUsers() {
      try {
        const fetchedUsers = await getUsers();
        setUsers(fetchedUsers);
      } catch (err) {
        console.error("Error loading users:", err);
        setError("Could not load users from database");
      } finally {
        setLoading(false);
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
      const t1d = users.find(u => u.id.toString() === selectedPlayers.team1Defense);
      const t1o = users.find(u => u.id.toString() === selectedPlayers.team1Offense);
      const t2d = users.find(u => u.id.toString() === selectedPlayers.team2Defense);
      const t2o = users.find(u => u.id.toString() === selectedPlayers.team2Offense);

      if (!t1d || !t1o || !t2d || !t2o) return;

      const t1DefElo = t1d.elo_defense || DEFAULT_DISPLAY_ELO;
      const t1OffElo = t1o.elo_offense || DEFAULT_DISPLAY_ELO;
      const t2DefElo = t2d.elo_defense || DEFAULT_DISPLAY_ELO;
      const t2OffElo = t2o.elo_offense || DEFAULT_DISPLAY_ELO;

      const team1Base = calculateTeamStrength(t1DefElo, t1OffElo);
      const team2Base = calculateTeamStrength(t2DefElo, t2OffElo);
      
      setBaseTeam1Rating(Math.round(team1Base));
      setBaseTeam2Rating(Math.round(team2Base));
      setEloDifference(Math.round(team1Base - team2Base));

      // Scenario 1: Team 1 is White
      const t1EffEloS1 = team1Base + WHITE_COLOR_ELO_ADVANTAGE;
      const t2EffEloS1 = team2Base;
      const t1ProbS1 = calculateWinProbability(t1EffEloS1, t2EffEloS1);
      setScenarioTeam1White({
        team1Probability: Math.round(t1ProbS1 * 100),
        team2Probability: Math.round((1 - t1ProbS1) * 100),
        team1EffectiveRating: Math.round(t1EffEloS1),
        team2EffectiveRating: Math.round(t2EffEloS1),
        predictedScore: predictScore(t1ProbS1)
      });

      // Scenario 2: Team 2 is White (Team 1 is Blue)
      const t1EffEloS2 = team1Base;
      const t2EffEloS2 = team2Base + WHITE_COLOR_ELO_ADVANTAGE;
      const t1ProbS2 = calculateWinProbability(t1EffEloS2, t2EffEloS2);
      setScenarioTeam2White({
        team1Probability: Math.round(t1ProbS2 * 100),
        team2Probability: Math.round((1 - t1ProbS2) * 100),
        team1EffectiveRating: Math.round(t1EffEloS2),
        team2EffectiveRating: Math.round(t2EffEloS2),
        predictedScore: predictScore(t1ProbS2)
      });

      // Fetch recent matches
      const fetchRecentMatches = async () => {
        setLoadingRecentMatches(true);
        try {
          const history = await getMatchHistoryBetweenTeams(
            t1d.id, t1o.id, // Assuming t1d and t1o form team 1
            t2d.id, t2o.id  // Assuming t2d and t2o form team 2
          );
          setRecentMatches(history);
        } catch (err) {
          console.error("Error fetching recent matches:", err);
          // Optionally set an error state for recent matches
        } finally {
          setLoadingRecentMatches(false);
        }
      };
      fetchRecentMatches();

    } else {
      // Reset if not all players selected
      setBaseTeam1Rating(null);
      setBaseTeam2Rating(null);
      setEloDifference(null);
      setScenarioTeam1White(null);
      setScenarioTeam2White(null);
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
  
  const renderPlayerSelect = (team: string, role: string) => {
    const value = selectedPlayers[`${team}${role}` as keyof typeof selectedPlayers];
    return (
      <FormControl mb={3}>
        <FormLabel>{role} Player</FormLabel>
        <Select
          name={`${team}${role}`}
          value={value}
          onChange={handleChange}
          placeholder="Select player"
          isDisabled={loading}
        >
          {users.map(user => (
            <option key={`${team}${role}-${user.id}`} value={user.id.toString()}>
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
      <Box borderWidth="1px" borderRadius="md" p={3} mb={2}>
        <Text fontWeight="bold">{player.name} ({role})</Text>
        <Text fontSize="sm">Defense ELO: {player.elo_defense}</Text>
        <Text fontSize="sm">Offense ELO: {player.elo_offense}</Text>
      </Box>
    );
  };

  const renderPredictionScenario = (scenario: TeamPredictionScenario | null, team1Name: string, team2Name: string, scenarioTitle: string) => {
    if (!scenario) return null;
    return (
      <Box mb={6} p={4} borderWidth="1px" borderRadius="lg" shadow="sm">
        <Heading size="md" mb={3}>{scenarioTitle}</Heading>
        <Flex justify="space-around" mb={3}>
          <Stat textAlign="center">
            <StatLabel>{team1Name}</StatLabel>
            <StatNumber color="blue.500">{scenario.team1Probability}%</StatNumber>
            <StatHelpText>Effective ELO: {scenario.team1EffectiveRating}</StatHelpText>
          </Stat>
          <Stat textAlign="center">
            <StatLabel>{team2Name}</StatLabel>
            <StatNumber color="orange.500">{scenario.team2Probability}%</StatNumber>
            <StatHelpText>Effective ELO: {scenario.team2EffectiveRating}</StatHelpText>
          </Stat>
        </Flex>
        <Text textAlign="center" fontWeight="bold" fontSize="lg">
          Predicted Score: {scenario.predictedScore.team1} - {scenario.predictedScore.team2}
        </Text>
      </Box>
    );
  };

  const team1Ready = selectedPlayers.team1Defense && selectedPlayers.team1Offense;
  const team2Ready = selectedPlayers.team2Defense && selectedPlayers.team2Offense;
  const allPlayersSelected = team1Ready && team2Ready;

  const t1dName = getPlayerDetails(selectedPlayers.team1Defense)?.name || "TBD";
  const t1oName = getPlayerDetails(selectedPlayers.team1Offense)?.name || "TBD";
  const t2dName = getPlayerDetails(selectedPlayers.team2Defense)?.name || "TBD";
  const t2oName = getPlayerDetails(selectedPlayers.team2Offense)?.name || "TBD";
  
  const team1DisplayName = team1Ready ? `${t1dName} & ${t1oName}` : "Team 1";
  const team2DisplayName = team2Ready ? `${t2dName} & ${t2oName}` : "Team 2";

  return (
    <Box maxWidth="1000px" mx="auto" p={6} borderRadius="lg" boxShadow="xl" bg="gray.50">
      <Heading as="h2" size="xl" mb={6} textAlign="center" color="teal.600">Match Outcome Predictor</Heading>
      
      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          <Text>{error}</Text>
        </Alert>
      )}
      
      {loading && (
        <Flex justify="center" py={10}><Spinner size="xl" color="teal.500" /></Flex>
      )}

      {!loading && (
        <>
          <Heading as="h3" size="lg" mb={4} color="gray.700">Team Configuration</Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={8}>
            <Card variant="outline">
              <CardHeader pb={2}><Heading size="md" textAlign="center" color="blue.600">Team 1</Heading></CardHeader>
              <CardBody pt={2}>
                {renderPlayerSelect('team1', 'Defense')}
                {renderPlayerSelect('team1', 'Offense')}
              </CardBody>
            </Card>
            <Card variant="outline">
              <CardHeader pb={2}><Heading size="md" textAlign="center" color="orange.600">Team 2</Heading></CardHeader>
              <CardBody pt={2}>
                {renderPlayerSelect('team2', 'Defense')}
                {renderPlayerSelect('team2', 'Offense')}
              </CardBody>
            </Card>
          </SimpleGrid>

          {allPlayersSelected && (
            <>
              <Divider my={8} borderColor="gray.300"/>
              <Heading as="h3" size="lg" mb={6} textAlign="center" color="gray.700">Prediction Analysis</Heading>

              <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} mb={6}>
                <Card variant="outline">
                  <CardHeader><Heading size="md" color="blue.700">{team1DisplayName}</Heading></CardHeader>
                  <CardBody>
                    {renderPlayerCard(selectedPlayers.team1Defense, "Defense")}
                    {renderPlayerCard(selectedPlayers.team1Offense, "Offense")}
                    <Text mt={2} fontWeight="bold">Base Team ELO: <Tag colorScheme="blue">{baseTeam1Rating}</Tag></Text>
                  </CardBody>
                </Card>
                <Card variant="outline">
                  <CardHeader><Heading size="md" color="orange.700">{team2DisplayName}</Heading></CardHeader>
                  <CardBody>
                    {renderPlayerCard(selectedPlayers.team2Defense, "Defense")}
                    {renderPlayerCard(selectedPlayers.team2Offense, "Offense")}
                    <Text mt={2} fontWeight="bold">Base Team ELO: <Tag colorScheme="orange">{baseTeam2Rating}</Tag></Text>
                  </CardBody>
                </Card>
              </SimpleGrid>
              
              {eloDifference !== null && (
                <Text textAlign="center" fontSize="lg" fontWeight="semibold" mb={6}>
                  Base ELO Difference (Team 1 - Team 2): 
                  <Tag ml={2} colorScheme={eloDifference > 0 ? "green" : eloDifference < 0 ? "red" : "gray"} size="lg">
                    {eloDifference > 0 ? `+${eloDifference}` : eloDifference}
                  </Tag>
                </Text>
              )}

              {renderPredictionScenario(scenarioTeam1White, team1DisplayName, team2DisplayName, `Scenario: ${team1DisplayName} (White) vs ${team2DisplayName} (Blue)`)}
              {renderPredictionScenario(scenarioTeam2White, team1DisplayName, team2DisplayName, `Scenario: ${team1DisplayName} (Blue) vs ${team2DisplayName} (White)`)}

              <Divider my={8} borderColor="gray.300"/>
              <Heading as="h4" size="md" mb={4}>Recent Head-to-Head Encounters</Heading>
              {loadingRecentMatches ? (
                <Flex justify="center"><Spinner color="teal.500" /></Flex>
              ) : recentMatches.length > 0 ? (
                <Table variant="simple" size="sm">
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
                <Text>No recent direct encounters found between these exact teams.</Text>
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
}; 