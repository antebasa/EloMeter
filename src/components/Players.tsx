import { useState, useEffect } from "react";
import { 
  Box, 
  Heading, 
  Text, 
  Table, 
  Thead, 
  Tbody, 
  Tr, 
  Th, 
  Td, 
  Input, 
  InputGroup, 
  InputLeftElement,
  Badge,
  Flex,
  Spinner,
  HStack,
  Icon,
  useColorModeValue,
  Avatar,
  Alert,
  AlertIcon
} from "@chakra-ui/react";
import { getUsers, getPlayerMatchHistory } from "../lib/supabase";
import type { User } from "../lib/supabase";

// Extended player type with statistics
interface PlayerWithStats extends User {
  winPercentage: number;
  recentForm: ('W' | 'L' | 'D')[];
}

export const Players = () => {
  const [players, setPlayers] = useState<PlayerWithStats[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<PlayerWithStats[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof PlayerWithStats;
    direction: 'ascending' | 'descending';
  }>({ key: 'elo_score', direction: 'descending' });

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        const fetchedUsers = await getUsers();
        
        // Process each user to get their recent form
        const playersWithRecentForm = await Promise.all(
          fetchedUsers.map(async (user) => {
            if (!user.id) return { ...user, winPercentage: 0, recentForm: [] };
            
            try {
              // Get match history for the player
              const matchHistory = await getPlayerMatchHistory(user.id);
              
              // Calculate win percentage
              const wins = user.wins || 0;
              const played = user.played || 0;
              const winPercentage = played > 0 ? Math.round((wins / played) * 100) : 0;
              
              // Get last 5 matches for recent form
              const recentMatches = matchHistory.slice(0, 5);
              const recentForm = recentMatches.map(match => 
                match.result === 'Win' ? 'W' : match.result === 'Draw' ? 'D' : 'L'
              ) as ('W' | 'L' | 'D')[];
              
              return {
                ...user,
                winPercentage,
                recentForm
              };
            } catch (error) {
              console.error(`Error fetching data for player ${user.id}:`, error);
              return {
                ...user,
                winPercentage: 0,
                recentForm: []
              };
            }
          })
        );
        
        // Sort initially by ELO score descending
        const sortedPlayers = [...playersWithRecentForm].sort((a, b) => 
          (b.elo_score || 0) - (a.elo_score || 0)
        );
        
        setPlayers(sortedPlayers);
        setFilteredPlayers(sortedPlayers);
      } catch (error) {
        console.error("Error loading users:", error);
        setError("Failed to load players. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  useEffect(() => {
    // Filter players when search term changes
    if (searchTerm.trim() === '') {
      setFilteredPlayers(players);
    } else {
      const filtered = players.filter(player => 
        player.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPlayers(filtered);
    }
  }, [searchTerm, players]);

  const handleSort = (key: keyof PlayerWithStats) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }

    setSortConfig({ key, direction });
    
    // Sort the filtered players
    const sortedPlayers = [...filteredPlayers].sort((a, b) => {
      // Handle potential undefined values
      const aValue = a[key];
      const bValue = b[key];
      
      const valueA = aValue !== undefined ? aValue : 0;
      const valueB = bValue !== undefined ? bValue : 0;
      
      if (valueA < valueB) {
        return direction === 'ascending' ? -1 : 1;
      }
      if (valueA > valueB) {
        return direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
    
    setFilteredPlayers(sortedPlayers);
  };

  const renderSortIcon = (key: keyof PlayerWithStats) => {
    if (sortConfig.key !== key) {
      return null;
    }
    return sortConfig.direction === 'ascending' ? '↑' : '↓';
  };

  const renderRecentForm = (form: ('W' | 'L' | 'D')[]) => {
    if (form.length === 0) {
      return <Text fontSize="sm" color="gray.500">No recent matches</Text>;
    }
    
    return (
      <HStack spacing={1}>
        {form.map((result, index) => (
          <Badge 
            key={index} 
            colorScheme={result === 'W' ? 'green' : result === 'D' ? 'yellow' : 'red'} 
            variant="solid" 
            fontSize="xs"
            borderRadius="full"
            px={2}
          >
            {result}
          </Badge>
        ))}
      </HStack>
    );
  };

  return (
    <Box maxWidth="900px" mx="auto" p={6} borderRadius="lg" boxShadow="md" bg="white">
      <Heading as="h2" size="lg" mb={6}>Player Rankings</Heading>
      
      <InputGroup mb={6}>
        <InputLeftElement pointerEvents="none">
          🔍
        </InputLeftElement>
        <Input 
          placeholder="Search players..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </InputGroup>
      
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
        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>#</Th>
                <Th>Player</Th>
                <Th onClick={() => handleSort('elo_score')} cursor="pointer">
                  ELO Rating {renderSortIcon('elo_score')}
                </Th>
                <Th onClick={() => handleSort('played')} cursor="pointer">
                  Games {renderSortIcon('played')}
                </Th>
                <Th onClick={() => handleSort('wins')} cursor="pointer">
                  Wins {renderSortIcon('wins')}
                </Th>
                <Th onClick={() => handleSort('losses')} cursor="pointer">
                  Losses {renderSortIcon('losses')}
                </Th>
                <Th onClick={() => handleSort('winPercentage')} cursor="pointer">
                  Win % {renderSortIcon('winPercentage')}
                </Th>
                <Th>Recent Form</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredPlayers.map((player, index) => (
                <Tr key={player.id}>
                  <Td>{index + 1}</Td>
                  <Td>
                    <HStack>
                      <Avatar size="sm" name={player.name} bg="blue.500" />
                      <Text fontWeight="medium">{player.name}</Text>
                    </HStack>
                  </Td>
                  <Td>
                    <Badge colorScheme="purple" fontSize="md">
                      {player.elo_score || 1500}
                    </Badge>
                  </Td>
                  <Td>{player.played || 0}</Td>
                  <Td>{player.wins || 0}</Td>
                  <Td>{player.losses || 0}</Td>
                  <Td>
                    <Badge colorScheme={player.winPercentage >= 50 ? 'green' : 'orange'}>
                      {player.winPercentage}%
                    </Badge>
                  </Td>
                  <Td>{renderRecentForm(player.recentForm)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          
          {filteredPlayers.length === 0 && !loading && (
            <Box textAlign="center" py={8}>
              <Text>No players found matching your search.</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}; 