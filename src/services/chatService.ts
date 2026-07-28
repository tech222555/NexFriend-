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

  async sendMessage(
    matchId: string, 
    senderId: string, 
    text: string, 
    senderName: string,
    media?: {
      audioUrl?: string;
      imageUrl?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: string;
      mediaType?: 'voice' | 'image' | 'file';
    }
  ) {
    const msg = {
      senderId,
      senderName,
      text,
      createdAt: serverTimestamp(),
      read: false,
      ...media
    };

    await addDoc(collection(db, `matches/${matchId}/messages`), msg);
    
    // Update last message in match with a beautiful emoji indicator
    const previewText = media?.mediaType === 'voice' 
      ? '🎤 Voice Note' 
      : media?.mediaType === 'image' 
        ? '📷 Photo' 
        : media?.mediaType === 'file' 
          ? `📁 ${media.fileName}` 
          : text;

    await updateDoc(doc(db, 'matches', matchId), {
      lastMessage: previewText,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: senderId,
      lastMessageRead: false
    });

    // Notify recipient
    try {
      const matchSnap = await getDoc(doc(db, 'matches', matchId));
      if (matchSnap.exists()) {
        const data = matchSnap.data();
        const userIds = data.userIds as string[];
        const isGroup = data.isGroup as boolean;
        const groupName = data.groupName as string;

        if (isGroup) {
          const recipientIds = userIds.filter(id => id !== senderId);
          for (const recipientId of recipientIds) {
            await notificationService.sendNotification(
              recipientId,
              matchId,
              `${senderName} in ${groupName}`,
              previewText.length > 50 ? previewText.substring(0, 47) + '...' : previewText
            );
          }
        } else {
          const recipientId = userIds.find(id => id !== senderId);
          if (recipientId) {
            await notificationService.sendNotification(
              recipientId,
              matchId,
              `New message from ${senderName}`,
              previewText.length > 50 ? previewText.substring(0, 47) + '...' : previewText
            );
          }
        }
      }
    } catch (err) {
      console.error('Notification dispatch failed:', err);
    }
  },

  async markMessagesAsRead(matchId: string, currentUserId: string, messages: Message[]) {
    const unreadMessages = messages.filter(
      msg => msg.senderId !== currentUserId && !msg.read
    );

    if (unreadMessages.length === 0) return;

    const promises = unreadMessages.map(async (msg) => {
      try {
        const msgRef = doc(db, `matches/${matchId}/messages`, msg.id);
        await updateDoc(msgRef, { read: true });
      } catch (err) {
        console.error(`Failed to mark message ${msg.id} as read:`, err);
      }
    });

    await Promise.all(promises);

    // Update parent match's lastMessageRead status if the newest message is from the other user
    if (messages.length > 0) {
      const sortedMsgs = [...messages].sort((a, b) => {
        const timeA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
        const timeB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
        return timeB - timeA;
      });
      const newestMsg = sortedMsgs[0];
      if (newestMsg && newestMsg.senderId !== currentUserId) {
        try {
          await updateDoc(doc(db, 'matches', matchId), {
            lastMessageRead: true
          });
        } catch (err) {
          console.error('Failed to update parent match lastMessageRead:', err);
        }
      }
    }
  },

  async toggleMessageReaction(matchId: string, messageId: string, currentUserId: string, emoji: string) {
    try {
      const msgRef = doc(db, `matches/${matchId}/messages`, messageId);
      const msgSnap = await getDoc(msgRef);
      if (!msgSnap.exists()) return;

      const data = msgSnap.data();
      const reactions = data.reactions || {};
      const reactionUsers = reactions[emoji] || [];

      let updatedUsers: string[];
      if (reactionUsers.includes(currentUserId)) {
        updatedUsers = reactionUsers.filter((id: string) => id !== currentUserId);
      } else {
        updatedUsers = [...reactionUsers, currentUserId];
      }

      const updatedReactions = { ...reactions };
      if (updatedUsers.length === 0) {
        delete updatedReactions[emoji];
      } else {
        updatedReactions[emoji] = updatedUsers;
      }

      await updateDoc(msgRef, {
        reactions: updatedReactions
      });
    } catch (err) {
      console.error(`Error toggling reaction ${emoji} on message ${messageId}:`, err);
    }
  },

  async setTypingStatus(matchId: string, userId: string, isTyping: boolean) {
    try {
      const matchRef = doc(db, 'matches', matchId);
      await updateDoc(matchRef, {
        [`typing.${userId}`]: isTyping
      });
    } catch (err) {
      console.error(`Error setting typing status for user ${userId} in ${matchId}:`, err);
    }
  }
};
