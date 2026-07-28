import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc,
  getDoc,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile, Match } from '../types';
import { handleFirestoreError, OperationType } from './firestoreErrorHandler';
import { triggerEmailNotification } from '../hooks/useNotifications';

export const matchService = {
  async getPotentialMatches(user: UserProfile) {
    try {
      // Fetch all potential users from the database
      const q = query(
        collection(db, 'users'),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      const potential = snapshot.docs
        .map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile))
        .filter(p => p.uid !== user.uid);

      // Simple interest-based sorting with safety guards
      return potential.sort((a, b) => {
        const aInterests = (a.interests || []).filter(i => (user.interests || []).includes(i)).length;
        const bInterests = (b.interests || []).filter(i => (user.interests || []).includes(i)).length;
        return bInterests - aInterests;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
  },

  async createMatch(userId: string, targetId: string) {
    let existingMatch: Match | null = null;
    try {
      // Check if reverse match exists
      const q = query(
        collection(db, 'matches'),
        where('userIds', 'array-contains', userId)
      );
      
      const snapshot = await getDocs(q);
      const existing = snapshot.docs.find(doc => {
        const data = doc.data();
        return data.userIds.includes(targetId) && data.status !== 'unmatched';
      });

      if (existing) {
        existingMatch = { id: existing.id, ...existing.data() } as Match;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'matches');
    }

    if (existingMatch) return existingMatch;

    const newMatch = {
      userIds: [userId, targetId],
      status: 'pending',
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp()
    };

    let docRef;
    try {
      docRef = await addDoc(collection(db, 'matches'), newMatch);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'matches');
    }

    // Create a notification for the matched user
    try {
      await addDoc(collection(db, `users/${targetId}/notifications`), {
        matchId: docRef.id,
        title: 'New Match! 💖',
        message: 'Someone wants to be your friend!',
        read: false,
        createdAt: serverTimestamp()
      });
      
      // Trigger high-fidelity email notification for the match
      await triggerEmailNotification(targetId, 'New Match! 💖', 'Someone wants to be your friend!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${targetId}/notifications`);
    }

    return { id: docRef.id, ...newMatch } as Match;
  },

  async acceptMatch(matchId: string) {
    try {
      const docRef = doc(db, 'matches', matchId);
      await updateDoc(docRef, { status: 'active', createdAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `matches/${matchId}`);
    }
  }
};
