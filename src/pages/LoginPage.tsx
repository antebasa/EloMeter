import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Box, Button, FormControl, FormLabel, Input, Heading, VStack, Text, Link as ChakraLink, StackDivider } from '@chakra-ui/react';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleAuth = async () => {
        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            if (isLogin) {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (signInError) throw signInError;
                setMessage('Logged in successfully! Redirecting...');
                // React Router will handle redirection via AuthProvider
            } else {
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (signUpError) throw signUpError;
                setMessage('Signup successful! Please check your email to confirm.');
            }
        } catch (e: any) {
            setError(e.message);
        }
        setLoading(false);
    };

    const handleOAuthSignIn = async (provider: 'slack') => {
        setLoading(true);
        setError(null);
        try {
            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: window.location.origin + '/app' // Or your desired redirect path after login
                }
            });
            if (oauthError) throw oauthError;
        } catch (e: any) {
            setError(e.message);
        }
        // setLoading(false); // Usually, the page will redirect before this is called
    };

    return (
        <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
            <VStack spacing={4} p={8} borderWidth={1} borderRadius="md" boxShadow="lg" minW="400px">
                <Heading color={'white'}>{isLogin ? 'Login' : 'Sign Up'}</Heading>
                <FormControl id="email">
                    <FormLabel color={'white'}>Email address</FormLabel>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} isDisabled={loading} />
                </FormControl>
                <FormControl id="password">
                    <FormLabel color={'white'}>Password</FormLabel>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} isDisabled={loading} />
                </FormControl>
                {error && <Text color="red.500">{error}</Text>}
                {message && <Text color="green.500">{message}</Text>}
                <Button colorScheme="teal" onClick={handleAuth} width="full" isLoading={loading} isDisabled={loading}>
                    {isLogin ? 'Login' : 'Sign Up'}
                </Button>
                <Text color={'white'}>
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <ChakraLink color="teal.500" onClick={() => !loading && setIsLogin(!isLogin)}>
                        {isLogin ? 'Sign Up' : 'Login'}
                    </ChakraLink>
                </Text>
                <VStack width="full" paddingTop={4} spacing={4} divider={<StackDivider borderColor="gray.200" />}>
                    <Button
                        variant="outline"
                        width="full"
                        onClick={() => handleOAuthSignIn('slack')}
                        isLoading={loading}
                        isDisabled={loading}
                        color={'teal.500'}
                    >
                        Sign in with Slack
                    </Button>
                </VStack>
            </VStack>
        </Box>
    );
};

export default LoginPage;
