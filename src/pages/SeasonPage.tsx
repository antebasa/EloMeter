import React, { useState } from 'react';
import {
  Box,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Text,
  VStack
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import SeasonManagement from '../components/Season/SeasonManagement';
import SeasonFixtures from '../components/Season/SeasonFixtures';
import SeasonTable from '../components/Season/SeasonTable';

const SeasonPage: React.FC = () => {
  const { user } = useAuth();
  const [tabIndex, setTabIndex] = useState(0);

  return (
    <Box>
      <VStack spacing={6} align="stretch">
        <Box textAlign="center">
          <Text fontSize="3xl" fontWeight="bold" color="white" mb={2}>
            🏆 Season League
          </Text>
          <Text color="gray.300" fontSize="lg">
            Standalone league system with fixed teams and fixtures
          </Text>
        </Box>

        <Tabs 
          index={tabIndex} 
          onChange={(index) => setTabIndex(index)}
          variant="enclosed"
          colorScheme="blue"
        >
          <TabList bg="gray.700" borderRadius="lg" p={1}>
            <Tab 
              color="gray.300" 
              _selected={{ color: "white", bg: "blue.600" }}
              borderRadius="md"
            >
              League Table
            </Tab>
            <Tab 
              color="gray.300" 
              _selected={{ color: "white", bg: "blue.600" }}
              borderRadius="md"
            >
              Fixtures
            </Tab>
            {user?.user_metadata?.admin && (
              <Tab 
                color="gray.300" 
                _selected={{ color: "white", bg: "blue.600" }}
                borderRadius="md"
              >
                Management
              </Tab>
            )}
          </TabList>

          <TabPanels>
            <TabPanel p={0}>
              <SeasonTable />
            </TabPanel>
            
            <TabPanel p={0}>
              <SeasonFixtures />
            </TabPanel>
            
            {user?.user_metadata?.admin && (
              <TabPanel p={0}>
                <SeasonManagement />
              </TabPanel>
            )}
          </TabPanels>
        </Tabs>
      </VStack>
    </Box>
  );
};

export default SeasonPage; 