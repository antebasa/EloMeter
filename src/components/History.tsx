import { useState } from "react";
import { Box, Heading, Text, Select, Flex, VStack, HStack, Tag, Badge } from "@chakra-ui/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data for player history
const PLAYERS_DATA = [
  { 
    id: 1, 
    name: "John Doe", 
    ratings: [
      { date: "Jan 1", rating: 1328 },
      { date: "Jan 15", rating: 1380 },
      { date: "Feb 1", rating: 1420 },
      { date: "Feb 15", rating: 1401 },
      { date: "Mar 1", rating: 1398 },
      { date: "Mar 15", rating: 1450 }
    ],
    matches: [
      { date: "Mar 15", opponent: "Team Jane & Mike", result: "Win", score: "10-8", ratingChange: "+12" },
      { date: "Mar 1", opponent: "Team Lisa & David", result: "Loss", score: "6-10", ratingChange: "-3" },
      { date: "Feb 15", opponent: "Team Robert & Emily", result: "Loss", score: "9-10", ratingChange: "-9" },
      { date: "Feb 1", opponent: "Team Sarah & James", result: "Win", score: "10-5", ratingChange: "+20" },
      { date: "Jan 15", opponent: "Team Michael & Jennifer", result: "Win", score: "10-7", ratingChange: "+32" }
    ]
  },
  { 
    id: 2, 
    name: "Jane Smith", 
    ratings: [
      { date: "Jan 1", rating: 1450 },
      { date: "Jan 15", rating: 1420 },
      { date: "Feb 1", rating: 1435 },
      { date: "Feb 15", rating: 1460 },
      { date: "Mar 1", rating: 1472 },
      { date: "Mar 15", rating: 1485 }
    ],
    matches: [
      { date: "Mar 15", opponent: "Team John & Michael", result: "Win", score: "10-7", ratingChange: "+13" },
      { date: "Mar 1", opponent: "Team Robert & Sarah", result: "Win", score: "10-9", ratingChange: "+12" },
      { date: "Feb 15", opponent: "Team David & Emily", result: "Win", score: "10-4", ratingChange: "+25" },
      { date: "Feb 1", opponent: "Team Lisa & James", result: "Win", score: "10-8", ratingChange: "+15" },
      { date: "Jan 15", opponent: "Team Jennifer & Mike", result: "Loss", score: "5-10", ratingChange: "-30" }
    ]
  },
  { 
    id: 3, 
    name: "Michael Johnson", 
    ratings: [
      { date: "Jan 1", rating: 1380 },
      { date: "Jan 15", rating: 1395 },
      { date: "Feb 1", rating: 1410 },
      { date: "Feb 15", rating: 1405 },
      { date: "Mar 1", rating: 1425 },
      { date: "Mar 15", rating: 1418 }
    ],
    matches: [
      { date: "Mar 15", opponent: "Team Jane & Lisa", result: "Loss", score: "7-10", ratingChange: "-7" },
      { date: "Mar 1", opponent: "Team John & Emily", result: "Win", score: "10-6", ratingChange: "+20" },
      { date: "Feb 15", opponent: "Team Sarah & Jennifer", result: "Loss", score: "8-10", ratingChange: "-5" },
      { date: "Feb 1", opponent: "Team Robert & Mike", result: "Win", score: "10-9", ratingChange: "+15" },
      { date: "Jan 15", opponent: "Team David & James", result: "Win", score: "10-6", ratingChange: "+15" }
    ]
  }
];

export const History = () => {
  const [selectedPlayer, setSelectedPlayer] = useState<number>(1);
  
  const playerData = PLAYERS_DATA.find(player => player.id === selectedPlayer);
  const chartData = playerData?.ratings.map(item => ({
    name: item.date,
    ELO: item.rating
  }));

  return (
    <Box maxWidth="900px" mx="auto" p={6} borderRadius="lg" boxShadow="md" bg="white">
      <Heading as="h2" size="lg" mb={6}>Player History</Heading>
      
      <Select 
        value={selectedPlayer} 
        onChange={(e) => setSelectedPlayer(parseInt(e.target.value))}
        mb={6}
        maxWidth="300px"
      >
        {PLAYERS_DATA.map(player => (
          <option key={player.id} value={player.id}>{player.name}</option>
        ))}
      </Select>
      
      <Box mb={8}>
        <Heading as="h3" size="md" mb={4}>ELO Rating History</Heading>
        <Box height="300px" bg="whiteAlpha.100" borderRadius="md" p={2}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={['dataMin - 50', 'dataMax + 50']} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "#2D3748", 
                  borderColor: "#4A5568",
                  color: "white" 
                }} 
              />
              <Line 
                type="monotone" 
                dataKey="ELO" 
                stroke="#3182CE" 
                strokeWidth={3}
                dot={{ r: 6 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Box>
      
      <Box>
        <Heading as="h3" size="md" mb={4}>Recent Matches</Heading>
        <VStack spacing={2} align="stretch">
          {playerData?.matches.map((match, index) => (
            <Flex 
              key={index} 
              p={3} 
              borderRadius="md" 
              bg={match.result === "Win" ? "blue.50" : "gray.50"}
              borderLeft={`4px solid ${match.result === "Win" ? "#3182CE" : "#A0AEC0"}`}
              justify="space-between"
              align="center"
            >
              <VStack align="flex-start" spacing={0}>
                <Text fontWeight="bold">{match.opponent}</Text>
                <Text fontSize="sm" color="gray.600">{match.date}</Text>
              </VStack>
              
              <HStack>
                <Text>{match.score}</Text>
                <Badge colorScheme={match.result === "Win" ? "green" : "red"}>
                  {match.result}
                </Badge>
                <Tag 
                  colorScheme={match.ratingChange.startsWith('+') ? "green" : "red"}
                >
                  {match.ratingChange}
                </Tag>
              </HStack>
            </Flex>
          ))}
        </VStack>
      </Box>
    </Box>
  );
}; 