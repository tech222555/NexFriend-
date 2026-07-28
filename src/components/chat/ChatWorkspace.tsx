import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Match, UserProfile } from '../../types';
import { MessageCircle, Clock, ChevronRight, Search, Globe, Shield, Star, Sparkles, MessageSquare, Phone, Video, SearchCode, Settings, Menu, Users, X, Check, Users2, Loader2, Camera } from 'lucide-react';
import { formatDate, cn, isUserOnline } from '../../utils';
import ChatRoom from './ChatRoom';
import { handleFirestoreError, OperationType } from '../../services/firestoreErrorHandler';
import { fileToBase64, resizeImage } from '../../utils/image';

const iconPresets = [
  { background: 'from-pink-500 to-rose-400', emoji: '💖' },
  { background: 'from-purple-600 to-indigo-500', emoji: '🧠' },
  { background: 'from-emerald-500 to-teal-400', emoji: '🚀' },
  { background: 'from-orange-500 to-amber-400', emoji: '🔥' },
  { background: 'from-blue-500 to-cyan-400', emoji: '💬' }
];

export default function ChatWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [matches, setMatches] = useState<(Match & { otherUser?: UserProfile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Group creation states
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupSubject, setGroupSubject] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedIconPreset, setSelectedIconPreset] = useState(0);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [customGroupImage, setCustomGroupImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      const resized = await resizeImage(base64, 400, 400);
      setCustomGroupImage(resized);
    } catch (err) {
      console.error("Error processing group image:", err);
    }
  };

  // Fetch match instances
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'matches'),
      where('userIds', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const matchData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Match));

      // Fetch other users' profiles for each 1-on-1 match
      const enrichedMatches = await Promise.all(
        matchData.map(async (m) => {
          if (m.isGroup) {
            return m; // Group chats don't have a single other user profile
          }
          const otherId = m.userIds.find(uid => uid !== user.uid);
          if (otherId) {
            const userDoc = await getDoc(doc(db, 'users', otherId));
            if (userDoc.exists()) {
              return { ...m, otherUser: { uid: otherId, ...userDoc.data() } as UserProfile };
            }
          }
          return m;
        })
      );

      setMatches(enrichedMatches);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // Fetch users when the create group modal is opened
  useEffect(() => {
    if (isCreateGroupOpen && user) {
      const fetchUsers = async () => {
        setUsersLoading(true);
        try {
          const snapshot = await getDocs(collection(db, 'users'));
          const usersList = snapshot.docs
            .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
            .filter(u => u.uid !== user.uid);
          setAllUsers(usersList);
        } catch (err) {
          console.error("Error fetching potential group members:", err);
        } finally {
          setUsersLoading(false);
        }
      };
      fetchUsers();
    }
  }, [isCreateGroupOpen, user]);

  const filteredMatches = matches.filter(m => {
    const term = searchQuery.toLowerCase();
    if (m.isGroup) {
      return m.groupName?.toLowerCase().includes(term) || m.lastMessage?.toLowerCase().includes(term);
    }
    return m.otherUser?.fullName.toLowerCase().includes(term) || m.lastMessage?.toLowerCase().includes(term);
  });

  const filteredUsers = allUsers.filter(u => 
    u.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
    u.username.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const toggleSelectMember = (uid: string) => {
    if (selectedUserIds.includes(uid)) {
      setSelectedUserIds(prev => prev.filter(id => id !== uid));
    } else {
      setSelectedUserIds(prev => [...prev, uid]);
    }
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !groupSubject.trim()) return;

    setCreatingGroup(true);
    let docRef;
    try {
      const preset = iconPresets[selectedIconPreset];
      const iconString = `preset:${preset.background}:${preset.emoji}`;
      
      const newGroupData = {
        userIds: [user.uid, ...selectedUserIds],
        isGroup: true,
        groupName: groupSubject.trim(),
        groupDescription: groupDescription.trim(),
        groupIcon: customGroupImage || iconString,
        createdBy: user.uid,
        admins: [user.uid],
        status: 'active',
        createdAt: serverTimestamp(),
        lastMessage: `🚀 Group established by ${profile.fullName}`,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
        lastMessageRead: false
      };

      try {
        docRef = await addDoc(collection(db, 'matches'), newGroupData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'matches');
      }

      try {
        // Send initial notification message in sub-collection
        await addDoc(collection(db, `matches/${docRef.id}/messages`), {
          senderId: 'system',
          senderName: 'System',
          text: `📢 Welcome to ${groupSubject.trim()}! Established by ${profile.fullName}. Say hello! 👋`,
          createdAt: serverTimestamp(),
          read: false
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `matches/${docRef.id}/messages`);
      }

      // Reset fields & close
      setGroupSubject('');
      setGroupDescription('');
      setSelectedUserIds([]);
      setCustomGroupImage(null);
      setIsCreateGroupOpen(false);
      
      // Redirect directly to the newly created group chat room
      navigate(`/chat/${docRef.id}`);
    } catch (err) {
      console.error("Error establishing sync group:", err);
      // Re-throw so user-facing UI or outer error boundaries can catch it
      throw err;
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-white md:border-l md:border-slate-100 relative pb-16 md:pb-0">
      {/* 1. Left Sidebar: Chats List */}
      <div className={cn(
        "w-full md:w-[380px] lg:w-[420px] flex flex-col bg-[#fdf2f8]/10 h-full border-r border-slate-100/90 flex-shrink-0 transition-all duration-300",
        id ? "hidden md:flex" : "flex"
      )}>
        {/* Sidebar Header */}
        <div className="p-5 border-b border-slate-100/80 bg-white flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight italic text-slate-900">
                Chats<span className="text-pink-500 font-extrabold">.</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-pink-500/10 text-pink-600 rounded-full">
                {matches.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsCreateGroupOpen(true)}
                className="p-2 hover:bg-pink-50 text-pink-500 hover:text-pink-600 rounded-xl transition-all flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider"
                title="Create WhatsApp-like Group"
              >
                <Users size={16} />
                <span className="hidden sm:inline">New Group</span>
              </button>
              <button 
                onClick={() => navigate('/')} 
                className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                title="Find more peers"
              >
                <Sparkles size={18} className="text-pink-500 animate-pulse" />
              </button>
            </div>
          </div>

          {/* WhatsApp style search box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or start new dynamic chat..."
              className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-pink-100 transition-all placeholder:text-slate-400 text-slate-900"
            />
          </div>
        </div>

        {/* Channels/Chats list content */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100/40 bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-2 border-pink-100 border-t-pink-500 rounded-full animate-spin" />
              <p className="text-slate-400 font-bold tracking-widest text-[9px] uppercase">Retrieving Channels...</p>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-12 h-12 bg-pink-50 text-pink-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare size={22} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No active sync channels</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
                Connect with new profile nodes in the Explore feed.
              </p>
              <button 
                onClick={() => navigate('/')}
                className="mt-4 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Find connections
              </button>
            </div>
          ) : (
            filteredMatches.map((match) => {
              const isSelected = id === match.id;
              const isGroup = match.isGroup;
              
              const title = isGroup ? match.groupName : (match.otherUser?.fullName || 'User Node');
              const online = isGroup ? false : isUserOnline(match.otherUser?.lastActive);
              const isUnread = match.lastMessageSenderId !== user?.uid && match.lastMessageRead === false && match.status !== 'pending';

              // Group avatar parser helper
              const renderAvatar = () => {
                if (isGroup) {
                  if (match.groupIcon?.startsWith('preset:')) {
                    const parts = match.groupIcon.split(':');
                    const bgGradient = parts[1] || 'from-pink-500 to-rose-400';
                    const emoji = parts[2] || '👥';
                    return (
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-gradient-to-tr shadow-sm border border-slate-100", bgGradient)}>
                        {emoji}
                      </div>
                    );
                  } else if (match.groupIcon) {
                    return (
                      <img 
                        src={match.groupIcon} 
                        className="w-12 h-12 rounded-xl object-cover border border-slate-100"
                        alt="Group Avatar"
                        referrerPolicy="no-referrer"
                      />
                    );
                  }
                }
                
                const avatarUrl = isGroup
                  ? `https://api.dicebear.com/7.x/initials/svg?seed=${match.groupName || 'Group'}`
                  : (match.otherUser?.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${match.id}`);
                
                return (
                  <img 
                    src={avatarUrl} 
                    className="w-12 h-12 rounded-xl object-cover border border-slate-100"
                    alt="Avatar"
                    referrerPolicy="no-referrer"
                  />
                );
              };
              
              return (
                <Link
                  key={match.id}
                  to={`/chat/${match.id}`}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 cursor-pointer transition-all hover:bg-slate-50/70",
                    isSelected ? "bg-pink-50/40 border-l-4 border-pink-500" : "border-l-4 border-transparent"
                  )}
                >
                  <div className="relative flex-shrink-0">
                    {renderAvatar()}
                    {!isGroup && (
                      <div className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
                        online ? "bg-green-500 animate-pulse" : "bg-slate-300"
                      )} />
                    )}
                  </div>
 
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5">
                        {isGroup && <Users2 size={12} className="text-slate-400 flex-shrink-0" />}
                        <span className="truncate">{title}</span>
                      </h4>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isUnread && (
                          <span className="relative flex h-2 w-2 flex-shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                          </span>
                        )}
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                          {formatDate(match.lastMessageAt)}
                        </span>
                      </div>
                    </div>
                    <p className={cn("text-[11px] truncate leading-relaxed transition-colors", isUnread ? "text-pink-600 font-extrabold" : "text-slate-500")}>
                      {match.status === 'pending' ? '🚀 New connection synced!' : (match.lastMessage || 'Connected. Start sync...')}
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Right Pane: Chat workspace screen / standby landing */}
      <div className={cn(
        "flex-1 flex flex-col h-full bg-slate-50/30 relative",
        !id ? "hidden md:flex" : "flex"
      )}>
        {id ? (
          <ChatRoom />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#fafbfc] select-none h-full relative overflow-hidden">
            {/* Soft decorative ring backgrounds */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-pink-100/10 rounded-full border border-pink-100/20 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-pink-100/5 rounded-full border border-pink-100/10 pointer-events-none" />

            <div className="relative z-10 max-w-sm flex flex-col items-center">
              <div className="w-20 h-20 bg-gradient-to-tr from-pink-500 to-rose-400 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-pink-500/20 mb-6 group hover:scale-110 transition-transform duration-500">
                <MessageCircle size={36} className="text-white" />
              </div>
              
              <h2 className="text-2xl font-black tracking-tight text-slate-900 italic">
                MEETORA CONNECT WEB
              </h2>
              <p className="text-xs text-slate-500 mt-2.5 max-w-xs leading-relaxed font-semibold">
                Send and receive secure translations instantly. Meetora keeps your devices connected and synced.
              </p>

              <div className="mt-8 flex items-center justify-center gap-2 px-4 py-1.5 bg-slate-100/80 rounded-full border border-slate-200/40 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                <Shield size={12} className="text-green-500" />
                Double check encrypted sync active
              </div>
            </div>

            <div className="absolute bottom-8 text-slate-400/60 font-black text-[9px] uppercase tracking-[0.25em] z-10">
              ⚡ Powered by Gemini AI Translations
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp-Style Group Creation Modal */}
      {isCreateGroupOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-pink-500/10 text-pink-600 rounded-2xl">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black italic tracking-tight text-slate-900 uppercase">New Sync Group</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">WhatsApp-Style Connection</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCreateGroupOpen(false)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {/* Step 1: Subject and Bio */}
              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">1. Group Identity</h4>
                <div className="flex gap-4 items-start">
                  {/* Selected Group Icon Render Preview */}
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "w-16 h-16 rounded-[1.25rem] flex items-center justify-center flex-shrink-0 bg-gradient-to-tr shadow-lg border border-white overflow-hidden transition-all hover:scale-105 active:scale-95 group relative",
                        customGroupImage ? "" : iconPresets[selectedIconPreset].background
                      )}
                      title="Upload custom group picture"
                    >
                      {customGroupImage ? (
                        <img 
                          src={customGroupImage} 
                          className="w-full h-full object-cover" 
                          alt="Group avatar preview" 
                        />
                      ) : (
                        <span className="text-3xl">{iconPresets[selectedIconPreset].emoji}</span>
                      )}
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-[1.25rem]">
                        <Camera size={18} className="text-white" />
                      </div>
                    </button>
                    {customGroupImage && (
                      <button
                        type="button"
                        onClick={() => setCustomGroupImage(null)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 hover:bg-rose-600 text-white rounded-full border border-white flex items-center justify-center shadow transition-all scale-100 hover:scale-110 cursor-pointer"
                        title="Remove custom image"
                      >
                        <X size={10} strokeWidth={3} />
                      </button>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-3">
                    <input 
                      type="text"
                      required
                      placeholder="Group Subject (e.g. London Explorers)..."
                      value={groupSubject}
                      onChange={(e) => setGroupSubject(e.target.value)}
                      maxLength={40}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-pink-100 outline-none transition-all placeholder:text-slate-400"
                    />
                    <input 
                      type="text"
                      placeholder="Group Description (e.g. Chatting about travel)..."
                      value={groupDescription}
                      onChange={(e) => setGroupDescription(e.target.value)}
                      maxLength={150}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-pink-100 outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Avatar Presets Picker */}
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">Choose Avatar Color & Symbol:</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[9px] font-bold text-pink-500 hover:text-pink-600 transition-colors uppercase tracking-wider"
                    >
                      {customGroupImage ? "Change Photo" : "Upload Custom Picture"}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {iconPresets.map((preset, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setSelectedIconPreset(index)}
                        className={cn(
                          "w-10 h-10 rounded-xl bg-gradient-to-tr flex items-center justify-center text-lg shadow-sm hover:scale-105 transition-all relative border border-transparent",
                          preset.background,
                          selectedIconPreset === index ? "ring-2 ring-pink-500 ring-offset-2 border-white scale-105" : "opacity-85 hover:opacity-100"
                        )}
                      >
                        {preset.emoji}
                        {selectedIconPreset === index && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 rounded-full border border-white flex items-center justify-center">
                            <Check size={8} className="text-white font-extrabold" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 2: Add Members list */}
              <div className="flex flex-col gap-4 flex-1 min-h-[250px]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">2. Select Group Members</h4>
                  <span className="text-[10px] bg-pink-500/10 text-pink-600 font-extrabold px-2.5 py-0.5 rounded-full">
                    {selectedUserIds.length} Selected
                  </span>
                </div>

                {/* Selected members small badges bubble wrap list */}
                {selectedUserIds.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none select-none">
                    {selectedUserIds.map(uid => {
                      const member = allUsers.find(u => u.uid === uid);
                      if (!member) return null;
                      return (
                        <div key={uid} className="flex items-center gap-1.5 bg-slate-100 border border-slate-200/40 rounded-full pl-1.5 pr-2.5 py-1 text-[10px] font-bold text-slate-700 flex-shrink-0 animate-in zoom-in-95">
                          <img 
                            src={member.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`} 
                            className="w-4 h-4 rounded-full object-cover" 
                            alt=""
                          />
                          <span>{member.fullName}</span>
                          <button 
                            type="button" 
                            onClick={() => toggleSelectMember(uid)} 
                            className="text-slate-400 hover:text-slate-600 ml-0.5"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Member Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Search synced connections to invite..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-pink-100 transition-all placeholder:text-slate-400 text-slate-800"
                  />
                </div>

                {/* Members list items scroll wrapper */}
                <div className="flex-1 overflow-y-auto border border-slate-100/80 rounded-2xl divide-y divide-slate-100/60 max-h-[220px]">
                  {usersLoading ? (
                    <div className="p-8 flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-pink-100 border-t-pink-500 rounded-full animate-spin" />
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Syncing contacts list...</p>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                      No matching connections found in your sync range.
                    </div>
                  ) : (
                    filteredUsers.map(u => {
                      const isSelected = selectedUserIds.includes(u.uid);
                      return (
                        <div 
                          key={u.uid}
                          onClick={() => toggleSelectMember(u.uid)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50/50",
                            isSelected ? "bg-pink-50/20" : ""
                          )}
                        >
                          <div className="relative">
                            <img 
                              src={u.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                              className="w-8 h-8 rounded-lg object-cover" 
                              alt={u.fullName}
                            />
                            {isSelected && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 rounded-full border border-white flex items-center justify-center">
                                <Check size={8} className="text-white font-extrabold" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{u.fullName}</p>
                            <p className="text-[10px] text-slate-400 font-medium truncate">@{u.username} • {u.city}, {u.country}</p>
                          </div>
                          <div className={cn(
                            "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                            isSelected ? "bg-pink-500 border-pink-500 text-white" : "border-slate-200"
                          )}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Establish / Create Group Button action */}
              <button
                type="submit"
                disabled={creatingGroup || !groupSubject.trim() || selectedUserIds.length === 0}
                className={cn(
                  "w-full py-4 rounded-2xl text-white font-black uppercase tracking-widest text-xs shadow-lg transition-all flex items-center justify-center gap-2 mt-2",
                  (creatingGroup || !groupSubject.trim() || selectedUserIds.length === 0)
                    ? "bg-slate-300 shadow-none cursor-not-allowed"
                    : "gradient-pink shadow-pink-500/10 hover:shadow-pink-500/25 hover:scale-[1.01] active:scale-95"
                )}
              >
                {creatingGroup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Establishing Sync Group...</span>
                  </>
                ) : (
                  <>
                    <Users size={16} />
                    <span>Establish Group Sync ({selectedUserIds.length + 1} Nodes)</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

