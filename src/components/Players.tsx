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
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Tooltip,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel
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
  }>({ key: 'elo_offense', direction: 'descending' });
  const [activeTab, setActiveTab] = useState(0); // 0 for offense, 1 for defense

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        const fetchedUsers = await getUsers();
        
        // Process each user to get their recent form
        const playersWithRecentForm = await Promise.all(
          fetchedUsers.map(async (user) => {
            if (!user.id) return { 
              ...user, 
              winPercentage: 0, 
              recentForm: []
            };
            
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
        
        // Initial sort by offense ELO
        const sortedPlayers = [...playersWithRecentForm].sort((a, b) => 
          (b.elo_offense || 0) - (a.elo_offense || 0)
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

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    // Reset sort config based on active tab
    if (index === 0) { // Offense tab
      handleSort('elo_offense');
    } else { // Defense tab
      handleSort('elo_defense');
    }
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

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4}>Loading players...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Box>
      </Alert>
    );
  }

  return (
    <Box p={5}>
      <Heading as="h1" size="xl" mb={6}>Player Rankings</Heading>
      
      <InputGroup mb={6}>
        <InputLeftElement pointerEvents="none">
          🔍
        </InputLeftElement>
        <Input 
          placeholder="Search players..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)}
          borderRadius="full"
          bg="white"
          boxShadow="sm"
        />
      </InputGroup>

      <Tabs variant="enclosed" colorScheme="blue" onChange={handleTabChange} index={activeTab}>
        <TabList>
          <Tab fontWeight="bold">Offense Rankings</Tab>
          <Tab fontWeight="bold">Defense Rankings</Tab>
        </TabList>
        
        <TabPanels>
          {/* Offense Tab */}
          <TabPanel>
            <Table variant="simple" size="md" bg="white" boxShadow="sm" borderRadius="md" overflow="hidden">
              <Thead bg="gray.50">
                <Tr>
                  <Th width="10%">Rank</Th>
                  <Th width="25%">Player</Th>
                  <Th width="15%" cursor="pointer" onClick={() => handleSort('elo_offense')}>
                    Offense ELO {renderSortIcon('elo_offense')}
                  </Th>
                  <Th width="10%" cursor="pointer" onClick={() => handleSort('winPercentage')}>
                    Win % {renderSortIcon('winPercentage')}
                  </Th>
                  <Th width="10%" cursor="pointer" onClick={() => handleSort('played')}>
                    Matches {renderSortIcon('played')}
                  </Th>
                  <Th width="15%" cursor="pointer" onClick={() => handleSort('goals')}>
                    Goals {renderSortIcon('goals')}
                  </Th>
                  <Th width="15%">Form</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredPlayers
                  .sort((a, b) => (b.elo_offense || 0) - (a.elo_offense || 0)) // Ensure sorted by offense ELO
                  .map((player, index) => (
                    <Tr key={player.id} _hover={{ bg: "gray.50" }}>
                      <Td>{index + 1}</Td>
                      <Td>
                        <Flex align="center">
                          <Avatar size="sm" name={player.name} mr={2} />
                          <Text fontWeight="medium">{player.name}</Text>
                        </Flex>
                      </Td>
                      <Td isNumeric fontWeight="bold">{player.elo_offense || 1400}</Td>
                      <Td isNumeric>{player.winPercentage}%</Td>
                      <Td isNumeric>{player.played || 0}</Td>
                      <Td isNumeric>{player.goals || 0}</Td>
                      <Td>{renderRecentForm(player.recentForm)}</Td>
                    </Tr>
                  ))}
                {filteredPlayers.length === 0 && (
                  <Tr>
                    <Td colSpan={7} textAlign="center" py={4}>
                      No players found
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </TabPanel>
          
          {/* Defense Tab */}
          <TabPanel>
            <Table variant="simple" size="md" bg="white" boxShadow="sm" borderRadius="md" overflow="hidden">
              <Thead bg="gray.50">
                <Tr>
                  <Th width="10%">Rank</Th>
                  <Th width="25%">Player</Th>
                  <Th width="15%" cursor="pointer" onClick={() => handleSort('elo_defense')}>
                    Defense ELO {renderSortIcon('elo_defense')}
                  </Th>
                  <Th width="10%" cursor="pointer" onClick={() => handleSort('winPercentage')}>
                    Win % {renderSortIcon('winPercentage')}
                  </Th>
                  <Th width="10%" cursor="pointer" onClick={() => handleSort('played')}>
                    Matches {renderSortIcon('played')}
                  </Th>
                  <Th width="15%" cursor="pointer" onClick={() => handleSort('conceded')}>
                    Conceded {renderSortIcon('conceded')}
                  </Th>
                  <Th width="15%">Form</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredPlayers
                  .sort((a, b) => (b.elo_defense || 0) - (a.elo_defense || 0)) // Ensure sorted by defense ELO
                  .map((player, index) => (
                    <Tr key={player.id} _hover={{ bg: "gray.50" }}>
                      <Td>{index + 1}</Td>
                      <Td>
                        <Flex align="center">
                          <Avatar size="sm" name={player.name} mr={2} />
                          <Text fontWeight="medium">{player.name}</Text>
                        </Flex>
                      </Td>
                      <Td isNumeric fontWeight="bold">{player.elo_defense || 1400}</Td>
                      <Td isNumeric>{player.winPercentage}%</Td>
                      <Td isNumeric>{player.played || 0}</Td>
                      <Td isNumeric>{player.conceded || 0}</Td>
                      <Td>{renderRecentForm(player.recentForm)}</Td>
                    </Tr>
                  ))}
                {filteredPlayers.length === 0 && (
                  <Tr>
                    <Td colSpan={7} textAlign="center" py={4}>
                      No players found
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}; 