import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Text,
  Alert,
  AlertIcon,
  Progress,
  VStack,
  HStack,
  Badge,
  useColorModeValue
} from '@chakra-ui/react';
import { supabase } from '../supabaseClient';

interface WinPercentageStats {
  blue_wins: number;
  white_wins: number;
  total_matches: number;
  blue_percentage: number;
  white_percentage: number;
}

export const WinPercentage: React.FC = () => {
  const [stats, setStats] = useState<WinPercentageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.300');

  useEffect(() => {
    fetchWinPercentageStats();
  }, []);

  const fetchWinPercentageStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Query to get win percentage statistics
      // We're looking for matches where either team scored 10 (assuming 10 is the winning score)
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

    } catch (err) {
      console.error('Error fetching win percentage stats:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
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
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        <Heading size="lg" textAlign="center" color="white">
          Team Win Percentage Statistics
        </Heading>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {/* Blue Team Stats */}
          <Card bg={cardBg} shadow="lg">
            <CardHeader pb={2}>
              <Flex align="center" justify="space-between">
                <Heading size="md" color="blue.400">
                  Blue Team
                </Heading>
                <Badge colorScheme="blue" fontSize="sm">
                  {stats.blue_wins} wins
                </Badge>
              </Flex>
            </CardHeader>
            <CardBody pt={2}>
              <VStack spacing={4} align="stretch">
                <Stat>
                  <StatLabel color={textColor}>Win Percentage</StatLabel>
                  <StatNumber fontSize="3xl" color="blue.400">
                    {stats.blue_percentage}%
                  </StatNumber>
                  <StatHelpText color={textColor}>
                    {stats.blue_wins} wins out of {stats.total_matches} matches
                  </StatHelpText>
                </Stat>
                <Progress
                  value={stats.blue_percentage}
                  colorScheme="blue"
                  size="lg"
                  borderRadius="md"
                />
              </VStack>
            </CardBody>
          </Card>

          {/* White Team Stats */}
          <Card bg={cardBg} shadow="lg">
            <CardHeader pb={2}>
              <Flex align="center" justify="space-between">
                <Heading size="md" color="gray.500">
                  White Team
                </Heading>
                <Badge colorScheme="gray" fontSize="sm">
                  {stats.white_wins} wins
                </Badge>
              </Flex>
            </CardHeader>
            <CardBody pt={2}>
              <VStack spacing={4} align="stretch">
                <Stat>
                  <StatLabel color={textColor}>Win Percentage</StatLabel>
                  <StatNumber fontSize="3xl" color="gray.300">
                    {stats.white_percentage}%
                  </StatNumber>
                  <StatHelpText color={textColor}>
                    {stats.white_wins} wins out of {stats.total_matches} matches
                  </StatHelpText>
                </Stat>
                <Progress
                  value={stats.white_percentage}
                  colorScheme="gray"
                  size="lg"
                  borderRadius="md"
                />
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Summary Card */}
        <Card bg={cardBg} shadow="lg">
          <CardHeader>
            <Heading size="md" textAlign="center" color="white">
              Overall Summary
            </Heading>
          </CardHeader>
          <CardBody>
            <Stat textAlign="center">
              <StatLabel color={textColor}>Total Matches</StatLabel>
              <StatNumber color={textColor}>{stats.total_matches}</StatNumber>
            </Stat>
            <SimpleGrid columns={{ base: 2, md: 2 }} spacing={4}>
              <Stat textAlign="center">
                <StatLabel color={textColor}>Blue Wins</StatLabel>
                <StatNumber color="blue.400">{stats.blue_wins}</StatNumber>
              </Stat>
              <Stat textAlign="center">
                <StatLabel color={textColor}>White Wins</StatLabel>
                <StatNumber color="gray.300">{stats.white_wins}</StatNumber>
              </Stat>

            </SimpleGrid>

            {stats.total_matches > 0 && (
              <Box mt={6}>
                <Text textAlign="center" color={textColor} mb={2}>
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
                  <Text>Unfinished: {Math.round((100 - stats.blue_percentage - stats.white_percentage) * 100) / 100}%</Text>
                </HStack>
              </Box>
            )}
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
};
