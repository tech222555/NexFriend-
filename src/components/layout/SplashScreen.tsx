import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

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
    }, 15000); // 15 seconds as requested

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onFinish]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
      className="fixed inset-0 z-[9999] bg-[#050505] flex flex-col items-center justify-center text-white overflow-hidden"
    >
      {/* Background Atmosphere */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="w-24 h-24 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-pink-500/20"
        >
          <Sparkles size={48} className="text-white animate-pulse" />
        </motion.div>

        <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-center">
          {text}
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="inline-block w-2 h-12 md:h-16 bg-pink-500 ml-2 align-middle"
          />
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="text-gray-400 font-medium tracking-[0.3em] uppercase text-xs"
        >
          Connecting Hearts & Minds
        </motion.p>
      </div>

      {/* Developer Info at Bottom */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-10 left-0 right-0 text-center space-y-2 px-4"
      >
        <div className="h-px w-12 bg-gray-800 mx-auto mb-4" />
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
          Developer Information
        </p>
        <p className="text-sm font-medium text-gray-300">
          Abdallah Ikadullah
        </p>
        <p className="text-[10px] text-gray-600 italic">
          Created by Abdallah Ikadullah
        </p>
      </motion.div>

      {/* Progress Bar (Optional but nice since it's 15s) */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900">
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 15, ease: "linear" }}
          className="h-full bg-pink-500"
        />
      </div>
    </motion.div>
  );
}
