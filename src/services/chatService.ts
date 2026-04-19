import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { Message } from '../types';
import { notificationService } from '../hooks/useNotifications';

export const chatService = {
  subscribeToMessages(matchId: string, callback: (messages: Message[]) => void) {
    const q = query(
      collection(db, `matches/${matchId}/messages`),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      callback(messages);
    });
  },

  async sendMessage(matchId: string, senderId: string, text: string, senderName: string) {
    const msg = {
      senderId,
      text,
      createdAt: serverTimestamp(),
      read: false
    };

    await addDoc(collection(db, `matches/${matchId}/messages`), msg);
    
    // Update last message in match
    await updateDoc(doc(db, 'matches', matchId), {
      lastMessage: text,
      lastMessageAt: serverTimestamp()
    });

    // Notify recipient
    try {
      const matchSnap = await getDoc(doc(db, 'matches', matchId));
      if (matchSnap.exists()) {
        const userIds = matchSnap.data().userIds as string[];
        const recipientId = userIds.find(id => id !== senderId);
        if (recipientId) {
          await notificationService.sendNotification(
            recipientId,
            matchId,
            `New message from ${senderName}`,
            text.length > 50 ? text.substring(0, 47) + '...' : text
          );
        }
      }
    } catch (err) {
      console.error('Notification dispatch failed:', err);
    }
  }
};
