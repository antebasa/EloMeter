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

// Updated to match the structure returned by getPlayerMatchHistory
interface MatchHistoryDisplayEntry {
  id: number; // PlayerMatchStats ID
  match_db_id: number; // Match ID from Match table
  date: string;
  result: 'Win' | 'Loss' | 'Draw';
  score: string; // e.g., "10-5"
  eloChange: number;
  oldElo: number;
  newElo: number;
  // scored_by_team: number; // Available from getPlayerMatchHistory if needed
  // conceded_by_team: number; // Available from getPlayerMatchHistory if needed
  teammate: string;
  opponents: string;
  // For popover, we need to know the player's team ID in this match and the match's white/blue team IDs
  myTeamIdInMatch: number; 
  matchWhiteTeamId: number;
  matchBlueTeamId: number;
}

interface PlayerWithStats extends User {
  winPercentage: number;
  recentFormDetailed: MatchHistoryDisplayEntry[];
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
  const headingColor = useColorModeValue("gray.700", "white");
  const inactiveTabColor = useColorModeValue("gray.600", "gray.400");
  const selectedTabColor = useColorModeValue("teal.600", "teal.300");

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
              // getPlayerMatchHistory now returns an array of objects that should somewhat match MatchHistoryDisplayEntry
              // We need to ensure the fields required by MatchHistoryDisplayEntry are present or mapped.
              const rawMatchHistory = await getPlayerMatchHistory(user.id);
              
              const processedMatchHistory: MatchHistoryDisplayEntry[] = rawMatchHistory.map((match: any) => ({
                id: match.id, // This is PlayerMatchStats.id
                match_db_id: match.match_db_id,
                date: match.date,
                result: match.result,
                score: match.score,
                eloChange: match.eloChange,
                oldElo: match.oldElo,
                newElo: match.newElo,
                teammate: match.teammate,
                opponents: match.opponents,
                myTeamIdInMatch: match.player_team_id_in_match, 
                matchWhiteTeamId: match.match_details_white_team_id, 
                matchBlueTeamId: match.match_details_blue_team_id,
              }));
              
              const wins = user.wins || 0;
              const played = user.played || 0;
              const winPercentage = played > 0 ? Math.round((wins / played) * 100) : 0;
              
              const recentMatchesDetailed: MatchHistoryDisplayEntry[] = processedMatchHistory.slice(0, 5);
              
              return {
                ...user,
                winPercentage,
                recentFormDetailed: recentMatchesDetailed
              };
            } catch (fetchError) {
              console.error(`Error fetching/processing match history for player ${user.id}:`, fetchError);
              return { 
                ...user,
                winPercentage: 0,
                recentFormDetailed: []
              };
            }
          })
        );
        
        let sortedPlayersList = [...playersWithRecentForm];
        if (activeTab === 0) { 
          sortedPlayersList.sort((a, b) => (b.elo_offense || 0) - (a.elo_offense || 0));
        } else { 
          sortedPlayersList.sort((a, b) => (b.elo_defense || 0) - (a.elo_defense || 0));
        }
        
        setPlayers(sortedPlayersList);
        setFilteredPlayers(sortedPlayersList);
      } catch (err) {
        console.error("Error loading users:", err);
        setError("Failed to load players. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []); 

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
      const aValue = a[key] as any; 
      const bValue = b[key] as any; 
      
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
    const keyToSort = index === 0 ? 'elo_offense' : 'elo_defense';
    setSortConfig({ key: keyToSort, direction: 'descending' });

    const sortedPlayersList = [...players].sort((a, b) => {
        const aValue = a[keyToSort] || 0;
        const bValue = b[keyToSort] || 0;
        return bValue - aValue; 
    });
    setPlayers(sortedPlayersList); 
    if (searchTerm.trim() === '') {
      setFilteredPlayers(sortedPlayersList);
    } else {
      const filtered = sortedPlayersList.filter(player => 
        player.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPlayers(filtered);
    }
  };

  const renderSortIcon = (key: keyof PlayerWithStats) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
  };

  const renderRecentForm = (formDetailed: MatchHistoryDisplayEntry[]) => {
    if (!formDetailed || formDetailed.length === 0) {
      return <Text fontSize="sm" color={noRecentMatchesColor}>No recent matches</Text>;
    }
    
    return (
      <HStack spacing={1}>
        {formDetailed.map((match, index) => {
          const resultChar = match.result === 'Win' ? 'W' : match.result === 'Draw' ? 'D' : 'L';
          const badgeColorScheme = match.result === 'Win' ? 'green' : match.result === 'Draw' ? 'yellow' : 'red';
          
          let playerTeamColor = 'N/A';
          if (match.myTeamIdInMatch && match.matchWhiteTeamId && match.myTeamIdInMatch === match.matchWhiteTeamId) {
            playerTeamColor = 'White';
          } else if (match.myTeamIdInMatch && match.matchBlueTeamId && match.myTeamIdInMatch === match.matchBlueTeamId) {
            playerTeamColor = 'Blue';
          }

          const eloChangeDisplay = match.eloChange > 0 ? `+${match.eloChange}` : `${match.eloChange}`;

          return (
            <Popover key={`${match.match_db_id}-${index}`} trigger="hover" placement="top" isLazy>
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
                    <Text><strong>Your Team ({playerTeamColor}):</strong> {match.teammate}</Text>
                    <Text><strong>Opponent:</strong> {match.opponents}</Text>
                    <Text><strong>Score:</strong> {match.score} 
                      <Text as="span" fontWeight="bold" color={`${badgeColorScheme}.500`}> ({match.result})</Text>
                    </Text>
                    <Text><strong>ELO Change:</strong> {eloChangeDisplay} (New: {match.newElo})</Text>
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
      <Heading as="h1" size="xl" mb={6} textAlign="center" color={headingColor}>Player Rankings</Heading>
      
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
          <Tab fontWeight="semibold" _selected={{ color: selectedTabColor, bg: useColorModeValue('teal.50', 'teal.700') }} color={inactiveTabColor}>Offense Rankings</Tab>
          <Tab fontWeight="semibold" _selected={{ color: selectedTabColor, bg: useColorModeValue('teal.50', 'teal.700') }} color={inactiveTabColor}>Defense Rankings</Tab>
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
                    <Tr key={player.id} _hover={{ bg: rowHoverBg }} transition="background-color 0.2s ease-in-out" cursor="pointer" >
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
                    <Tr key={player.id} _hover={{ bg: rowHoverBg }} transition="background-color 0.2s ease-in-out" cursor="pointer" >
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