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
  
  // High-reliability states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [matchingInProgress, setMatchingInProgress] = useState(false);

  useEffect(() => {
    if (profile) {
      loadMatches();
    }
  }, [profile]);

  const loadMatches = async () => {
    if (!profile) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const matches = await matchService.getPotentialMatches(profile);
      setPotentialMatches(matches || []);
    } catch (err: any) {
      console.error('Failed to load discovery feed:', err);
      setErrorMsg('Could not fetch discovery profiles from server.');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!profile || !potentialMatches[currentIndex] || matchingInProgress) return;
    
    setMatchingInProgress(true);
    setErrorMsg(null);
    const target = potentialMatches[currentIndex];
    
    try {
      await matchService.createMatch(profile.uid, target.uid);
      
      // Trigger confetti and modal
      setLastMatch(target);
      setShowMatchModal(true);
      
      try {
        if (typeof confetti === 'function') {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ec4899', '#8b5cf6', '#ffffff']
          });
        } else if (confetti && typeof (confetti as any).default === 'function') {
          (confetti as any).default({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ec4899', '#8b5cf6', '#ffffff']
          });
        } else {
          console.warn('Confetti module is not callable as a function.');
        }
      } catch (confettiErr) {
        console.error('Confetti animation error caught:', confettiErr);
      }

      nextCard();
    } catch (err: any) {
      console.error('Failed to register like/match:', err);
      // Symmetrically parse error responses from Firebase rules
      let userFriendlyMessage = 'An error occurred during syncing. Please try again.';
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && parsed.error) {
          if (parsed.error.toLowerCase().includes('permission') || parsed.error.toLowerCase().includes('insufficient')) {
            userFriendlyMessage = `Database Sync Refused: Missing permissions for matching collection.`;
          } else {
            userFriendlyMessage = `Sync Protocol Failure: ${parsed.error}`;
          }
        }
      } catch (_) {
        if (err.message && (err.message.toLowerCase().includes('permission') || err.message.toLowerCase().includes('insufficient'))) {
          userFriendlyMessage = 'Database authorization refused. Please verify security permissions.';
        }
      }
      setErrorMsg(userFriendlyMessage);
    } finally {
      setMatchingInProgress(false);
    }
  };

  const handleSkip = () => {
    if (matchingInProgress) return;
    setErrorMsg(null);
    const userToSkip = potentialMatches[currentIndex];
    setPotentialMatches(prev => {
      const updated = [...prev];
      updated.splice(currentIndex, 1); // Remove from current position
      return [...updated, userToSkip]; // Add to end
    });
  };

  const nextCard = () => {
    setCurrentIndex(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-pink-100 border-t-pink-500 rounded-full animate-spin" />
        <p className="text-slate-400 font-medium animate-pulse tracking-widest text-xs uppercase">Initialising discovery...</p>
      </div>
    );
  }

  const currentUser = potentialMatches[currentIndex];

  if (!currentUser) {
    return (
      <div className="text-center py-20 px-4 bg-white rounded-[3rem] shadow-sm border border-slate-100 max-w-sm mx-auto">
        <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6 text-pink-500">
          <Globe size={40} />
        </div>
        <h2 className="text-2xl font-black italic text-slate-900 mb-2">YOU'RE GLOBAL!</h2>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          You've explored all active nodes. Check back soon for new global connections.
        </p>
        <button 
          onClick={loadMatches}
          className="px-8 py-3 gradient-pink text-white rounded-2xl font-bold shadow-lg shadow-pink-200 hover:scale-105 active:scale-95 transition-all text-sm uppercase tracking-widest"
        >
          Refresh Feed
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto relative h-[75vh] flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentUser.uid}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.1, x: 200 }}
          className="relative flex-1 bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col"
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
            
            <div className="absolute bottom-8 left-8 right-8 text-white">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-black italic tracking-tighter">{currentUser.fullName}, {currentUser.age}</h2>
              </div>
              <div className="flex items-center gap-1.5 text-white/90 text-xs font-bold uppercase tracking-widest">
                <MapPin size={14} className="text-pink-400" />
                {currentUser.city}, {currentUser.country}
              </div>
            </div>

            <div className="absolute top-6 left-6 flex gap-2">
              {(currentUser.badges || []).map(badge => (
                <div key={badge} className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold text-white border border-white/20 flex items-center gap-1">
                  <Award size={12} className="text-pink-300" />
                  {badge}
                </div>
              ))}
            </div>
          </div>

          {/* Info Part */}
          <div className="p-8 flex-1 overflow-y-auto bg-white flex flex-col">
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-[10px] font-bold uppercase tracking-wider text-center leading-normal">
                🚨 {errorMsg}
              </div>
            )}
            
            <div className="flex flex-wrap gap-2 mb-6">
              {(currentUser.interests || []).map(interest => (
                <span key={interest} className="px-3 py-1 bg-pink-50 text-pink-600 rounded-lg text-[10px] font-bold uppercase tracking-wide">
                  #{interest.toLowerCase()}
                </span>
              ))}
            </div>
            
            <p className="text-slate-600 text-sm leading-relaxed mb-8 italic">
              "{currentUser.bio || "No bio yet, but I'm awesome!"}"
            </p>

            <div className="flex items-center justify-center gap-8 mt-auto">
              <button 
                onClick={handleSkip}
                disabled={matchingInProgress}
                className={cn(
                  "w-16 h-16 bg-white border border-slate-100 shadow-xl rounded-full flex items-center justify-center text-slate-400 transition-all",
                  matchingInProgress ? "opacity-30 pointer-events-none" : "hover:text-slate-600 hover:scale-110 active:scale-95"
                )}
              >
                <X size={32} strokeWidth={3} />
              </button>
              <button 
                onClick={handleLike}
                disabled={matchingInProgress}
                className={cn(
                  "w-20 h-20 bg-pink-500 shadow-2xl shadow-pink-200 rounded-full flex items-center justify-center text-white transition-all",
                  matchingInProgress ? "bg-pink-300 pointer-events-none animate-pulse" : "hover:bg-pink-600 hover:scale-110 active:scale-95"
                )}
              >
                {matchingInProgress ? (
                  <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Heart size={40} fill="currentColor" />
                )}
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
            className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[3rem] p-10 max-w-sm w-full text-center shadow-2xl border border-slate-100"
            >
              <Sparkles className="text-pink-500 mx-auto mb-4" size={48} />
              <h2 className="text-3xl font-black italic text-slate-900 mb-2 leading-none">IT'S A MATCH!</h2>
              <p className="text-slate-500 mb-8 text-sm">You and <span className="font-bold text-pink-600">{lastMatch.fullName}</span> are now synced.</p>
              
              <div className="flex items-center justify-center gap-4 mb-10">
                <img src={profile?.profilePicture} className="w-20 h-20 rounded-[1.5rem] border-4 border-pink-100 object-cover" alt="Me" />
                <div className="w-8 h-[2px] bg-pink-100" />
                <img src={lastMatch.profilePicture} className="w-20 h-20 rounded-[1.5rem] border-4 border-pink-100 object-cover" alt="Them" />
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setShowMatchModal(false)}
                  className="w-full py-4 gradient-pink text-white rounded-2xl font-bold shadow-lg shadow-pink-200 text-sm uppercase tracking-widest"
                >
                  Send a Message
                </button>
                <button 
                  onClick={() => setShowMatchModal(false)}
                  className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-bold hover:bg-slate-100 text-[10px] uppercase tracking-[0.2em]"
                >
                  Keep Exploring
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 flex justify-center gap-1.5">
        {Array.from({ length: Math.min(5, potentialMatches.length) }).map((_, i) => (
          <div 
            key={i} 
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === currentIndex % 5 ? "w-8 bg-pink-500 shadow-md shadow-pink-200" : "w-1.5 bg-slate-200"
            )} 
          />
        ))}
      </div>
    </div>
  );
}
