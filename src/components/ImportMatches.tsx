import {Box, Button, VStack} from '@chakra-ui/react';

// Parse a match string into the required format
// Format: "Player1/Player2 10-7 Player3/Player4"

const matches = [
  "2025-04-23 14:45:57*7/1*10-7*9/10",
  "2025-04-24 14:05:28*7/1*10-3*10/11",
  "2025-04-24 14:20:34*7/1*10-9*10/11",
  "2025-04-24 14:33:40*7/12*10-3*8/9",
  "2025-04-24 16:33:38*11/12*10-7*7/1",
  "2025-04-25 12:50:46*10/12*10-6*9/1",
  "2025-04-25 14:33:27*11/12*9-10*7/1",
  "2025-04-25 15:37:07*10/1*10-5*7/12",
  "2025-04-25 15:37:37*10/1*10-9*7/12",
  "2025-04-25 16:20:35*11/12*9-10*7/1",
  "2025-04-28 10:26:48*9/11*10-6*10/1",
  "2025-04-28 13:30:32*7/1*10-9*10/12",
  "2025-04-28 15:11:34*7/1*10-7*10/12",
  "2025-04-28 16:25:59*7/1*9-10*9/12",
  "2025-04-29 11:55:51*10/12*4-10*7/1",
  "2025-04-29 14:20:36*10/12*6-10*7/1",
  "2025-04-30 10:17:21*1/12*7-10*9/10",
  "2025-04-30 12:55:02*7/12*10-4*9/10",
  "2025-04-30 14:38:11*1/10*8-10*12/7",
  "2025-04-30 15:41:42*7/1*10-6*9/10",
  "2025-04-30 16:44:47*10/1*10-7*12/7",
  "2025-05-06 13:36:28*1/10*10-7*12/9",
  "2025-05-06 14:49:05*1/10*7-10*12/9",
  "2025-05-06 16:18:09*1/10*7-10*12/9",
  "2025-05-07 10:31:42*1/10*7-10*12/9",
  "2025-05-07 12:29:35*1/10*10-8*12/9",
  "2025-05-07 15:01:45*1/10*10-9*12/9",
  "2025-05-08 12:46:15*9/7*10-6*10/11",
  "2025-05-09 09:12:34*8/7*3-10*10/11",
  "2025-05-09 09:59:06*8/11*10-7*9/1",
  "2025-05-09 11:27:57*1/10*10-5*9/7",
  "2025-05-09 13:03:44*1/10*6-10*7/11",
  "2025-05-09 16:22:28*1/10*6-10*7/11",
  "2025-05-09 16:23:05*10/1*10-7*7/11",
  "2025-05-12 16:24:37*1/11*10-4*8/7",
  "2025-05-12 16:25:10*11/8*6-10*7/1",
  "2025-05-13 10:47:45*1/11*10-8*8/7",
  "2025-05-13 13:19:12*1/9*10-5*8/7",
  "2025-05-13 14:04:07*11/1*6-10*9/8",
  "2025-05-13 16:25:06*7/1*10-5*8/11",
  "2025-05-13 16:25:25*1/7*3-10*11/8",
  "2025-05-14 09:09:11*8/1*10-3*9/11",
  "2025-05-14 14:11:34*1/7*10-7*9/8",
  "2025-05-14 16:21:04*1/8*6-10*9/7",
  "2025-05-15 12:50:16*1/8*5-10*9/7",
  "2025-05-15 14:58:51*9/1*10-4*8/7",
];

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
export const ImportMatches = () => {
  const handleImport = async () => {

    for (const item of matches) {
      console.log(item);
      const [date, part1, score, part2] = item.split("*");
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
        team1DefenseGoals: Math.round(team1Score),
        team1OffenseGoals: Math.round(team1Score),
        team2DefenseGoals: Math.round(team2Score),
        team2OffenseGoals: Math.round(team2Score),
        date
      };
      await sleep(5000);
      // await saveMatch(result);

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
