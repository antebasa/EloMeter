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
  Avatar
} from "@chakra-ui/react";
import { getUsers } from "../lib/supabase";
import type { User } from "../lib/supabase";

// Extended player type with statistics
interface PlayerWithStats extends User {
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPercentage: number;
  recentForm: ('W' | 'L')[];
}

// Mock data generator
const generatePlayerStats = (user: User): PlayerWithStats => {
  const gamesPlayed = Math.floor(Math.random() * 50) + 10;
  const wins = Math.floor(Math.random() * gamesPlayed);
  const losses = gamesPlayed - wins;
  const winPercentage = Math.round((wins / gamesPlayed) * 100);
  
  // Generate random recent form (last 5 games)
  const generateRecentForm = (): ('W' | 'L')[] => {
    const form: ('W' | 'L')[] = [];
    for (let i = 0; i < 5; i++) {
      form.push(Math.random() > 0.5 ? 'W' : 'L');
    }
    return form;
  };

  return {
    ...user,
    rating: Math.round(1400 + Math.random() * 200),
    gamesPlayed,
    wins,
    losses,
    winPercentage,
    recentForm: generateRecentForm()
  };
};

export const Players = () => {
  const [players, setPlayers] = useState<PlayerWithStats[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<PlayerWithStats[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof PlayerWithStats;
    direction: 'ascending' | 'descending';
  }>({ key: 'rating', direction: 'descending' });

  useEffect(() => {
    async function loadUsers() {
      try {
        const fetchedUsers = await getUsers();
        // Add mock statistics to each user
        const playersWithStats = fetchedUsers.map(user => generatePlayerStats(user));
        
        // Sort initially by rating descending
        const sortedPlayers = [...playersWithStats].sort((a, b) => b.rating - a.rating);
        
        setPlayers(sortedPlayers);
        setFilteredPlayers(sortedPlayers);
      } catch (error) {
        console.error("Error loading users:", error);
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
      if (a[key] < b[key]) {
        return direction === 'ascending' ? -1 : 1;
      }
      if (a[key] > b[key]) {
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

  const renderRecentForm = (form: ('W' | 'L')[]) => {
    return (
      <HStack spacing={1}>
        {form.map((result, index) => (
          <Badge 
            key={index} 
            colorScheme={result === 'W' ? 'green' : 'red'} 
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
                <Th onClick={() => handleSort('rating')} cursor="pointer">
                  ELO Rating {renderSortIcon('rating')}
                </Th>
                <Th onClick={() => handleSort('gamesPlayed')} cursor="pointer">
                  Games {renderSortIcon('gamesPlayed')}
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
                      {player.rating}
                    </Badge>
                  </Td>
                  <Td>{player.gamesPlayed}</Td>
                  <Td>{player.wins}</Td>
                  <Td>{player.losses}</Td>
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
          
          {filteredPlayers.length === 0 && (
            <Box textAlign="center" py={8}>
              <Text>No players found matching your search.</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}; 