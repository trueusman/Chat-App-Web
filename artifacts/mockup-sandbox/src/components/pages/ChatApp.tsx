import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Users, UserPlus, User as UserIcon,
  Search, Send, ChevronLeft, Check, X, Bell,
  Smile, Paperclip, Phone, Video, MoreVertical,
  Loader2, UserCheck, LogOut, Camera,
  Save, Lock, CheckCircle, Trash2, Link, Upload,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { User, Conversation, Message, FriendRequest } from "@/lib/types";

type Tab = "chats" | "contacts" | "discover" | "profile";

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(d: string) {
  const date = new Date(d), now = new Date(), diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff === 1) return "Yesterday";
  if (diff < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
function fmtMsg(d: string) { return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, image, size }: { name: string; image?: string; size: "xs" | "sm" | "md" | "lg" }) {
  const sz = { xs: "w-7 h-7 text-xs rounded-xl", sm: "w-9 h-9 text-sm rounded-xl", md: "w-11 h-11 text-sm rounded-2xl", lg: "w-14 h-14 text-lg rounded-2xl" };
  const gs = ["from-violet-500 to-purple-700", "from-pink-500 to-rose-600", "from-blue-500 to-cyan-600", "from-amber-500 to-orange-600", "from-green-500 to-teal-600"];
  const g = gs[(name.charCodeAt(0) || 0) % gs.length];
  if (image) return <img src={image} alt={name} className={`${sz[size]} object-cover flex-shrink-0`} />;
  return <div className={`${sz[size]} bg-gradient-to-br ${g} flex items-center justify-center font-bold text-white flex-shrink-0`}>{(name || "?").charAt(0).toUpperCase()}</div>;
}

function IconBtn({ icon, onClick }: { icon: React.ReactNode; onClick?: () => void }) {
  return <button onClick={onClick} className="w-9 h-9 rounded-xl flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-colors">{icon}</button>;
}

function TypingBubble() {
  return (
    <div className="bg-[#1a1a35] border border-white/5 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="w-2 h-2 bg-white/30 rounded-full block"
          animate={{ y: [0, -5, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }} />
      ))}
    </div>
  );
}

function TypingLabel() {
  return (
    <span className="flex items-center gap-1.5 text-violet-400 text-xs">
      <span>typing</span>
      <span className="flex gap-0.5 items-end pb-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="w-1 h-1 bg-violet-400 rounded-full inline-block"
            animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </span>
    </span>
  );
}

function MessageTick({ isRead }: { isRead: boolean }) {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none"
      className={`flex-shrink-0 transition-colors duration-300 ${isRead ? "text-blue-400" : "text-white/25"}`}>
      <path d="M1 5.5L4.5 9L10 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 5.5L8.5 9L14 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Chat Input — standalone so it never re-mounts ────────────────────────────
function ChatInput({ onSend, onTyping }: { onSend: (text: string) => void; onTyping: () => void }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const t = value.trim();
    if (!t) return;
    setValue("");
    onSend(t);
    // keep focus after send
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="px-4 py-3 bg-[#0f0f22] border-t border-white/5 flex-shrink-0">
      <div className="flex items-center gap-2 bg-[#1a1a35] rounded-2xl px-4 py-2 border border-white/5">
        <button type="button" className="text-white/25 hover:text-violet-400 transition-colors flex-shrink-0">
          <Smile className="w-5 h-5" />
        </button>
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-white placeholder-white/20 text-sm outline-none min-w-0"
          placeholder="Type a message..."
          value={value}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          onChange={(e) => { setValue(e.target.value); onTyping(); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button type="button" className="text-white/25 hover:text-violet-400 transition-colors flex-shrink-0">
          <Paperclip className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          className="w-9 h-9 flex-shrink-0 bg-gradient-to-br from-violet-600 to-purple-700 disabled:opacity-25 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30 transition-all hover:scale-105 active:scale-95"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}

// ── Chat Panel ────────────────────────────────────────────────────────────────
interface ChatPanelProps {
  activeConv: Conversation | null;
  messages: Message[];
  loadingMsgs: boolean;
  typing: { convId: string; userId: string } | null;
  myId: string;
  onBack?: () => void;
  onSend: (text: string) => void;
  onTyping: () => void;
}

function ChatPanel({ activeConv, messages, loadingMsgs, typing, myId, onBack, onSend, onTyping, messagesEndRef }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Helper to get the other participant
  function other() {
    if (!activeConv) return null;
    return activeConv.participants.find((p) => (p._id || p.id) !== myId) ?? activeConv.participants[0];
  }
  const otherUser = other();

  if (!activeConv) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a1a] text-center p-8">
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4 }} className="flex flex-col items-center">
          <div className="w-24 h-24 bg-violet-500/10 rounded-3xl flex items-center justify-center mb-5">
            <MessageSquare className="w-10 h-10 text-violet-400/60" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Select a chat</h2>
          <p className="text-white/30 text-sm max-w-xs">Choose a conversation from the sidebar to start messaging</p>
        </motion.div>
      </div>
    );
  }

  const online = otherUser && (otherUser.isOnline ?? false);

  return (
    <div className="flex flex-col h-full bg-[#0a0a1a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#0f0f22] border-b border-white/5 flex-shrink-0">
        {onBack && (
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center text-white/50 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="relative flex-shrink-0">
          <Avatar name={otherUser?.name ?? "?"} image={otherUser?.profileImage} size="md" />
          {online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0f0f22]" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate">{otherUser?.name ?? "Unknown"}</p>
          <div className="h-4 flex items-center">
            {typing?.convId === activeConv._id
              ? <TypingLabel />
              : online
                ? <span className="text-green-400 text-xs">Online</span>
                : <span className="text-white/25 text-xs">Offline</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn icon={<Phone className="w-4 h-4" />} />
          <IconBtn icon={<Video className="w-4 h-4" />} />
          <IconBtn icon={<MoreVertical className="w-4 h-4" />} />
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 min-h-0 overscroll-contain">
        {loadingMsgs ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-14 h-14 bg-violet-500/10 rounded-full flex items-center justify-center"><MessageSquare className="w-6 h-6 text-violet-400/50" /></div>
            <p className="text-white/30 text-sm">No messages yet — say hello!</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              if (!msg) return null;
              const isMe = !!(msg.sender && (msg.sender._id || msg.sender.id) === myId);
              const nextMsg = messages[i + 1];
              const isLast = !nextMsg || !nextMsg.sender || (nextMsg.sender._id || nextMsg.sender.id) !== (msg.sender?._id || msg.sender?.id);
              const isRead = msg.readBy?.some((id) => id === (otherUser?._id || otherUser?.id));
              const gap = i > 0 && messages[i - 1]?.sender && (messages[i - 1].sender._id || messages[i - 1].sender.id) === (msg.sender?._id || msg.sender?.id) ? "mt-0.5" : "mt-4";
              return (
                <motion.div key={msg._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
                  className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"} ${gap}`}>
                  {!isMe && <div className="w-7 flex-shrink-0 self-end">{isLast && msg.sender && <Avatar name={msg.sender.name ?? "?"} image={msg.sender.profileImage} size="xs" />}</div>}
                  <div className={`max-w-[70%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe
                      ? "bg-gradient-to-br from-violet-600 to-purple-700 text-white rounded-br-sm shadow-lg shadow-violet-500/20"
                      : "bg-[#1a1a35] text-white/90 rounded-bl-sm border border-white/5"}`}>
                      {msg.content}
                    </div>
                    <div className={`flex items-center gap-1 mt-1 px-1 ${isMe ? "flex-row-reverse" : ""}`}>
                      <span className="text-white/20 text-[10px]">{fmtMsg(msg.createdAt)}</span>
                      {isMe && <MessageTick isRead={!!isRead} />}
                    </div>
                  </div>
                </motion.div>
              );
            })}
            <AnimatePresence>
              {typing?.convId === activeConv._id && (
                <motion.div key="tb" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-end gap-2 mt-4">
                  <div className="w-7">{otherUser && <Avatar name={otherUser.name ?? "?"} image={otherUser.profileImage} size="xs" />}</div>
                  <TypingBubble />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Input — standalone component so typing never causes re-mount */}
      <ChatInput onSend={onSend} onTyping={onTyping} />
    </div>
  );
}

// ── Sidebar Content ───────────────────────────────────────────────────────────
interface SidebarProps {
  user: User;
  tab: Tab;
  setTab: (t: Tab) => void;
  activeConv: Conversation | null;
  setActiveConv: (c: Conversation | null) => void;
  conversations: Conversation[];
  friends: User[];
  friendRequests: { sent: FriendRequest[]; received: FriendRequest[] };
  allUsers: User[];
  convSearch: string;
  setConvSearch: (v: string) => void;
  userSearch: string;
  setUserSearch: (v: string) => void;
  onlineUsers: Set<string>;
  typing: { convId: string; userId: string } | null;
  myId: string;
  totalBadge: number;
  logout: () => void;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onSendRequest: (uid: string) => void;
  onOpenChat: (fid: string) => void;
  onSearchUsers: (q: string) => void;
  updateUser: (u: User) => void;
}

function SidebarContent({
  user, tab, setTab, activeConv, setActiveConv, conversations, friends,
  friendRequests, allUsers, convSearch, setConvSearch, userSearch, setUserSearch,
  onlineUsers, typing, myId, totalBadge, logout, onAccept, onDecline,
  onSendRequest, onOpenChat, onSearchUsers, updateUser,
}: SidebarProps) {
  const pendingReceived = friendRequests.received.filter((r) => r.status === "pending" && r.sender);
  const filteredConvs = conversations.filter((c) => {
    const other = c.participants.find((p) => (p._id || p.id) !== myId) ?? c.participants[0];
    return other?.name?.toLowerCase().includes(convSearch.toLowerCase());
  });

  function isOnline(u: User) { return onlineUsers.has(u._id || u.id || "") || !!u.isOnline; }

  return (
    <div className="flex flex-col h-full bg-[#0f0f22]">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3 md:mb-5">
          <div className="relative cursor-pointer" onClick={() => setTab("profile")}>
            <Avatar name={user?.name ?? "?"} image={user?.profileImage} size="md" />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0f0f22]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{user?.name}</p>
            <p className="text-white/30 text-xs truncate">{user?.statusMessage}</p>
          </div>
          <button onClick={logout} className="w-8 h-8 flex items-center justify-center text-white/30 hover:text-red-400 transition-colors rounded-xl hover:bg-red-500/10">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        {/* Desktop tabs only */}
        <div className="hidden md:flex bg-white/5 rounded-2xl p-1 gap-1">
          {(["chats", "contacts", "discover"] as const).map((t) => {
            const icons = { chats: <MessageSquare className="w-3.5 h-3.5" />, contacts: <Users className="w-3.5 h-3.5" />, discover: <UserPlus className="w-3.5 h-3.5" /> };
            const labels = { chats: "Chats", contacts: "Friends", discover: "People" };
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold transition-all relative ${tab === t ? "bg-violet-600 text-white shadow" : "text-white/30 hover:text-white"}`}>
                {icons[t]}{labels[t]}
                {t === "contacts" && totalBadge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">{totalBadge}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {tab === "chats" && (
          <>
            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                <input value={convSearch} onChange={(e) => setConvSearch(e.target.value)} placeholder="Search..."
                  className="w-full bg-white/5 border border-white/8 text-white placeholder-white/25 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 transition-all" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {filteredConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
                  <MessageSquare className="w-8 h-8 text-white/10" />
                  <p className="text-white/25 text-sm">No chats yet</p>
                </div>
              ) : filteredConvs.map((conv) => {
                const other = conv.participants.find((p) => (p._id || p.id) !== myId) ?? conv.participants[0];
                if (!other) return null;
                const isActive = activeConv?._id === conv._id;
                const unread = conv.unreadCount ?? 0;
                return (
                  <button key={conv._id} onClick={() => setActiveConv(conv)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all text-left mb-0.5 ${isActive ? "bg-violet-600/20 border border-violet-500/30" : "hover:bg-white/5"}`}>
                    <div className="relative flex-shrink-0">
                      <Avatar name={other.name ?? "?"} image={other.profileImage} size="md" />
                      {isOnline(other) && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0f0f22]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className="text-white font-semibold text-sm truncate">{other.name}</span>
                        {conv.lastMessage && <span className="text-white/25 text-[10px] flex-shrink-0 ml-2">{fmtTime(conv.lastMessage.createdAt)}</span>}
                      </div>
                      <div className="flex justify-between items-center mt-0.5">
                        <span className="text-white/35 text-xs truncate">
                          {typing?.convId === conv._id ? (
                            <span className="text-violet-400 flex items-center gap-1">
                              typing <span className="flex gap-0.5">{[0, 1, 2].map(i => (
                                <motion.span key={i} className="w-1 h-1 bg-violet-400 rounded-full inline-block"
                                  animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                              ))}</span>
                            </span>
                          ) : conv.lastMessage ? conv.lastMessage.content : <span className="italic opacity-40">No messages</span>}
                        </span>
                        {unread > 0 && <span className="flex-shrink-0 min-w-[18px] h-[18px] bg-violet-600 rounded-full text-[9px] text-white flex items-center justify-center font-bold px-1 ml-1">{unread}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {tab === "contacts" && (
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {pendingReceived.length > 0 && (
              <div className="mb-4">
                <p className="text-white/35 text-[10px] font-bold uppercase tracking-widest mb-2">Requests ({pendingReceived.length})</p>
                {pendingReceived.map((req) => (
                  <div key={req._id} className="flex items-center gap-3 bg-violet-500/10 border border-violet-500/20 rounded-2xl p-3 mb-2">
                    <Avatar name={req.sender.name ?? "?"} image={req.sender.profileImage} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{req.sender.name ?? "Unknown"}</p>
                      <p className="text-white/35 text-xs">Friend request</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => onAccept(req._id)} className="w-8 h-8 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl flex items-center justify-center"><Check className="w-4 h-4" /></button>
                      <button onClick={() => onDecline(req._id)} className="w-8 h-8 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-white/35 text-[10px] font-bold uppercase tracking-widest mb-2">Friends ({friends.length})</p>
            {friends.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 text-center"><Users className="w-7 h-7 text-white/10 mb-2" /><p className="text-white/25 text-sm">No friends yet</p></div>
            ) : friends.map((f) => {
              const fid = f._id || f.id || "";
              return (
                <div key={fid} className="flex items-center gap-3 px-2 py-3 rounded-2xl hover:bg-white/5 transition-colors">
                  <div className="relative">
                    <Avatar name={f.name ?? "?"} image={f.profileImage} size="sm" />
                    {isOnline(f) && <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full border border-[#0f0f22]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{f.name}</p>
                    <p className="text-xs">{isOnline(f) ? <span className="text-green-400">Online</span> : <span className="text-white/25">Offline</span>}</p>
                  </div>
                  <button onClick={() => onOpenChat(fid)} className="w-8 h-8 bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === "discover" && (
          <>
            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                <input value={userSearch} onChange={(e) => { setUserSearch(e.target.value); onSearchUsers(e.target.value); }} placeholder="Search people..."
                  className="w-full bg-white/5 border border-white/8 text-white placeholder-white/25 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 transition-all" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {allUsers.map((u) => {
                const uid = u._id || u.id || "";
                const isFriend = friends.some((f) => (f._id || f.id) === uid);
                const sentReq = friendRequests.sent.find((r) => r.receiver && (r.receiver._id || r.receiver.id) === uid && r.status === "pending");
                const receivedReq = friendRequests.received.find((r) => r.sender && (r.sender._id || r.sender.id) === uid && r.status === "pending");
                return (
                  <div key={uid} className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 transition-colors">
                    <div className="relative">
                      <Avatar name={u.name ?? "?"} image={u.profileImage} size="sm" />
                      {isOnline(u) && <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full border border-[#0f0f22]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{u.name}</p>
                      <p className="text-white/25 text-xs truncate">{u.statusMessage}</p>
                    </div>
                    {isFriend ? (
                      <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg flex items-center gap-1"><UserCheck className="w-3 h-3" />Friends</span>
                    ) : sentReq ? (
                      <span className="text-xs text-white/25 bg-white/5 px-2 py-1 rounded-lg">Pending</span>
                    ) : receivedReq ? (
                      <button onClick={() => onAccept(receivedReq._id)} className="text-xs text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 px-2 py-1 rounded-lg flex items-center gap-1"><Check className="w-3 h-3" />Accept</button>
                    ) : (
                      <button onClick={() => onSendRequest(uid)} className="w-8 h-8 bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 rounded-xl flex items-center justify-center"><UserPlus className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "profile" && (
          <div className="flex-1 overflow-y-auto">
            <ProfileTab user={user} myId={myId} updateUser={updateUser} logout={logout} compact />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ChatApp ──────────────────────────────────────────────────────────────
export default function ChatApp() {
  const { user, logout, updateUser } = useAuth();
  const [tab, setTab] = useState<Tab>("chats");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<{ sent: FriendRequest[]; received: FriendRequest[] }>({ sent: [], received: [] });
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [convSearch, setConvSearch] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState<{ convId: string; userId: string } | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myId = (user?._id || user?.id) ?? "";
  const activeConvRef = useRef(activeConv);
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);

  const loadConversations = useCallback(async () => {
    try { const { conversations: c } = await api.get<{ conversations: Conversation[] }>("/conversations"); setConversations(c); } catch {}
  }, []);
  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try { const { messages: m } = await api.get<{ messages: Message[] }>(`/messages/${convId}`); setMessages(m); }
    catch {} finally { setLoadingMsgs(false); }
  }, []);
  const loadFriends = useCallback(async () => {
    try {
      const [{ friends: f }, { sent, received }] = await Promise.all([
        api.get<{ friends: User[] }>("/friends"),
        api.get<{ sent: FriendRequest[]; received: FriendRequest[] }>("/friends/requests"),
      ]);
      setFriends(f); setFriendRequests({ sent, received });
    } catch {}
  }, []);
  const loadUsers = useCallback(async (q = "") => {
    try { const { users } = await api.get<{ users: User[] }>(`/users${q ? `?q=${encodeURIComponent(q)}` : ""}`); setAllUsers(users); } catch {}
  }, []);

  useEffect(() => { loadConversations(); loadFriends(); loadUsers(); }, [loadConversations, loadFriends, loadUsers]);

  useEffect(() => {
    const socket = getSocket();
    socket.on("receive-message", ({ message }: { message: Message }) => {
      const cur = activeConvRef.current;
      if (message.conversationId === cur?._id) {
        setMessages((prev) => {
          // Replace optimistic temp message if content matches, otherwise append
          const tempIdx = prev.findIndex(
            (m) => m._id.startsWith("temp-") && m.content === message.content
          );
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = message;
            return updated;
          }
          return [...prev, message];
        });
        socket.emit("mark-read", { conversationId: cur._id });
      }
      loadConversations();
    });
    socket.on("user-online", ({ userId }: { userId: string }) => setOnlineUsers((p) => new Set([...p, userId])));
    socket.on("user-offline", ({ userId }: { userId: string }) => setOnlineUsers((p) => { const s = new Set(p); s.delete(userId); return s; }));
    socket.on("typing-start", ({ conversationId, userId }: { conversationId: string; userId: string }) => setTyping({ convId: conversationId, userId }));
    socket.on("typing-stop", () => setTyping(null));
    socket.on("incoming-friend-request", () => loadFriends());
    socket.on("friend-request-accepted", () => { loadFriends(); loadConversations(); });
    socket.on("friend-request-declined", () => loadFriends());
    socket.on("unread-count-update", () => loadConversations());
    return () => {
      ["receive-message","user-online","user-offline","typing-start","typing-stop",
       "incoming-friend-request","friend-request-accepted","friend-request-declined","unread-count-update"]
        .forEach((e) => socket.off(e));
    };
  }, [loadConversations, loadFriends]);   // ← no activeConv in deps, use ref instead

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    if (activeConv) { loadMessages(activeConv._id); getSocket().emit("mark-read", { conversationId: activeConv._id }); }
    else setMessages([]);
  }, [activeConv, loadMessages]);

  const handleSend = useCallback((text: string) => {
    const conv = activeConvRef.current;
    if (!conv) return;
    // Optimistic: show message immediately before server confirms
    const optimistic: Message = {
      _id: `temp-${Date.now()}`,
      conversationId: conv._id,
      sender: user as User,
      content: text,
      readBy: [myId],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    getSocket().emit("send-message", { conversationId: conv._id, content: text });
  }, [myId, user]);

  const handleTyping = useCallback(() => {
    const conv = activeConvRef.current;
    if (!conv) return;
    getSocket().emit("typing-start", { conversationId: conv._id });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => getSocket().emit("typing-stop", { conversationId: conv._id }), 1500);
  }, []);

  async function acceptRequest(id: string) { try { await api.put(`/friends/accept/${id}`, {}); loadFriends(); loadConversations(); } catch {} }
  async function declineRequest(id: string) { try { await api.put(`/friends/decline/${id}`, {}); loadFriends(); } catch {} }
  async function sendFriendRequest(uid: string) { try { await api.post("/friends/request/" + uid, {}); loadFriends(); } catch {} }
  async function openChatWith(fid: string) {
    try { const { conversation } = await api.get<{ conversation: Conversation }>(`/conversations/with/${fid}`); setActiveConv(conversation); setTab("chats"); } catch {}
  }

  const totalBadge = friendRequests.received.filter((r) => r.status === "pending" && r.sender).length;

  const sidebarProps: SidebarProps = {
    user: user!, tab, setTab, activeConv, setActiveConv, conversations, friends,
    friendRequests, allUsers, convSearch, setConvSearch, userSearch, setUserSearch,
    onlineUsers, typing, myId, totalBadge, logout,
    onAccept: acceptRequest, onDecline: declineRequest,
    onSendRequest: sendFriendRequest, onOpenChat: openChatWith,
    onSearchUsers: loadUsers, updateUser,
  };

  const chatPanelProps: ChatPanelProps = {
    activeConv, messages, loadingMsgs, typing, myId,
    onSend: handleSend, onTyping: handleTyping, messagesEndRef,
  };

  return (
    <>
      {/* DESKTOP: two-panel */}
      <div className="hidden md:flex app-height bg-[#0a0a1a]">
        <div className="w-80 lg:w-96 flex-shrink-0 border-r border-white/5 flex flex-col overflow-hidden">
          <SidebarContent {...sidebarProps} />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatPanel {...chatPanelProps} />
        </div>
      </div>

      {/* MOBILE: full screen */}
      <div className="flex flex-col app-height bg-[#0a0a1a] md:hidden">
        {activeConv ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <ChatPanel {...chatPanelProps} onBack={() => setActiveConv(null)} />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-hidden min-h-0">
              <AnimatePresence mode="wait">
                <motion.div key={tab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="h-full flex flex-col overflow-hidden">
                  {tab === "profile" ? (
                    <div className="flex-1 overflow-y-auto bg-[#0a0a1a]">
                      <ProfileTab user={user!} myId={myId} updateUser={updateUser} logout={logout} />
                    </div>
                  ) : (
                    <SidebarContent {...sidebarProps} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            {/* Bottom nav */}
            <div className="flex-shrink-0 bg-[#0f0f22] border-t border-white/5 px-2 py-1">
              <div className="flex items-center justify-around">
                {([
                  { key: "chats", Icon: MessageSquare, label: "Chats", badge: 0 },
                  { key: "contacts", Icon: Users, label: "Friends", badge: totalBadge },
                  { key: "discover", Icon: UserPlus, label: "People", badge: 0 },
                  { key: "profile", Icon: UserIcon, label: "Profile", badge: 0 },
                ] as const).map(({ key, Icon, label, badge }) => {
                  const active = tab === key;
                  return (
                    <button key={key} onClick={() => setTab(key)}
                      className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all ${active ? "text-violet-400" : "text-white/25 hover:text-white/50"}`}>
                      <div className={`relative p-2 rounded-xl ${active ? "bg-violet-500/15" : ""}`}>
                        <Icon className="w-5 h-5" />
                        {badge > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">{badge}</span>}
                      </div>
                      <span className={`text-[10px] font-medium ${active ? "text-violet-400" : ""}`}>{label}</span>
                      {active && <motion.div layoutId="mni" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-violet-400 rounded-full" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ user, myId, updateUser, logout, compact }: { user: User; myId: string; updateUser: (u: User) => void; logout: () => void; compact?: boolean }) {
  const [name, setName] = useState(user.name ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [statusMessage, setStatusMessage] = useState(user.statusMessage ?? "");
  const [profileImage, setProfileImage] = useState(user.profileImage ?? "");
  const [imageTab, setImageTab] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput] = useState(user.profileImage?.startsWith("http") ? user.profileImage : "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pwdSaved, setPwdSaved] = useState(false);
  const [error, setError] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const colors = ["from-violet-500 to-purple-700", "from-pink-500 to-rose-600", "from-blue-500 to-cyan-600", "from-amber-500 to-orange-600"];
  const color = colors[myId.charCodeAt(0) % colors.length] ?? colors[0];

  function readFile(file: File): Promise<string> {
    return new Promise((res, rej) => {
      if (file.size > 2 * 1024 * 1024) return rej(new Error("Max 2MB"));
      if (!file.type.startsWith("image/")) return rej(new Error("Must be an image"));
      const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(new Error("Failed")); r.readAsDataURL(file);
    });
  }
  async function handleFile(f: File) { setError(""); try { setProfileImage(await readFile(f)); } catch (e) { setError(e instanceof Error ? e.message : "Error"); } }
  async function saveProfile() {
    setError(""); setSaving(true);
    try { const { user: u } = await api.put<{ user: User }>("/users/profile", { name, bio, statusMessage, profileImage }); updateUser(u); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); } finally { setSaving(false); }
  }
  async function changePassword() {
    setPwdError(""); setSavingPwd(true);
    try { await api.put("/users/password", { currentPassword, newPassword }); setCurrentPassword(""); setNewPassword(""); setPwdSaved(true); setTimeout(() => setPwdSaved(false), 2000); }
    catch (e) { setPwdError(e instanceof Error ? e.message : "Failed"); } finally { setSavingPwd(false); }
  }

  return (
    <div className="px-5 py-6 space-y-5">
      {!compact && (
        <div className="relative h-24 rounded-3xl bg-gradient-to-br from-violet-600/40 to-purple-900/60 mb-12 overflow-hidden">
          <div className="absolute -bottom-10 left-5">
            <div className="relative group">
              <div className={`w-20 h-20 rounded-2xl border-4 border-[#0a0a1a] bg-gradient-to-br ${color} flex items-center justify-center text-2xl font-bold text-white shadow-xl overflow-hidden`}>
                {profileImage ? <img src={profileImage} className="w-full h-full object-cover" onError={() => setProfileImage("")} /> : (name || "?").charAt(0).toUpperCase()}
              </div>
              <button onClick={() => fileRef.current?.click()} className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
      <div><p className="text-white font-bold text-base">{user.name}</p><p className="text-white/30 text-xs">{user.email}</p></div>
      <div className="space-y-2">
        <label className="text-white/35 text-[10px] font-bold uppercase tracking-widest block">Profile Photo</label>
        <div className="flex bg-white/5 border border-white/8 rounded-xl p-1 gap-1">
          {(["upload", "url"] as const).map((t) => (
            <button key={t} onClick={() => setImageTab(t)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${imageTab === t ? "bg-violet-600 text-white" : "text-white/30 hover:text-white"}`}>
              {t === "upload" ? <><Upload className="w-3 h-3" />Upload</> : <><Link className="w-3 h-3" />URL</>}
            </button>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {imageTab === "upload" ? (
          <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl py-5 cursor-pointer transition-all ${dragging ? "border-violet-500 bg-violet-500/10" : "border-white/10 hover:border-violet-500/40"}`}>
            {profileImage && !profileImage.startsWith("http") ? (
              <><img src={profileImage} className="w-12 h-12 rounded-xl object-cover border border-violet-500" /><p className="text-green-400 text-xs">Image ready — click to change</p></>
            ) : (
              <><Upload className="w-5 h-5 text-white/20" /><p className="text-white/25 text-sm">Drop or click to browse</p><p className="text-white/15 text-xs">JPG, PNG — max 2MB</p></>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { const u = urlInput.trim(); if (u.startsWith("http")) setProfileImage(u); } }}
                placeholder="https://..." className="input-field flex-1 py-2" />
              <button onClick={() => { const u = urlInput.trim(); if (u.startsWith("http")) setProfileImage(u); }} className="px-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold transition-colors">Apply</button>
            </div>
            {profileImage?.startsWith("http") && (
              <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                <img src={profileImage} className="w-10 h-10 rounded-xl object-cover border border-violet-500" onError={() => setProfileImage("")} />
                <div className="flex-1 min-w-0"><p className="text-green-400 text-xs">Preview OK</p><p className="text-white/20 text-xs truncate">{profileImage}</p></div>
                <button onClick={() => { setProfileImage(""); setUrlInput(""); }} className="text-white/25 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        )}
        {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}
      </div>
      {[{ label: "Name", val: name, set: setName }, { label: "Status", val: statusMessage, set: setStatusMessage }].map(({ label, val, set }) => (
        <div key={label}>
          <label className="text-white/35 text-[10px] font-bold uppercase tracking-widest block mb-1.5">{label}</label>
          <input type="text" value={val} onChange={(e) => set(e.target.value)} className="input-field" />
        </div>
      ))}
      <div>
        <label className="text-white/35 text-[10px] font-bold uppercase tracking-widest block mb-1.5">Bio</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="input-field resize-none" placeholder="About you..." />
      </div>
      <button onClick={saveProfile} disabled={saving} className="btn-primary flex items-center justify-center gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? "Saved!" : "Save Profile"}
      </button>
      <div className="border-t border-white/8 pt-5 space-y-3">
        <p className="text-white font-semibold text-sm flex items-center gap-2"><Lock className="w-4 h-4 text-violet-400" />Change Password</p>
        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className="input-field" />
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="input-field" />
        {pwdError && <p className="text-red-400 text-xs bg-red-500/10 rounded-xl px-3 py-2">{pwdError}</p>}
        <button onClick={changePassword} disabled={savingPwd || !currentPassword || !newPassword}
          className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-2xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
          {savingPwd ? <Loader2 className="w-4 h-4 animate-spin" /> : pwdSaved ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Lock className="w-4 h-4" />}
          {pwdSaved ? "Updated!" : "Update Password"}
        </button>
      </div>
      <button onClick={logout} className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-medium rounded-2xl transition-all flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4" />Sign Out
      </button>
    </div>
  );
}
