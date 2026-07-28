import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setProfile: (profile: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  setProfile: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
      }
    });

    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const docRef = doc(db, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile({ uid: user.uid, ...docSnap.data() } as UserProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Profile sync error:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeProfile();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !profile) return;

    const updatePresence = async (isActive = true) => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          lastActive: isActive ? serverTimestamp() : new Date(0)
        });
      } catch (err) {
        console.error('Failed to update presence status:', err);
      }
    };

    // Update immediately on mount / user change
    updatePresence(true);

    // Set up active presence tracker interval (every 1 minute)
    const intervalId = setInterval(() => updatePresence(true), 1 * 60 * 1000);

    const handleBeforeUnload = () => {
      // Promptly inform that the user is exiting before the connection/process dies
      updateDoc(doc(db, 'users', user.uid), {
        lastActive: new Date(0)
      }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [user?.uid, profile?.uid]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
