import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Grid,
  GridItem,
  Select,
  useToast,
  Divider,
  Input,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper
} from '@chakra-ui/react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getSeasons,
  getSeasonFixtures,
  updateFixtureScore,
  type Season,
  type SeasonFixture
} from '../../lib/seasonSupabase';

const SeasonFixtures: React.FC = () => {
  const { user } = useAuth();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [fixtures, setFixtures] = useState<SeasonFixture[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingFixture, setEditingFixture] = useState<SeasonFixture | null>(null);
  const [homeScore, setHomeScore] = useState<number>(0);
  const [awayScore, setAwayScore] = useState<number>(0);
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    loadSeasons();
  }, []);

  useEffect(() => {
    if (selectedSeasonId) {
      loadFixtures();
    }
  }, [selectedSeasonId]);

  const loadSeasons = async () => {
    try {
      const seasonsData = await getSeasons();
      setSeasons(seasonsData);
      
      // Auto-select the first active season or the first season
      const activeSeason = seasonsData.find(s => s.status === 'active');
      if (activeSeason) {
        setSelectedSeasonId(activeSeason.id.toString());
      } else if (seasonsData.length > 0) {
        setSelectedSeasonId(seasonsData[0].id.toString());
      }
    } catch (error) {
      toast({
        title: 'Error loading seasons',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const loadFixtures = async () => {
    if (!selectedSeasonId) return;
    
    setLoading(true);
    try {
      const fixturesData = await getSeasonFixtures(parseInt(selectedSeasonId));
      setFixtures(fixturesData);
    } catch (error) {
      toast({
        title: 'Error loading fixtures',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditFixture = (fixture: SeasonFixture) => {
    setEditingFixture(fixture);
    setHomeScore(fixture.home_score || 0);
    setAwayScore(fixture.away_score || 0);
    onOpen();
  };

  const handleSaveScore = async () => {
    if (!editingFixture) return;
    
    setLoading(true);
    try {
      const success = await updateFixtureScore(editingFixture.id, homeScore, awayScore);
      if (success) {
        toast({
          title: 'Score updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        onClose();
        loadFixtures();
      } else {
        toast({
          title: 'Error updating score',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: 'Error updating score',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const getMatchStatus = (fixture: SeasonFixture) => {
    if (fixture.home_score !== null && fixture.away_score !== null) {
      return 'played';
    }
    return 'scheduled';
  };

  const getWinnerBadge = (homeScore: number, awayScore: number) => {
    if (homeScore > awayScore) {
      return <Badge colorScheme="blue" ml={2}>WHITE WINS</Badge>;
    } else if (awayScore > homeScore) {
      return <Badge colorScheme="red" ml={2}>BLUE WINS</Badge>;
    } else {
      return <Badge colorScheme="gray" ml={2}>DRAW</Badge>;
    }
  };

  const selectedSeason = seasons.find(s => s.id.toString() === selectedSeasonId);

  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        <HStack justify="space-between" align="center">
          <Text fontSize="2xl" fontWeight="bold" color="white">
            Season Fixtures
          </Text>
          
          <Select
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
            w="300px"
            bg="gray.700"
            color="white"
            borderColor="gray.600"
            placeholder="Select a season"
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name} ({season.status})
              </option>
            ))}
          </Select>
        </HStack>

        {selectedSeason && (
          <Box p={4} bg="gray.700" borderRadius="lg">
            <Text color="white" fontSize="lg" fontWeight="bold">
              {selectedSeason.name}
            </Text>
            <Text color="gray.300" fontSize="sm">
              Status: <Badge colorScheme={selectedSeason.status === 'active' ? 'green' : 'gray'}>
                {selectedSeason.status}
              </Badge>
            </Text>
          </Box>
        )}

        <Divider />

        {loading && (
          <Text color="white" textAlign="center">Loading fixtures...</Text>
        )}

        {!loading && fixtures.length === 0 && selectedSeasonId && (
          <Text color="gray.400" textAlign="center">
            No fixtures found for this season.
          </Text>
        )}

        {!loading && fixtures.length > 0 && (
          <VStack spacing={4} align="stretch">
            {fixtures.map((fixture) => {
              const isPlayed = getMatchStatus(fixture) === 'played';
              
              return (
                <Box
                  key={fixture.id}
                  p={4}
                  borderWidth={1}
                  borderRadius="lg"
                  bg={isPlayed ? "gray.700" : "gray.800"}
                  borderColor={isPlayed ? "green.500" : "gray.600"}
                  cursor={user?.user_metadata?.admin ? "pointer" : "default"}
                  onClick={user?.user_metadata?.admin ? () => handleEditFixture(fixture) : undefined}
                  _hover={user?.user_metadata?.admin ? { bg: "gray.600" } : {}}
                >
                  <Grid templateColumns="1fr auto 1fr" gap={4} alignItems="center">
                    {/* Home Team (White Side) */}
                    <GridItem>
                      <VStack align="end" spacing={1}>
                        <Text color="white" fontWeight="bold" textAlign="right">
                          {fixture.home_team?.name || 'Unknown Team'}
                        </Text>
                        <Badge colorScheme="blue" size="sm">WHITE SIDE</Badge>
                      </VStack>
                    </GridItem>

                    {/* Score */}
                    <GridItem>
                      <VStack spacing={1}>
                        {isPlayed ? (
                          <>
                            <HStack spacing={2}>
                              <Text fontSize="2xl" fontWeight="bold" color="white">
                                {fixture.home_score}
                              </Text>
                              <Text fontSize="xl" color="gray.400">-</Text>
                              <Text fontSize="2xl" fontWeight="bold" color="white">
                                {fixture.away_score}
                              </Text>
                            </HStack>
                            {fixture.home_score !== null && fixture.away_score !== null && 
                             getWinnerBadge(fixture.home_score, fixture.away_score)}
                            <Text fontSize="xs" color="gray.400">
                              {fixture.played_at && new Date(fixture.played_at).toLocaleDateString()}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Text color="gray.400" fontSize="lg">VS</Text>
                            <Badge colorScheme="yellow" size="sm">SCHEDULED</Badge>
                            {user?.user_metadata?.admin && (
                              <Text fontSize="xs" color="gray.500">Click to add score</Text>
                            )}
                          </>
                        )}
                      </VStack>
                    </GridItem>

                    {/* Away Team (Blue Side) */}
                    <GridItem>
                      <VStack align="start" spacing={1}>
                        <Text color="white" fontWeight="bold" textAlign="left">
                          {fixture.away_team?.name || 'Unknown Team'}
                        </Text>
                        <Badge colorScheme="red" size="sm">BLUE SIDE</Badge>
                      </VStack>
                    </GridItem>
                  </Grid>
                </Box>
              );
            })}
          </VStack>
        )}
      </VStack>

      {/* Score Edit Modal */}
      {user?.user_metadata?.admin && (
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent bg="gray.800" color="white">
            <ModalHeader>Edit Match Score</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {editingFixture && (
                <VStack spacing={4}>
                  <Text textAlign="center" fontSize="lg">
                    {editingFixture.home_team?.name} vs {editingFixture.away_team?.name}
                  </Text>
                  
                  <Grid templateColumns="1fr auto 1fr" gap={4} alignItems="center" w="full">
                    <GridItem>
                      <VStack>
                        <Text fontWeight="bold">{editingFixture.home_team?.name}</Text>
                        <Badge colorScheme="blue" size="sm">WHITE SIDE</Badge>
                                                                          <NumberInput
                           value={homeScore}
                           onChange={(valueString, value) => setHomeScore(value !== undefined ? value : 0)}
                           min={0}
                           max={50}
                         >
                           <NumberInputField />
                           <NumberInputStepper>
                             <NumberIncrementStepper />
                             <NumberDecrementStepper />
                           </NumberInputStepper>
                         </NumberInput>
                       </VStack>
                     </GridItem>
                     
                     <GridItem>
                       <Text fontSize="xl" color="gray.400">-</Text>
                     </GridItem>
                     
                     <GridItem>
                       <VStack>
                         <Text fontWeight="bold">{editingFixture.away_team?.name}</Text>
                         <Badge colorScheme="red" size="sm">BLUE SIDE</Badge>
                         <NumberInput
                           value={awayScore}
                           onChange={(valueString, value) => setAwayScore(value !== undefined ? value : 0)}
                           min={0}
                           max={50}
                         >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      </VStack>
                    </GridItem>
                  </Grid>
                </VStack>
              )}
            </ModalBody>

            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onClose}>
                Cancel
              </Button>
              <Button 
                colorScheme="blue" 
                onClick={handleSaveScore}
                isLoading={loading}
              >
                Save Score
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </Box>
  );
};

export default SeasonFixtures; 