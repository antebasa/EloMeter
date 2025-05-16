import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// import { ChakraProvider } from '@chakra-ui/react'; // Removed as it's in main.tsx
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardPage from './pages/DashboardPage'; // Your main application component

// A component to handle redirection logic after login/logout
const AuthRedirector: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // Or a global loading spinner if preferred
  }

  // If user is logged in and on the login page, redirect to app
  if (user && window.location.pathname === '/login') {
    return <Navigate to="/app" replace />;
  }
  
  // If user is not logged in and not on login page, ProtectedRoute will handle it.
  // This component primarily handles the post-login redirect from /login.

  return null; // No redirection needed from here in other cases
};

function App() {
  return (
    // <ChakraProvider> // Removed as it's in main.tsx
      <AuthProvider>
        <BrowserRouter>
          <AuthRedirector />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app" element={<ProtectedRoute />}>
              {/* Nested routes are protected */}
              <Route index element={<DashboardPage />} /> 
              {/* Add other protected routes here as children of ProtectedRoute */}
              {/* e.g. <Route path="settings" element={<SettingsPage />} /> */}
            </Route>
            {/* Redirect root to /app if logged in, or /login if not */}
            <Route 
              path="/" 
              element={
                <AuthAwareRedirect />
              }
            />
            {/* Optional: A catch-all route for 404 Not Found */}
            {/* <Route path="*" element={<NotFoundPage />} /> */}
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    // </ChakraProvider> // Removed as it's in main.tsx
  );
}

// Helper for root path redirection
const AuthAwareRedirect: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return null; // Or spinner
  return user ? <Navigate to="/app" replace /> : <Navigate to="/login" replace />;
};

export default App;
