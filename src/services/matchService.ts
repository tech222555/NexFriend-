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

export const matchService = {
  async getPotentialMatches(user: UserProfile) {
    // Basic recommendation logic
    const q = query(
      collection(db, 'users'),
      limit(20)
    );
    
    const snapshot = await getDocs(q);
    const potential = snapshot.docs
      .map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile))
      .filter(p => {
        if (p.uid === user.uid) return false;
        if (user.preferences.gender !== 'All' && p.gender !== user.preferences.gender) return false;
        return true;
      });

    // Simple interest-based sorting
    return potential.sort((a, b) => {
      const aInterests = a.interests.filter(i => user.interests.includes(i)).length;
      const bInterests = b.interests.filter(i => user.interests.includes(i)).length;
      return bInterests - aInterests;
    });
  },

  async createMatch(userId: string, targetId: string) {
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

    if (existing) return { id: existing.id, ...existing.data() } as Match;

    const newMatch = {
      userIds: [userId, targetId],
      status: 'pending',
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'matches'), newMatch);

    // Create a notification for the matched user
    await addDoc(collection(db, `users/${targetId}/notifications`), {
      type: 'match',
      fromUserId: userId,
      message: 'Someone wants to be your friend!',
      read: false,
      createdAt: serverTimestamp()
    });

    return { id: docRef.id, ...newMatch } as Match;
  },

  async acceptMatch(matchId: string) {
    const docRef = doc(db, 'matches', matchId);
    await updateDoc(docRef, { status: 'active', createdAt: serverTimestamp() });
  }
};
