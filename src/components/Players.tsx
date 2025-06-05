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
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
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
  useColorModeValue,
  VStack
} from "@chakra-ui/react";
import {SearchIcon} from '@chakra-ui/icons';
import {GiCrossedSwords, GiShield} from 'react-icons/gi';
import type {User as SupabaseUser, PlayerMatchStatsQueryResultEntry, TeamWithStats} from "../lib/supabase";
import {getPlayerMatchHistory, getUsers, getAllPlayerMatchStats, getTeamRankings, getTeamMatchHistory} from "../lib/supabase";

// Extend SupabaseUser type to include avatar_url if it comes from your DB
interface User extends SupabaseUser {
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
  winPercentageOffense?: number; // Win rate for matches played in offense
  winPercentageDefense?: number; // Win rate for matches played in defense
  recentFormDetailed: MatchHistoryDisplayEntry[];
  elo_overall?: number; // Added for overall ranking

  // Role-specific aggregated stats
  scoredAsDefense?: number;
  concededAsDefense?: number;
  matchesAsDefense?: number;
  winsAsDefense?: number; // Added for defense win rate calculation
  scoredAsOffense?: number;
  concededAsOffense?: number;
  matchesAsOffense?: number;
  winsAsOffense?: number; // Added for offense win rate calculation
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
  const [teams, setTeams] = useState<TeamWithStats[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<TeamWithStats[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof PlayerWithStats;
    direction: 'ascending' | 'descending';
  }>({ key: 'elo_offense', direction: 'descending' });
  const [teamSortConfig, setTeamSortConfig] = useState<{
    key: keyof TeamWithStats;
    direction: 'ascending' | 'descending';
  }>({ key: 'winPercentage', direction: 'descending' });
  const [activeTab, setActiveTab] = useState(0); // 0 for offense, 1 for defense, 2 for overall, 3 for teams
  const [selectedTeam, setSelectedTeam] = useState<TeamWithStats | null>(null);
  const [teamMatchHistory, setTeamMatchHistory] = useState<any[]>([]);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [loadingTeamHistory, setLoadingTeamHistory] = useState(false);

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
              winPercentageOffense: 0,
              winPercentageDefense: 0,
              recentFormDetailed: [],
              scoredAsDefense: 0,
              concededAsDefense: 0,
              matchesAsDefense: 0,
              winsAsDefense: 0,
              scoredAsOffense: 0,
              concededAsOffense: 0,
              matchesAsOffense: 0,
              winsAsOffense: 0,
            } as PlayerWithStats; // Cast to satisfy type

            // Role-specific aggregations
            let scoredAsDefense = 0;
            let concededAsDefense = 0;
            let matchesAsDefense = 0;
            let winsAsDefense = 0;
            let scoredAsOffense = 0;
            let concededAsOffense = 0;
            let matchesAsOffense = 0;
            let winsAsOffense = 0;

            const userStats = statsByUser[user.id] || [];

            userStats.forEach((stat: PlayerMatchStatsQueryResultEntry) => {
              // Determine role played in this match
              // Defense ELO changed = played defense
              if (stat.new_elo !== stat.old_elo && stat.new_elo_offense === stat.old_elo_offense) {
                matchesAsDefense++;
                scoredAsDefense += stat.scored;
                concededAsDefense += stat.conceded;
                console.log(11111, stat.scored, stat.conceded)
                if (stat.scored > stat.conceded) winsAsDefense++;
              }
              // Offense ELO changed = played offense
              else if (stat.new_elo_offense !== stat.old_elo_offense && stat.new_elo === stat.old_elo) {
                matchesAsOffense++;
                scoredAsOffense += stat.scored;
                concededAsOffense += stat.conceded;
                console.log(222, stat.scored, stat.conceded)
                if (stat.scored > stat.conceded) winsAsOffense++;
              }
              // Fallback or ambiguous case: if only one changed, assign to that role
              // This might need refinement based on how ELO updates always happen for both in PlayerMatchStats
              else if (stat.new_elo !== stat.old_elo) { // Primarily a defensive role ELO update
                matchesAsDefense++;
                scoredAsDefense += stat.scored;
                concededAsDefense += stat.conceded;
                console.log(33, stat.scored, stat.conceded)
                if (stat.scored > stat.conceded) winsAsDefense++;
              } else if (stat.new_elo_offense !== stat.old_elo_offense) { // Primarily an offensive role ELO update
                 matchesAsOffense++;
                scoredAsOffense += stat.scored;
                concededAsOffense += stat.conceded;
                console.log(44, stat.scored, stat.conceded)
                if (stat.scored > stat.conceded) winsAsOffense++;
              }
              // If neither ELO specific to role changed but general stats exist, it's harder to categorize
              // For now, this logic prioritizes distinct ELO changes.
            });

            // Calculate role-specific win percentages
            const winPercentageOffense = matchesAsOffense > 0 ? Math.round((winsAsOffense / matchesAsOffense) * 100) : 0;
            const winPercentageDefense = matchesAsDefense > 0 ? Math.round((winsAsDefense / matchesAsDefense) * 100) : 0;

            try {
              const rawMatchHistory = await getPlayerMatchHistory(user.id);

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
              const recentMatchesDetailed: MatchHistoryDisplayEntry[] = processedMatchHistory.slice(0, 5);

              const offenseElo = user.elo_offense ?? 1400;
              const defenseElo = user.elo_defense ?? 1400;
              const overallElo = Math.round((offenseElo + defenseElo) / 2);

              return {
                ...user,
                winPercentage,
                winPercentageOffense,
                winPercentageDefense,
                recentFormDetailed: recentMatchesDetailed,
                elo_offense: offenseElo,
                elo_defense: defenseElo,
                elo_overall: overallElo,
                scoredAsDefense,
                concededAsDefense,
                matchesAsDefense,
                winsAsDefense,
                scoredAsOffense,
                concededAsOffense,
                matchesAsOffense,
                winsAsOffense,
              };
            } catch (fetchError) {
              console.error(`Error fetching/processing match history for player ${user.id}:`, fetchError);
              return {
                ...user,
                winPercentage: 0,
                winPercentageOffense: 0,
                winPercentageDefense: 0,
                recentFormDetailed: [],
                elo_offense: user.elo_offense ?? 1400,
                elo_defense: user.elo_defense ?? 1400,
                elo_overall: Math.round(((user.elo_offense ?? 1400) + (user.elo_defense ?? 1400)) / 2),
                scoredAsDefense: 0,
                concededAsDefense: 0,
                matchesAsDefense: 0,
                winsAsDefense: 0,
                scoredAsOffense: 0,
                concededAsOffense: 0,
                matchesAsOffense: 0,
                winsAsOffense: 0,
              } as PlayerWithStats; // Cast to satisfy type
            }
          })
        );

        // Load teams data
        const fetchedTeams = await getTeamRankings();

        let sortedPlayersList = [...playersWithAllStats] as PlayerWithStats[];
        if (activeTab === 0) {
          sortedPlayersList.sort((a, b) => (b.elo_offense || 0) - (a.elo_offense || 0));
        } else if (activeTab === 1) {
          sortedPlayersList.sort((a, b) => (b.elo_defense || 0) - (a.elo_defense || 0));
        } else if (activeTab === 2) {
          sortedPlayersList.sort((a, b) => (b.elo_overall || 0) - (a.elo_overall || 0));
        }

        setPlayers(sortedPlayersList);
        setFilteredPlayers(sortedPlayersList);
        setTeams(fetchedTeams);
        setFilteredTeams(fetchedTeams);
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
    if (activeTab === 3) {
      // Filter teams
      if (searchTerm.trim() === '') {
        setFilteredTeams(teams);
      } else {
        const filtered = teams.filter(team =>
          team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          team.defender_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          team.attacker_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredTeams(filtered);
      }
    } else {
      // Filter players
      if (searchTerm.trim() === '') {
        setFilteredPlayers(players);
      } else {
        const filtered = players.filter(player =>
          player.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredPlayers(filtered);
      }
    }
  }, [searchTerm, players, teams, activeTab]);

  const handleTeamSort = (key: keyof TeamWithStats) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (teamSortConfig.key === key && teamSortConfig.direction === 'ascending') {
      direction = 'descending';
    }

    setTeamSortConfig({ key, direction });

    const sorted = [...filteredTeams].sort((a, b) => {
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
    setFilteredTeams(sorted);
  };

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
    
    if (index === 3) {
      // Teams tab - set default team sorting
      setTeamSortConfig({ key: 'winPercentage', direction: 'descending' });
      const sortedTeams = [...teams].sort((a, b) => b.winPercentage - a.winPercentage);
      setTeams(sortedTeams);
      if (searchTerm.trim() === '') {
        setFilteredTeams(sortedTeams);
      } else {
        const filtered = sortedTeams.filter(team =>
          team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          team.defender_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          team.attacker_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredTeams(filtered);
      }
    } else {
      // Player tabs
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
    }
  };

  const renderSortIcon = (key: keyof PlayerWithStats) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
  };

  const renderTeamSortIcon = (key: keyof TeamWithStats) => {
    if (teamSortConfig.key !== key) return null;
    return teamSortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
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

  const handleTeamClick = async (team: TeamWithStats) => {
    setSelectedTeam(team);
    setIsTeamModalOpen(true);
    setLoadingTeamHistory(true);
    
    try {
      const history = await getTeamMatchHistory(team.id);
      setTeamMatchHistory(history);
    } catch (error) {
      console.error('Error loading team match history:', error);
      setTeamMatchHistory([]);
    } finally {
      setLoadingTeamHistory(false);
    }
  };

  const closeTeamModal = () => {
    setIsTeamModalOpen(false);
    setSelectedTeam(null);
    setTeamMatchHistory([]);
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
      <Heading as="h1" size="xl" mb={6} textAlign="center" color={headingColor}>Rankings</Heading>

      <InputGroup mb={6} size={{ base: "md", md: "lg" }}>
        <InputLeftElement pointerEvents="none">
          <SearchIcon color={searchIconColor} />
        </InputLeftElement>
        <Input
          placeholder={activeTab === 3 ? "Search teams..." : "Search players..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          borderRadius="full"
          variant="filled"
          boxShadow="sm"
        />
      </InputGroup>

      <Tabs variant="soft-rounded" colorScheme="teal" onChange={handleTabChange} index={activeTab} isLazy>
        <TabList mb={4} justifyContent="center" flexWrap="wrap">
          <Tab fontWeight="semibold" _selected={{ color: selectedTabColor, bg: useColorModeValue('teal.50', 'teal.700') }} color={inactiveTabColor} fontSize={{ base: "sm", md: "md" }}>Offense Rankings</Tab>
          <Tab fontWeight="semibold" _selected={{ color: selectedTabColor, bg: useColorModeValue('teal.50', 'teal.700') }} color={inactiveTabColor} fontSize={{ base: "sm", md: "md" }}>Defense Rankings</Tab>
          <Tab fontWeight="semibold" _selected={{ color: selectedTabColor, bg: useColorModeValue('teal.50', 'teal.700') }} color={inactiveTabColor} fontSize={{ base: "sm", md: "md" }}>Overall Rankings</Tab>
          <Tab fontWeight="semibold" _selected={{ color: selectedTabColor, bg: useColorModeValue('teal.50', 'teal.700') }} color={inactiveTabColor} fontSize={{ base: "sm", md: "md" }}>Teams</Tab>
        </TabList>

        <TabPanels>
          <TabPanel p={0}>
            <Box overflowX="auto">
              <Table variant="simple" size={{ base: "sm", md: "md" }} bg={tableBg} boxShadow="md" borderRadius="md">
                <Thead bg={headerBg}>
                  <Tr>
                    <Th cursor="pointer" onClick={() => handleSort('name')}>Name{renderSortIcon('name')}</Th>
                    {activeTab === 0 && ( // Offense Tab
                      <>
                        <Th cursor="pointer" onClick={() => handleSort('elo_offense')}>Off. ELO {renderSortIcon('elo_offense')}</Th>
                        <Th cursor="pointer" onClick={() => handleSort('scoredAsOffense')}>Scored (O) {renderSortIcon('scoredAsOffense')}</Th>
                        <Th cursor="pointer" onClick={() => handleSort('concededAsOffense')}>Conceded (O) {renderSortIcon('concededAsOffense')}</Th>
                        <Th cursor="pointer" onClick={() => handleSort('matchesAsOffense')}>Played (O) {renderSortIcon('matchesAsOffense')}</Th>
                        <Th isNumeric cursor="pointer" onClick={() => handleSort('winPercentageOffense')}>Win % (O) {renderSortIcon('winPercentageOffense')}</Th>
                      </>
                    )}
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
                          <Td isNumeric>{player.winPercentageOffense || 0}%</Td>
                        </>
                      )}
                      <Td>{renderRecentForm(player.recentFormDetailed) as ReactNode}</Td>
                    </Tr>
                  )) as ReactNode}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>

          <TabPanel p={0}>
            <Box overflowX="auto">
              <Table variant="simple" size={{ base: "sm", md: "md" }} bg={tableBg} boxShadow="md" borderRadius="md">
                <Thead bg={headerBg}>
                  <Tr>
                    <Th cursor="pointer" onClick={() => handleSort('name')}>Name{renderSortIcon('name')}</Th>
                    {activeTab === 1 && ( // Defense Tab
                      <>
                        <Th cursor="pointer" onClick={() => handleSort('elo_defense')}>Def. ELO {renderSortIcon('elo_defense')}</Th>
                        <Th cursor="pointer" onClick={() => handleSort('scoredAsDefense')}>Scored (D) {renderSortIcon('scoredAsDefense')}</Th>
                        <Th cursor="pointer" onClick={() => handleSort('concededAsDefense')}>Conceded (D) {renderSortIcon('concededAsDefense')}</Th>
                        <Th cursor="pointer" onClick={() => handleSort('matchesAsDefense')}>Played (D) {renderSortIcon('matchesAsDefense')}</Th>
                        <Th isNumeric cursor="pointer" onClick={() => handleSort('winPercentageDefense')}>Win % (D) {renderSortIcon('winPercentageDefense')}</Th>
                      </>
                    )}
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
                          <Td isNumeric>{player.winPercentageDefense || 0}%</Td>
                        </>
                      )}
                      <Td>{renderRecentForm(player.recentFormDetailed)}</Td>
                    </Tr>
                  )) as ReactNode}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>

          <TabPanel p={0}>
            <Box overflowX="auto">
              <Table variant="simple" size={{ base: "sm", md: "md" }} bg={tableBg} boxShadow="md" borderRadius="md">
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
              <Table variant="simple" size={{ base: "sm", md: "md" }} bg={tableBg} boxShadow="md" borderRadius="md">
                <Thead bg={headerBg}>
                  <Tr>
                    <Th cursor="pointer" onClick={() => handleTeamSort('name')}>Team Name{renderTeamSortIcon('name')}</Th>
                    <Th cursor="pointer" onClick={() => handleTeamSort('played')}>Played{renderTeamSortIcon('played')}</Th>
                    <Th cursor="pointer" onClick={() => handleTeamSort('won')}>Won{renderTeamSortIcon('won')}</Th>
                    <Th isNumeric cursor="pointer" onClick={() => handleTeamSort('winPercentage')}>Win %{renderTeamSortIcon('winPercentage')}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredTeams.map((team, idx) => (
                    <Tr
                      key={team.id}
                      _hover={{ bg: rowHoverBg }}
                      transition="background-color 0.2s ease-in-out"
                      cursor="pointer"
                      onClick={() => handleTeamClick(team)}
                      backgroundColor={positionColor(idx)}
                    >
                      <Td>
                        <Flex align="center">
                          <Text mr={'20px'} fontWeight="medium">{idx + 1}.</Text>
                          <Flex direction="column" gap={1}>
                            <HStack spacing={2}>
                              <Icon as={GiShield} boxSize={4} color="blue.600" />
                              <Avatar 
                                size="xs" 
                                name={team.defender_name} 
                                src={team.defender_avatar_url ? `${import.meta.env.VITE_SUPABASE_URL}/${team.defender_avatar_url}` : undefined} 
                              />
                              <Text fontSize="sm" fontWeight="medium" color="blue.700">
                                {team.defender_name}
                              </Text>
                            </HStack>
                            <HStack spacing={2}>
                              <Icon as={GiCrossedSwords} boxSize={4} color="orange.600" />
                              <Avatar 
                                size="xs" 
                                name={team.attacker_name} 
                                src={team.attacker_avatar_url ? `${import.meta.env.VITE_SUPABASE_URL}/${team.attacker_avatar_url}` : undefined} 
                              />
                              <Text fontSize="sm" fontWeight="medium" color="orange.700">
                                {team.attacker_name}
                              </Text>
                            </HStack>
                          </Flex>
                        </Flex>
                      </Td>
                      <Td>{team.played}</Td>
                      <Td>{team.won}</Td>
                      <Td isNumeric>{team.winPercentage}%</Td>
                    </Tr>
                  )) as ReactNode}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
      {((activeTab === 3 && filteredTeams.length === 0) || (activeTab !== 3 && filteredPlayers.length === 0)) && !loading && searchTerm && (
        <Text mt={4} textAlign="center" color={textColor}>
          No {activeTab === 3 ? 'teams' : 'players'} found for "{searchTerm}".
        </Text>
      ) as ReactNode}
      {((activeTab === 3 && filteredTeams.length === 0) || (activeTab !== 3 && filteredPlayers.length === 0)) && !loading && !searchTerm && (
         <Text mt={4} textAlign="center" color={textColor}>
          No {activeTab === 3 ? 'teams' : 'players'} available. Add some {activeTab === 3 ? 'teams and' : 'players and'} matches to get started!
         </Text>
      ) as ReactNode}
      
      {/* Team Match History Modal */}
      <Modal isOpen={isTeamModalOpen} onClose={closeTeamModal} size="6xl">
        <ModalOverlay />
        <ModalContent maxH="90vh">
          <ModalHeader>
            {selectedTeam && (
              <VStack spacing={2} align="start">
                <Text fontSize="xl">Team Match History</Text>
                <HStack spacing={4}>
                  <HStack spacing={2}>
                    <Icon as={GiShield} boxSize={4} color="blue.600" />
                    <Avatar 
                      size="xs" 
                      name={selectedTeam.defender_name} 
                      src={selectedTeam.defender_avatar_url ? `${import.meta.env.VITE_SUPABASE_URL}/${selectedTeam.defender_avatar_url}` : undefined} 
                    />
                    <Text fontSize="sm" fontWeight="medium" color="blue.700">
                      {selectedTeam.defender_name}
                    </Text>
                  </HStack>
                  <Text fontSize="sm" color="gray.500">&</Text>
                  <HStack spacing={2}>
                    <Icon as={GiCrossedSwords} boxSize={4} color="orange.600" />
                    <Avatar 
                      size="xs" 
                      name={selectedTeam.attacker_name} 
                      src={selectedTeam.attacker_avatar_url ? `${import.meta.env.VITE_SUPABASE_URL}/${selectedTeam.attacker_avatar_url}` : undefined} 
                    />
                    <Text fontSize="sm" fontWeight="medium" color="orange.700">
                      {selectedTeam.attacker_name}
                    </Text>
                  </HStack>
                </HStack>
                <Text fontSize="sm" color="gray.600">
                  {selectedTeam.played} matches played • {selectedTeam.won} wins • {selectedTeam.winPercentage}% win rate
                </Text>
              </VStack>
            )}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto">
            {loadingTeamHistory ? (
              <Box textAlign="center" py={10}>
                <Spinner size="xl" color="teal.500" />
                <Text mt={4} color={textColor}>Loading team match history...</Text>
              </Box>
            ) : teamMatchHistory.length === 0 ? (
              <Box textAlign="center" py={10}>
                <Text color={textColor}>No match history available for this team.</Text>
              </Box>
            ) : (
              <Box
                display="grid"
                gridTemplateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
                gap={4}
                pb={4}
              >
                {teamMatchHistory.map((match, index) => {
                  const isWin = match.result === "Win";
                  const isDraw = match.result === "Draw";
                  
                  return (
                    <Box
                      key={index}
                      p={4}
                      borderRadius="md"
                      bg={isWin ? "green.50" : isDraw ? "gray.50" : "red.50"}
                      border="2px solid"
                      borderColor={isWin ? "green.200" : isDraw ? "gray.200" : "red.200"}
                      _hover={{
                        borderColor: isWin ? "green.400" : isDraw ? "gray.400" : "red.400",
                        transform: "translateY(-1px)"
                      }}
                      transition="all 0.2s ease"
                    >
                      <VStack spacing={3}>
                        {/* Date */}
                        <Text fontSize="xs" color="gray.500">
                          {new Date(match.date).toLocaleDateString()}
                        </Text>
                        
                        {/* Score */}
                        <Text fontSize="xl" fontWeight="bold" color="gray.800">
                          {match.score}
                        </Text>
                        
                        {/* Result */}
                        <Badge 
                          colorScheme={isWin ? "green" : isDraw ? "gray" : "red"}
                          variant="solid"
                          fontSize="sm"
                        >
                          {match.result}
                        </Badge>
                        
                        {/* Team Color */}
                        <Text fontSize="sm" color="gray.600">
                          Played as {match.teamColor} team
                        </Text>
                        
                        {/* VS */}
                        <Text fontSize="xs" color="gray.500" fontWeight="bold">VS</Text>
                        
                        {/* Opponent */}
                        <Text fontSize="sm" fontWeight="medium" color="red.700" textAlign="center">
                          {match.opponent}
                        </Text>
                      </VStack>
                    </Box>
                  );
                })}
              </Box>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};
