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
  IconButton
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
  type Season
} from '../../lib/seasonSupabase';
import { getTeamRankings, type TeamWithStats } from '../../lib/supabase';

const SeasonManagement: React.FC = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [teams, setTeams] = useState<TeamWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [newSeasonDate, setNewSeasonDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [seasonToDelete, setSeasonToDelete] = useState<Season | null>(null);
  
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
      const [seasonsData, teamsData] = await Promise.all([
        getSeasons(),
        getTeamRankings()
      ]);
      setSeasons(seasonsData);
      setTeams(teamsData);
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

    if (selectedTeams.length < 2) {
      toast({
        title: 'Select at least 2 teams',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);
    try {
      const season = await createSeason(newSeasonName, newSeasonDate);
      if (season) {
        const teamIds = selectedTeams.map(id => parseInt(id));
        const success = await addTeamsToSeason(season.id, teamIds);
        
        if (success) {
          await generateFixtures(season.id);
          toast({
            title: 'Season created successfully',
            description: 'Teams added and fixtures generated',
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
          
          // Reset form
          setNewSeasonName('');
          setSelectedTeams([]);
          setNewSeasonDate(new Date().toISOString().split('T')[0]);
          onCreateClose();
          loadData();
        } else {
          toast({
            title: 'Error adding teams to season',
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
      <Modal isOpen={isCreateOpen} onClose={onCreateClose} size="xl">
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

              <Box w="full">
                <Text mb={2} fontWeight="bold">Select Teams (minimum 2):</Text>
                <CheckboxGroup value={selectedTeams} onChange={(values) => setSelectedTeams(values as string[])}>
                  <Stack spacing={2} maxH="300px" overflowY="auto">
                    {teams.map((team) => (
                      <Checkbox key={team.id} value={team.id.toString()}>
                        <Text fontSize="sm">
                          {team.name} ({team.played} matches, {team.winPercentage.toFixed(1)}% win rate)
                        </Text>
                      </Checkbox>
                    ))}
                  </Stack>
                </CheckboxGroup>
              </Box>
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
              isDisabled={!newSeasonName.trim() || selectedTeams.length < 2}
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