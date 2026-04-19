import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Match, UserProfile } from '../../types';
import { MessageCircle, Clock, ChevronRight } from 'lucide-react';
import { formatDate } from '../../utils';

export default function ChatList() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<(Match & { otherUser?: UserProfile })[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 border-3 border-pink-100 border-t-pink-500 rounded-full animate-spin" />
      <p className="text-gray-400 font-medium">Loading conversations...</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-gray-900 italic tracking-tight">MESSAGES</h1>
        <div className="bg-pink-50 text-pink-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-pink-100">
          {matches.length} CONNECTIONS
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[3rem] border border-gray-100 shadow-sm">
          <MessageCircle size={48} className="text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-800">Your inbox is empty</h3>
          <p className="text-gray-400 mt-2 max-w-xs mx-auto text-sm">Start matching with people to begin a conversation!</p>
          <Link to="/" className="mt-8 inline-block gradient-pink text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-pink-100 hover:scale-105 transition-transform active:scale-95">Discover People</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => (
            <Link
              key={match.id}
              to={`/chat/${match.id}`}
              className="block group bg-white p-5 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-xl hover:border-pink-200 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-5">
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 bg-gray-50 rounded-full overflow-hidden border-2 border-white group-hover:border-pink-100 transition-colors shadow-sm">
                    <img 
                      src={match.otherUser?.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${match.id}`} 
                      alt={match.otherUser?.fullName || 'User'} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-gray-900 truncate group-hover:text-pink-600 transition-colors">
                      {match.otherUser?.fullName || 'Meetora User'}
                    </h3>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                      <Clock size={10} />
                      {formatDate(match.lastMessageAt)}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 truncate italic opacity-80">
                    {match.lastMessage || 'No messages yet... start the connection! 👋'}
                  </p>
                </div>
                
                <div className="p-2 bg-gray-50 rounded-xl text-gray-300 group-hover:bg-pink-50 group-hover:text-pink-500 transition-all ml-2">
                  <ChevronRight size={20} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
