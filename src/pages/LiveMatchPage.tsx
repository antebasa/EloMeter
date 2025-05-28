import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Select,
  useToast,
  Heading,
  Card,
  CardBody,
  Divider,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
  SimpleGrid,
  IconButton,
  Flex,
  useClipboard,
  Tooltip,
  Code,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { ExternalLinkIcon, CopyIcon, ViewIcon } from '@chakra-ui/icons';
import { supabase } from '../supabaseClient';
import { getUsers } from '../lib/supabase';
import type { User } from '../lib/supabase';

interface LiveMatch {
  id: number;
  white_team_defense_id: number;
  white_team_offense_id: number;
  blue_team_defense_id: number;
  blue_team_offense_id: number;
  white_score: number;
  blue_score: number;
  status: string;
  created_at: string;
}

const LiveMatchPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeMatches, setActiveMatches] = useState<LiveMatch[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState({
    whiteDefense: '',
    whiteOffense: '',
    blueDefense: '',
    blueOffense: '',
  });
  
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
    loadActiveMatches();
  }, []);

  const loadUsers = async () => {
    try {
      const usersData = await getUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadActiveMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('live_matches')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActiveMatches(data || []);
    } catch (error) {
      console.error('Error loading active matches:', error);
    }
  };

  const handlePlayerChange = (position: string, userId: string) => {
    setSelectedPlayers(prev => ({
      ...prev,
      [position]: userId
    }));
  };

  const validateTeamSelection = () => {
    const { whiteDefense, whiteOffense, blueDefense, blueOffense } = selectedPlayers;
    
    if (!whiteDefense || !whiteOffense || !blueDefense || !blueOffense) {
      toast({
        title: 'Incomplete Team Selection',
        description: 'Please select all four players',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return false;
    }

    const allPlayers = [whiteDefense, whiteOffense, blueDefense, blueOffense];
    const uniquePlayers = new Set(allPlayers);
    
    if (uniquePlayers.size !== 4) {
      toast({
        title: 'Duplicate Player Selection',
        description: 'Each player can only be selected once',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return false;
    }

    return true;
  };

  const createLiveMatch = async () => {
    if (!validateTeamSelection()) return;

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('live_matches')
        .insert({
          white_team_defense_id: parseInt(selectedPlayers.whiteDefense),
          white_team_offense_id: parseInt(selectedPlayers.whiteOffense),
          blue_team_defense_id: parseInt(selectedPlayers.blueDefense),
          blue_team_offense_id: parseInt(selectedPlayers.blueOffense),
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Live Match Created',
        description: 'Players can now join their team screens',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Navigate to the live score display
      navigate(`/app/live-match/${data.id}/display`);
    } catch (error) {
      console.error('Error creating live match:', error);
      toast({
        title: 'Error',
        description: 'Failed to create live match',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setCreating(false);
    }
  };

  const getUserName = (userId: number) => {
    const user = users.find(u => u.id === userId);
    return user?.name || 'Unknown';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="200px">
        <Spinner size="xl" />
      </Box>
    );
  }

  return (
    <Box p={6} maxW="1000px" mx="auto">
      <VStack spacing={8} align="stretch">
        <Heading size="lg" textAlign="center">Live Match Control Center</Heading>
        
        {/* Active Matches */}
        {activeMatches.length > 0 && (
          <Box>
            <Heading size="md" mb={4} color="green.600">🔴 Active Matches</Heading>
            <VStack spacing={4}>
              {activeMatches.map((match) => (
                <ActiveMatchCard 
                  key={match.id} 
                  match={match} 
                  getUserName={getUserName}
                  navigate={navigate}
                />
              ))}
            </VStack>
          </Box>
        )}

        {activeMatches.length > 0 && <Divider />}

        {/* Create New Match */}
        <Box>
          <Heading size="md" mb={4} color="blue.600">➕ Create New Live Match</Heading>
          
          <VStack spacing={6}>
            {/* Team Selection */}
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} w="100%">
              {/* White Team */}
              <Card bg="white" borderWidth="2px" borderColor="gray.200">
                <CardBody>
                  <Heading size="sm" mb={4} color="gray.700" textAlign="center">
                    ⚪ White Team
                  </Heading>
                  <VStack spacing={4}>
                    <Box w="100%">
                      <Text fontSize="sm" mb={2} fontWeight="medium">Defense Player</Text>
                      <Select
                        placeholder="Select defender"
                        value={selectedPlayers.whiteDefense}
                        onChange={(e) => handlePlayerChange('whiteDefense', e.target.value)}
                        bg="white"
                      >
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </Select>
                    </Box>
                    <Box w="100%">
                      <Text fontSize="sm" mb={2} fontWeight="medium">Offense Player</Text>
                      <Select
                        placeholder="Select attacker"
                        value={selectedPlayers.whiteOffense}
                        onChange={(e) => handlePlayerChange('whiteOffense', e.target.value)}
                        bg="white"
                      >
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </Select>
                    </Box>
                  </VStack>
                </CardBody>
              </Card>

              {/* Blue Team */}
              <Card bg="blue.50" borderWidth="2px" borderColor="blue.200">
                <CardBody>
                  <Heading size="sm" mb={4} color="blue.700" textAlign="center">
                    🔵 Blue Team
                  </Heading>
                  <VStack spacing={4}>
                    <Box w="100%">
                      <Text fontSize="sm" mb={2} fontWeight="medium">Defense Player</Text>
                      <Select
                        placeholder="Select defender"
                        value={selectedPlayers.blueDefense}
                        onChange={(e) => handlePlayerChange('blueDefense', e.target.value)}
                        bg="white"
                      >
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </Select>
                    </Box>
                    <Box w="100%">
                      <Text fontSize="sm" mb={2} fontWeight="medium">Offense Player</Text>
                      <Select
                        placeholder="Select attacker"
                        value={selectedPlayers.blueOffense}
                        onChange={(e) => handlePlayerChange('blueOffense', e.target.value)}
                        bg="white"
                      >
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </Select>
                    </Box>
                  </VStack>
                </CardBody>
              </Card>
            </SimpleGrid>

            <Button
              colorScheme="green"
              size="lg"
              w="100%"
              maxW="400px"
              height="60px"
              fontSize="lg"
              onClick={createLiveMatch}
              isLoading={creating}
              loadingText="Creating Match..."
              leftIcon={<span style={{ fontSize: '20px' }}>🚀</span>}
            >
              Start Live Match
            </Button>
          </VStack>
        </Box>

        <Alert status="info" borderRadius="lg">
          <AlertIcon />
          <AlertDescription>
            <Text fontWeight="bold" mb={2}>How Live Matches Work:</Text>
            <Text fontSize="sm">
              1. Select 4 players (2 per team) and start a match<br />
              2. Share team control links with players for mobile scoring<br />
              3. View live scores on the main display screen<br />
              4. Game ends automatically when a team reaches 10 goals
            </Text>
          </AlertDescription>
        </Alert>
      </VStack>
    </Box>
  );
};

// Component for displaying active match cards
const ActiveMatchCard: React.FC<{
  match: LiveMatch;
  getUserName: (id: number) => string;
  navigate: (path: string) => void;
}> = ({ match, getUserName, navigate }) => {
  const baseUrl = window.location.origin;
  const whiteTeamUrl = `${baseUrl}/app/live-match/${match.id}/white`;
  const blueTeamUrl = `${baseUrl}/app/live-match/${match.id}/blue`;
  
  const { onCopy: onCopyWhite, hasCopied: hasCopiedWhite } = useClipboard(whiteTeamUrl);
  const { onCopy: onCopyBlue, hasCopied: hasCopiedBlue } = useClipboard(blueTeamUrl);

  return (
    <Card w="100%" borderWidth="2px" borderColor="green.200" bg="green.50">
      <CardBody>
        <VStack spacing={4}>
          {/* Match Info */}
          <HStack justify="space-between" w="100%" align="center">
            <VStack align="start" spacing={1} flex={1}>
              <HStack>
                <Badge colorScheme="gray" fontSize="sm">WHITE</Badge>
                <Text fontSize="sm" fontWeight="medium">
                  {getUserName(match.white_team_defense_id)} (D) & {getUserName(match.white_team_offense_id)} (O)
                </Text>
              </HStack>
              <HStack>
                <Badge colorScheme="blue" fontSize="sm">BLUE</Badge>
                <Text fontSize="sm" fontWeight="medium">
                  {getUserName(match.blue_team_defense_id)} (D) & {getUserName(match.blue_team_offense_id)} (O)
                </Text>
              </HStack>
            </VStack>
            
            <VStack spacing={2}>
              <Badge colorScheme="green" fontSize="2xl" px={4} py={2} borderRadius="full">
                {match.white_score} - {match.blue_score}
              </Badge>
              <Text fontSize="xs" color="gray.600">
                Match #{match.id}
              </Text>
            </VStack>
          </HStack>

          {/* Action Buttons */}
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3} w="100%">
            {/* Display Button */}
            <Button
              colorScheme="green"
              leftIcon={<ViewIcon />}
              onClick={() => navigate(`/app/live-match/${match.id}/display`)}
            >
              View Display
            </Button>

            {/* White Team Control */}
            <HStack spacing={1}>
              <Button
                flex={1}
                colorScheme="gray"
                size="sm"
                onClick={() => window.open(whiteTeamUrl, '_blank')}
                leftIcon={<ExternalLinkIcon />}
              >
                White Control
              </Button>
              <Tooltip label={hasCopiedWhite ? "Copied!" : "Copy link"}>
                <IconButton
                  aria-label="Copy white team link"
                  icon={<CopyIcon />}
                  size="sm"
                  colorScheme="gray"
                  variant="outline"
                  onClick={onCopyWhite}
                />
              </Tooltip>
            </HStack>

            {/* Blue Team Control */}
            <HStack spacing={1}>
              <Button
                flex={1}
                colorScheme="blue"
                size="sm"
                onClick={() => window.open(blueTeamUrl, '_blank')}
                leftIcon={<ExternalLinkIcon />}
              >
                Blue Control
              </Button>
              <Tooltip label={hasCopiedBlue ? "Copied!" : "Copy link"}>
                <IconButton
                  aria-label="Copy blue team link"
                  icon={<CopyIcon />}
                  size="sm"
                  colorScheme="blue"
                  variant="outline"
                  onClick={onCopyBlue}
                />
              </Tooltip>
            </HStack>
          </SimpleGrid>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default LiveMatchPage; 