import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Match, UserProfile } from '../../types';
import { Heart, MessageCircle, Sparkles, Clock, MapPin, Award } from 'lucide-react';
import { formatDate, cn, isUserOnline } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Likes() {
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
    }, (err) => {
      console.error("Failed to load likes/matches:", err);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 h-[70vh]">
        <div className="w-10 h-10 border-2 border-pink-100 border-t-pink-500 rounded-full animate-spin" />
        <p className="text-slate-400 font-medium tracking-widest text-[10px] uppercase">Retrieving your syncs...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-full">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-pink-50 text-pink-500 rounded-xl">
          <Heart size={20} fill="currentColor" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-pink-500">Mutual Syncs</span>
      </div>
      <h1 className="text-4xl font-black italic tracking-tighter text-slate-900 mb-8">YOUR LIKES & MATCHES</h1>

      {matches.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[3rem] border border-slate-100 shadow-sm max-w-md mx-auto w-full">
          <div className="w-16 h-16 bg-pink-50 text-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 italic">No connections yet</h3>
          <p className="text-slate-500 mt-2 max-w-xs mx-auto text-sm">
            Like other candidates on the Explore feed. When they like you back, they'll appear here as mutual connections!
          </p>
          <Link to="/" className="mt-8 inline-block gradient-pink px-8 py-3 rounded-2xl text-white font-bold text-sm uppercase tracking-widest shadow-lg shadow-pink-200">
            Start Exploring
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <AnimatePresence>
            {matches.map((item) => {
              if (!item.otherUser) return null;
              const online = isUserOnline(item.otherUser.lastActive);
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-pink-500/5 hover:-translate-y-1 transition-all flex flex-col"
                >
                  {/* Photo part */}
                  <div className="relative h-48 bg-slate-100 overflow-hidden">
                    <img
                      src={item.otherUser.profilePicture || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400"}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                      alt={item.otherUser.fullName}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                    
                    {/* Status badge */}
                    <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-white border border-white/20 flex items-center gap-1">
                      <div className={cn("w-2 h-2 rounded-full", online ? "bg-green-500 animate-pulse" : "bg-slate-300")} />
                      {online ? "Online" : "Offline"}
                    </div>

                    {/* Meta info inside image */}
                    <div className="absolute bottom-4 left-4 text-white">
                      <h3 className="font-black italic text-lg leading-tight truncate max-w-[200px]">
                        {item.otherUser.fullName}, {item.otherUser.age}
                      </h3>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className="text-pink-400" />
                        {item.otherUser.city}
                      </p>
                    </div>
                  </div>

                  {/* Body info */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <p className="text-xs text-slate-500 italic line-clamp-2 leading-relaxed mb-4">
                      "{item.otherUser.bio || "No bio yet, but they look pretty awesome!"}"
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {(item.otherUser.interests || []).slice(0, 2).map((interest) => (
                        <span key={interest} className="px-2.5 py-0.5 bg-pink-50 text-pink-600 rounded-md text-[9px] font-bold uppercase tracking-wide">
                          #{interest}
                        </span>
                      ))}
                    </div>

                    <Link
                      to={`/chat/${item.id}`}
                      className="w-full py-3 bg-pink-50 hover:bg-pink-100 text-pink-600 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors mt-auto"
                    >
                      <MessageCircle size={14} />
                      Send Message
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
