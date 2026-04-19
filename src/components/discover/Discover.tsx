import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { matchService } from '../../services/matchService';
import { UserProfile } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, X, MapPin, Award, Globe, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '../../utils';

export default function Discover() {
  const { profile } = useAuth();
  const [potentialMatches, setPotentialMatches] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [lastMatch, setLastMatch] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (profile) {
      loadMatches();
    }
  }, [profile]);

  const loadMatches = async () => {
    if (!profile) return;
    setLoading(true);
    const matches = await matchService.getPotentialMatches(profile);
    setPotentialMatches(matches);
    setLoading(false);
  };

  const handleLike = async () => {
    if (!profile || !potentialMatches[currentIndex]) return;
    
    const target = potentialMatches[currentIndex];
    await matchService.createMatch(profile.uid, target.uid);
    
    // Trigger confetti and modal
    setLastMatch(target);
    setShowMatchModal(true);
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ec4899', '#8b5cf6', '#ffffff']
    });

    nextCard();
  };

  const handleSkip = () => {
    nextCard();
  };

  const nextCard = () => {
    setCurrentIndex(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-pink-100 border-t-pink-500 rounded-full animate-spin" />
        <p className="text-gray-400 font-medium animate-pulse">Finding global friends...</p>
      </div>
    );
  }

  const currentUser = potentialMatches[currentIndex];

  if (!currentUser) {
    return (
      <div className="text-center py-20 px-4">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400">
          <Globe size={40} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">You've explored the globe!</h2>
        <p className="text-gray-500 max-w-sm mx-auto mb-8">
          Check back later for new people or invite your friends to NexFriend.
        </p>
        <button 
          onClick={loadMatches}
          className="px-6 py-3 gradient-pink text-white rounded-xl font-bold hover:scale-105 transition-transform"
        >
          Refresh Feed
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto relative h-[70vh] flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentUser.uid}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.1, x: 200 }}
          className="relative flex-1 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 flex flex-col"
        >
          {/* Image Part */}
          <div className="relative h-2/3">
            <img 
              src={currentUser.profilePicture} 
              alt={currentUser.fullName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
            
            <div className="absolute bottom-6 left-6 right-6 text-white">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-3xl font-bold">{currentUser.fullName}, {currentUser.age}</h2>
                <div className="px-2 py-0.5 bg-pink-500 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-lg">
                  {currentUser.gender}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-white/90 text-sm font-medium">
                <MapPin size={16} />
                {currentUser.city}, {currentUser.country}
              </div>
            </div>

            <div className="absolute top-6 left-6 flex gap-2">
              {currentUser.badges.map(badge => (
                <div key={badge} className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold text-white border border-white/20 flex items-center gap-1">
                  <Award size={12} />
                  {badge}
                </div>
              ))}
            </div>
          </div>

          {/* Info Part */}
          <div className="p-8 flex-1 overflow-y-auto bg-white">
            <div className="flex flex-wrap gap-2 mb-6">
              {currentUser.interests.map(interest => (
                <span key={interest} className="px-3 py-1.5 bg-pink-50 text-pink-600 rounded-lg text-xs font-semibold">
                  #{interest.toLowerCase()}
                </span>
              ))}
            </div>
            
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">About ME</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-6 italic">
              "{currentUser.bio || "No bio yet, but I'm awesome!"}"
            </p>

            <div className="flex items-center justify-center gap-6 mt-auto">
              <button 
                onClick={handleSkip}
                className="w-16 h-16 bg-white border border-gray-100 shadow-lg rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:scale-110 active:scale-95 transition-all"
              >
                <X size={28} strokeWidth={3} />
              </button>
              <button 
                onClick={handleLike}
                className="w-20 h-20 bg-pink-500 shadow-xl shadow-pink-200 rounded-full flex items-center justify-center text-white hover:bg-pink-600 hover:scale-110 active:scale-95 transition-all"
              >
                <Heart size={32} fill="currentColor" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Match Modal */}
      <AnimatePresence>
        {showMatchModal && lastMatch && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[3rem] p-10 max-w-sm w-full text-center shadow-2xl border border-white/20"
            >
              <Sparkles className="text-pink-500 mx-auto mb-4" size={48} />
              <h2 className="text-3xl font-black text-gray-900 mb-2 italic">IT'S A MATCH!</h2>
              <p className="text-gray-500 mb-8">You and <span className="font-bold text-pink-600">{lastMatch.fullName}</span> are now connected.</p>
              
              <div className="flex items-center justify-center gap-4 mb-10">
                <img src={profile?.profilePicture} className="w-20 h-20 rounded-full border-4 border-pink-100 object-cover" alt="Me" />
                <img src={lastMatch.profilePicture} className="w-20 h-20 rounded-full border-4 border-pink-100 object-cover" alt="Them" />
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setShowMatchModal(false)}
                  className="w-full py-4 gradient-pink text-white rounded-2xl font-bold shadow-lg shadow-pink-200"
                >
                  Send a Message
                </button>
                <button 
                  onClick={() => setShowMatchModal(false)}
                  className="w-full py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100"
                >
                  Keep Exploring
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 flex justify-center gap-1">
        {Array.from({ length: Math.min(5, potentialMatches.length) }).map((_, i) => (
          <div 
            key={i} 
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === currentIndex % 5 ? "w-8 bg-pink-500" : "w-1.5 bg-gray-200"
            )} 
          />
        ))}
      </div>
    </div>
  );
}
