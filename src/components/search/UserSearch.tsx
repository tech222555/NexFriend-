import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { UserProfile } from '../../types';
import { matchService } from '../../services/matchService';
import { 
  Search, 
  User, 
  MessageSquare, 
  Heart, 
  MapPin, 
  Sparkles, 
  Check, 
  Copy, 
  X, 
  Filter, 
  Globe, 
  Award, 
  ShieldCheck,
  AtSign,
  ArrowRight,
  CircleDot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, isUserOnline } from '../../utils';

export default function UserSearch() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'username' | 'online' | 'interests'>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [copiedUsername, setCopiedUsername] = useState<string | null>(null);
  const [connectingUid, setConnectingUid] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Sync URL with search query
  useEffect(() => {
    if (searchQuery) {
      setSearchParams({ q: searchQuery }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [searchQuery, setSearchParams]);

  // Load users from Firestore
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), limit(100));
        const snapshot = await getDocs(q);
        const fetchedUsers = snapshot.docs
          .map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile))
          .filter(u => u.uid !== profile?.uid);
        
        setUsers(fetchedUsers);
      } catch (err) {
        console.error('Failed to search accounts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [profile]);

  // Filter users based on query and filter mode
  const filteredUsers = useMemo(() => {
    const rawQuery = searchQuery.trim().toLowerCase();
    const cleanQuery = rawQuery.startsWith('@') ? rawQuery.slice(1) : rawQuery;

    return users.filter(user => {
      const usernameMatch = (user.username || '').toLowerCase().includes(cleanQuery);
      const nameMatch = (user.fullName || '').toLowerCase().includes(cleanQuery);
      const bioMatch = (user.bio || '').toLowerCase().includes(cleanQuery);
      const cityMatch = (user.city || '').toLowerCase().includes(cleanQuery);
      const countryMatch = (user.country || '').toLowerCase().includes(cleanQuery);
      const interestMatch = (user.interests || []).some(i => i.toLowerCase().includes(cleanQuery));

      const matchesSearch = !cleanQuery || 
        usernameMatch || 
        nameMatch || 
        bioMatch || 
        cityMatch || 
        countryMatch || 
        interestMatch;

      if (!matchesSearch) return false;

      if (activeFilter === 'username') {
        return usernameMatch;
      }
      if (activeFilter === 'online') {
        return isUserOnline(user.lastActive);
      }
      if (activeFilter === 'interests') {
        return interestMatch || (user.interests && user.interests.length > 0);
      }

      return true;
    });
  }, [users, searchQuery, activeFilter]);

  const handleCopyUsername = (username: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const formatted = username.startsWith('@') ? username : `@${username}`;
    navigator.clipboard.writeText(formatted);
    setCopiedUsername(username);
    setTimeout(() => setCopiedUsername(null), 2000);
  };

  const handleStartChat = async (targetUser: UserProfile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!profile) return;

    setConnectingUid(targetUser.uid);
    try {
      const match = await matchService.createMatch(profile.uid, targetUser.uid);
      navigate(`/chat/${match.id}`);
    } catch (err) {
      console.error('Error initiating chat session:', err);
    } finally {
      setConnectingUid(null);
    }
  };

  const handleConnect = async (targetUser: UserProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) return;

    setConnectingUid(targetUser.uid);
    try {
      await matchService.createMatch(profile.uid, targetUser.uid);
      setActionSuccessMsg(`Connected with @${targetUser.username || targetUser.fullName}!`);
      setTimeout(() => setActionSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Error connecting with account:', err);
    } finally {
      setConnectingUid(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      {/* Action Notification Banner */}
      <AnimatePresence>
        {actionSuccessMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400">
              <Sparkles size={18} />
            </div>
            <span className="text-sm font-bold">{actionSuccessMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-pink-500 text-xs font-black uppercase tracking-widest mb-1">
            <AtSign size={14} /> Account Directory
          </div>
          <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-slate-900 uppercase">
            Search Accounts
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Find people by their handle, username, location, or shared interests.
          </p>
        </div>
      </div>

      {/* Main Search Input Box */}
      <div className="relative group">
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-pink-500 transition-colors">
          <Search size={22} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by @username, full name, or city..."
          className="w-full bg-white border border-slate-200/80 rounded-3xl pl-14 pr-12 py-5 text-base font-semibold text-slate-900 outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-400 transition-all shadow-sm"
          autoFocus
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-5 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
            title="Clear search query"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Filter Tabs & Count */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveFilter('all')}
            className={cn(
              "px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
              activeFilter === 'all'
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
            )}
          >
            All Accounts
          </button>
          <button
            onClick={() => setActiveFilter('username')}
            className={cn(
              "px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
              activeFilter === 'username'
                ? "bg-pink-500 text-white shadow-md shadow-pink-500/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
            )}
          >
            <AtSign size={13} /> By Username
          </button>
          <button
            onClick={() => setActiveFilter('online')}
            className={cn(
              "px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
              activeFilter === 'online'
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Online Now
          </button>
          <button
            onClick={() => setActiveFilter('interests')}
            className={cn(
              "px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
              activeFilter === 'interests'
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
            )}
          >
            <Sparkles size={13} /> By Interests
          </button>
        </div>

        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {filteredUsers.length} {filteredUsers.length === 1 ? 'Account' : 'Accounts'} Found
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm animate-pulse flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-slate-200 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded-lg w-3/4" />
                  <div className="h-3 bg-slate-200 rounded-lg w-1/2" />
                </div>
              </div>
              <div className="h-10 bg-slate-100 rounded-2xl" />
            </div>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm px-6 flex flex-col items-center">
          <div className="w-16 h-16 bg-pink-50 text-pink-500 rounded-2xl flex items-center justify-center mb-4 border border-pink-100">
            <User size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 italic">No Accounts Found</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-md font-medium">
            {searchQuery
              ? `We couldn't find any accounts matching "${searchQuery}". Try searching with a different username or full name.`
              : 'There are no other active accounts matching this filter at the moment.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
            >
              Clear Search Query
            </button>
          )}
        </div>
      ) : (
        /* Results Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => {
            const online = isUserOnline(user.lastActive);
            const userHandle = user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : `@${user.fullName.toLowerCase().replace(/\s+/g, '_')}`;

            return (
              <motion.div
                key={user.uid}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setSelectedUser(user)}
                className="group relative bg-white rounded-[2rem] p-5 border border-slate-200/80 hover:border-pink-300 hover:shadow-xl hover:shadow-pink-500/5 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top Header: Avatar & Names */}
                  <div className="flex items-start gap-3.5">
                    <div className="relative flex-shrink-0">
                      <img
                        src={user.profilePicture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'}
                        alt={user.fullName}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-100 group-hover:border-pink-300 transition-colors"
                        referrerPolicy="no-referrer"
                      />
                      <div
                        className={cn(
                          "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white",
                          online ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                        )}
                        title={online ? "Online Now" : "Offline"}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-pink-600 transition-colors">
                          {user.fullName}
                        </h3>
                        {user.badges && user.badges.length > 0 && (
                          <ShieldCheck size={16} className="text-pink-500 flex-shrink-0" />
                        )}
                      </div>

                      {/* Username badge with copy action */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-bold text-pink-500 bg-pink-50 px-2.5 py-0.5 rounded-lg border border-pink-100 font-mono truncate">
                          {userHandle}
                        </span>
                        <button
                          onClick={(e) => handleCopyUsername(userHandle, e)}
                          className="p-1 text-slate-400 hover:text-pink-600 transition-colors"
                          title="Copy username"
                        >
                          {copiedUsername === userHandle ? (
                            <Check size={13} className="text-emerald-500" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Location & Bio */}
                  <div className="mt-4 space-y-2">
                    {(user.city || user.country) && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <MapPin size={13} className="text-pink-400 flex-shrink-0" />
                        <span className="truncate">
                          {[user.city, user.country].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}

                    {user.bio ? (
                      <p className="text-xs text-slate-600 line-clamp-2 font-normal leading-relaxed">
                        {user.bio}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No bio provided</p>
                    )}
                  </div>

                  {/* Interests Pills */}
                  {user.interests && user.interests.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {user.interests.slice(0, 3).map((interest, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md"
                        >
                          #{interest}
                        </span>
                      ))}
                      {user.interests.length > 3 && (
                        <span className="text-[10px] font-semibold text-slate-400">
                          +{user.interests.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Action Bar */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={(e) => handleConnect(user, e)}
                    disabled={connectingUid === user.uid}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-pink-50 hover:text-pink-600 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Heart size={14} className="text-pink-500" />
                    <span>Like</span>
                  </button>

                  <button
                    onClick={(e) => handleStartChat(user, e)}
                    disabled={connectingUid === user.uid}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-pink-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-slate-900/10"
                  >
                    <MessageSquare size={14} />
                    <span>Message</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* User Full Profile Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden relative max-h-[90vh] flex flex-col"
            >
              {/* Header Image / Pattern */}
              <div className="h-32 bg-gradient-to-tr from-pink-500 via-rose-400 to-purple-600 relative p-6 flex justify-end items-start">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="w-9 h-9 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body Content */}
              <div className="p-6 pt-0 overflow-y-auto flex-1 relative">
                {/* Avatar floating */}
                <div className="relative -mt-14 mb-4 flex justify-between items-end">
                  <div className="relative">
                    <img
                      src={selectedUser.profilePicture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'}
                      alt={selectedUser.fullName}
                      className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-xl"
                      referrerPolicy="no-referrer"
                    />
                    <div
                      className={cn(
                        "absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white",
                        isUserOnline(selectedUser.lastActive) ? "bg-emerald-500" : "bg-slate-300"
                      )}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={(e) => handleConnect(selectedUser, e)}
                      className="p-3 bg-pink-50 text-pink-600 hover:bg-pink-100 rounded-2xl font-bold transition-colors"
                      title="Send Like"
                    >
                      <Heart size={20} fill="currentColor" />
                    </button>
                    <button
                      onClick={() => handleStartChat(selectedUser)}
                      className="px-5 py-3 bg-slate-900 hover:bg-pink-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-slate-900/10 transition-all"
                    >
                      <MessageSquare size={16} />
                      Start Chat
                    </button>
                  </div>
                </div>

                {/* Name & Username */}
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{selectedUser.fullName}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-pink-500 bg-pink-50 px-3 py-1 rounded-xl border border-pink-100 font-mono">
                      {selectedUser.username ? (selectedUser.username.startsWith('@') ? selectedUser.username : `@${selectedUser.username}`) : `@${selectedUser.fullName.toLowerCase().replace(/\s+/g, '_')}`}
                    </span>
                    <button
                      onClick={(e) => handleCopyUsername(selectedUser.username || selectedUser.fullName, e)}
                      className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 font-medium"
                    >
                      <Copy size={13} /> Copy
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Location</div>
                    <div className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1">
                      <MapPin size={13} className="text-pink-500" />
                      {[selectedUser.city, selectedUser.country].filter(Boolean).join(', ') || 'Not specified'}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gender & Age</div>
                    <div className="text-xs font-bold text-slate-800 mt-1">
                      {selectedUser.gender || 'Private'} • {selectedUser.age || 'N/A'} yrs
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <div className="mt-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">About</h4>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                    {selectedUser.bio || 'This user has not written a bio yet.'}
                  </p>
                </div>

                {/* Interests */}
                {selectedUser.interests && selectedUser.interests.length > 0 && (
                  <div className="mt-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Interests & Passions</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.interests.map((interest, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 bg-pink-50 text-pink-600 rounded-xl text-xs font-bold border border-pink-100"
                        >
                          #{interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
