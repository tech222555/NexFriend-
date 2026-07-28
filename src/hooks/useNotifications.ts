import { useEffect } from 'react';
import { collection, query, where, onSnapshot, serverTimestamp, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';

// Synthesize a premium high-quality dual-tone bell chime using native Web Audio API
export function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playTone = (frequency: number, startTime: number, duration: number, volume = 0.25) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, startTime);
      
      gainNode.gain.setValueAtTime(volume, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = audioCtx.currentTime;
    // Classic double chime: high G#5 and C6 creating an elegant alert tone
    playTone(830.61, now, 0.4); 
    playTone(1046.50, now + 0.12, 0.5); 
  } catch (err) {
    console.warn('Audio synthesis skipped or failed:', err);
  }
}

// Flash tab title helper to draw user attention when in another tab
let titleFlashInterval: any = null;
function startTitleFlashing(senderName: string) {
  if (titleFlashInterval) clearInterval(titleFlashInterval);
  
  const originalTitle = document.title;
  let showAlt = true;
  
  titleFlashInterval = setInterval(() => {
    document.title = showAlt ? `🔔 New Sync from ${senderName}!` : originalTitle;
    showAlt = !showAlt;
  }, 1500);

  // Clear when user refocuses the tab
  const clearFlash = () => {
    clearInterval(titleFlashInterval);
    document.title = originalTitle;
    titleFlashInterval = null;
    window.removeEventListener('focus', clearFlash);
  };
  window.addEventListener('focus', clearFlash);
}

export function useNotifications() {
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user || !profile) return;

    // Safe request for browser notification permission (shields mobile & iframe constraints)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        if (Notification.permission === 'default') {
          Notification.requestPermission().catch(err => console.warn('Notification request rejected:', err));
        }
      } catch (err) {
        console.warn('Failed to access Notification API safely:', err);
      }
    }

    // Subscribe to unread notifications for the current user
    const q = query(
      collection(db, `users/${user.uid}/notifications`),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notification = {
            id: change.doc.id,
            ...change.doc.data()
          } as any;
          
          // 1. Play synthetic mobile bell chime
          playNotificationSound();

          // 2. Trigger hardware vibration if supported (iOS/Android mobile browsers)
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
              navigator.vibrate([120, 80, 120]);
            } catch (_) {}
          }

          // 3. Handle tab title flashing if the window is currently in the background
          if (document.visibilityState === 'hidden') {
            const sender = notification.title?.replace('New message from ', '') || 'someone';
            startTitleFlashing(sender);
          }

          // 4. Dispatch a custom window event containing the notification.
          // This allows Layout.tsx to catch it and display a magnificent animated
          // lock-screen phone notification banner!
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('app-notification', { detail: notification }));
          }
          
          // 5. Build native browser notification for OS-level popups (if minimized/hidden)
          if (typeof window !== 'undefined' && 'Notification' in window) {
            try {
              if (Notification.permission === 'granted' && document.visibilityState === 'hidden') {
                const n = new Notification(notification.title || 'Meetora connect', {
                  body: notification.message,
                  icon: '/vite.svg',
                  tag: notification.matchId || 'general',
                });

                n.onclick = () => {
                  window.focus();
                  // Mark as read when clicked
                  updateDoc(doc(db, `users/${user.uid}/notifications`, change.doc.id), {
                    read: true
                  }).catch(err => console.error('Failed to mark notification read:', err));
                  // Navigate to the chat if registered in Layout
                  window.dispatchEvent(new CustomEvent('app-notification-click', { detail: notification }));
                  n.close();
                };
              }
            } catch (notifyErr) {
              console.warn('Browser rejected Native Notification builder:', notifyErr);
            }
          }
        }
      });
    }, (error) => {
      console.error('Subscription error in notification observer:', error);
    });

    return unsubscribe;
  }, [user, profile]);

  return null;
}

export async function triggerEmailNotification(recipientId: string, title: string, message: string) {
  try {
    const userDoc = await getDoc(doc(db, 'users', recipientId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const email = userData?.email;
      const fullName = userData?.fullName || 'User';
      if (email) {
        console.log(`Triggering email sync notification to: ${email}`);
        await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: email,
            recipientName: fullName,
            title,
            message
          })
        }).catch(err => console.error('Fetch post send-email failed:', err));
      } else {
        console.warn(`No email found for user document: ${recipientId}`);
      }
    } else {
      console.warn(`User document does not exist for email dispatch: ${recipientId}`);
    }
  } catch (err) {
    console.error('Error in triggerEmailNotification:', err);
  }
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

      // Trigger high-fidelity email notifications instantly
      await triggerEmailNotification(recipientId, title, message);
    } catch (err) {
      console.error('Failed to send notification:', err);
    }
  }
};
