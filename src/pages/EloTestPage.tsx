import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Select,
  SimpleGrid,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
  useColorModeValue,
  VStack
} from '@chakra-ui/react';
import {getUsers, type User} from '../lib/supabase';
import {calculateImprovedElo, DEFAULT_ELO_PARAMETERS, type EloParameters} from '../lib/improvedElo';

interface TeamComposition {
  defense: User | null;
  offense: User | null;
}

interface EloTestResult {
  team1EloChange: {
    defense: number;
    offense: number;
  };
  team2EloChange: {
    defense: number;
    offense: number;
  };
  explanation: string[];
}



const EloTestPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [parameters, setParameters] = useState<EloParameters>(DEFAULT_ELO_PARAMETERS);
  const [team1, setTeam1] = useState<TeamComposition>({ defense: null, offense: null });
  const [team2, setTeam2] = useState<TeamComposition>({ defense: null, offense: null });
  const [team1Score, setTeam1Score] = useState<number>(10);
  const [team2Score, setTeam2Score] = useState<number>(5);
  const [testResult, setTestResult] = useState<EloTestResult | null>(null);
  const [loading, setLoading] = useState(true);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const userData = await getUsers();
        setUsers(userData);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Improved ELO calculation algorithm
  const calculateEloTest = useCallback((): EloTestResult => {
    if (!team1.defense || !team1.offense || !team2.defense || !team2.offense) {
      return {
        team1EloChange: { defense: 0, offense: 0 },
        team2EloChange: { defense: 0, offense: 0 },
        explanation: ['Please select all players for both teams']
      };
    }

    const result = calculateImprovedElo(
      team1.defense,
      team1.offense,
      team2.defense,
      team2.offense,
      team1Score,
      team2Score,
      parameters
    );

    return {
      team1EloChange: {
        defense: result.team1DefenseChange,
        offense: result.team1OffenseChange
      },
      team2EloChange: {
        defense: result.team2DefenseChange,
        offense: result.team2OffenseChange
      },
      explanation: result.explanation
    };
  }, [team1.defense, team1.offense, team2.defense, team2.offense, team1Score, team2Score, parameters]);

  // Auto-calculate when parameters, teams, or scores change
  useEffect(() => {
    if (team1.defense && team1.offense && team2.defense && team2.offense) {
      const result = calculateEloTest();
      setTestResult(result);
    } else {
      setTestResult(null);
    }
  }, [calculateEloTest, team1.defense, team1.offense, team2.defense, team2.offense]);



  const resetParameters = () => {
    setParameters(DEFAULT_ELO_PARAMETERS);
  };

  if (loading) {
    return (
      <Box p={6}>
        <Text>Loading users...</Text>
      </Box>
    );
  }

  return (
    <Box p={6} maxW="1400px" mx="auto">
      <VStack spacing={6} align="stretch">
        <Heading size="lg" textAlign="center">
          ELO Algorithm Test Laboratory - Live Mode
        </Heading>

        <Alert status="info">
          <AlertIcon />
          <Box>
            <AlertTitle>Improved ELO Algorithm Features:</AlertTitle>
            <AlertDescription>
              • Real-time calculations as you adjust sliders and parameters
              • Winners NEVER lose points - guaranteed minimum gain for winning teams
              • Dramatic score difference impact - bigger wins = much bigger ELO changes
              • Dynamic K-factor based on score difference and team composition
              • Skill gap analysis and penalties/bonuses
              • Aggressive score detection (5+ goal difference by default)
              • Massive upset bonuses (up to 2.5x multiplier for underdog wins)
            </AlertDescription>
          </Box>
        </Alert>

        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
          {/* Parameters Panel */}
          <Card bg={cardBg} borderColor={borderColor}>
            <CardHeader>
              <HStack justify="space-between">
                <Heading size="md">Algorithm Parameters</Heading>
                <Button size="sm" onClick={resetParameters}>Reset to Default</Button>
              </HStack>
            </CardHeader>
            <CardBody>
              <VStack spacing={6}>
                <FormControl>
                  <FormLabel>Base K-Factor: {parameters.baseKFactor}</FormLabel>
                  <Slider
                    value={parameters.baseKFactor}
                    onChange={(val) => setParameters(prev => ({ ...prev, baseKFactor: val }))}
                    min={20}
                    max={120}
                    step={5}
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                  <Text fontSize="sm" color="gray.500">Base volatility of ELO changes</Text>
                </FormControl>

                <FormControl>
                  <FormLabel>Score Difference Multiplier: {parameters.scoreDiffMultiplier.toFixed(2)}</FormLabel>
                  <Slider
                    value={parameters.scoreDiffMultiplier}
                    onChange={(val) => setParameters(prev => ({ ...prev, scoreDiffMultiplier: val }))}
                    min={0}
                    max={1.5}
                    step={0.1}
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                  <Text fontSize="sm" color="gray.500">How much score difference affects K-factor (higher = more dramatic)</Text>
                </FormControl>

                <FormControl>
                  <FormLabel>Skill Gap Threshold: {parameters.skillGapThreshold}</FormLabel>
                  <Slider
                    value={parameters.skillGapThreshold}
                    onChange={(val) => setParameters(prev => ({ ...prev, skillGapThreshold: val }))}
                    min={25}
                    max={200}
                    step={25}
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                  <Text fontSize="sm" color="gray.500">ELO difference considered significant</Text>
                </FormControl>

                <FormControl>
                  <FormLabel>Max ELO Change: {parameters.maxEloChange}</FormLabel>
                  <Slider
                    value={parameters.maxEloChange}
                    onChange={(val) => setParameters(prev => ({ ...prev, maxEloChange: val }))}
                    min={50}
                    max={150}
                    step={5}
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                  <Text fontSize="sm" color="gray.500">Maximum points that can be gained/lost (higher = more dramatic swings)</Text>
                </FormControl>

                <FormControl>
                  <FormLabel>Aggressive Score Threshold: {parameters.aggressiveScoreThreshold}</FormLabel>
                  <Slider
                    value={parameters.aggressiveScoreThreshold}
                    onChange={(val) => setParameters(prev => ({ ...prev, aggressiveScoreThreshold: val }))}
                    min={2}
                    max={10}
                    step={1}
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                  <Text fontSize="sm" color="gray.500">Goal difference considered "aggressive" (lower = more scenarios trigger big changes)</Text>
                </FormControl>

                <FormControl>
                  <FormLabel>Skill Gap Penalty: {parameters.skillGapPenalty.toFixed(2)}</FormLabel>
                  <Slider
                    value={parameters.skillGapPenalty}
                    onChange={(val) => setParameters(prev => ({ ...prev, skillGapPenalty: val }))}
                    min={0}
                    max={0.6}
                    step={0.05}
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                  <Text fontSize="sm" color="gray.500">Reduction factor for imbalanced teams</Text>
                </FormControl>

                <FormControl>
                  <FormLabel>Balanced Team Bonus: {parameters.balancedTeamBonus.toFixed(2)}</FormLabel>
                  <Slider
                    value={parameters.balancedTeamBonus}
                    onChange={(val) => setParameters(prev => ({ ...prev, balancedTeamBonus: val }))}
                    min={1}
                    max={2}
                    step={0.1}
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                  <Text fontSize="sm" color="gray.500">Multiplier for balanced teams with skill gap</Text>
                </FormControl>
              </VStack>
            </CardBody>
          </Card>

          {/* Team Selection Panel */}
          <Card bg={cardBg} borderColor={borderColor}>
            <CardHeader>
              <Heading size="md">Team Setup & Score</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={6}>
                {/* Team 1 */}
                <Box w="full">
                  <Text fontWeight="bold" mb={2}>Team 1</Text>
                  <SimpleGrid columns={2} spacing={3}>
                    <FormControl>
                      <FormLabel fontSize="sm">Defense</FormLabel>
                      <Select
                        placeholder="Select defender"
                        value={team1.defense?.id || ''}
                        onChange={(e) => {
                          const user = users.find(u => u.id === parseInt(e.target.value));
                          setTeam1(prev => ({ ...prev, defense: user || null }));
                        }}
                      >
                        {users.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.name} (D: {user.elo_defense || 1400})
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">Offense</FormLabel>
                      <Select
                        placeholder="Select attacker"
                        value={team1.offense?.id || ''}
                        onChange={(e) => {
                          const user = users.find(u => u.id === parseInt(e.target.value));
                          setTeam1(prev => ({ ...prev, offense: user || null }));
                        }}
                      >
                        {users.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.name} (O: {user.elo_offense || 1400})
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                  </SimpleGrid>
                </Box>

                {/* Team 2 */}
                <Box w="full">
                  <Text fontWeight="bold" mb={2}>Team 2</Text>
                  <SimpleGrid columns={2} spacing={3}>
                    <FormControl>
                      <FormLabel fontSize="sm">Defense</FormLabel>
                      <Select
                        placeholder="Select defender"
                        value={team2.defense?.id || ''}
                        onChange={(e) => {
                          const user = users.find(u => u.id === parseInt(e.target.value));
                          setTeam2(prev => ({ ...prev, defense: user || null }));
                        }}
                      >
                        {users.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.name} (D: {user.elo_defense || 1400})
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">Offense</FormLabel>
                      <Select
                        placeholder="Select attacker"
                        value={team2.offense?.id || ''}
                        onChange={(e) => {
                          const user = users.find(u => u.id === parseInt(e.target.value));
                          setTeam2(prev => ({ ...prev, offense: user || null }));
                        }}
                      >
                        {users.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.name} (O: {user.elo_offense || 1400})
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                  </SimpleGrid>
                </Box>

                <Divider />

                {/* Score Input */}
                <SimpleGrid columns={2} spacing={4} w="full">
                  <FormControl>
                    <FormLabel>Team 1 Score</FormLabel>
                    <NumberInput
                      value={team1Score}
                      onChange={(_, val) => setTeam1Score(val || 0)}
                      min={0}
                      max={20}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Team 2 Score</FormLabel>
                    <NumberInput
                      value={team2Score}
                      onChange={(_, val) => setTeam2Score(val || 0)}
                      min={0}
                      max={20}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                </SimpleGrid>

                {(!team1.defense || !team1.offense || !team2.defense || !team2.offense) && (
                  <Alert status="warning" borderRadius="md">
                    <AlertIcon />
                    <Text fontSize="sm">Select all players to see live ELO calculations</Text>
                  </Alert>
                )}

                {(team1.defense && team1.offense && team2.defense && team2.offense) && (
                  <Alert status="success" borderRadius="md">
                    <AlertIcon />
                    <Text fontSize="sm">✨ ELO calculations update live as you adjust parameters!</Text>
                  </Alert>
                )}
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Results Panel */}
        {testResult && (
          <Card bg={cardBg} borderColor={borderColor}>
            <CardHeader>
              <Heading size="md">Test Results</Heading>
            </CardHeader>
            <CardBody>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                {/* ELO Changes */}
                <Box>
                  <Text fontWeight="bold" mb={4}>ELO Changes</Text>
                  <VStack spacing={4} align="stretch">
                    <Box p={4} borderRadius="md" bg={useColorModeValue('blue.50', 'blue.900')}>
                      <Text fontWeight="bold" color="blue.600">Team 1</Text>
                      <HStack justify="space-between">
                        <Text>{team1.defense?.name} (D):</Text>
                        <Badge colorScheme={testResult.team1EloChange.defense >= 0 ? 'green' : 'red'}>
                          {testResult.team1EloChange.defense >= 0 ? '+' : ''}{testResult.team1EloChange.defense}
                        </Badge>
                      </HStack>
                      <HStack justify="space-between">
                        <Text>{team1.offense?.name} (O):</Text>
                        <Badge colorScheme={testResult.team1EloChange.offense >= 0 ? 'green' : 'red'}>
                          {testResult.team1EloChange.offense >= 0 ? '+' : ''}{testResult.team1EloChange.offense}
                        </Badge>
                      </HStack>
                    </Box>

                    <Box p={4} borderRadius="md" bg={useColorModeValue('red.50', 'red.900')}>
                      <Text fontWeight="bold" color="red.600">Team 2</Text>
                      <HStack justify="space-between">
                        <Text>{team2.defense?.name} (D):</Text>
                        <Badge colorScheme={testResult.team2EloChange.defense >= 0 ? 'green' : 'red'}>
                          {testResult.team2EloChange.defense >= 0 ? '+' : ''}{testResult.team2EloChange.defense}
                        </Badge>
                      </HStack>
                      <HStack justify="space-between">
                        <Text>{team2.offense?.name} (O):</Text>
                        <Badge colorScheme={testResult.team2EloChange.offense >= 0 ? 'green' : 'red'}>
                          {testResult.team2EloChange.offense >= 0 ? '+' : ''}{testResult.team2EloChange.offense}
                        </Badge>
                      </HStack>
                    </Box>
                  </VStack>
                </Box>

                {/* Explanation */}
                <Box>
                  <Text fontWeight="bold" mb={4}>Algorithm Explanation</Text>
                  <VStack align="stretch" spacing={2}>
                    {testResult.explanation.map((line, index) => (
                      <Text key={index} fontSize="sm" p={2} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
                        {line}
                      </Text>
                    ))}
                  </VStack>
                </Box>
              </SimpleGrid>
            </CardBody>
          </Card>
        )}
      </VStack>
    </Box>
  );
};

export default EloTestPage;
