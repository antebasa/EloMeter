import { useState } from 'react';
import type { ReactNode } from 'react';
import { 
  Box, 
  Flex, 
  VStack, 
  Text, 
  Icon,
  Heading,
  Divider,
  useColorModeValue
} from '@chakra-ui/react';

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
      bg={isActive ? "blue.100" : "transparent"}
      color={isActive ? "blue.800" : "inherit"}
      borderRadius="md"
      _hover={{
        bg: "blue.50",
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
  const navItems = [
    { name: 'EnterScore', label: 'Enter Score' },
    { name: 'MatchOdds', label: 'Match Odds' },
    { name: 'History', label: 'History' },
    { name: 'OptimalTeams', label: 'Optimal Teams' },
    { name: 'Players', label: 'Players' },
    { name: 'AddPlayer', label: 'Add Player' }
  ];

  return (
    <Flex h="100vh" w="100%">
      {/* Sidebar */}
      <Box
        w="250px"
        bg={useColorModeValue('white', 'gray.900')}
        borderRight="1px"
        borderRightColor={useColorModeValue('gray.200', 'gray.700')}
        py="5"
      >
        <VStack align="flex-start" spacing="1" h="full">
          <Box px="4" pb="5" w="full">
            <Heading size="md">EloMeter</Heading>
          </Box>
          <Divider />
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
        </VStack>
      </Box>

      {/* Main content */}
      <Box flex="1" overflowY="auto" p="5">
        {children}
      </Box>
    </Flex>
  );
}; 