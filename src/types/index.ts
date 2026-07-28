export type Gender = 'Male' | 'Female' | 'Other';

export interface UserPreferences {
  gender: Gender | 'All';
  ageRange: [number, number];
}

export interface UserProfile {
  uid: string;
  fullName: string;
  username: string;
  email: string;
  gender: Gender;
  age: number;
  country: string;
  city: string;
  interests: string[];
  profilePicture: string;
  bio: string;
  badges: string[];
  createdAt: any;
  lastActive: any;
  preferences: UserPreferences;
}

export interface Match {
  id: string;
  userIds: string[];
  status: 'pending' | 'active' | 'unmatched';
  createdAt: any;
  lastMessage?: string;
  lastMessageAt?: any;
  lastMessageSenderId?: string;
  lastMessageRead?: boolean;
  typing?: Record<string, boolean>;
  isGroup?: boolean;
  groupName?: string;
  groupIcon?: string;
  groupDescription?: string;
  createdBy?: string;
  admins?: string[];
}

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  text: string;
  createdAt: any;
  read: boolean;
  translations?: Record<string, string>;
  audioUrl?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  mediaType?: 'voice' | 'image' | 'file';
  reactions?: Record<string, string[]>; // mapping of emoji (string) to user UIDs (string[]) who reacted
}

export interface Notification {
  id: string;
  matchId?: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
}

export interface StatusUpdate {
  id: string;
  userId: string;
  userFullName: string;
  userProfilePicture: string;
  type: 'text' | 'image' | 'video';
  content: string; // text or Base64/url
  bgGradient?: string; // e.g. 'from-purple-500 to-indigo-500'
  textColor?: string; // e.g. '#ffffff'
  createdAt: any;
  expiresAt: any;
  viewerIds: string[]; // List of user IDs permitted to view this status
}
