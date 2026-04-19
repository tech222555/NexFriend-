import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
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

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matchData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Match));

      setMatches(matchData as any);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  if (loading) return <div className="text-center py-20">Loading chats...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-gray-900 italic">MESSAGES</h1>
        <div className="bg-pink-100 text-pink-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
          {matches.length} CHATS
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
          <MessageCircle size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-700">No messages yet</h3>
          <p className="text-gray-400 mt-2 max-w-xs mx-auto">Start matching with people to begin a conversation!</p>
          <Link to="/" className="mt-6 inline-block gradient-pink text-white px-6 py-3 rounded-xl font-bold">Find Friends</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <Link
              key={match.id}
              to={`/chat/${match.id}`}
              className="block group bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-xl hover:border-pink-200 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-gray-100 rounded-full overflow-hidden border-2 border-white group-hover:border-pink-100 transition-colors">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${match.id}`} alt="User" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full" title="Online" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-gray-900 truncate group-hover:text-pink-600 transition-colors">
                      {match.userIds.filter(id => id !== user?.uid)[0]}
                    </h3>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                      <Clock size={10} />
                      {formatDate(match.lastMessageAt)}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 truncate italic">
                    {match.lastMessage || 'No messages yet... start the connection! 👋'}
                  </p>
                </div>
                
                <ChevronRight className="text-gray-300 group-hover:text-pink-500 transition-colors" size={20} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
