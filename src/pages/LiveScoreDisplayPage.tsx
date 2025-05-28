import React, {useEffect, useState} from 'react';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Code,
  Divider,
  Flex,
  Heading,
  HStack,
  IconButton,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  SimpleGrid,
  Spinner,
  Text,
  Tooltip,
  useClipboard,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import {useNavigate, useParams} from 'react-router-dom';
import {ArrowBackIcon, CopyIcon, ExternalLinkIcon} from '@chakra-ui/icons';
import {supabase} from '../supabaseClient';
import type {User} from '../lib/supabase';
import {saveMatch} from '../lib/supabase';
import {useLiveMatch} from '../hooks/useLiveMatch';
import type {EloCalculationResult} from '../lib/improvedElo';
import {calculateImprovedEloFromMatchData} from '../lib/improvedElo';

const LiveScoreDisplayPage: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { match, loading, error } = useLiveMatch(matchId);
  const [users, setUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [eloPreview, setEloPreview] = useState<EloCalculationResult | null>(null);
  const [winProbabilities, setWinProbabilities] = useState<{
    whiteWinProb: number;
    blueWinProb: number;
  } | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const navigate = useNavigate();

  // URLs for team control
  const baseUrl = window.location.origin;
  const whiteTeamUrl = `${baseUrl}/app/live-match/${matchId}/white`;
  const blueTeamUrl = `${baseUrl}/app/live-match/${matchId}/blue`;

  const { onCopy: onCopyWhite, hasCopied: hasCopiedWhite } = useClipboard(whiteTeamUrl);
  const { onCopy: onCopyBlue, hasCopied: hasCopiedBlue } = useClipboard(blueTeamUrl);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (match?.status === 'finished' && !isOpen) {
      calculateEloPreview();
      onOpen();
    }
  }, [match?.status, isOpen, onOpen]);

  // Calculate live win probabilities whenever score changes
  useEffect(() => {
    if (match && users.length > 0) {
      calculateSmartWinProbabilities();
    }
  }, [match?.white_score, match?.blue_score, users]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('User')
        .select('*');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const calculateWinProbability = (team1Rating: number, team2Rating: number): number => {
    return 1 / (1 + Math.pow(10, (team2Rating - team1Rating) / 400));
  };

  const calculateSmartWinProbabilities = () => {
    if (!match || users.length === 0) return;

    const whiteDefUser = users.find(u => u.id === match.white_team_defense_id);
    const whiteOffUser = users.find(u => u.id === match.white_team_offense_id);
    const blueDefUser = users.find(u => u.id === match.blue_team_defense_id);
    const blueOffUser = users.find(u => u.id === match.blue_team_offense_id);

    if (!whiteDefUser || !whiteOffUser || !blueDefUser || !blueOffUser) return;

    // Calculate team ELO using the same weighted formula as improved ELO
    const whiteDefElo = whiteDefUser.elo_defense || 1400;
    const whiteOffElo = whiteOffUser.elo_offense || 1400;
    const blueDefElo = blueDefUser.elo_defense || 1400;
    const blueOffElo = blueOffUser.elo_offense || 1400;

    const whiteWeakerElo = Math.min(whiteDefElo, whiteOffElo);
    const whiteStrongerElo = Math.max(whiteDefElo, whiteOffElo);
    const whiteTeamElo = whiteWeakerElo * 0.9 + whiteStrongerElo * 0.1;

    const blueWeakerElo = Math.min(blueDefElo, blueOffElo);
    const blueStrongerElo = Math.max(blueDefElo, blueOffElo);
    const blueTeamElo = blueWeakerElo * 0.9 + blueStrongerElo * 0.1;

    // 1. Base ELO probability (40% weight)
    const baseWhiteWinProb = calculateWinProbability(whiteTeamElo, blueTeamElo);

    // 2. Proximity to victory factor (35% weight)
    const whiteProximity = match.white_score / 10; // How close white is to winning
    const blueProximity = match.blue_score / 10;   // How close blue is to winning

    // If a team is very close to 10, they have a big advantage
    let proximityFactor = 0.5; // neutral
    if (whiteProximity > 0.7 || blueProximity > 0.7) {
      // Someone is close to winning - proximity becomes very important
      proximityFactor = whiteProximity / (whiteProximity + blueProximity);
    } else if (match.white_score + match.blue_score > 0) {
      // Early/mid game - proximity has moderate impact
      proximityFactor = (whiteProximity * 0.7 + 0.5 * 0.3);
    }

    // 3. Momentum factor (25% weight) - based on recent performance
    let momentumFactor = 0.5; // neutral
    const totalScore = match.white_score + match.blue_score;

    if (totalScore >= 3) {
      // Calculate momentum based on score ratio with recency bias
      const whiteRatio = match.white_score / totalScore;

      // If the game is lopsided, momentum matters more
      const scoreDiff = Math.abs(match.white_score - match.blue_score);
      const lopsidedMultiplier = Math.min(1 + (scoreDiff * 0.2), 2.0);

      momentumFactor = whiteRatio * lopsidedMultiplier;
      momentumFactor = Math.max(0.1, Math.min(0.9, momentumFactor)); // Cap between 10-90%
    }

    // 4. Combine all factors with weights
    const combinedWhiteProb =
      baseWhiteWinProb * 0.40 +      // ELO base probability
      proximityFactor * 0.35 +       // How close to winning
      momentumFactor * 0.25;         // Current momentum

    // Ensure probabilities are reasonable (5% to 95%)
    const finalWhiteProb = Math.max(0.05, Math.min(0.95, combinedWhiteProb));
    const finalBlueProb = 1 - finalWhiteProb;

    setWinProbabilities({
      whiteWinProb: finalWhiteProb,
      blueWinProb: finalBlueProb
    });
  };

  const calculateEloPreview = async () => {
    if (!match || users.length === 0) return;

    try {
      const userMap: Record<number, User> = {};
      users.forEach(user => {
        userMap[user.id] = user;
      });

      const matchData = {
        team1Defense: match.white_team_defense_id.toString(),
        team1Offense: match.white_team_offense_id.toString(),
        team2Defense: match.blue_team_defense_id.toString(),
        team2Offense: match.blue_team_offense_id.toString(),
        team1Score: match.white_score,
        team2Score: match.blue_score,
        date: new Date(),
      };

      const eloResult = await calculateImprovedEloFromMatchData(matchData, userMap);
      setEloPreview(eloResult);
    } catch (error) {
      console.error('Error calculating ELO preview:', error);
    }
  };

  const getUserName = (userId: number) => {
    const user = users.find(u => u.id === userId);
    return user?.name || 'Unknown';
  };

  const confirmScore = async () => {
    if (!match) return;

    setSaving(true);
    try {
      // Save the match to the regular match system
      const matchData = {
        team1Defense: match.white_team_defense_id.toString(),
        team1Offense: match.white_team_offense_id.toString(),
        team2Defense: match.blue_team_defense_id.toString(),
        team2Offense: match.blue_team_offense_id.toString(),
        team1Score: match.white_score,
        team2Score: match.blue_score,
        date: new Date(),
      };

      const result = await saveMatch(matchData);

      if (result.success) {
        // Mark the live match as completed
        await supabase
          .from('live_matches')
          .update({
            status: 'completed',
            confirmed_by_white: true,
            confirmed_by_blue: true,
          })
          .eq('id', matchId);

        toast({
          title: 'Match Saved',
          description: 'The match has been saved to the database and ELO ratings updated',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });

        onClose();
        navigate('/app');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error saving match:', error);
      toast({
        title: 'Error',
        description: 'Failed to save match to database',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelMatch = async () => {
    if (!match) return;

    try {
      await supabase
        .from('live_matches')
        .update({ status: 'cancelled' })
        .eq('id', matchId);

      toast({
        title: 'Match Cancelled',
        description: 'The match has been cancelled',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });

      onClose();
      navigate('/app');
    } catch (error) {
      console.error('Error cancelling match:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel match',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (error || !match) {
    return (
      <Box p={6} textAlign="center">
        <Alert status="error">
          <AlertIcon />
          <AlertDescription>{error || 'Match not found'}</AlertDescription>
        </Alert>
      </Box>
    );
  }

  const isGameFinished = match.white_score >= 10 || match.blue_score >= 10;
  const winner = match.white_score > match.blue_score ? 'White' :
                 match.blue_score > match.white_score ? 'Blue' : 'Tie';

  return (
    <Box p={6} maxW="900px" mx="auto">
      {/* Header with Navigation */}
      <Flex justify="space-between" align="center" mb={6}>
        <IconButton
          aria-label="Back to live matches"
          icon={<ArrowBackIcon />}
          variant="ghost"
          onClick={() => navigate('/app/live-match')}
        />
        <Heading size="xl" textAlign="center">Live Match Display</Heading>
        <Box w="40px" /> {/* Spacer for centering */}
      </Flex>

      <VStack spacing={6} align="stretch">
        {/* Score Display */}
        <Card>
          <CardBody>
            <VStack spacing={4}>
              <HStack spacing={8} justify="center" align="center">
                <VStack>
                  <Text fontSize="lg" fontWeight="bold" color="gray.600">WHITE TEAM</Text>
                  <Badge fontSize="4xl" px={6} py={3} colorScheme="gray">
                    {match.white_score}
                  </Badge>
                  <VStack spacing={1} fontSize="sm" color="gray.600">
                    <Text>{getUserName(match.white_team_defense_id)} (D)</Text>
                    <Text>{getUserName(match.white_team_offense_id)} (O)</Text>
                  </VStack>
                </VStack>

                <Text fontSize="3xl" fontWeight="bold" color="gray.400">VS</Text>

                <VStack>
                  <Text fontSize="lg" fontWeight="bold" color="blue.600">BLUE TEAM</Text>
                  <Badge fontSize="4xl" px={6} py={3} colorScheme="blue">
                    {match.blue_score}
                  </Badge>
                  <VStack spacing={1} fontSize="sm" color="gray.600">
                    <Text>{getUserName(match.blue_team_defense_id)} (D)</Text>
                    <Text>{getUserName(match.blue_team_offense_id)} (O)</Text>
                  </VStack>
                </VStack>
              </HStack>

              {/* Live Win Probabilities - Horizontal Bar */}
              {winProbabilities && match.status === 'active' && (
                <VStack spacing={3} w="100%" mt={4}>
                  <Text fontSize="md" fontWeight="bold" color="green.700" textAlign="center">
                    🎯 Live Win Probabilities
                  </Text>

                  {/* Percentage Labels */}
                  <HStack justify="space-between" w="100%" px={2}>
                    <VStack spacing={0}>
                      <Text fontSize="lg" fontWeight="bold" color="gray.700">
                        {Math.round(winProbabilities.whiteWinProb * 100)}%
                      </Text>
                      <Text fontSize="xs" color="gray.500">White</Text>
                    </VStack>
                    <VStack spacing={0}>
                      <Text fontSize="lg" fontWeight="bold" color="blue.700">
                        {Math.round(winProbabilities.blueWinProb * 100)}%
                      </Text>
                      <Text fontSize="xs" color="blue.500">Blue</Text>
                    </VStack>
                  </HStack>

                  {/* Horizontal Progress Bar */}
                  <Box w="100%" position="relative">
                    <Progress
                      value={winProbabilities.whiteWinProb * 100}
                      size="lg"
                      colorScheme="gray"
                      bg="blue.200"
                      borderRadius="full"
                      height="20px"
                      sx={{
                        '& > div': {
                          background: 'linear-gradient(90deg, #718096 0%, #A0AEC0 100%)',
                        }
                      }}
                    />
                    {/* Center divider line */}
                    <Box
                      position="absolute"
                      top="0"
                      left="50%"
                      transform="translateX(-50%)"
                      height="20px"
                      width="2px"
                      bg="white"
                      borderRadius="full"
                      zIndex={2}
                    />
                  </Box>

                  <Text fontSize="xs" color="gray.600" textAlign="center">
                    Based on team ELO, proximity to victory, and game momentum
                  </Text>
                </VStack>
              )}

              {/* Direct Team Control Buttons */}
              {match.status === 'active' && (
                <VStack spacing={3} w="100%">
                  <Text fontSize="md" fontWeight="bold" color="gray.700" textAlign="center">
                    🎮 Quick Team Access
                  </Text>
                  <HStack spacing={4} justify="center" w="100%">
                    <Button
                      size="lg"
                      colorScheme="gray"
                      variant="solid"
                      leftIcon={<span style={{ fontSize: '20px' }}>⚪</span>}
                      onClick={() => window.open(`/app/live-match/${matchId}/white`, '_blank')}
                      minW="200px"
                      height="60px"
                      fontSize="lg"
                      fontWeight="bold"
                      _hover={{ transform: 'scale(1.02)' }}
                      _active={{ transform: 'scale(0.98)' }}
                    >
                      White Team Control
                    </Button>
                    <Button
                      size="lg"
                      colorScheme="blue"
                      variant="solid"
                      leftIcon={<span style={{ fontSize: '20px' }}>🔵</span>}
                      onClick={() => window.open(`/app/live-match/${matchId}/blue`, '_blank')}
                      minW="200px"
                      height="60px"
                      fontSize="lg"
                      fontWeight="bold"
                      _hover={{ transform: 'scale(1.02)' }}
                      _active={{ transform: 'scale(0.98)' }}
                    >
                      Blue Team Control
                    </Button>
                  </HStack>
                  <Text fontSize="sm" color="gray.600" textAlign="center">
                    Click to open team control on mobile devices
                  </Text>
                </VStack>
              )}

              {match.status !== 'active' && (
                <Alert status="warning" borderRadius="lg">
                  <AlertIcon />
                  <AlertDescription>
                    Team controls are only available for active matches
                  </AlertDescription>
                </Alert>
              )}

              {isGameFinished && (
                <Alert status="success">
                  <AlertIcon />
                  <AlertDescription fontSize="lg">
                    🎉 Game Over! {winner} Team Wins!
                  </AlertDescription>
                </Alert>
              )}
            </VStack>
          </CardBody>
        </Card>

        <Divider />

        {/* Team Control Access */}
        <Card>
          <CardBody>
            <Heading size="md" mb={4} textAlign="center">📱 Mobile Team Controls</Heading>
            <Text fontSize="sm" color="gray.600" textAlign="center" mb={4}>
              Players can scan QR codes or copy links to control the score from their mobile devices
            </Text>

            <VStack spacing={4}>
              {/* White Team Control */}
              <Box
                p={4}
                borderRadius="lg"
                bg="gray.50"
                borderWidth="1px"
                borderColor="gray.200"
                w="100%"
              >
                <VStack spacing={3}>
                  <HStack justify="space-between" w="100%">
                    <Text fontWeight="bold" color="gray.700">White Team Control</Text>
                    <Badge colorScheme="gray">WHITE</Badge>
                  </HStack>

                  <HStack spacing={2} w="100%">
                    <Button
                      flex={1}
                      colorScheme="gray"
                      leftIcon={<ExternalLinkIcon />}
                      onClick={() => window.open(whiteTeamUrl, '_blank')}
                    >
                      Open Control
                    </Button>
                    <Tooltip label={hasCopiedWhite ? "Copied!" : "Copy link"}>
                      <IconButton
                        aria-label="Copy white team link"
                        icon={<CopyIcon />}
                        colorScheme="gray"
                        variant="outline"
                        onClick={onCopyWhite}
                      />
                    </Tooltip>
                  </HStack>

                  <Code fontSize="xs" p={2} borderRadius="md" w="100%" textAlign="center">
                    {whiteTeamUrl}
                  </Code>
                </VStack>
              </Box>

              {/* Blue Team Control */}
              <Box
                p={4}
                borderRadius="lg"
                bg="blue.50"
                borderWidth="1px"
                borderColor="blue.200"
                w="100%"
              >
                <VStack spacing={3}>
                  <HStack justify="space-between" w="100%">
                    <Text fontWeight="bold" color="blue.700">Blue Team Control</Text>
                    <Badge colorScheme="blue">BLUE</Badge>
                  </HStack>

                  <HStack spacing={2} w="100%">
                    <Button
                      flex={1}
                      colorScheme="blue"
                      leftIcon={<ExternalLinkIcon />}
                      onClick={() => window.open(blueTeamUrl, '_blank')}
                    >
                      Open Control
                    </Button>
                    <Tooltip label={hasCopiedBlue ? "Copied!" : "Copy link"}>
                      <IconButton
                        aria-label="Copy blue team link"
                        icon={<CopyIcon />}
                        colorScheme="blue"
                        variant="outline"
                        onClick={onCopyBlue}
                      />
                    </Tooltip>
                  </HStack>

                  <Code fontSize="xs" p={2} borderRadius="md" w="100%" textAlign="center">
                    {blueTeamUrl}
                  </Code>
                </VStack>
              </Box>
            </VStack>

            <Alert status="info" mt={4} borderRadius="lg">
              <AlertIcon />
              <AlertDescription fontSize="sm">
                <strong>How to use:</strong> Share the links above with team players.
                They can open them on their phones to control the score in real-time.
              </AlertDescription>
            </Alert>
          </CardBody>
        </Card>

        {/* Match Status */}
        <Card>
          <CardBody>
            <HStack justify="space-between" align="center">
              <VStack align="start" spacing={1}>
                <Text fontSize="sm" color="gray.600">
                  Status: <Badge colorScheme={match.status === 'active' ? 'green' : 'gray'}>
                    {match.status.toUpperCase()}
                  </Badge>
                </Text>
                {match.finished_at && (
                  <Text fontSize="sm" color="gray.600">
                    Finished: {new Date(match.finished_at).toLocaleString()}
                  </Text>
                )}
              </VStack>

              <VStack align="end" spacing={1}>
                <Text fontSize="xs" color="gray.500">Match ID: {matchId}</Text>
                <Text fontSize="xs" color="gray.500">
                  Created: {new Date(match.created_at).toLocaleString()}
                </Text>
              </VStack>
            </HStack>
          </CardBody>
        </Card>
      </VStack>

      {/* Game Completion Modal with ELO Preview */}
      <Modal isOpen={isOpen} onClose={() => {}} closeOnOverlayClick={false} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>🎉 Game Completed!</ModalHeader>
          <ModalBody>
            <VStack spacing={6}>
              <VStack spacing={2}>
                <Text fontSize="lg" textAlign="center">
                  Final Score: {match.white_score} - {match.blue_score}
                </Text>
                <Text fontSize="lg" fontWeight="bold" textAlign="center" color="green.600">
                  {winner} Team Wins!
                </Text>
              </VStack>

              {/* ELO Changes Preview */}
              {eloPreview && (
                <Card w="100%" bg="blue.50" borderColor="blue.200" borderWidth="1px">
                  <CardBody>
                    <VStack spacing={4}>
                      <Heading size="md" color="blue.700" textAlign="center">
                        📊 ELO Rating Changes Preview
                      </Heading>

                      <SimpleGrid columns={2} spacing={4} w="100%">
                        {/* White Team Changes */}
                        <VStack spacing={3} p={3} bg="white" borderRadius="md" borderWidth="1px">
                          <Text fontWeight="bold" color="gray.700">White Team</Text>
                          <VStack spacing={2}>
                            <HStack justify="space-between" w="100%">
                              <Text fontSize="sm">{getUserName(match.white_team_defense_id)} (D):</Text>
                              <Badge
                                colorScheme={eloPreview.team1DefenseChange >= 0 ? 'green' : 'red'}
                                fontSize="sm"
                              >
                                {eloPreview.team1DefenseChange >= 0 ? '+' : ''}{eloPreview.team1DefenseChange}
                              </Badge>
                            </HStack>
                            <HStack justify="space-between" w="100%">
                              <Text fontSize="sm">{getUserName(match.white_team_offense_id)} (O):</Text>
                              <Badge
                                colorScheme={eloPreview.team1OffenseChange >= 0 ? 'green' : 'red'}
                                fontSize="sm"
                              >
                                {eloPreview.team1OffenseChange >= 0 ? '+' : ''}{eloPreview.team1OffenseChange}
                              </Badge>
                            </HStack>
                          </VStack>
                        </VStack>

                        {/* Blue Team Changes */}
                        <VStack spacing={3} p={3} bg="blue.50" borderRadius="md" borderWidth="1px">
                          <Text fontWeight="bold" color="blue.700">Blue Team</Text>
                          <VStack spacing={2}>
                            <HStack justify="space-between" w="100%">
                              <Text fontSize="sm">{getUserName(match.blue_team_defense_id)} (D):</Text>
                              <Badge
                                colorScheme={eloPreview.team2DefenseChange >= 0 ? 'green' : 'red'}
                                fontSize="sm"
                              >
                                {eloPreview.team2DefenseChange >= 0 ? '+' : ''}{eloPreview.team2DefenseChange}
                              </Badge>
                            </HStack>
                            <HStack justify="space-between" w="100%">
                              <Text fontSize="sm">{getUserName(match.blue_team_offense_id)} (O):</Text>
                              <Badge
                                colorScheme={eloPreview.team2OffenseChange >= 0 ? 'green' : 'red'}
                                fontSize="sm"
                              >
                                {eloPreview.team2OffenseChange >= 0 ? '+' : ''}{eloPreview.team2OffenseChange}
                              </Badge>
                            </HStack>
                          </VStack>
                        </VStack>
                      </SimpleGrid>
                    </VStack>
                  </CardBody>
                </Card>
              )}

              <Text textAlign="center" color="gray.600">
                Would you like to save this match to the database and update ELO ratings?
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="ghost" onClick={cancelMatch}>
                Cancel Match
              </Button>
              <Button
                colorScheme="green"
                onClick={confirmScore}
                isLoading={saving}
                loadingText="Saving..."
              >
                Confirm & Save Match
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default LiveScoreDisplayPage;
