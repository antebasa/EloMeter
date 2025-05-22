import type {ReactNode} from "react";
import {useEffect, useState} from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Avatar,
  Badge,
  Box,
  Flex,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Portal,
  Spinner,
  Tab,
  Table,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue
} from "@chakra-ui/react";
import {SearchIcon} from '@chakra-ui/icons';
import type {User as SupabaseUser, PlayerMatchStatsQueryResultEntry} from "../lib/supabase";
import {getPlayerMatchHistory, getUsers, getAllPlayerMatchStats} from "../lib/supabase";

// Extend SupabaseUser type to include avatar_url if it comes from your DB
interface User extends SupabaseUser {
  avatar_url?: string;
  elo_offense?: number;
  elo_defense?: number;
  elo_overall?: number;
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
  elo_overall?: number; // Added for overall ranking
  elo_offense?: number;
  elo_defense?: number;

  // Role-specific aggregated stats
  scoredAsDefense?: number;
  concededAsDefense?: number;
  matchesAsDefense?: number;
  scoredAsOffense?: number;
  concededAsOffense?: number;
  matchesAsOffense?: number;
}

// Define props for Players component
interface PlayersProps {
  onPlayerClick: (playerId: number) => void;
}

const positionColor = (position: number): string | undefined => {
  if (position === 0) return "#b5a64255"
  else if (position === 1) return "#c0c0c0aa"
  else if (position === 2) return "#cd7f3255"
  return
}

export const Players = ({ onPlayerClick }: PlayersProps) => {
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
  const headingColor = useColorModeValue("white", "gray.700");
  const inactiveTabColor = useColorModeValue("white", "gray.400");
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
  const [activeTab, setActiveTab] = useState(0); // 0 for offense, 1 for defense, 2 for overall

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        setError(null);
        const fetchedUsers: User[] = await getUsers();
        // Fetch all player match stats once
        const allStats: PlayerMatchStatsQueryResultEntry[] = await getAllPlayerMatchStats();

        // Group all stats by user_id for efficient lookup
        const statsByUser = allStats.reduce((acc, stat) => {
          const userId = stat.user_id;
          if (!acc[userId]) {
            acc[userId] = [];
          }
          acc[userId].push(stat);
          return acc;
        }, {} as Record<number, PlayerMatchStatsQueryResultEntry[]>);


        const playersWithAllStats = await Promise.all(
          fetchedUsers.map(async (user) => {
            if (!user.id) return {
              ...user,
              winPercentage: 0,
              recentFormDetailed: [],
              scoredAsDefense: 0,
              concededAsDefense: 0,
              matchesAsDefense: 0,
              scoredAsOffense: 0,
              concededAsOffense: 0,
              matchesAsOffense: 0,
            } as PlayerWithStats; // Cast to satisfy type

            // Role-specific aggregations
            let scoredAsDefense = 0;
            let concededAsDefense = 0;
            let matchesAsDefense = 0;
            let scoredAsOffense = 0;
            let concededAsOffense = 0;
            let matchesAsOffense = 0;

            const userStats = statsByUser[user.id] || [];

            userStats.forEach((stat: PlayerMatchStatsQueryResultEntry) => {
              // Determine role played in this match
              // Defense ELO changed = played defense
              if (stat.new_elo !== stat.old_elo && stat.new_elo_offense === stat.old_elo_offense) {
                matchesAsDefense++;
                scoredAsDefense += stat.scored;
                concededAsDefense += stat.conceded;
              }
              // Offense ELO changed = played offense
              else if (stat.new_elo_offense !== stat.old_elo_offense && stat.new_elo === stat.old_elo) {
                matchesAsOffense++;
                scoredAsOffense += stat.scored;
                concededAsOffense += stat.conceded;
              }
              // Fallback or ambiguous case: if only one changed, assign to that role
              // This might need refinement based on how ELO updates always happen for both in PlayerMatchStats
              else if (stat.new_elo !== stat.old_elo) { // Primarily a defensive role ELO update
                matchesAsDefense++;
                scoredAsDefense += stat.scored;
                concededAsDefense += stat.conceded;
              } else if (stat.new_elo_offense !== stat.old_elo_offense) { // Primarily an offensive role ELO update
                 matchesAsOffense++;
                scoredAsOffense += stat.scored;
                concededAsOffense += stat.conceded;
              }
              // If neither ELO specific to role changed but general stats exist, it's harder to categorize
              // For now, this logic prioritizes distinct ELO changes.
            });

            try {
              const rawMatchHistory = await getPlayerMatchHistory(user.id);
              console.log(`[DEBUG Players.tsx] rawMatchHistory for user ${user.id}:`, JSON.parse(JSON.stringify(rawMatchHistory)));

              const processedMatchHistory: MatchHistoryDisplayEntry[] = rawMatchHistory.map((match: any) => ({
                id: match.id,
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
              const played = user.played || 0; // Overall played from User table
              const winPercentage = played > 0 ? Math.round((wins / played) * 100) : 0;
              const recentMatchesDetailed: MatchHistoryDisplayEntry[] = processedMatchHistory.reverse().slice(0, 5);
              console.log(`[DEBUG Players.tsx] recentMatchesDetailed for user ${user.id} (for chips):`, JSON.parse(JSON.stringify(recentMatchesDetailed)));

              const offenseElo = user.elo_offense ?? 1400;
              const defenseElo = user.elo_defense ?? 1400;
              const overallElo = Math.round((offenseElo + defenseElo) / 2);

              return {
                ...user,
                winPercentage,
                recentFormDetailed: recentMatchesDetailed,
                elo_offense: offenseElo,
                elo_defense: defenseElo,
                elo_overall: overallElo,
                scoredAsDefense,
                concededAsDefense,
                matchesAsDefense,
                scoredAsOffense,
                concededAsOffense,
                matchesAsOffense,
              };
            } catch (fetchError) {
              console.error(`Error fetching/processing match history for player ${user.id}:`, fetchError);
              return {
                ...user,
                winPercentage: 0,
                recentFormDetailed: [],
                elo_offense: user.elo_offense ?? 1400,
                elo_defense: user.elo_defense ?? 1400,
                elo_overall: Math.round(((user.elo_offense ?? 1400) + (user.elo_defense ?? 1400)) / 2),
                scoredAsDefense: 0,
                concededAsDefense: 0,
                matchesAsDefense: 0,
                scoredAsOffense: 0,
                concededAsOffense: 0,
                matchesAsOffense: 0,
              } as PlayerWithStats; // Cast to satisfy type
            }
          })
        );

        let sortedPlayersList = [...playersWithAllStats] as PlayerWithStats[];
        if (activeTab === 0) {
          sortedPlayersList.sort((a, b) => (b.elo_offense || 0) - (a.elo_offense || 0));
        } else if (activeTab === 1) {
          sortedPlayersList.sort((a, b) => (b.elo_defense || 0) - (a.elo_defense || 0));
        } else { // activeTab === 2 for Overall
          sortedPlayersList.sort((a, b) => (b.elo_overall || 0) - (a.elo_overall || 0));
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
    const keyToSort: keyof PlayerWithStats = index === 0 ? 'elo_offense' : index === 1 ? 'elo_defense' : 'elo_overall';
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
                  opacity={1 - (2 * index / 10)}
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
        }) as ReactNode}
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
    <Box p={{ base: 2, md: 5 }}>
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
          <Tab fontWeight="semibold" _selected={{ color: selectedTabColor, bg: useColorModeValue('teal.50', 'teal.700') }} color={inactiveTabColor}>Overall Rankings</Tab>
        </TabList>

        <TabPanels>
          <TabPanel p={0}>
            <Box overflowX="auto">
              <Table variant="simple" size="md" bg={tableBg} boxShadow="md" borderRadius="md">
                <Thead bg={headerBg}>
                  <Tr>
                    <Th cursor="pointer" onClick={() => handleSort('name')}>Name{renderSortIcon('name')}</Th>
                    {activeTab === 0 && ( // Offense Tab
                      <>
                        <Th cursor="pointer" onClick={() => handleSort('elo_offense')}>Off. ELO {renderSortIcon('elo_offense')}</Th>
                        <Th cursor="pointer" onClick={() => handleSort('scoredAsOffense')}>Scored (O) {renderSortIcon('scoredAsOffense')}</Th>
                        <Th cursor="pointer" onClick={() => handleSort('concededAsOffense')}>Conceded (O) {renderSortIcon('concededAsOffense')}</Th>
                        <Th cursor="pointer" onClick={() => handleSort('matchesAsOffense')}>Played (O) {renderSortIcon('matchesAsOffense')}</Th>
                      </>
                    )}
                    <Th isNumeric cursor="pointer" onClick={() => handleSort('played')}>Played{renderSortIcon('played')}</Th>
                    <Th isNumeric cursor="pointer" onClick={() => handleSort('winPercentage')}>Win %{renderSortIcon('winPercentage')}</Th>
                    <Th>Recent Form</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredPlayers.map((player, idx) => (
                    <Tr
                      key={player.id}
                      _hover={{ bg: rowHoverBg }}
                      transition="background-color 0.2s ease-in-out"
                      cursor="pointer"
                      onClick={() => onPlayerClick(player.id)}
                      backgroundColor={positionColor(idx)}
                    >
                      <Td>
                        <Flex align="center">
                          <Text mr={'20px'} fontWeight="medium">{idx + 1}.</Text>
                          <Avatar size="sm" name={player.name} mr={3} src={player.avatar_url ? `${import.meta.env.VITE_SUPABASE_URL}/${player.avatar_url}` : undefined} />
                          <Text fontWeight="medium">{player.name}</Text>
                        </Flex>
                      </Td>
                      {/* Offense Stats */}
                      {activeTab === 0 && (
                        <>
                          <Td>{player.elo_offense || 1400}</Td>
                          <Td>{player.scoredAsOffense || 0}</Td>
                          <Td>{player.concededAsOffense || 0}</Td>
                          <Td>{player.matchesAsOffense || 0}</Td>
                        </>
                      )}
                      <Td isNumeric>{player.played || 0}</Td>
                      <Td isNumeric>{player.winPercentage}%</Td>
                      <Td>{renderRecentForm(player.recentFormDetailed) as ReactNode}</Td>
                    </Tr>
                  )) as ReactNode}
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
                    {activeTab === 1 && ( // Defense Tab
                      <>
                        <Th cursor="pointer" onClick={() => handleSort('elo_defense')}>Def. ELO {renderSortIcon('elo_defense')}</Th>
                        <Th cursor="pointer" onClick={() => handleSort('scoredAsDefense')}>Scored (D) {renderSortIcon('scoredAsDefense')}</Th>
                        <Th cursor="pointer" onClick={() => handleSort('concededAsDefense')}>Conceded (D) {renderSortIcon('concededAsDefense')}</Th>
                        <Th cursor="pointer" onClick={() => handleSort('matchesAsDefense')}>Played (D) {renderSortIcon('matchesAsDefense')}</Th>
                      </>
                    )}
                    <Th isNumeric cursor="pointer" onClick={() => handleSort('played')}>Played{renderSortIcon('played')}</Th>
                    <Th isNumeric cursor="pointer" onClick={() => handleSort('winPercentage')}>Win %{renderSortIcon('winPercentage')}</Th>
                    <Th>Recent Form</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredPlayers.map((player, idx) => (
                    <Tr
                      key={player.id}
                      _hover={{ bg: rowHoverBg }}
                      transition="background-color 0.2s ease-in-out"
                      cursor="pointer"
                      onClick={() => onPlayerClick(player.id)}
                      backgroundColor={positionColor(idx)}
                    >
                      <Td>
                        <Flex align="center">
                          <Text mr={'20px'} fontWeight="medium">{idx + 1}.</Text>
                          <Avatar size="sm" name={player.name} mr={3} src={player.avatar_url ? `${import.meta.env.VITE_SUPABASE_URL}/${player.avatar_url}` : undefined} />
                          <Text fontWeight="medium">{player.name}</Text>
                        </Flex>
                      </Td>
                      {/* Defense Stats */}
                      {activeTab === 1 && (
                        <>
                          <Td>{player.elo_defense || 1400}</Td>
                          <Td>{player.scoredAsDefense || 0}</Td>
                          <Td>{player.concededAsDefense || 0}</Td>
                          <Td>{player.matchesAsDefense || 0}</Td>
                        </>
                      )}
                      <Td isNumeric>{player.played || 0}</Td>
                      <Td isNumeric>{player.winPercentage}%</Td>
                      <Td>{renderRecentForm(player.recentFormDetailed)}</Td>
                    </Tr>
                  )) as ReactNode}
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
                    {activeTab === 2 && ( // Overall Tab
                      <>
                        <Th cursor="pointer" onClick={() => handleSort('elo_overall')}>Overall ELO {renderSortIcon('elo_overall')}</Th>
                        <Th cursor="pointer" onClick={() => handleSort('scored')}>Total Scored {renderSortIcon('scored')}</Th>
                        <Th cursor="pointer" onClick={() => handleSort('conceded')}>Total Conceded {renderSortIcon('conceded')}</Th>
                        <Th cursor="pointer" onClick={() => handleSort('played')}>Total Played {renderSortIcon('played')}</Th>
                      </>
                    )}
                    <Th isNumeric cursor="pointer" onClick={() => handleSort('winPercentage')}>Win %{renderSortIcon('winPercentage')}</Th>
                    <Th>Recent Form</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredPlayers.map((player, idx) => (
                    <Tr
                      key={player.id}
                      _hover={{ bg: rowHoverBg }}
                      transition="background-color 0.2s ease-in-out"
                      cursor="pointer"
                      onClick={() => onPlayerClick(player.id)}
                      backgroundColor={positionColor(idx)}
                    >
                      <Td>
                        <Flex align="center">
                          <Text mr={'20px'} fontWeight="medium">{idx + 1}.</Text>
                          <Avatar size="sm" name={player.name} mr={3} src={player.avatar_url ? `${import.meta.env.VITE_SUPABASE_URL}/${player.avatar_url}` : undefined} />
                          <Text fontWeight="medium">{player.name}</Text>
                        </Flex>
                      </Td>
                      {/* Overall Stats */}
                      {activeTab === 2 && (
                        <>
                          <Td>{player.elo_overall || 1400}</Td>
                          <Td>{player.scored || 0}</Td>{/* Total scored from User table */}
                          <Td>{player.conceded || 0}</Td>{/* Total conceded from User table */}
                          <Td>{player.played || 0}</Td>{/* Total played from User table */}
                        </>
                      )}
                      <Td>{player.winPercentage}%</Td>
                      <Td>{renderRecentForm(player.recentFormDetailed)}</Td>
                    </Tr>
                  )) as ReactNode}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
      {filteredPlayers.length === 0 && !loading && searchTerm && (
        <Text mt={4} textAlign="center" color={textColor}>No players found for "{searchTerm}".</Text>
      ) as ReactNode}
      {filteredPlayers.length === 0 && !loading && !searchTerm && (
         <Text mt={4} textAlign="center" color={textColor}>No players available. Add some players and matches to get started!</Text>
      ) as ReactNode}
    </Box>
  );
};
