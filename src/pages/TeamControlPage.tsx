import React, { useState } from 'react';
import {
  Box,
  Button,
  VStack,
  Text,
  useToast,
  Heading,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
  HStack,
  IconButton,
  Flex,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowBackIcon, ExternalLinkIcon } from '@chakra-ui/icons';
import { useLiveMatch } from '../hooks/useLiveMatch';

const TeamControlPage: React.FC = () => {
  const { matchId, team } = useParams<{ matchId: string; team: 'white' | 'blue' }>();
  const { match, loading, error, updateScore } = useLiveMatch(matchId);
  const [updating, setUpdating] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const handleScoreUpdate = async (scoreType: 'attack' | 'defense' | 'backspace') => {
    if (!match || updating) return;

    setUpdating(true);
    
    let updateType: 'white_attack' | 'blue_attack' | 'white_backspace' | 'blue_backspace' | 'white_defense' | 'blue_defense';
    
    if (team === 'white') {
      if (scoreType === 'attack') {
        updateType = 'white_attack';
      } else if (scoreType === 'defense') {
        updateType = 'white_defense';
      } else {
        updateType = 'white_backspace';
      }
    } else {
      if (scoreType === 'attack') {
        updateType = 'blue_attack';
      } else if (scoreType === 'defense') {
        updateType = 'blue_defense';
      } else {
        updateType = 'blue_backspace';
      }
    }

    const success = await updateScore(updateType);
    
    if (!success) {
      toast({
        title: 'Error',
        description: 'Failed to update score',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
    
    setUpdating(false);
  };

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        height="100vh"
        bg={team === 'white' ? 'white' : 'blue.50'}
      >
        <Spinner size="xl" color={team === 'white' ? 'gray.600' : 'blue.600'} />
      </Box>
    );
  }

  if (error || !match) {
    return (
      <Box 
        p={6} 
        textAlign="center"
        height="100vh"
        bg={team === 'white' ? 'white' : 'blue.50'}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Alert status="error" maxW="400px">
          <AlertIcon />
          <AlertDescription>{error || 'Match not found or no longer active'}</AlertDescription>
        </Alert>
      </Box>
    );
  }

  const teamScore = team === 'white' ? match.white_score : match.blue_score;
  const opponentScore = team === 'white' ? match.blue_score : match.white_score;
  const isWhiteTeam = team === 'white';

  return (
    <Box
      height="100vh"
      bg={isWhiteTeam ? 'white' : 'blue.50'}
      display="flex"
      flexDirection="column"
      position="relative"
    >
      {/* Header with Navigation */}
      <Box 
        p={4} 
        borderBottom="1px" 
        borderColor={isWhiteTeam ? 'gray.200' : 'blue.200'}
        bg={isWhiteTeam ? 'gray.50' : 'blue.100'}
      >
        <Flex justify="space-between" align="center">
          <IconButton
            aria-label="Back to match display"
            icon={<ArrowBackIcon />}
            variant="ghost"
            colorScheme={isWhiteTeam ? 'gray' : 'blue'}
            onClick={() => navigate(`/app/live-match/${matchId}/display`)}
          />
          
          <VStack spacing={1}>
            <Heading 
              size="lg" 
              color={isWhiteTeam ? 'gray.700' : 'blue.700'}
              textAlign="center"
            >
              {team?.toUpperCase()} TEAM
            </Heading>
            <Badge 
              fontSize="xl" 
              px={4} 
              py={2} 
              colorScheme={isWhiteTeam ? 'gray' : 'blue'}
              borderRadius="full"
            >
              {teamScore} - {opponentScore}
            </Badge>
          </VStack>

          <IconButton
            aria-label="Open match display"
            icon={<ExternalLinkIcon />}
            variant="ghost"
            colorScheme={isWhiteTeam ? 'gray' : 'blue'}
            onClick={() => window.open(`/app/live-match/${matchId}/display`, '_blank')}
          />
        </Flex>
      </Box>

      {/* Control Buttons */}
      <VStack spacing={6} flex={1} justify="center" p={6}>
        {/* Attack Goal Button */}
        <Button
          size="lg"
          height="140px"
          width="100%"
          maxW="400px"
          colorScheme="green"
          fontSize="2xl"
          fontWeight="bold"
          onClick={() => handleScoreUpdate('attack')}
          isLoading={updating}
          borderRadius="xl"
          boxShadow="lg"
          _hover={{ 
            transform: 'scale(1.02)',
            boxShadow: 'xl'
          }}
          _active={{ transform: 'scale(0.98)' }}
          bg="green.500"
          _loading={{ bg: 'green.400' }}
        >
          <VStack spacing={2}>
            <Text fontSize="3xl">⚽</Text>
            <Text>ATTACK GOAL</Text>
            <Text fontSize="lg" opacity={0.9}>+1 for {team?.toUpperCase()}</Text>
          </VStack>
        </Button>

        {/* Defense Goal Button */}
        <Button
          size="lg"
          height="140px"
          width="100%"
          maxW="400px"
          colorScheme="red"
          fontSize="2xl"
          fontWeight="bold"
          onClick={() => handleScoreUpdate('defense')}
          isLoading={updating}
          borderRadius="xl"
          boxShadow="lg"
          _hover={{ 
            transform: 'scale(1.02)',
            boxShadow: 'xl'
          }}
          _active={{ transform: 'scale(0.98)' }}
          bg="red.500"
          _loading={{ bg: 'red.400' }}
        >
          <VStack spacing={2}>
            <Text fontSize="3xl">🛡️</Text>
            <Text>DEFENSE GOAL</Text>
            <Text fontSize="lg" opacity={0.9}>-1 from opponent</Text>
          </VStack>
        </Button>

        {/* Backspace Button */}
        <Button
          size="md"
          height="100px"
          width="100%"
          maxW="300px"
          colorScheme="orange"
          fontSize="lg"
          fontWeight="bold"
          onClick={() => handleScoreUpdate('backspace')}
          isLoading={updating}
          borderRadius="xl"
          boxShadow="md"
          _hover={{ 
            transform: 'scale(1.02)',
            boxShadow: 'lg'
          }}
          _active={{ transform: 'scale(0.98)' }}
          bg="orange.500"
          _loading={{ bg: 'orange.400' }}
        >
          <VStack spacing={1}>
            <Text fontSize="2xl">⬅️</Text>
            <Text>UNDO</Text>
            <Text fontSize="sm" opacity={0.9}>-1 from {team?.toUpperCase()}</Text>
          </VStack>
        </Button>
      </VStack>

      {/* Game Status */}
      {match.status === 'finished' && (
        <Box p={4}>
          <Alert status="success" borderRadius="lg">
            <AlertIcon />
            <AlertDescription fontSize="lg">
              🎉 Game finished! Final score: {match.white_score} - {match.blue_score}
            </AlertDescription>
          </Alert>
        </Box>
      )}

      {/* Instructions */}
      <Box 
        p={4} 
        textAlign="center" 
        borderTop="1px" 
        borderColor={isWhiteTeam ? 'gray.200' : 'blue.200'}
        bg={isWhiteTeam ? 'gray.50' : 'blue.100'}
      >
        <Text fontSize="sm" color={isWhiteTeam ? 'gray.600' : 'blue.700'}>
          Tap buttons to update the score in real-time
        </Text>
        <HStack justify="center" mt={2} spacing={4}>
          <Text fontSize="xs" color={isWhiteTeam ? 'gray.500' : 'blue.600'}>
            Match ID: {matchId}
          </Text>
          <Text fontSize="xs" color={isWhiteTeam ? 'gray.500' : 'blue.600'}>
            Status: {match.status.toUpperCase()}
          </Text>
        </HStack>
      </Box>
    </Box>
  );
};

export default TeamControlPage; 