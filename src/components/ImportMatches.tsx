import { useState } from 'react';
import { Button, Box, Text, VStack, Alert, AlertIcon, Progress, useToast } from '@chakra-ui/react';
import { saveMatch} from '../lib/supabase';
import { supabase } from '../lib/supabase';

// Parse a match string into the required format
// Format: "Player1/Player2 10-7 Player3/Player4"

const matches = [
  "7/1 10-7 9/10",
  "7/1 10-3 10/11",
  "7/1 10-9 10/11",
  "7/12 10-3 8/9",
  "11/12 10-7 7/1",
  "10/12 10-6 9/1",
  "11/12 9-10 7/1",
  "10/1 10-5 7/12",
  "10/1 10-9 7/12",
  "11/12 9-10 7/1",
  "9/11 10-6 10/1",
  "7/1 10-9 10/12",
  "7/1 10-7 10/12",
  "7/1 9-10 9/12",
  "10/12 4-10 7/1",
  "10/12 6-10 7/1",
  "1/12 7-10 9/10",
  "7/12 10-4 9/10",
  "1/10 8-10 12/7",
  "7/1 10-6 9/10",
  "10/1 10-7 12/7",
  "1/10 10-7 12/9",
  "1/10 7-10 12/9",
  "1/10 7-10 12/9",
  "1/10 7-10 12/9",
  "1/10 10-8 12/9",
  "1/10 10-9 12/9",
  "9/7 10-6 10/11",
  "8/7 3-10 10/11",
  "8/11 10-7 9/1",
  "1/10 10-5 9/7",
  "1/10 6-10 7/11",
  "1/10 6-10 7/11",
  "10/1 10-7 7/11",
  "1/11 10-4 8/7",
  "11/8 6-10 7/1",
  "1/11 10-8 8/7",
  "1/9 10-5 8/7",
  "11/1 6-10 9/8",
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
export const ImportMatches = () => {
  const handleImport = async () => {

    for (const item of matches) {
      console.log(item);
      const [part1, score, part2] = item.split(" ");
      const [team1Defense, team1Offense] = part1.split("/").map(Number);
      const [team1Score, team2Score] = score.split("-").map(Number);
      const [team2Defense, team2Offense] = part2.split("/").map(Number);

      const result = {
        team1Defense,
        team1Offense,
        team2Defense,
        team2Offense,
        team1Score,
        team2Score,
        team1DefenseGoals: Math.round(0.2*team1Score),
        team1OffenseGoals: Math.round(0.8*team1Score),
        team2DefenseGoals: Math.round(0.2*team2Score),
        team2OffenseGoals: Math.round(0.8*team2Score),
      };
      await sleep(5000);
      await saveMatch(result);

      setTimeout(( )=> {
        console.log("aj sad govno jedno")
      }, 5000)
      console.log(result);
    }




  }

  return (
    <Box maxWidth="900px" mx="auto" p={6} borderRadius="lg" boxShadow="md" bg="white">
      <VStack spacing={4} align="stretch">

        <Button
          colorScheme="blue"
          onClick={handleImport}
          loadingText="Importing..."
          size="lg"
        >
          Import Matches
        </Button>
      </VStack>
    </Box>
  );
};
