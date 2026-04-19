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
    // 1. Get IDs of people the user has already matched with
    const matchesQ = query(
      collection(db, 'matches'),
      where('userIds', 'array-contains', user.uid)
    );
    const matchesSnap = await getDocs(matchesQ);
    const matchedUserIds = matchesSnap.docs.reduce((acc: string[], doc) => {
      const data = doc.data();
      const otherId = data.userIds.find((id: string) => id !== user.uid);
      if (otherId) acc.push(otherId);
      return acc;
    }, []);

    // 2. Fetch potential users
    const q = query(
      collection(db, 'users'),
      limit(50)
    );
    
    const snapshot = await getDocs(q);
    const potential = snapshot.docs
      .map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile))
      .filter(p => {
        if (p.uid === user.uid) return false;
        if (matchedUserIds.includes(p.uid)) return false;
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
      matchId: docRef.id,
      title: 'New Match! 💖',
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
