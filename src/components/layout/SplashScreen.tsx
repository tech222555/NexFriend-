import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Heart } from 'lucide-react';

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [text, setText] = useState('');
  const fullText = 'Meetora connect';
  
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setText(fullText.slice(0, index + 1));
      index++;
      if (index >= fullText.length) {
        clearInterval(interval);
      }
    }, 150);
    
    const timer = setTimeout(() => {
      onFinish();
    }, 4000); 

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onFinish]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center text-slate-900 overflow-hidden"
    >
      {/* Background Atmosphere */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-300 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, delay: 5 }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-300 rounded-full blur-[120px]" 
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="w-24 h-24 gradient-pink rounded-[2rem] flex items-center justify-center shadow-2xl shadow-pink-200"
        >
          <Heart size={48} className="text-white animate-pulse" fill="currentColor" />
        </motion.div>

        <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-center">
          {text}
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="inline-block w-2 text-pink-500 ml-2 align-middle"
          >
            |
          </motion.span>
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="text-slate-400 font-bold tracking-[0.3em] uppercase text-[10px]"
        >
          Connecting Hearts & Minds
        </motion.p>
      </div>

      {/* Developer Info at Bottom */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-12 left-0 right-0 text-center space-y-2 px-4"
      >
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
          Created By
        </p>
        <p className="text-sm font-black italic text-slate-900 tracking-tight">
          Abdallah Ikadullah
        </p>
      </motion.div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-50">
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 4, ease: "linear" }}
          className="h-full bg-pink-500 shadow-md shadow-pink-200"
        />
      </div>
    </motion.div>
  );
}
