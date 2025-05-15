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
  AlertIcon,
  useColorModeValue
} from "@chakra-ui/react";
import { getUsers, getHistoricalMatchupStatsByColor } from "../lib/supabase";
import type { User } from "../lib/supabase";

// Extended player interface with skill ratings
interface PlayerWithSkills extends User {
  defenseSkill: number;
  offenseSkill: number;
}

// Generate the best team combinations for balanced gameplay
const generateBalancedTeams = (selectedPlayers: PlayerWithSkills[]) => {
  if (selectedPlayers.length !== 4) {
    return null;
  }

  // Calculate team rating using player skills
  const calculateTeamRating = (players: PlayerWithSkills[]) => {
    const team = assignRoles(players);
    return (team.defense.defenseSkill * 4 + team.offense.offenseSkill * 6) / 10;
  };

  // All possible team combinations (6 possible combinations with 4 players)
  const combinations = [
    [0, 1, 2, 3], // team 1: players 0,1; team 2: players 2,3
    [0, 2, 1, 3], // team 1: players 0,2; team 2: players 1,3
    [0, 3, 1, 2], // team 1: players 0,3; team 2: players 1,2
  ];

  let bestCombination = null;
  let smallestRatingDifference = Infinity;

  // Find the most balanced team combination
  for (const [p1, p2, p3, p4] of combinations) {
    const team1 = [selectedPlayers[p1], selectedPlayers[p2]];
    const team2 = [selectedPlayers[p3], selectedPlayers[p4]];

    const team1Rating = calculateTeamRating(team1);
    const team2Rating = calculateTeamRating(team2);
    const ratingDifference = Math.abs(team1Rating - team2Rating);

    if (ratingDifference < smallestRatingDifference) {
      smallestRatingDifference = ratingDifference;
      bestCombination = {
        team1: team1,
        team2: team2,
        team1Roles: assignRoles(team1),
        team2Roles: assignRoles(team2),
        team1Rating: team1Rating,
        team2Rating: team2Rating,
        ratingDifference: ratingDifference
      };
    }
  }

  return bestCombination;
};

// Calculate player skill metrics based on their stats
const calculatePlayerSkills = (player: User): PlayerWithSkills => {
  // Use played games to adjust skill weighting
  const gamesPlayed = player.played || 0;
  const experienceFactor = Math.min(gamesPlayed / 10, 1); // Max experience factor is 1

  // Use the actual ELO values directly
  const defenseElo = player.elo_defense || 1400;
  const offenseElo = player.elo_offense || 1400;
  
  // Scale ELO to 1-10 skill range
  // Assuming 1300-1700 as the typical ELO range, map to 1-10
  const defenseSkill = Math.max(1, Math.min(10, (defenseElo - 1300) / 400 * 9 + 1));
  const offenseSkill = Math.max(1, Math.min(10, (offenseElo - 1300) / 400 * 9 + 1));

  return {
    ...player,
    defenseSkill: Math.round(defenseSkill * 10) / 10, // Round to 1 decimal place
    offenseSkill: Math.round(offenseSkill * 10) / 10  // Round to 1 decimal place
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

// Calculate team strength using a combination of offense and defense ELO ratings
// This will be used for ELO-based PREDICTIONS. Ensure it's consistent with MatchOdds.tsx
const calculateTeamStrengthForPrediction = (defenderElo: number, attackerElo: number): number => {
  return (defenderElo + attackerElo) / 2;
};

// Helper functions for win probability and score prediction (can be imported or redefined if not already)
// For brevity, assuming they are available or will be added, similar to MatchOdds.tsx
const calculateWinProbability = (team1Rating: number, team2Rating: number): number => {
  return 1 / (1 + Math.pow(10, (team2Rating - team1Rating) / 400));
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

// Interfaces for prediction scenarios (similar to MatchOdds.tsx)
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
  teamName: string;
  opponentName: string;
  historicalWins: number;
  historicalLosses: number;
  historicalDraws: number;
  totalPlayed: number;
  winProbability: number;
  predictedScore: { team1: number; team2: number };
}

export const OptimalTeams = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [playersWithSkills, setPlayersWithSkills] = useState<PlayerWithSkills[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [optimalTeamData, setOptimalTeamData] = useState<any>(null); // Stores result from generateBalancedTeams
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingPredictions, setLoadingPredictions] = useState(false);

  // State for the new predictions
  const [eloPrediction, setEloPrediction] = useState<EloPredictionScenario | null>(null);
  const [historicalPredictions, setHistoricalPredictions] = useState<HistoricalPredictionScenario[]>([]);

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

  const generateTeams = async () => {
    if (selectedPlayerIds.length !== 4) {
      setOptimalTeamData(null);
      setEloPrediction(null);
      setHistoricalPredictions([]);
      return;
    }
    setLoadingPredictions(true);
    setError(null);

    const selectedPlayers = playersWithSkills.filter(
      player => selectedPlayerIds.includes(player.id.toString())
    );
    const balancedTeamInfo = generateBalancedTeams(selectedPlayers);
    setOptimalTeamData(balancedTeamInfo);

    if (balancedTeamInfo) {
      try {
        const team1Player1 = balancedTeamInfo.team1[0];
        const team1Player2 = balancedTeamInfo.team1[1];
        const team2Player1 = balancedTeamInfo.team2[0];
        const team2Player2 = balancedTeamInfo.team2[1];
        
        const team1DefPlayer = balancedTeamInfo.team1Roles.defense;
        const team1OffPlayer = balancedTeamInfo.team1Roles.offense;
        const team2DefPlayer = balancedTeamInfo.team2Roles.defense;
        const team2OffPlayer = balancedTeamInfo.team2Roles.offense;

        // 1. ELO Based Prediction (Overall)
        const t1DefElo = team1DefPlayer.elo_defense || 1400;
        const t1OffElo = team1OffPlayer.elo_offense || 1400;
        const t2DefElo = team2DefPlayer.elo_defense || 1400;
        const t2OffElo = team2OffPlayer.elo_offense || 1400;

        const team1BaseEloPred = calculateTeamStrengthForPrediction(t1DefElo, t1OffElo);
        const team2BaseEloPred = calculateTeamStrengthForPrediction(t2DefElo, t2OffElo);
        const probTeam1Overall = calculateWinProbability(team1BaseEloPred, team2BaseEloPred);
        const predictedScoreOverall = predictScore(probTeam1Overall);

        setEloPrediction({
          team1Name: `Team ${team1Player1.name} & ${team1Player2.name}`,
          team2Name: `Team ${team2Player1.name} & ${team2Player2.name}`,
          team1BaseElo: team1BaseEloPred,
          team2BaseElo: team2BaseEloPred,
          team1Probability: probTeam1Overall,
          team2Probability: 1 - probTeam1Overall,
          predictedScore: predictedScoreOverall,
        });

        // 2. Historical Predictions
        const team1UserIds = [team1Player1.id, team1Player2.id].sort();
        const team2UserIds = [team2Player1.id, team2Player2.id].sort();
        
        const newHistoricalPredictions: HistoricalPredictionScenario[] = [];

        // Scenario: Team 1 (White) vs Team 2 (Blue)
        // Get stats for Team 1 (as Team A) vs Team 2 (as Team B)
        const statsTeam1AsTeamA = await getHistoricalMatchupStatsByColor(
          team1UserIds[0], team1UserIds[1], 
          team2UserIds[0], team2UserIds[1]
        );

        const t1WhiteStats = statsTeam1AsTeamA.teamA_as_white;
        const totalPlayedT1White = t1WhiteStats.wins + t1WhiteStats.losses + t1WhiteStats.draws;
        const winProbT1White = totalPlayedT1White > 0 ? (t1WhiteStats.wins + 0.5 * t1WhiteStats.draws) / totalPlayedT1White : 0.5;
        const scoreT1White = predictScore(winProbT1White);
        
        newHistoricalPredictions.push({
          scenarioTitle: `Team ${team1Player1.name} & ${team1Player2.name} (White) vs Team ${team2Player1.name} & ${team2Player2.name} (Blue)`,
          teamName: `Team ${team1Player1.name} & ${team1Player2.name}`,
          opponentName: `Team ${team2Player1.name} & ${team2Player2.name}`,
          historicalWins: t1WhiteStats.wins,
          historicalLosses: t1WhiteStats.losses,
          historicalDraws: t1WhiteStats.draws,
          totalPlayed: totalPlayedT1White,
          winProbability: winProbT1White,
          predictedScore: scoreT1White
        });

        // Scenario: Team 1 (Blue) vs Team 2 (White) 
        // Get stats for Team 2 (as Team A - White) vs Team 1 (as Team B - Blue)
        const statsTeam2AsTeamA = await getHistoricalMatchupStatsByColor(
          team2UserIds[0], team2UserIds[1], // Team 2 is Team A (White)
          team1UserIds[0], team1UserIds[1]  // Team 1 is Team B (Blue)
        );
        
        const t2WhiteStats = statsTeam2AsTeamA.teamA_as_white; // Stats for Team 2 (White) vs Team 1 (Blue)
        const totalPlayedT1Blue = t2WhiteStats.wins + t2WhiteStats.losses + t2WhiteStats.draws;
        // Win probability for Team 1 (Blue) is when Team 2 (White) loses or draws (partially)
        const winProbT1Blue = totalPlayedT1Blue > 0 ? (t2WhiteStats.losses + 0.5 * t2WhiteStats.draws) / totalPlayedT1Blue : 0.5;
        const scoreT1Blue = predictScore(winProbT1Blue);

        newHistoricalPredictions.push({
          scenarioTitle: `Team ${team1Player1.name} & ${team1Player2.name} (Blue) vs Team ${team2Player1.name} & ${team2Player2.name} (White)`,
          teamName: `Team ${team1Player1.name} & ${team1Player2.name}`,
          opponentName: `Team ${team2Player1.name} & ${team2Player2.name}`,
          historicalWins: t2WhiteStats.losses, // Team 1 (Blue) wins if Team 2 (White) loses
          historicalLosses: t2WhiteStats.wins, // Team 1 (Blue) loses if Team 2 (White) wins
          historicalDraws: t2WhiteStats.draws,
          totalPlayed: totalPlayedT1Blue,
          winProbability: winProbT1Blue,
          predictedScore: scoreT1Blue
        });

        setHistoricalPredictions(newHistoricalPredictions);

      } catch (e) {
        console.error("Error fetching predictions:", e);
        setError("Failed to fetch prediction data. Check console for details.");
        setEloPrediction(null);
        setHistoricalPredictions([]);
      }
    } else {
      setEloPrediction(null);
      setHistoricalPredictions([]);
    }
    setLoadingPredictions(false);
  };

  return (
    <Box maxWidth="900px" mx="auto" p={6} borderRadius="lg" boxShadow="md" bg={useColorModeValue("white", "gray.800")}>
      <Heading as="h2" size="lg" mb={6} color={useColorModeValue("gray.700", "whiteAlpha.900")}>Optimal Teams Generator</Heading>
      
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
                      <Badge colorScheme="green" mr={1}>O: {player.elo_offense || 1400}</Badge>
                      <Badge colorScheme="blue">D: {player.elo_defense || 1400}</Badge>
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
            isDisabled={selectedPlayerIds.length !== 4 || loadingPredictions}
            isLoading={loadingPredictions}
          >
            Generate Optimal Teams & Predictions
          </Button>
          
          {loadingPredictions && (
            <Flex justify="center" py={8}><Spinner size="xl" /></Flex>
          )}

          {!loadingPredictions && optimalTeamData && (
            <Box>
              <Divider mb={6} />
              <Heading as="h3" size="md" mb={6} textAlign="center" color={useColorModeValue("gray.700", "whiteAlpha.900")}>Optimal Balanced Teams</Heading>
              <Text textAlign="center" mb={1} fontSize="sm" color={useColorModeValue("gray.600", "gray.400")}>
                Team ratings are based on a custom skill formula (D: 40%, O: 60%). Predictions below use ELO.
              </Text>
              <Text textAlign="center" mb={4} fontSize="sm" color={useColorModeValue("gray.600", "gray.400")}>
                Rating Difference: <Badge colorScheme={optimalTeamData.ratingDifference < 5 ? "green" : "yellow"}>{optimalTeamData.ratingDifference.toFixed(1)}</Badge> (Lower is more balanced based on skills)
              </Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
                <Card variant="filled" bg={useColorModeValue("blue.50", "blue.800")}>
                  <CardHeader pb={0}>
                    <Heading size="md" textAlign="center">Team 1: {optimalTeamData.team1Roles.defense.name} & {optimalTeamData.team1Roles.offense.name}</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <Box p={3} bg={useColorModeValue("white", "gray.700")} borderRadius="md" shadow="sm">
                        <Text fontWeight="bold">Defense</Text>
                        <Flex justify="space-between" align="center">
                          <Text>{optimalTeamData.team1Roles.defense.name}</Text>
                          <HStack>
                            <Badge colorScheme="blue">D-Skill: {optimalTeamData.team1Roles.defense.defenseSkill}</Badge>
                            <Badge colorScheme="green">O-Skill: {optimalTeamData.team1Roles.defense.offenseSkill}</Badge>
                          </HStack>
                        </Flex>
                      </Box>
                      
                      <Box p={3} bg={useColorModeValue("white", "gray.700")} borderRadius="md" shadow="sm">
                        <Text fontWeight="bold">Offense</Text>
                        <Flex justify="space-between" align="center">
                          <Text>{optimalTeamData.team1Roles.offense.name}</Text>
                          <HStack>
                            <Badge colorScheme="blue">D-Skill: {optimalTeamData.team1Roles.offense.defenseSkill}</Badge>
                            <Badge colorScheme="green">O-Skill: {optimalTeamData.team1Roles.offense.offenseSkill}</Badge>
                          </HStack>
                        </Flex>
                      </Box>
                      
                      <Stat mt={2} p={2} bg={useColorModeValue("blue.100", "blue.700")} borderRadius="md">
                        <StatLabel>Team Skill Rating</StatLabel>
                        <StatNumber>{optimalTeamData.team1Rating.toFixed(1)}</StatNumber>
                      </Stat>
                    </VStack>
                  </CardBody>
                </Card>
              
                <Card variant="filled" bg={useColorModeValue("orange.50", "orange.800")}>
                  <CardHeader pb={0}>
                    <Heading size="md" textAlign="center">Team 2: {optimalTeamData.team2Roles.defense.name} & {optimalTeamData.team2Roles.offense.name}</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <Box p={3} bg={useColorModeValue("white", "gray.700")} borderRadius="md" shadow="sm">
                        <Text fontWeight="bold">Defense</Text>
                        <Flex justify="space-between" align="center">
                          <Text>{optimalTeamData.team2Roles.defense.name}</Text>
                          <HStack>
                            <Badge colorScheme="blue">D-Skill: {optimalTeamData.team2Roles.defense.defenseSkill}</Badge>
                            <Badge colorScheme="green">O-Skill: {optimalTeamData.team2Roles.defense.offenseSkill}</Badge>
                          </HStack>
                        </Flex>
                      </Box>
                      
                      <Box p={3} bg={useColorModeValue("white", "gray.700")} borderRadius="md" shadow="sm">
                        <Text fontWeight="bold">Offense</Text>
                        <Flex justify="space-between" align="center">
                          <Text>{optimalTeamData.team2Roles.offense.name}</Text>
                          <HStack>
                            <Badge colorScheme="blue">D-Skill: {optimalTeamData.team2Roles.offense.defenseSkill}</Badge>
                            <Badge colorScheme="green">O-Skill: {optimalTeamData.team2Roles.offense.offenseSkill}</Badge>
                          </HStack>
                        </Flex>
                      </Box>
                      
                      <Stat mt={2} p={2} bg={useColorModeValue("orange.100", "orange.700")} borderRadius="md">
                        <StatLabel>Team Skill Rating</StatLabel>
                        <StatNumber>{optimalTeamData.team2Rating.toFixed(1)}</StatNumber>
                      </Stat>
                    </VStack>
                  </CardBody>
                </Card>
              </SimpleGrid>

              <Divider my={8} />
              <Heading as="h3" size="lg" mb={6} textAlign="center" color={useColorModeValue("gray.700", "whiteAlpha.900")}>Match Predictions</Heading>

              {/* Display ELO Prediction */}
              {eloPrediction && (
                <Card variant="outline" bg={useColorModeValue("gray.50", "gray.700")} mb={6} shadow="md">
                  <CardHeader><Heading size="md" color={useColorModeValue("gray.700", "whiteAlpha.900")}>Overall ELO Based Prediction</Heading></CardHeader>
                  <CardBody>
                    <Flex justify="space-around" mb={4} direction={{base: "column", md: "row"}}>
                      <Stat textAlign="center" p={2}>
                        <StatLabel>{eloPrediction.team1Name}</StatLabel>
                        <StatNumber color="blue.500">{Math.round(eloPrediction.team1Probability * 100)}%</StatNumber>
                        <StatHelpText>Avg ELO: {Math.round(eloPrediction.team1BaseElo)}</StatHelpText>
                      </Stat>
                      <Stat textAlign="center" p={2}>
                        <StatLabel>{eloPrediction.team2Name}</StatLabel>
                        <StatNumber color="orange.500">{Math.round(eloPrediction.team2Probability * 100)}%</StatNumber>
                        <StatHelpText>Avg ELO: {Math.round(eloPrediction.team2BaseElo)}</StatHelpText>
                      </Stat>
                    </Flex>
                    <Text textAlign="center" fontWeight="bold" fontSize="lg">
                      Predicted Score: {eloPrediction.predictedScore.team1} - {eloPrediction.predictedScore.team2}
                    </Text>
                  </CardBody>
                </Card>
              )}

              {/* Display Historical Predictions */}
              {historicalPredictions.map((pred, idx) => (
                <Card key={idx} variant="outline" bg={useColorModeValue("gray.50", "gray.700")} mb={6} shadow="md">
                  <CardHeader><Heading size="md" color={useColorModeValue("gray.700", "whiteAlpha.900")}>{pred.scenarioTitle}</Heading></CardHeader>
                  <CardBody>
                    <Text fontSize="sm" mb={2} textAlign="center">
                      Historical Record (Team 1 perspective): <Badge colorScheme={pred.historicalWins > pred.historicalLosses ? "green" : "red"}>{pred.historicalWins}W</Badge> - <Badge colorScheme={pred.historicalLosses > pred.historicalWins ? "green" : "red"}>{pred.historicalLosses}L</Badge> - <Badge>{pred.historicalDraws}D</Badge> (Total: {pred.totalPlayed})
                    </Text>
                     {pred.totalPlayed === 0 && <Text textAlign="center" fontSize="xs" color="gray.500" mb={2}>No exact historical matches found for this team & color configuration.</Text>}
                    <Flex justify="space-around" mb={4} direction={{base: "column", md: "row"}}>
                      <Stat textAlign="center" p={2}>
                        <StatLabel>{pred.teamName}</StatLabel>
                        <StatNumber color="blue.500">{Math.round(pred.winProbability * 100)}%</StatNumber>
                         <StatHelpText>Win Chance</StatHelpText>
                      </Stat>
                      <Stat textAlign="center" p={2}>
                        <StatLabel>{pred.opponentName}</StatLabel>
                        <StatNumber color="orange.500">{Math.round((1 - pred.winProbability) * 100)}%</StatNumber>
                        <StatHelpText>Win Chance</StatHelpText>
                      </Stat>
                    </Flex>
                    <Text textAlign="center" fontWeight="bold" fontSize="lg">
                       Predicted Score: {pred.predictedScore.team1} - {pred.predictedScore.team2}
                    </Text>
                  </CardBody>
                </Card>
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}; 