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
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  Portal
} from "@chakra-ui/react";
import { SearchIcon } from '@chakra-ui/icons';
import { getUsers, getPlayerMatchHistory } from "../lib/supabase";
import type { User as SupabaseUser } from "../lib/supabase";

// Extend SupabaseUser type to include avatar_url if it comes from your DB
interface User extends SupabaseUser {
  avatar_url?: string;
}

interface MatchDetails {
  white_team_id: number;
  blue_team_id: number;
  // Add other relevant match details if present
}

interface MatchHistoryEntry {
  myTeamId: number;
  myTeamPlayers: string[];
  opponentTeamId: number;
  opponentTeamPlayers: string[];
  myTeamScore: number;
  opponentTeamScore: number;
  result: 'Win' | 'Loss' | 'Draw';
  date: string;
  eloChange?: number; // Made optional as it might not always be present if not calculated
  eloChangeOffense?: number; // Made optional
  oldElo?: number;
  newElo?: number;
  oldEloOffense?: number;
  newEloOffense?: number;
  matchDetails?: MatchDetails; // Optional if not always joined
  // Ensure all fields used in renderRecentForm are here
}

// Extended player type with statistics
interface PlayerWithStats extends User {
  winPercentage: number;
  recentFormDetailed: MatchHistoryEntry[];
}

export const Players = () => {
  // Moved useColorModeValue calls to the top
  const tableBg = useColorModeValue("white", "gray.750");
  const headerBg = useColorModeValue("gray.50", "gray.800");
  const rowHoverBg = useColorModeValue("gray.100", "gray.700");
  const textColor = useColorModeValue("gray.800", "whiteAlpha.900");
  const popoverBg = useColorModeValue("white", "gray.700");
  const popoverArrowBg = useColorModeValue("white", "gray.700");
  const popoverColor = useColorModeValue("gray.800", "whiteAlpha.900");
  const noRecentMatchesColor = useColorModeValue("gray.500", "gray.400");
  const searchIconColor = useColorModeValue("gray.400", "gray.300");

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
        setError(null);
        const fetchedUsers: User[] = await getUsers();
        
        const playersWithRecentForm = await Promise.all(
          fetchedUsers.map(async (user) => {
            if (!user.id) return { 
              ...user, 
              winPercentage: 0, 
              recentFormDetailed: []
            };
            
            try {
              const matchHistory: MatchHistoryEntry[] = await getPlayerMatchHistory(user.id);
              
              const wins = user.wins || 0;
              const played = user.played || 0;
              const winPercentage = played > 0 ? Math.round((wins / played) * 100) : 0;
              
              const recentMatchesDetailed: MatchHistoryEntry[] = matchHistory.slice(0, 5);
              
              return {
                ...user,
                winPercentage,
                recentFormDetailed: recentMatchesDetailed
              };
            } catch (fetchError) {
              console.error(`Error fetching match history for player ${user.id}:`, fetchError);
              return { // Return basic user data even if match history fails
                ...user,
                winPercentage: 0,
                recentFormDetailed: []
              };
            }
          })
        );
        
        // Default sort based on the active tab after loading
        let sortedPlayers = [...playersWithRecentForm];
        if (activeTab === 0) { // Offense
          sortedPlayers.sort((a, b) => (b.elo_offense || 0) - (a.elo_offense || 0));
        } else { // Defense
          sortedPlayers.sort((a, b) => (b.elo_defense || 0) - (a.elo_defense || 0));
        }
        
        setPlayers(sortedPlayers);
        setFilteredPlayers(sortedPlayers);
      } catch (err) {
        console.error("Error loading users:", err);
        setError("Failed to load players. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []); // Removed activeTab from dependencies to prevent re-fetching on tab change, sorting is handled by handleTabChange

  useEffect(() => {
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
    
    const sorted = [...filteredPlayers].sort((a, b) => {
      const aValue = a[key] as any; // Type assertion for comparison
      const bValue = b[key] as any; // Type assertion for comparison
      
      // Handle cases where ELO might be null or undefined, treating them as low values for sorting
      const valA = aValue === null || aValue === undefined ? (direction === 'ascending' ? Infinity : -Infinity) : aValue;
      const valB = bValue === null || bValue === undefined ? (direction === 'ascending' ? Infinity : -Infinity) : bValue;

      if (valA < valB) {
        return direction === 'ascending' ? -1 : 1;
      }
      if (valA > valB) {
        return direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
    setFilteredPlayers(sorted);
  };

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    // Apply default sort for the new tab and resort the *original* full list of players
    const keyToSort = index === 0 ? 'elo_offense' : 'elo_defense';
    setSortConfig({ key: keyToSort, direction: 'descending' });

    const sortedPlayers = [...players].sort((a, b) => {
        const aValue = a[keyToSort] || 0;
        const bValue = b[keyToSort] || 0;
        return bValue - aValue; // Descending
    });
    setPlayers(sortedPlayers); // Update the base players list with new sort
    // Apply search term if it exists
    if (searchTerm.trim() === '') {
      setFilteredPlayers(sortedPlayers);
    } else {
      const filtered = sortedPlayers.filter(player => 
        player.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPlayers(filtered);
    }
  };

  const renderSortIcon = (key: keyof PlayerWithStats) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
  };

  const renderRecentForm = (formDetailed: MatchHistoryEntry[]) => {
    if (!formDetailed || formDetailed.length === 0) {
      return <Text fontSize="sm" color={noRecentMatchesColor}>No recent matches</Text>;
    }
    
    return (
      <HStack spacing={1}>
        {formDetailed.map((match, index) => {
          const resultChar = match.result === 'Win' ? 'W' : match.result === 'Draw' ? 'D' : 'L';
          const badgeColorScheme = match.result === 'Win' ? 'green' : match.result === 'Draw' ? 'yellow' : 'red';
          
          const playerTeamColor = match.matchDetails && match.myTeamId === match.matchDetails.white_team_id ? 'White' : 
                                 (match.matchDetails && match.myTeamId === match.matchDetails.blue_team_id ? 'Blue' : 'N/A');

          const eloDefChange = (match.newElo !== undefined && match.oldElo !== undefined) ? (match.newElo - match.oldElo) : null;
          const eloOffChange = (match.newEloOffense !== undefined && match.oldEloOffense !== undefined) ? (match.newEloOffense - match.oldEloOffense) : null;
          
          let eloChangeStringArr: string[] = [];
          if (eloDefChange !== null) {
            eloChangeStringArr.push(`Def: ${eloDefChange > 0 ? '+' : ''}${eloDefChange}`);
          }
          if (eloOffChange !== null) {
            eloChangeStringArr.push(`Off: ${eloOffChange > 0 ? '+' : ''}${eloOffChange}`);
          }
          const eloDisplayString = eloChangeStringArr.length > 0 ? eloChangeStringArr.join(' / ') : "N/A";

          const myTeamPlayersDisplay = Array.isArray(match.myTeamPlayers) ? match.myTeamPlayers.join(' & ') : 'Unknown Players';
          const opponentTeamPlayersDisplay = Array.isArray(match.opponentTeamPlayers) ? match.opponentTeamPlayers.join(' & ') : 'Unknown Players';

          return (
            <Popover key={`${match.date}-${index}-${match.myTeamId}`} trigger="hover" placement="top" isLazy>
              <PopoverTrigger>
                <Badge 
                  colorScheme={badgeColorScheme} 
                  variant="solid" 
                  fontSize="xs"
                  borderRadius="full"
                  px={2}
                  cursor="help"
                >
                  {resultChar}
                </Badge>
              </PopoverTrigger>
              <Portal>
                <PopoverContent zIndex="tooltip" minWidth="300px" boxShadow="lg" 
                                bg={popoverBg} 
                                color={popoverColor}>
                  <PopoverArrow bg={popoverArrowBg} />
                  <PopoverCloseButton />
                  <PopoverHeader fontWeight="bold" borderBottomWidth="1px">
                    Match Details ({new Date(match.date).toLocaleDateString()})
                  </PopoverHeader>
                  <PopoverBody fontSize="sm">
                    <Text><strong>Your Team ({playerTeamColor}):</strong> {myTeamPlayersDisplay}</Text>
                    <Text><strong>Opponent:</strong> {opponentTeamPlayersDisplay}</Text>
                    <Text><strong>Score:</strong> {match.myTeamScore} - {match.opponentTeamScore} 
                      <Text as="span" fontWeight="bold" color={`${badgeColorScheme}.500`}> ({match.result})</Text>
                    </Text>
                    <Text><strong>ELO Change:</strong> {eloDisplayString}</Text>
                  </PopoverBody>
                </PopoverContent>
              </Portal>
            </Popover>
          );
        })}
      </HStack>
    );
  };

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" color="teal.500" />
        <Text mt={4} color={textColor}>Loading players...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert status="error" borderRadius="md" variant="left-accent">
        <AlertIcon />
        <Box flex="1">
          <AlertTitle>Error Loading Players</AlertTitle>
          <AlertDescription display="block">{error}</AlertDescription>
        </Box>
      </Alert>
    );
  }
  
  return (
    <Box p={{ base: 2, md: 5 }} color={textColor}>
      <Heading as="h1" size="xl" mb={6} textAlign="center">Player Rankings</Heading>
      
      <InputGroup mb={6} size="lg">
        <InputLeftElement pointerEvents="none">
          <SearchIcon color={searchIconColor} />
        </InputLeftElement>
        <Input 
          placeholder="Search players..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)}
          borderRadius="full"
          variant="filled"
          boxShadow="sm"
        />
      </InputGroup>

      <Tabs variant="soft-rounded" colorScheme="teal" onChange={handleTabChange} index={activeTab} isLazy>
        <TabList mb={4} justifyContent="center">
          <Tab fontWeight="semibold">Offense Rankings</Tab>
          <Tab fontWeight="semibold">Defense Rankings</Tab>
        </TabList>
        
        <TabPanels>
          <TabPanel p={0}>
            <Box overflowX="auto">
              <Table variant="simple" size="md" bg={tableBg} boxShadow="md" borderRadius="md">
                <Thead bg={headerBg}>
                  <Tr>
                    <Th cursor="pointer" onClick={() => handleSort('name')}>Name{renderSortIcon('name')}</Th>
                    <Th cursor="pointer" onClick={() => handleSort('elo_offense')}>Off. ELO{renderSortIcon('elo_offense')}</Th>
                    <Th isNumeric cursor="pointer" onClick={() => handleSort('played')}>Played{renderSortIcon('played')}</Th>
                    <Th isNumeric cursor="pointer" onClick={() => handleSort('scored')}>Scored{renderSortIcon('scored')}</Th>
                    <Th isNumeric cursor="pointer" onClick={() => handleSort('winPercentage')}>Win %{renderSortIcon('winPercentage')}</Th>
                    <Th>Recent Form</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredPlayers.map(player => (
                    <Tr key={player.id} _hover={{ bg: rowHoverBg }} transition="background-color 0.2s ease-in-out" cursor="pointer" /* onClick={() => navigateToPlayerProfile(player.id)} */>
                      <Td>
                        <Flex align="center">
                          <Avatar size="sm" name={player.name} mr={3} src={player.avatar_url || undefined} />
                          <Text fontWeight="medium">{player.name}</Text>
                        </Flex>
                      </Td>
                      <Td isNumeric fontWeight="bold" color="teal.500">{player.elo_offense || 1400}</Td>
                      <Td isNumeric>{player.played || 0}</Td>
                      <Td isNumeric>{player.scored || 0}</Td>
                      <Td isNumeric>{player.winPercentage}%</Td>
                      <Td>{renderRecentForm(player.recentFormDetailed)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>
          
          <TabPanel p={0}>
            <Box overflowX="auto">
              <Table variant="simple" size="md" bg={tableBg} boxShadow="md" borderRadius="md">
                <Thead bg={headerBg}>
                  <Tr>
                    <Th cursor="pointer" onClick={() => handleSort('name')}>Name{renderSortIcon('name')}</Th>
                    <Th cursor="pointer" onClick={() => handleSort('elo_defense')}>Def. ELO{renderSortIcon('elo_defense')}</Th>
                    <Th isNumeric cursor="pointer" onClick={() => handleSort('played')}>Played{renderSortIcon('played')}</Th>
                    <Th isNumeric cursor="pointer" onClick={() => handleSort('conceded')}>Conceded{renderSortIcon('conceded')}</Th>
                    <Th isNumeric cursor="pointer" onClick={() => handleSort('winPercentage')}>Win %{renderSortIcon('winPercentage')}</Th>
                    <Th>Recent Form</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredPlayers.map(player => (
                    <Tr key={player.id} _hover={{ bg: rowHoverBg }} transition="background-color 0.2s ease-in-out" cursor="pointer" /* onClick={() => navigateToPlayerProfile(player.id)} */>
                      <Td>
                        <Flex align="center">
                          <Avatar size="sm" name={player.name} mr={3} src={player.avatar_url || undefined} />
                          <Text fontWeight="medium">{player.name}</Text>
                        </Flex>
                      </Td>
                      <Td isNumeric fontWeight="bold" color="purple.500">{player.elo_defense || 1400}</Td>
                      <Td isNumeric>{player.played || 0}</Td>
                      <Td isNumeric>{player.conceded || 0}</Td>
                      <Td isNumeric>{player.winPercentage}%</Td>
                      <Td>{renderRecentForm(player.recentFormDetailed)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
      {filteredPlayers.length === 0 && !loading && searchTerm && (
        <Text mt={4} textAlign="center" color={textColor}>No players found for "{searchTerm}".</Text>
      )}
      {filteredPlayers.length === 0 && !loading && !searchTerm && (
         <Text mt={4} textAlign="center" color={textColor}>No players available. Add some players and matches to get started!</Text>
      )}
    </Box>
  );
}; 