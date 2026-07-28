import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Match, UserProfile } from '../../types';
import { MessageCircle, Clock, ChevronRight, Search } from 'lucide-react';
import { formatDate, cn, isUserOnline } from '../../utils';

export default function ChatList() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<(Match & { otherUser?: UserProfile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

      // Fetch other users' profiles for each match
      const enrichedMatches = await Promise.all(
        matchData.map(async (m) => {
          const otherId = m.userIds.find(id => id !== user.uid);
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

  const filteredMatches = matches.filter(m => 
    m.otherUser?.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.otherUser?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 h-[70vh]">
      <div className="w-10 h-10 border-2 border-pink-100 border-t-pink-500 rounded-full animate-spin" />
      <p className="text-slate-400 font-medium tracking-widest text-[10px] uppercase">Opening channels...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-full">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-black italic tracking-tighter text-slate-900">MESSAGES</h1>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search active chats or usernames..."
          className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-pink-100 transition-all shadow-sm"
        />
      </div>

      {searchQuery && (
        <div className="mb-6">
          <Link
            to={`/search?q=${encodeURIComponent(searchQuery)}`}
            className="w-full bg-pink-50 border border-pink-100 hover:bg-pink-100 p-4 rounded-2xl text-pink-600 text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-colors shadow-sm"
          >
            <span>Search all accounts for "{searchQuery}"</span>
            <ChevronRight size={16} />
          </Link>
        </div>
      )}

      {matches.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-pink-50 text-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 italic">Start Syncing</h3>
          <p className="text-slate-500 mt-2 max-w-xs mx-auto text-sm">You haven't matched with anyone yet. Go back to Explore and find your global connections.</p>
          <Link to="/" className="mt-8 inline-block gradient-pink px-8 py-3 rounded-2xl text-white font-bold text-sm uppercase tracking-widest shadow-lg shadow-pink-200">
            Find People
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredMatches.map((match) => {
            const isUnread = match.lastMessageSenderId !== user?.uid && match.lastMessageRead === false && match.status !== 'pending';
            return (
              <Link
                key={match.id}
                to={`/chat/${match.id}`}
                className="group p-5 bg-white rounded-[2rem] border border-slate-100 flex items-center gap-5 hover:border-pink-200 hover:shadow-xl hover:shadow-pink-500/5 transition-all"
              >
                <div className="relative">
                  <img 
                    src={match.otherUser?.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${match.id}`} 
                    alt={match.otherUser?.fullName} 
                    className="w-16 h-16 rounded-[1.25rem] object-cover border-2 border-slate-50 group-hover:border-pink-200 transition-colors"
                    referrerPolicy="no-referrer"
                  />
                  <div className={cn(
                    "absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full transition-colors",
                    isUserOnline(match.otherUser?.lastActive) ? "bg-green-500 animate-pulse" : "bg-slate-300"
                  )} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-black italic text-slate-900 truncate">
                      {match.otherUser?.fullName || 'User'}
                    </h3>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">
                        {formatDate(match.lastMessageAt)}
                      </span>
                    </div>
                  </div>
                  <p className={cn("text-xs truncate transition-colors", isUnread ? "text-pink-600 font-extrabold" : "text-slate-500 font-medium")}>
                    {match.status === 'pending' ? '🚀 New connection synced!' : (match.lastMessage || 'Channel established.')}
                  </p>
                </div>
                
                <div className="p-2 flex items-center gap-2 text-slate-300 group-hover:text-pink-500 group-hover:bg-pink-50 rounded-xl transition-all">
                  {isUnread && (
                    <span className="relative flex h-2.5 w-2.5 flex-shrink-0 mr-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500"></span>
                    </span>
                  )}
                  <ChevronRight size={24} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
