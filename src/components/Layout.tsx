import type {ReactNode} from 'react';
import {Box, Divider, Flex, Heading, Text, VStack, Spacer, Button} from '@chakra-ui/react';
import { useAuth } from "../contexts/AuthContext";

// Navigation item type
interface NavItemProps {
  icon?: ReactNode;
  children: ReactNode;
  isActive?: boolean;
  onClick: () => void;
}

// Navigation item component
const NavItem = ({ children, icon, isActive, onClick }: NavItemProps) => {
  return (
    <Flex
      align="center"
      px="4"
      py="3"
      cursor="pointer"
      role="group"
      fontWeight={isActive ? "bold" : "normal"}
      transition=".15s ease"
      bg={isActive ? "blue.700" : "transparent"}
      color={isActive ? "white" : "gray.300"}
      borderRadius="md"
      _hover={{
        bg: "blue.600",
        color: "white"
      }}
      onClick={onClick}
    >
      {icon && (
        <Box mr="2">
          {icon}
        </Box>
      )}
      <Text>{children}</Text>
    </Flex>
  );
};

// Main layout component props
interface LayoutProps {
  children: ReactNode;
  activeNavItem: string;
  onNavItemClick: (navItem: string) => void;
}

export const Layout = ({ children, activeNavItem, onNavItemClick }: LayoutProps) => {
  const { signOut } = useAuth();
  const navItems = [
    { name: 'EnterScore', label: 'Enter Score' },
    { name: 'MatchOdds', label: 'Match Odds' },
    { name: 'History', label: 'History' },
    { name: 'OptimalTeams', label: 'Optimal Teams' },
    { name: 'Players', label: 'Players' },
    { name: 'AddPlayer', label: 'Add Player' },
    { name: 'ImportMatches', label: 'Import Matches' }
  ];

  return (
    <Flex h="100vh" w="100%">
      {/* Sidebar */}
      <Box
        w="250px"
        bg="#1A202C" // Dark background
        borderRight="1px"
        borderRightColor="gray.700"
        py="5"
      >
        <VStack align="flex-start" spacing="1" h="full">
          <Box px="4" pb="5" w="full">
            <Heading size="md" color="white">EloMeter</Heading>
          </Box>
          <Divider borderColor="gray.700" />
          <Box w="full" pt="5">
            {navItems.map((item) => (
              <NavItem
                key={item.name}
                isActive={activeNavItem === item.name}
                onClick={() => onNavItemClick(item.name)}
              >
                {item.label}
              </NavItem>
            ))}
          </Box>
          <Spacer />
          <Box px="4" pb="5" w="full">
            <Button 
              colorScheme="teal" 
              variant="outline" 
              width="full" 
              onClick={async () => await signOut()}
            >
              Sign Out
            </Button>
          </Box>
        </VStack>
      </Box>

      {/* Main content */}
      <Box flex="1" overflowY="auto" p="5" bg="#2D3748"> {/* Slightly lighter dark background */}
        {children}
      </Box>
    </Flex>
  );
};
