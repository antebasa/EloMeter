import type {ReactNode} from 'react';
import {
  Box, 
  Divider, 
  Flex, 
  Heading, 
  Text, 
  VStack, 
  Spacer, 
  Button,
  IconButton,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
  HStack
} from '@chakra-ui/react';
import { HamburgerIcon } from '@chakra-ui/icons';
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
  const { user, signOut } = useAuth();
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  let navItems = []
  if (user?.user_metadata?.admin) {
    navItems.push({ name: 'EnterScore', label: 'Enter Score' },)
  }
  navItems = [...navItems,
    { name: 'MatchOdds', label: 'Match Odds' },
    { name: 'History', label: 'History' },
    { name: 'OptimalTeams', label: 'Optimal Teams' },
    { name: 'Players', label: 'Players' },
    { name: 'PlayerComparison', label: 'Player Comparison' },
    { name: 'WinPercentage', label: 'Win Percentage' },
  ];

  if (user?.user_metadata?.admin) {
    navItems.push({ name: 'AddPlayer', label: 'Add Player' },)
  }

  const handleNavItemClick = (navItem: string) => {
    onNavItemClick(navItem);
    onClose(); // Close mobile menu when item is clicked
  };

  const SidebarContent = () => (
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
            onClick={() => handleNavItemClick(item.name)}
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
  );

  return (
    <Flex h="100vh" w="100%">
      {/* Desktop Sidebar - Hidden on mobile */}
      <Box
        w="250px"
        bg="#1A202C"
        borderRight="1px"
        borderRightColor="gray.700"
        py="5"
        display={{ base: "none", md: "block" }}
      >
        <SidebarContent />
      </Box>

      {/* Mobile Header with Hamburger */}
      <Box
        position="fixed"
        top="0"
        left="0"
        right="0"
        bg="#1A202C"
        borderBottom="1px"
        borderBottomColor="gray.700"
        p="4"
        zIndex="1000"
        display={{ base: "block", md: "none" }}
      >
        <HStack justify="space-between" align="center">
          <IconButton
            aria-label="Open menu"
            icon={<HamburgerIcon />}
            onClick={onOpen}
            variant="ghost"
            color="white"
            _hover={{ bg: "gray.700" }}
          />
          <Heading size="md" color="white">EloMeter</Heading>
          <Box w="40px" /> {/* Spacer for centering */}
        </HStack>
      </Box>

      {/* Mobile Drawer */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent bg="#1A202C">
          <DrawerCloseButton color="white" />
          <DrawerHeader borderBottomWidth="1px" borderBottomColor="gray.700">
            <Heading size="md" color="white">EloMeter</Heading>
          </DrawerHeader>
          <DrawerBody p="0">
            <SidebarContent />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Main content */}
      <Box 
        flex="1" 
        overflowY="auto" 
        p="5" 
        bg="#2D3748"
        pt={{ base: "80px", md: "5" }} // Add top padding on mobile for fixed header
      >
        {children}
      </Box>
    </Flex>
  );
};
