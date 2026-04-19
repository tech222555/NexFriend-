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
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
  read: boolean;
  translations?: Record<string, string>;
}

export interface Notification {
  id: string;
  type: 'match' | 'message' | 'friend_request';
  fromUserId: string;
  message: string;
  read: boolean;
  createdAt: any;
}
