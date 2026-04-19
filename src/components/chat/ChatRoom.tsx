import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { chatService } from '../../services/chatService';
import { geminiService } from '../../services/gemini';
import { Message, UserProfile } from '../../types';
import { Send, Globe2, ShieldAlert, ChevronLeft, Smile, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { cn, formatDate } from '../../utils';

export default function ChatRoom() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !user) return;

    // Fetch other user's info
    const fetchOtherUser = async () => {
      const matchDoc = await getDoc(doc(db, 'matches', id));
      if (matchDoc.exists()) {
        const data = matchDoc.data();
        const otherId = data.userIds.find((uid: string) => uid !== user.uid);
        if (otherId) {
          const userDoc = await getDoc(doc(db, 'users', otherId));
          if (userDoc.exists()) {
            setOtherUser({ uid: otherId, ...userDoc.data() } as UserProfile);
          }
        }
      }
    };

    fetchOtherUser();

    // Subscribe to messages
    const unsubscribe = chatService.subscribeToMessages(id, (msgs) => {
      setMessages(msgs);
    });

    return unsubscribe;
  }, [id, user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getProfilePic = (pic?: string, seed?: string) => {
    return pic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed || 'default'}`;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !id || !user || isModerating) return;

    setIsModerating(true);
    const isInappropriate = await geminiService.moderateText(inputText);
    
    if (isInappropriate) {
      alert('Your message was blocked for community safety rules. Please keep it friendly!');
      setIsModerating(false);
      return;
    }

    await chatService.sendMessage(id, user.uid, inputText, profile?.fullName || 'Someone');
    setInputText('');
    setIsModerating(false);
  };

  const handleTranslate = async (msgId: string, text: string) => {
    if (!profile) return;
    setIsTranslating(true);
    const translated = await geminiService.translateText(text, 'English'); // Default to English for demo
    
    setMessages(prev => prev.map(m => 
      m.id === msgId ? { ...m, translations: { ...m.translations, en: translated } } : m
    ));
    setIsTranslating(false);
  };

  return (
    <div className="flex flex-col h-[80vh] bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100 max-w-4xl mx-auto">
      {/* Chat Header */}
      <header className="p-6 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/chats')} className="p-2 -ml-2 text-gray-400 hover:text-pink-500 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="relative">
            <img 
              src={getProfilePic(otherUser?.profilePicture, id)} 
              className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover" 
              alt="Avatar" 
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">{otherUser?.fullName || 'Connecting...'}</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-pink-50 hover:text-pink-500 transition-all">
            <ShieldAlert size={20} />
          </button>
          <button className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-100 transition-all">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide bg-gray-50/30">
        <div className="flex flex-col items-center justify-center py-4 mb-4">
          <div className="px-4 py-1.5 bg-white shadow-sm border border-gray-100 rounded-full text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            You recently matched! Say hello 👋
          </div>
        </div>

        {messages.map((msg) => {
          const isMe = msg.senderId === user?.uid;
          return (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              key={msg.id}
              className={cn(
                "flex w-full mb-2",
                isMe ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "flex items-end gap-2 max-w-[80%]",
                isMe ? "flex-row-reverse" : "flex-row"
              )}>
                {!isMe && (
                   <img 
                    src={getProfilePic(otherUser?.profilePicture, otherUser?.uid)} 
                    className="w-8 h-8 rounded-full object-cover hidden sm:block border border-gray-200" 
                    referrerPolicy="no-referrer"
                    alt="" 
                  />
                )}
                <div className="flex flex-col gap-1">
                  <div
                    className={cn(
                      "px-5 py-3 rounded-[2rem] text-sm shadow-sm relative group transition-all",
                      isMe 
                        ? "gradient-pink text-white rounded-br-none" 
                        : "bg-white text-gray-700 border border-gray-100 rounded-bl-none"
                    )}
                  >
                    {msg.text}
                    
                    {msg.translations?.en && (
                      <div className="mt-2 pt-2 border-t border-black/10 text-xs italic opacity-80 flex items-center gap-1">
                        <Globe2 size={10} />
                        {msg.translations.en}
                      </div>
                    )}

                    {!isMe && !msg.translations?.en && (
                      <button 
                        onClick={() => handleTranslate(msg.id, msg.text)}
                        className="absolute -right-12 top-0 p-2 text-gray-300 hover:text-pink-500 opacity-0 group-hover:opacity-100 transition-all"
                        title="Translate"
                        disabled={isTranslating}
                      >
                        <Globe2 size={16} />
                      </button>
                    )}
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold text-gray-300 uppercase tracking-tighter",
                    isMe ? "text-right" : "text-left"
                  )}>
                    {formatDate(msg.createdAt)}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <footer className="p-6 bg-white border-t border-gray-100">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <div className="relative flex-1 group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button type="button" className="text-gray-400 hover:text-pink-500 transition-colors">
                <Smile size={20} />
              </button>
            </div>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isModerating ? "Checking message safety..." : "Type your message here..."}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-[2rem] focus:outline-none focus:ring-2 focus:ring-pink-500 focus:bg-white transition-all text-sm"
              disabled={isModerating}
            />
          </div>
          <button
            type="submit"
            disabled={!inputText.trim() || isModerating}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg text-white",
              inputText.trim() ? "gradient-pink scale-100 active:scale-95" : "bg-gray-100 text-gray-300 scale-90"
            )}
          >
            {isModerating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </form>
      </footer>
    </div>
  );
}
