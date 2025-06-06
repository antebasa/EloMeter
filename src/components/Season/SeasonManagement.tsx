import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Input,
  Select,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Checkbox,
  CheckboxGroup,
  Stack,
  Divider,
  Badge,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  IconButton,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper
} from '@chakra-ui/react';
import { DeleteIcon, EditIcon } from '@chakra-ui/icons';
import {
  getSeasons,
  createSeason,
  addTeamsToSeason,
  generateFixtures,
  updateSeasonStatus,
  getSeasonTeams,
  removeTeamFromSeason,
  deleteSeason,
  createTeamsFromPlayersAndAddToSeason,
  type Season
} from '../../lib/seasonSupabase';
import { getTeamRankings, getUsers, type TeamWithStats, type User } from '../../lib/supabase';

const SeasonManagement: React.FC = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [teams, setTeams] = useState<TeamWithStats[]>([]);
  const [players, setPlayers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [newSeasonDate, setNewSeasonDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [seasonToDelete, setSeasonToDelete] = useState<Season | null>(null);
  const [selectionMode, setSelectionMode] = useState<'manual' | 'random' | 'players'>('manual');
  const [teamCount, setTeamCount] = useState<number>(4);
  const [createdTeamsFromPlayers, setCreatedTeamsFromPlayers] = useState<Array<{defense: User, offense: User}>>([]);
  
  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const toast = useToast();
  const cancelRef = React.useRef<HTMLButtonElement>(null) as any;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [seasonsData, teamsData, playersData] = await Promise.all([
        getSeasons(),
        getTeamRankings(),
        getUsers()
      ]);
      setSeasons(seasonsData);
      setTeams(teamsData);
      setPlayers(playersData);
      console.log('Loaded players:', playersData.length, playersData);
    } catch (error) {
      toast({
        title: 'Error loading data',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRandomTeamSelection = () => {
    if (teams.length < teamCount) {
      toast({
        title: 'Not enough teams',
        description: `Need at least ${teamCount} teams for random selection`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const shuffled = [...teams].sort(() => 0.5 - Math.random());
    const randomTeams = shuffled.slice(0, teamCount).map(team => team.id.toString());
    setSelectedTeams(randomTeams);
    
    toast({
      title: 'Teams randomly selected!',
      description: `Selected ${teamCount} random teams`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleGenerateTeamsFromPlayers = () => {
    if (selectedPlayers.length < 4 || selectedPlayers.length % 2 !== 0) {
      toast({
        title: 'Invalid player count',
        description: 'Please select an even number of players (minimum 4)',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const playerObjects = selectedPlayers.map(id => 
      players.find(p => p.id.toString() === id)!
    );

    // Shuffle players and pair them
    const shuffled = [...playerObjects].sort(() => 0.5 - Math.random());
    const newTeams: Array<{defense: User, offense: User}> = [];
    
    for (let i = 0; i < shuffled.length; i += 2) {
      newTeams.push({
        defense: shuffled[i],
        offense: shuffled[i + 1]
      });
    }

    setCreatedTeamsFromPlayers(newTeams);
    
    toast({
      title: 'Teams generated!',
      description: `Created ${newTeams.length} teams from selected players`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleCreateSeason = async () => {
    if (!newSeasonName.trim()) {
      toast({
        title: 'Season name is required',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Validation based on selection mode
    if (selectionMode === 'players') {
      if (createdTeamsFromPlayers.length < 2) {
        toast({
          title: 'Generate teams first',
          description: 'Please generate teams from selected players',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
    } else {
      if (selectedTeams.length < 2) {
        toast({
          title: 'Select at least 2 teams',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
    }

    setLoading(true);
    try {
      const season = await createSeason(newSeasonName, newSeasonDate);
      if (season) {
        let success = false;
        
        if (selectionMode === 'players') {
          // Create teams from players and add to season
          success = await createTeamsFromPlayersAndAddToSeason(season.id, createdTeamsFromPlayers);
        } else {
          // Add existing teams to season
          const teamIds = selectedTeams.map(id => parseInt(id));
          success = await addTeamsToSeason(season.id, teamIds);
        }
        
        if (success) {
          await generateFixtures(season.id);
          toast({
            title: 'Season created successfully',
            description: selectionMode === 'players' 
              ? 'Teams created from players and fixtures generated'
              : 'Teams added and fixtures generated',
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
          
          // Reset form
          setNewSeasonName('');
          setSelectedTeams([]);
          setSelectedPlayers([]);
          setCreatedTeamsFromPlayers([]);
          setSelectionMode('manual');
          setNewSeasonDate(new Date().toISOString().split('T')[0]);
          onCreateClose();
          loadData();
        } else {
          toast({
            title: 'Error setting up season teams',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Error creating season',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (season: Season, newStatus: 'draft' | 'active' | 'completed') => {
    setLoading(true);
    try {
      const success = await updateSeasonStatus(season.id, newStatus);
      if (success) {
        toast({
          title: 'Season status updated',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        loadData();
      } else {
        toast({
          title: 'Error updating season status',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: 'Error updating season status',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSeason = (season: Season) => {
    setEditingSeason(season);
    onEditOpen();
  };

  const handleDeleteSeason = (season: Season) => {
    setSeasonToDelete(season);
    onDeleteOpen();
  };

  const confirmDeleteSeason = async () => {
    if (!seasonToDelete) return;
    
    setLoading(true);
    try {
      const success = await deleteSeason(seasonToDelete.id);
      if (success) {
        toast({
          title: 'Season deleted successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        loadData();
      } else {
        toast({
          title: 'Error deleting season',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: 'Error deleting season',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
      setSeasonToDelete(null);
      onDeleteClose();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'completed': return 'blue';
      case 'draft': return 'yellow';
      default: return 'gray';
    }
  };

  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        <HStack justify="space-between">
          <Text fontSize="2xl" fontWeight="bold" color="white">
            Season Management
          </Text>
          <Button colorScheme="blue" onClick={onCreateOpen} isLoading={loading}>
            Create New Season
          </Button>
        </HStack>

        <Divider />

        {/* Seasons List */}
        <VStack spacing={4} align="stretch">
          {seasons.map((season) => (
            <Box
              key={season.id}
              p={4}
              borderWidth={1}
              borderRadius="lg"
              bg="gray.700"
              borderColor="gray.600"
            >
              <HStack justify="space-between" align="start">
                <VStack align="start" spacing={2}>
                  <HStack>
                    <Text fontSize="lg" fontWeight="bold" color="white">
                      {season.name}
                    </Text>
                    <Badge colorScheme={getStatusColor(season.status)}>
                      {season.status}
                    </Badge>
                  </HStack>
                  <Text color="gray.300" fontSize="sm">
                    Started: {new Date(season.start_date).toLocaleDateString()}
                    {season.end_date && ` • Ended: ${new Date(season.end_date).toLocaleDateString()}`}
                  </Text>
                </VStack>
                
                <HStack>
                  <Select
                    value={season.status}
                    onChange={(e) => handleStatusChange(season, e.target.value as any)}
                    size="sm"
                    bg="gray.600"
                    color="white"
                    borderColor="gray.500"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </Select>
                  <IconButton
                    aria-label="Edit season"
                    icon={<EditIcon />}
                    size="sm"
                    onClick={() => handleEditSeason(season)}
                  />
                  <IconButton
                    aria-label="Delete season"
                    icon={<DeleteIcon />}
                    size="sm"
                    colorScheme="red"
                    onClick={() => handleDeleteSeason(season)}
                  />
                </HStack>
              </HStack>
            </Box>
          ))}
        </VStack>
      </VStack>

      {/* Create Season Modal */}
      <Modal isOpen={isCreateOpen} onClose={onCreateClose} size="2xl">
        <ModalOverlay />
        <ModalContent bg="gray.800" color="white">
          <ModalHeader>Create New Season</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Input
                placeholder="Season Name (e.g., 'Season 1 - January 2024')"
                value={newSeasonName}
                onChange={(e) => setNewSeasonName(e.target.value)}
                bg="gray.700"
                borderColor="gray.600"
              />
              
              <Input
                type="date"
                value={newSeasonDate}
                onChange={(e) => setNewSeasonDate(e.target.value)}
                bg="gray.700"
                borderColor="gray.600"
              />

              {/* Selection Mode */}
              <Box w="full">
                <Text mb={2} fontWeight="bold" color="white">Team Selection Method:</Text>
                <Select
                  value={selectionMode}
                  onChange={(e) => {
                    setSelectionMode(e.target.value as 'manual' | 'random' | 'players');
                    setSelectedTeams([]);
                    setSelectedPlayers([]);
                    setCreatedTeamsFromPlayers([]);
                  }}
                  bg="gray.700"
                  borderColor="gray.600"
                  color="white"
                  sx={{
                    option: {
                      bg: 'gray.700',
                      color: 'white',
                      _hover: {
                        bg: 'gray.600'
                      }
                    }
                  }}
                >
                  <option style={{ backgroundColor: '#2D3748', color: 'white' }} value="manual">📋 Manual Team Selection</option>
                  <option style={{ backgroundColor: '#2D3748', color: 'white' }} value="random">🎲 Random Team Selection</option>
                  <option style={{ backgroundColor: '#2D3748', color: 'white' }} value="players">👥 Select Players & Create Teams</option>
                </Select>
              </Box>

              {/* Manual Team Selection */}
              {selectionMode === 'manual' && (
                <Box w="full">
                  <Text mb={2} fontWeight="bold" color="white">Select Teams (minimum 2):</Text>
                  <CheckboxGroup value={selectedTeams} onChange={(values) => setSelectedTeams(values as string[])}>
                    <Stack spacing={2} maxH="300px" overflowY="auto">
                      {teams.map((team) => (
                        <Checkbox key={team.id} value={team.id.toString()}>
                          <Text fontSize="sm" color="white">
                            {team.name} ({team.played} matches, {team.winPercentage.toFixed(1)}% win rate)
                          </Text>
                        </Checkbox>
                      ))}
                    </Stack>
                  </CheckboxGroup>
                </Box>
              )}

              {/* Random Team Selection */}
              {selectionMode === 'random' && (
                <Box w="full">
                  <VStack spacing={3}>
                    <HStack w="full">
                      <Text fontWeight="bold" color="white">Number of teams:</Text>
                      <Select
                        value={teamCount}
                        onChange={(e) => setTeamCount(parseInt(e.target.value))}
                        w="100px"
                        bg="gray.700"
                        borderColor="gray.600"
                        color="white"
                        sx={{
                          option: {
                            bg: 'gray.700',
                            color: 'white'
                          }
                        }}
                      >
                        {[2, 3, 4, 5, 6, 7, 8].map(num => (
                          <option key={num} value={num} style={{ backgroundColor: '#2D3748', color: 'white' }}>{num}</option>
                        ))}
                      </Select>
                    </HStack>
                    <Button 
                      colorScheme="green" 
                      onClick={handleRandomTeamSelection}
                      w="full"
                      isDisabled={teams.length < teamCount}
                    >
                      🎲 Randomly Select {teamCount} Teams
                    </Button>
                    {selectedTeams.length > 0 && (
                      <Box w="full">
                        <Text fontSize="sm" fontWeight="bold" mb={2} color="white">Selected Teams:</Text>
                        <Stack spacing={1}>
                          {selectedTeams.map(teamId => {
                            const team = teams.find(t => t.id.toString() === teamId);
                            return team ? (
                              <Text key={teamId} fontSize="sm" color="green.400">
                                ✓ {team.name}
                              </Text>
                            ) : null;
                          })}
                        </Stack>
                      </Box>
                    )}
                  </VStack>
                </Box>
              )}

              {/* Player Selection & Team Creation */}
              {selectionMode === 'players' && (
                <Box w="full">
                  <VStack spacing={3}>
                    <Text fontWeight="bold" color="white">Select Players (even number, minimum 4):</Text>
                    
                    {/* Debug info */}
                    <Text fontSize="xs" color="gray.400">
                      Available players: {players.length} | Selected: {selectedPlayers.length}
                    </Text>
                    
                    {players.length === 0 ? (
                      <Text color="red.400" fontSize="sm">No players found. Loading...</Text>
                    ) : (
                      <CheckboxGroup value={selectedPlayers} onChange={(values) => setSelectedPlayers(values as string[])}>
                        <Stack spacing={2} maxH="200px" overflowY="auto" w="full" bg="gray.700" p={2} borderRadius="md">
                          {players.map((player) => (
                            <Checkbox key={player.id} value={player.id.toString()} colorScheme="blue">
                              <Text fontSize="sm" color="white">
                                {player.name} (ELO: {player.elo_defense || 1400}D / {player.elo_offense || 1400}O)
                              </Text>
                            </Checkbox>
                          ))}
                        </Stack>
                      </CheckboxGroup>
                    )}
                    
                    <Button 
                      colorScheme="purple" 
                      onClick={handleGenerateTeamsFromPlayers}
                      w="full"
                      isDisabled={selectedPlayers.length < 4 || selectedPlayers.length % 2 !== 0}
                    >
                      🔀 Generate Teams from {selectedPlayers.length} Players
                    </Button>

                    {createdTeamsFromPlayers.length > 0 && (
                      <Box w="full">
                        <Text fontSize="sm" fontWeight="bold" mb={2} color="white">Generated Teams:</Text>
                        <Stack spacing={2}>
                          {createdTeamsFromPlayers.map((team, index) => (
                            <Box key={index} p={2} bg="gray.600" borderRadius="md">
                              <Text fontSize="sm" color="blue.300">
                                Team {index + 1}: {team.defense.name} (Defense) & {team.offense.name} (Offense)
                              </Text>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </VStack>
                </Box>
              )}
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCreateClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={handleCreateSeason}
              isLoading={loading}
              isDisabled={
                !newSeasonName.trim() || 
                (selectionMode === 'players' && createdTeamsFromPlayers.length < 2) ||
                (selectionMode !== 'players' && selectedTeams.length < 2)
              }
            >
              Create Season
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg="gray.800" color="white">
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Season
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete "{seasonToDelete?.name}"? 
              This action cannot be undone and will remove all fixtures and results.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button 
                colorScheme="red" 
                onClick={confirmDeleteSeason} 
                ml={3}
                isLoading={loading}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default SeasonManagement; 