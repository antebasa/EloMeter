import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Select,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Badge,
  Divider,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid
} from '@chakra-ui/react';
import {
  getSeasons,
  getSeasonStandings,
  type Season,
  type SeasonStanding
} from '../../lib/seasonSupabase';

const SeasonTable: React.FC = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [standings, setStandings] = useState<SeasonStanding[]>([]);
  const [loading, setLoading] = useState(false);
  
  const toast = useToast();

  useEffect(() => {
    loadSeasons();
  }, []);

  useEffect(() => {
    if (selectedSeasonId) {
      loadStandings();
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

  const loadStandings = async () => {
    if (!selectedSeasonId) return;
    
    setLoading(true);
    try {
      const standingsData = await getSeasonStandings(parseInt(selectedSeasonId));
      setStandings(standingsData);
    } catch (error) {
      toast({
        title: 'Error loading standings',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const getPositionColor = (position: number) => {
    if (position === 1) return 'gold';
    if (position === 2) return 'silver';
    if (position === 3) return 'orange';
    return 'gray';
  };

  const getWinPercentage = (standing: SeasonStanding) => {
    if (standing.matches_played === 0) return 0;
    return (standing.matches_won / standing.matches_played) * 100;
  };

  const selectedSeason = seasons.find(s => s.id.toString() === selectedSeasonId);

  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        <HStack justify="space-between" align="center">
          <Text fontSize="2xl" fontWeight="bold" color="white">
            Season League Table
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
            <HStack justify="space-between">
              <VStack align="start" spacing={1}>
                <Text color="white" fontSize="lg" fontWeight="bold">
                  {selectedSeason.name}
                </Text>
                <Text color="gray.300" fontSize="sm">
                  Started: {new Date(selectedSeason.start_date).toLocaleDateString()}
                  {selectedSeason.end_date && ` • Ended: ${new Date(selectedSeason.end_date).toLocaleDateString()}`}
                </Text>
              </VStack>
              <Badge 
                colorScheme={
                  selectedSeason.status === 'active' ? 'green' : 
                  selectedSeason.status === 'completed' ? 'blue' : 'yellow'
                }
                fontSize="sm"
                px={3}
                py={1}
              >
                {selectedSeason.status.toUpperCase()}
              </Badge>
            </HStack>
          </Box>
        )}

        <Divider />

        {loading && (
          <Text color="white" textAlign="center">Loading standings...</Text>
        )}

        {!loading && standings.length === 0 && selectedSeasonId && (
          <Text color="gray.400" textAlign="center">
            No standings data found for this season.
          </Text>
        )}

        {!loading && standings.length > 0 && (
          <>
            {/* League Statistics */}
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
              <Stat bg="gray.700" p={4} borderRadius="lg">
                <StatLabel color="gray.300">Total Teams</StatLabel>
                <StatNumber color="white">{standings.length}</StatNumber>
              </Stat>
              <Stat bg="gray.700" p={4} borderRadius="lg">
                <StatLabel color="gray.300">Matches Played</StatLabel>
                <StatNumber color="white">
                  {standings.reduce((sum, s) => sum + s.matches_played, 0)}
                </StatNumber>
              </Stat>
              <Stat bg="gray.700" p={4} borderRadius="lg">
                <StatLabel color="gray.300">Total Goals</StatLabel>
                <StatNumber color="white">
                  {standings.reduce((sum, s) => sum + s.goals_scored, 0)}
                </StatNumber>
              </Stat>
              <Stat bg="gray.700" p={4} borderRadius="lg">
                <StatLabel color="gray.300">Avg Goals/Match</StatLabel>
                <StatNumber color="white">
                  {standings.length > 0 
                    ? (standings.reduce((sum, s) => sum + s.goals_scored, 0) / 
                       Math.max(standings.reduce((sum, s) => sum + s.matches_played, 0), 1)).toFixed(1)
                    : '0.0'
                  }
                </StatNumber>
              </Stat>
            </SimpleGrid>

            {/* League Table */}
            <TableContainer bg="gray.800" borderRadius="lg" overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead bg="gray.700">
                  <Tr>
                    <Th color="white" textAlign="center">Pos</Th>
                    <Th color="white">Team</Th>
                    <Th color="white" textAlign="center">MP</Th>
                    <Th color="white" textAlign="center">W</Th>
                    <Th color="white" textAlign="center">D</Th>
                    <Th color="white" textAlign="center">L</Th>
                    <Th color="white" textAlign="center">GF</Th>
                    <Th color="white" textAlign="center">GA</Th>
                    <Th color="white" textAlign="center">GD</Th>
                    <Th color="white" textAlign="center">Pts</Th>
                    <Th color="white" textAlign="center">Win%</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {standings.map((standing, index) => {
                    const position = index + 1;
                    const winPercentage = getWinPercentage(standing);
                    
                    return (
                      <Tr 
                        key={standing.team_id}
                        bg={position <= 3 ? "gray.700" : "transparent"}
                        _hover={{ bg: "gray.600" }}
                      >
                        <Td textAlign="center">
                          <Badge 
                            colorScheme={getPositionColor(position)}
                            borderRadius="full"
                            px={2}
                            py={1}
                            fontWeight="bold"
                          >
                            {position}
                          </Badge>
                        </Td>
                        <Td>
                          <Text color="white" fontWeight="bold" fontSize="sm">
                            {standing.team_name}
                          </Text>
                        </Td>
                        <Td textAlign="center" color="white">{standing.matches_played}</Td>
                        <Td textAlign="center" color="green.400" fontWeight="bold">
                          {standing.matches_won}
                        </Td>
                        <Td textAlign="center" color="yellow.400" fontWeight="bold">
                          {standing.matches_drawn}
                        </Td>
                        <Td textAlign="center" color="red.400" fontWeight="bold">
                          {standing.matches_lost}
                        </Td>
                        <Td textAlign="center" color="blue.400" fontWeight="bold">
                          {standing.goals_scored}
                        </Td>
                        <Td textAlign="center" color="red.300">
                          {standing.goals_conceded}
                        </Td>
                        <Td textAlign="center" color={standing.goal_difference >= 0 ? "green.400" : "red.400"} fontWeight="bold">
                          {standing.goal_difference >= 0 ? '+' : ''}{standing.goal_difference}
                        </Td>
                        <Td textAlign="center">
                          <Badge 
                            colorScheme="blue" 
                            fontSize="sm"
                            fontWeight="bold"
                          >
                            {standing.points}
                          </Badge>
                        </Td>
                        <Td textAlign="center" color="white" fontSize="sm">
                          {winPercentage.toFixed(1)}%
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </TableContainer>

            {/* Legend */}
            <Box p={4} bg="gray.700" borderRadius="lg">
              <Text color="white" fontSize="sm" fontWeight="bold" mb={2}>Legend:</Text>
              <HStack spacing={4} flexWrap="wrap">
                <Text color="gray.300" fontSize="xs">MP = Matches Played</Text>
                <Text color="gray.300" fontSize="xs">W = Wins</Text>
                <Text color="gray.300" fontSize="xs">D = Draws</Text>
                <Text color="gray.300" fontSize="xs">L = Losses</Text>
                <Text color="gray.300" fontSize="xs">GF = Goals For</Text>
                <Text color="gray.300" fontSize="xs">GA = Goals Against</Text>
                <Text color="gray.300" fontSize="xs">GD = Goal Difference</Text>
                <Text color="gray.300" fontSize="xs">Pts = Points (3 for win, 1 for draw)</Text>
              </HStack>
            </Box>
          </>
        )}
      </VStack>
    </Box>
  );
};

export default SeasonTable; 