import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/layout/Layout';
import Login from './components/auth/Login';
import SignUp from './components/auth/SignUp';
import OnboardingFlow from './components/onboarding/OnboardingFlow';
import Discover from './components/discover/Discover';
import ChatList from './components/chat/ChatList';
import ChatRoom from './components/chat/ChatRoom';
import Profile from './components/profile/Profile';
import { useNotifications } from './hooks/useNotifications';

import SplashScreen from './components/layout/SplashScreen';
import { AnimatePresence } from 'motion/react';

function PrivateRoute({ children, requireProfile = true }: { children: React.ReactNode, requireProfile?: boolean }) {
  const { user, profile, loading } = useAuth();
  useNotifications(); // Listen for notifications while in private routes
  
  if (loading) return <div className="flex items-center justify-center h-[70vh]"><div className="w-10 h-10 border-4 border-pink-100 border-t-pink-500 rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (requireProfile && !profile) return <Navigate to="/onboarding" />;
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" />;
  return <>{children}</>;
}

export default function App() {
  const [showSplash, setShowSplash] = React.useState(() => {
    // Only show splash screen once per session
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('splashShown');
    }
    return true;
  });

  const handleSplashFinish = () => {
    setShowSplash(false);
    sessionStorage.setItem('splashShown', 'true');
  };

  return (
    <AuthProvider>
      <AnimatePresence>
        {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
      </AnimatePresence>
      <Router>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
          
          <Route element={<Layout />}>
            <Route path="/" element={<PrivateRoute><Discover /></PrivateRoute>} />
            <Route path="/onboarding" element={<PrivateRoute requireProfile={false}><OnboardingFlow /></PrivateRoute>} />
            <Route path="/chats" element={<PrivateRoute><ChatList /></PrivateRoute>} />
            <Route path="/chat/:id" element={<PrivateRoute><ChatRoom /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
