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
    <Box h="100%" display="flex" flexDirection="column">
      <VStack spacing={6} align="stretch" flex="1" h="100%">
        <Box textAlign="center" flexShrink={0}>
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
          display="flex"
          flexDirection="column"
          flex="1"
          h="100%"
        >
          <TabList bg="gray.700" borderRadius="lg" p={1} flexShrink={0}>
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

          <TabPanels flex="1" h="100%">
            <TabPanel p={0} h="100%">
              <SeasonTable />
            </TabPanel>
            
            <TabPanel p={0} h="100%">
              <SeasonFixtures />
            </TabPanel>
            
            {user?.user_metadata?.admin && (
              <TabPanel p={0} h="100%">
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