export interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  profileImage: string;
  bio: string;
  statusMessage: string;
  isOnline?: boolean;
  lastSeen?: string;
  createdAt: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  sender: User;
  content: string;
  readBy: string[];
  createdAt: string;
}

export interface Conversation {
  _id: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount?: number;
  updatedAt: string;
}

export interface FriendRequest {
  _id: string;
  sender: User;
  receiver: User;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
}
