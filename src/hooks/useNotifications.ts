import { useEffect } from 'react';
import { collection, query, where, onSnapshot, serverTimestamp, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';

export function useNotifications() {
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user || !profile) return;

    // Request browser notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Subscribe to unread notifications for the current user
    const q = query(
      collection(db, `users/${user.uid}/notifications`),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notification = change.doc.data();
          
          // Show browser notification if the tab is in background or not focused
          if (document.visibilityState === 'hidden' || Notification.permission === 'granted') {
            const n = new Notification(notification.title || 'Meetora connect', {
              body: notification.message,
              icon: '/vite.svg', // Fallback icon
              tag: notification.matchId || 'general',
            });

            n.onclick = () => {
              window.focus();
              // Mark as read when clicked
              updateDoc(doc(db, `users/${user.uid}/notifications`, change.doc.id), {
                read: true
              });
              n.close();
            };
          }
        }
      });
    });

    return unsubscribe;
  }, [user, profile]);

  return null;
}

export const notificationService = {
  async sendNotification(recipientId: string, matchId: string, title: string, message: string) {
    try {
      await addDoc(collection(db, `users/${recipientId}/notifications`), {
        matchId,
        title,
        message,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to send notification:', err);
    }
  }
};
