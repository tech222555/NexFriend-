import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { chatService } from '../../services/chatService';
import { geminiService } from '../../services/gemini';
import { Message, UserProfile, Match } from '../../types';
import { 
  Send, Globe2, ShieldAlert, ChevronLeft, Smile, MoreVertical, 
  Paperclip, Camera, Mic, Play, Pause, Trash2, X, FileText, Download, Loader2,
  Check, CheckCheck, Users, Info, ChevronDown, ChevronUp, Users2, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { cn, isUserOnline } from '../../utils';

// Premium dynamic voice player component that adapts styles depending on user origin
function VoicePlayer({ src, isMe }: { src: string; isMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => console.error("Play error:", err));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatAudioTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className={cn(
      "flex items-center gap-3 py-2 px-3 rounded-2xl min-w-[210px] max-w-full shadow-sm border",
      isMe 
        ? "bg-black/15 border-transparent text-white" 
        : "bg-pink-50/50 border-pink-100/60 text-slate-700"
    )}>
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
      <button
        onClick={togglePlay}
        type="button"
        className={cn(
          "w-8 h-8 rounded-full hover:scale-105 active:scale-95 flex items-center justify-center shadow-sm transition-all flex-shrink-0",
          isMe 
            ? "bg-white text-pink-600" 
            : "bg-pink-500 text-white shadow-pink-200"
        )}
      >
        {isPlaying ? (
          <Pause size={12} fill="currentColor" />
        ) : (
          <Play size={12} className="ml-0.5" fill="currentColor" />
        )}
      </button>
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className={cn(
            "w-full h-1 rounded-lg appearance-none cursor-pointer focus:outline-none mb-1",
            isMe 
              ? "bg-white/25 accent-white" 
              : "bg-slate-200 accent-pink-500"
          )}
        />
        <div className="flex justify-between items-center text-[9px] font-bold opacity-80 select-none">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{duration ? formatAudioTime(duration) : '0:05'}</span>
        </div>
      </div>
    </div>
  );
}

const emojiCategories = {
  "Popular": ["❤️", "😂", "😍", "🔥", "👍", "🙌", "🎉", "🚀", "✨", "💯", "🤔", "😭"],
  "Smiles": ["😊", "😎", "🥰", "🥳", "😉", "😜", "😆", "🤩", "😮", "🙄", "😴", "🧠"],
  "Gestures": ["👍", "👎", "👊", "✌️", "👌", "🤝", "🙏", "👋", "💖", "💔", "💌", "💅"],
  "Activity": ["🎉", "🎈", "🎂", "🚀", "💡", "🌟", "✨", "🍀", "💥", "🏁", "🏆", "🎁"]
};

const meetoraStickers = [
  { id: 'happy', name: 'Happy Day', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=happy&backgroundColor=ffb6c1' },
  { id: 'cool', name: 'Chill Vibes', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=cool&backgroundColor=b2f2bb' },
  { id: 'love', name: 'In Love', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=love&backgroundColor=ffe3e3' },
  { id: 'wink', name: 'Wink Wink', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=wink&backgroundColor=ffec99' },
  { id: 'sleepy', name: 'Snoozing', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=sleepy&backgroundColor=d0ebff' },
  { id: 'wow', name: 'Shocked', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=wow&backgroundColor=eebefa' },
  { id: 'angel', name: 'Halo Angel', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=angel&backgroundColor=e3fafc' },
  { id: 'devil', name: 'Spicy', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=devil&backgroundColor=ffc9c9' },
  { id: 'cool-bear', name: 'Teddy', url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=teddy&backgroundColor=ffd8a8&eyes=happy' },
  { id: 'astro', name: 'Astronaut', url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=astro&backgroundColor=c5f6fa&eyes=bulging' },
  { id: 'roboto', name: 'Meetora Bot', url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=meetora&backgroundColor=eebefa&eyes=round' },
  { id: 'spark-love', name: 'Hearts', url: 'https://api.dicebear.com/7.x/icons/svg?seed=heart&icon=heart&colors[]=ff5c8a' }
];

export default function ChatRoom() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeReactionsMsgId, setActiveReactionsMsgId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [groupMembers, setGroupMembers] = useState<UserProfile[]>([]);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [typingUserName, setTypingUserName] = useState('');
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev?.message === message ? null : prev);
    }, 4000);
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-amber-200 text-amber-950 px-0.5 rounded font-bold">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  const filteredMessages = messages.filter(msg => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    
    // Check main text
    if (msg.text?.toLowerCase().includes(query)) return true;
    
    // Check sender name
    const senderProfile = groupMembers.find(m => m.uid === msg.senderId);
    const sName = senderProfile?.fullName || msg.senderName || '';
    if (sName.toLowerCase().includes(query)) return true;
    
    // Check file name
    if (msg.fileName?.toLowerCase().includes(query)) return true;
    
    // Check translations
    if (msg.translations) {
      return Object.values(msg.translations).some(translationText => 
        translationText?.toLowerCase().includes(query)
      );
    }
    
    return false;
  });

  // File & Image attachment states
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string; size: string; dataUrl: string } | null>(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<any>(null);

  // Full screen lightbox photo preview
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  // Emoji & Sticker selection states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [stickerTab, setStickerTab] = useState<'emoji' | 'sticker'>('emoji');

  useEffect(() => {
    if (!id || !user) return;

    if (id === 'test-room' || id.startsWith('mock-')) {
      setOtherUser({
        uid: 'test-user',
        fullName: 'Sarah Connor',
        username: 'sarah_connor',
        profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
        gender: 'Female',
        age: 26,
        country: 'USA',
        city: 'Los Angeles',
        interests: ['Tech', 'Cybersecurity', 'Resistance'],
        bio: 'No fate but what we make. Keeping human sync links alive.',
        badges: ['Operational Creator'],
        email: 'sarah@resistance.net'
      } as UserProfile);

      setMessages([
        {
          id: 'test-msg-1',
          senderId: 'test-user',
          text: 'Hey! Just saw your operational interests on Meetora. Let’s sync up soon! 🌸',
          createdAt: new Date(),
          read: true
        }
      ]);
      return;
    }

    // 1. Subscribe to match doc changes (including group metadata, userIds, etc.)
    const unsubscribeMatch = onSnapshot(doc(db, 'matches', id), async (matchSnap) => {
      if (matchSnap.exists()) {
        const data = { id: matchSnap.id, ...matchSnap.data() } as Match;
        setMatch(data);

        // Fetch user typing status for the group/1-on-1
        const typingMap = data.typing || {};
        const typingUids = Object.keys(typingMap).filter(uid => uid !== user?.uid && typingMap[uid] === true);
        if (typingUids.length > 0) {
          setIsOtherUserTyping(true);
          const activeTypingUid = typingUids[0];
          const matchedMem = groupMembers.find(m => m.uid === activeTypingUid) || (otherUser?.uid === activeTypingUid ? otherUser : null);
          if (matchedMem) {
            setTypingUserName(matchedMem.fullName);
          } else {
            try {
              const uDoc = await getDoc(doc(db, 'users', activeTypingUid));
              if (uDoc.exists()) {
                setTypingUserName(uDoc.data().fullName || 'Someone');
              } else {
                setTypingUserName('Someone');
              }
            } catch (err) {
              setTypingUserName('Someone');
            }
          }
        } else {
          setIsOtherUserTyping(false);
          setTypingUserName('');
        }

        if (data.isGroup) {
          // Fetch profiles of all members in the group
          try {
            const members = await Promise.all(
              data.userIds.map(async (uid) => {
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                  return { uid, ...userDoc.data() } as UserProfile;
                }
                return null;
              })
            );
            setGroupMembers(members.filter(Boolean) as UserProfile[]);
          } catch (err) {
            console.error("Error loading group members:", err);
          }
        } else {
          // Standard 1-to-1 match
          const otherId = data.userIds?.find((uid: string) => uid !== user?.uid);
          if (otherId) {
            const userDoc = await getDoc(doc(db, 'users', otherId));
            if (userDoc.exists()) {
              setOtherUser({ uid: otherId, ...userDoc.data() } as UserProfile);
            }
          }
        }
      }
    }, (error) => {
      console.error("Error subscribing to match document:", error);
    });

    // 2. Subscribe to messages list
    const unsubscribeMessages = chatService.subscribeToMessages(id, (msgs) => {
      setMessages(msgs);
      if (user && id !== 'test-room' && !id.startsWith('mock-')) {
        chatService.markMessagesAsRead(id, user.uid, msgs);
      }
    });

    return () => {
      unsubscribeMatch();
      unsubscribeMessages();
    };
  }, [id, user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle setting typing status for current user
  useEffect(() => {
    if (!id || !user || id === 'test-room' || id.startsWith('mock-')) return;

    if (!inputText) {
      chatService.setTypingStatus(id, user.uid, false);
      return;
    }

    // Set typing to true
    chatService.setTypingStatus(id, user.uid, true);

    const delayDebounce = setTimeout(() => {
      chatService.setTypingStatus(id, user.uid, false);
    }, 3000);

    return () => {
      clearTimeout(delayDebounce);
    };
  }, [inputText, id, user]);

  // Set typing to false on unmount or id change
  useEffect(() => {
    return () => {
      if (id && user && id !== 'test-room' && !id.startsWith('mock-')) {
        chatService.setTypingStatus(id, user.uid, false);
      }
    };
  }, [id, user]);

  // Clear search on chat change
  useEffect(() => {
    setShowSearch(false);
    setSearchQuery('');
  }, [id]);

  // Clean up recording states
  const cleanupRecording = () => {
    setIsRecording(false);
    setMediaRecorder(null);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  // Start microphone capture
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast("Audio recording is not supported in this browser context (or requires opening the app in a new tab).", "error");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        
        // Convert audio chunk stream natively to Base64 to pack into the document
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          
          if (id === 'test-room' || id.startsWith('mock-')) {
            const userMessage: Message = {
              id: 'msg-' + Math.random(),
              senderId: user!.uid,
              text: '🎤 Sent a voice note',
              audioUrl: base64Audio,
              mediaType: 'voice',
              createdAt: new Date(),
              read: true
            };
            setMessages(prev => [...prev, userMessage]);
            
            setTimeout(() => {
              const reply: Message = {
                id: 'msg-' + Math.random(),
                senderId: 'test-user',
                text: 'Listening... 🎧 Got your sync note, sounds crystal clear! Let’s lock in our meetup! 🚀',
                createdAt: new Date(),
                read: true
              };
              setMessages(prev => [...prev, reply]);
            }, 1800);
          } else {
            // Live Firebase fire
            await chatService.sendMessage(
              id!,
              user!.uid,
              '🎤 Sent a voice note',
              profile?.fullName || 'User',
              {
                audioUrl: base64Audio,
                mediaType: 'voice'
              }
            );
          }
        };
        reader.readAsDataURL(audioBlob);

        // Terminate components to unlock microphone badge
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Recording hardware capture failed:", err);
      showToast("Microphone connection blocked. Please grant access in your workspace.", "error");
    }
  };

  // Submit and upload the audio record
  const stopAndSendRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      cleanupRecording();
    }
  };

  // Void current recording
  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.onstop = () => {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.stop();
      cleanupRecording();
    }
  };

  // Format record elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // File size formatter
  const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Process selected photo
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      showToast("Please select a photo smaller than 800 KB to guarantee high performance sync.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
      setPreviewFile(null); // Mutually clear file preview
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  // Process selected document
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      showToast("Please select a file smaller than 800 KB to guarantee high performance sync.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewFile({
        name: file.name,
        size: formatBytes(file.size),
        dataUrl: reader.result as string
      });
      setPreviewImage(null); // Mutually clear image preview
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  const handleStickerSelect = async (sticker: { id: string; name: string; url: string }) => {
    if (isModerating) return;
    setIsModerating(true);
    setShowEmojiPicker(false);

    if (id === 'test-room' || id.startsWith('mock-')) {
      const userMessage: Message = {
        id: 'msg-' + Math.random(),
        senderId: user!.uid,
        text: `Sent sticker: ${sticker.name}`,
        imageUrl: sticker.url,
        mediaType: 'image',
        createdAt: new Date(),
        read: true,
      };
      setMessages(prev => [...prev, userMessage]);
      setIsModerating(false);

      setTimeout(() => {
        const replies = [
          "Super cute sticker! 💖",
          "Aww, love that sticker! 😍",
          "That aligns perfect with our sync wave! 🚀",
        ];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        const replyMessage: Message = {
          id: 'msg-' + Math.random(),
          senderId: 'test-user',
          text: randomReply,
          createdAt: new Date(),
          read: true
        };
        setMessages(prev => [...prev, replyMessage]);
      }, 1500);
      return;
    }

    try {
      await chatService.sendMessage(
        id!,
        user!.uid,
        `Sent sticker: ${sticker.name}`,
        profile?.fullName || 'User',
        {
          imageUrl: sticker.url,
          mediaType: 'image'
        }
      );
    } catch (err) {
      console.error("Sticker send failure:", err);
      showToast("Failed to send sticker integration.", "error");
    } finally {
      setIsModerating(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isModerating || (!inputText.trim() && !previewImage && !previewFile)) return;

    setIsModerating(true);

    // Only moderate if text body exists and no image/file is selected
    if (inputText.trim() && !previewImage && !previewFile) {
      const isInappropriate = await geminiService.moderateText(inputText);
      if (isInappropriate) {
        showToast('Your message was flagged for safety and not sent.', 'error');
        setIsModerating(false);
        return;
      }
    }

    const mediaFields: any = {};
    let textToSend = inputText;

    if (previewImage) {
      mediaFields.imageUrl = previewImage;
      mediaFields.mediaType = 'image';
      if (!textToSend.trim()) {
        textToSend = '📷 Sent a photo';
      }
    } else if (previewFile) {
      mediaFields.fileUrl = previewFile.dataUrl;
      mediaFields.fileName = previewFile.name;
      mediaFields.fileSize = previewFile.size;
      mediaFields.mediaType = 'file';
      if (!textToSend.trim()) {
        textToSend = `📁 ${previewFile.name}`;
      }
    }

    if (id === 'test-room' || id.startsWith('mock-')) {
      const userMessage: Message = {
        id: 'msg-' + Math.random(),
        senderId: user!.uid,
        text: textToSend,
        createdAt: new Date(),
        read: true,
        ...mediaFields
      };
      setMessages(prev => [...prev, userMessage]);
      setInputText('');
      setPreviewImage(null);
      setPreviewFile(null);
      setIsModerating(false);

      setTimeout(() => {
        const replyText = previewImage 
          ? 'Wow, stunning snapshot! Let me sync that to my terminal feed. 🌟' 
          : 'Got the document transfer crystal clear! Syncing packets now. 📁';
        const replyMessage: Message = {
          id: 'msg-' + Math.random(),
          senderId: 'test-user',
          text: replyText,
          createdAt: new Date(),
          read: true
        };
        setMessages(prev => [...prev, replyMessage]);
      }, 1500);
      return;
    }

    try {
      await chatService.sendMessage(
        id!,
        user!.uid,
        textToSend,
        profile?.fullName || 'User',
        Object.keys(mediaFields).length > 0 ? mediaFields : undefined
      );

      setInputText('');
      setPreviewImage(null);
      setPreviewFile(null);
    } catch (err) {
      console.error("Message send failure:", err);
      showToast("Failed to send message attachment. Document size limit exceeded.", "error");
    } finally {
      setIsModerating(false);
    }
  };

  const getTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isGroup = match?.isGroup;

  const renderHeaderAvatar = () => {
    if (isGroup) {
      if (match?.groupIcon?.startsWith('preset:')) {
        const parts = match.groupIcon.split(':');
        const bgGradient = parts[1] || 'from-pink-500 to-rose-400';
        const emoji = parts[2] || '👥';
        return (
          <div className={cn("w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-lg sm:text-2xl bg-gradient-to-tr shadow-sm border border-slate-100/80", bgGradient)}>
            {emoji}
          </div>
        );
      } else if (match?.groupIcon) {
        return (
          <img 
            src={match.groupIcon} 
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl object-cover border border-slate-100 shadow-sm" 
            alt="Group Avatar" 
            referrerPolicy="no-referrer"
          />
        );
      }
    }
    
    const avatarUrl = isGroup
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${match?.groupName || 'Group'}`
      : (otherUser?.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`);
      
    return (
      <img 
        src={avatarUrl} 
        className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl object-cover border border-slate-100 shadow-sm" 
        alt="Avatar" 
        referrerPolicy="no-referrer"
      />
    );
  };

  const headerTitle = isGroup ? (match?.groupName || 'Sync Group') : (otherUser?.fullName || 'Connecting...');

  const renderHeaderStatus = () => {
    if (isOtherUserTyping) {
      return (
        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-pink-500 mt-0.5 sm:mt-1 flex items-center gap-1">
          {isGroup ? `${typingUserName} is typing` : 'Typing'}
          <span className="flex gap-0.5 items-center">
            <span className="w-1 h-1 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        </span>
      );
    }

    if (isGroup) {
      const memberCount = match?.userIds?.length || groupMembers.length || 0;
      return (
        <button 
          onClick={() => setShowGroupInfo(!showGroupInfo)}
          className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-pink-500 hover:text-pink-600 transition-colors mt-0.5 sm:mt-1 flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 outline-none"
        >
          <Users size={10} />
          <span>{memberCount} Members • View Info</span>
          {showGroupInfo ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      );
    }

    const online = isUserOnline(otherUser?.lastActive);
    return (
      <span className={cn(
        "text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-colors mt-0.5 sm:mt-1 block truncate",
        online ? "text-green-500" : "text-slate-400"
      )}>
        {online ? "Active connection" : "Offline"}
      </span>
    );
  };

  return (
    <div className="flex flex-col w-full h-full bg-slate-50/20 overflow-hidden relative">
      {/* Subtle Whatsapp elegant texture mesh */}
      <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      {/* Hidden file selectors */}
      <input 
        type="file" 
        ref={imageInputRef} 
        onChange={handleImageChange} 
        accept="image/*" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="*" 
        className="hidden" 
      />

      {/* Active Header */}
      <header className="px-4 sm:px-6 py-3.5 sm:py-4 bg-white border-b border-slate-100/95 flex items-center justify-between z-20 min-w-0 gap-3">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button 
            onClick={() => navigate('/chats')} 
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-xl transition-all md:hidden flex-shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              {renderHeaderAvatar()}
              {!isGroup && (
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 border-2 border-white rounded-full transition-colors",
                  isUserOnline(otherUser?.lastActive) ? "bg-green-500 animate-pulse" : "bg-slate-300"
                )} />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-xs text-slate-900 leading-none truncate flex items-center gap-1.5">
                {isGroup && <Users2 size={13} className="text-slate-400" />}
                <span className="truncate">{headerTitle}</span>
              </h2>
              {renderHeaderStatus()}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isGroup && (
            <button 
              onClick={() => setShowGroupInfo(!showGroupInfo)}
              className={cn(
                "p-2 rounded-xl transition-all",
                showGroupInfo ? "text-pink-500 bg-pink-50" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              )}
              title="Group Sync Details"
            >
              <Info size={18} />
            </button>
          )}
          <button 
            onClick={() => isRecording ? stopAndSendRecording() : startRecording()}
            className={cn(
              "hidden sm:flex p-2 rounded-xl transition-all",
              isRecording ? "text-rose-500 bg-rose-50 animate-pulse" : "text-slate-400 hover:text-pink-500 hover:bg-pink-50"
            )}
            title="Record dynamic voice note"
          >
            <Mic size={18} />
          </button>
          <button 
            onClick={() => {
              setShowSearch(!showSearch);
              if (showSearch) setSearchQuery('');
            }}
            className={cn(
              "p-2 rounded-xl transition-all",
              showSearch ? "text-pink-500 bg-pink-50" : "text-slate-400 hover:text-pink-500 hover:bg-pink-50"
            )}
            title="Search messages"
          >
            <Search size={18} />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
            <MoreVertical size={18} />
          </button>
        </div>
      </header>

      {/* Search Bar Panel */}
      <AnimatePresence>
        {showSearch && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white border-b border-slate-100 z-10 overflow-hidden shadow-sm"
          >
            <div className="p-3 px-4 sm:px-6 flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search messages in this conversation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 font-semibold transition-all"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all animate-in fade-in zoom-in duration-200"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">
                {searchQuery.trim() === '' ? (
                  <span>{messages.length} messages</span>
                ) : (
                  <span className="text-pink-500 font-black">
                    {filteredMessages.length} found
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsible Group Info Dropdown Panel */}
      <AnimatePresence>
        {isGroup && showGroupInfo && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white border-b border-slate-100 z-10 overflow-hidden shadow-sm"
          >
            <div className="p-4 sm:p-5 flex flex-col gap-4">
              {match?.groupDescription && (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100/50">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Group Bio / Goal</span>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{match.groupDescription}</p>
                </div>
              )}
              
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-2.5">
                  Synced Nodes ({groupMembers.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-1">
                  {groupMembers.map((member) => {
                    const isAdmin = match?.admins?.includes(member.uid);
                    const isCurrentUser = member.uid === user?.uid;
                    const online = isCurrentUser ? true : isUserOnline(member.lastActive);
                    
                    return (
                      <div key={member.uid} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-all">
                        <div className="relative">
                          <img 
                            src={member.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.uid}`} 
                            className="w-8 h-8 rounded-lg object-cover" 
                            alt=""
                          />
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white",
                            online ? "bg-green-500 animate-pulse" : "bg-slate-300"
                          )} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-slate-800 truncate flex items-center gap-1">
                            {member.fullName}
                            {isCurrentUser && <span className="text-[9px] text-pink-500 font-bold">(Me)</span>}
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium truncate">@{member.username}</p>
                        </div>
                        {isAdmin && (
                          <span className="text-[8px] font-black uppercase bg-pink-500/10 text-pink-600 px-2 py-0.5 rounded-md border border-pink-500/10 flex-shrink-0">
                            Admin
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages list visual stream */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 space-y-4">
        <div className="flex justify-center mb-6">
          <div className="px-4 py-1.5 bg-white/80 backdrop-blur-sm border border-slate-100 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-2">
             <Globe2 size={12} className="text-pink-400" />
             End-to-End Secure Sync
          </div>
        </div>

        {searchQuery.trim() !== '' && filteredMessages.length > 0 && (
          <div className="flex justify-center mb-4">
            <div className="px-4 py-1.5 bg-pink-50 border border-pink-100 rounded-full text-[10px] font-bold text-pink-500 uppercase tracking-tighter flex items-center gap-2 shadow-sm shadow-pink-500/5 animate-in fade-in slide-in-from-top-1 duration-300">
              <Search size={11} className="text-pink-400 animate-pulse" />
              <span>Showing {filteredMessages.length} of {messages.length} results matching "{searchQuery}"</span>
              <button 
                onClick={() => setSearchQuery('')} 
                className="ml-1 px-1.5 py-0.5 rounded-md hover:bg-pink-100 text-pink-500 font-extrabold cursor-pointer border-none bg-transparent text-[9px] transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {searchQuery.trim() !== '' && filteredMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center select-none animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 bg-slate-100 border border-slate-200/50 rounded-2xl flex items-center justify-center text-slate-400 mb-4 shadow-sm shadow-slate-100">
              <Search size={20} />
            </div>
            <h3 className="text-xs font-black text-slate-800">No results for "{searchQuery}"</h3>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs font-semibold leading-relaxed">
              We couldn't find any messages or files matching that keyword in this sync channel.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-3.5 py-1.5 bg-pink-500 hover:bg-pink-600 text-white text-[10px] font-black rounded-lg shadow-md shadow-pink-500/20 transition-all uppercase tracking-wider"
            >
              Clear Search
            </button>
          </div>
        )}

        {filteredMessages.map((msg, idx) => {
          const isMe = msg.senderId === user?.uid;
          const hasAnyReactions = msg.reactions && Object.keys(msg.reactions).some(emoji => msg.reactions![emoji]?.length > 0);
          
          if (msg.senderId === 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-3.5 select-none w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="px-5 py-2 bg-slate-100/85 backdrop-blur-sm border border-slate-200/50 rounded-2xl text-[10px] font-bold text-slate-500 uppercase tracking-tight shadow-sm max-w-md text-center leading-relaxed flex items-center gap-2">
                  <span className="text-sm">📢</span>
                  <span>{msg.text}</span>
                </div>
              </div>
            );
          }

          const senderProfile = groupMembers.find(m => m.uid === msg.senderId);
          const senderName = senderProfile?.fullName || msg.senderName || 'Anonymous';
          const senderAvatar = senderProfile?.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`;

          return (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              key={msg.id}
              className={cn(
                "flex w-full items-center gap-2 group/msg relative",
                hasAnyReactions ? "mb-5" : "mb-1.5",
                isMe ? "justify-end" : "justify-start"
              )}
            >
              {!isMe && isGroup && (
                <img 
                  src={senderAvatar} 
                  alt="" 
                  className="w-7 h-7 rounded-lg object-cover border border-slate-100 shadow-sm flex-shrink-0 mt-auto mb-1 select-none"
                  referrerPolicy="no-referrer"
                />
              )}

              {isMe && (
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveReactionsMsgId(activeReactionsMsgId === msg.id ? null : msg.id);
                    }}
                    className={cn(
                      "p-1.5 rounded-full bg-white hover:bg-slate-100 border border-slate-100 text-slate-400 hover:text-pink-500 transition-all shadow-sm active:scale-95",
                      activeReactionsMsgId === msg.id 
                        ? "opacity-100 text-pink-500 bg-pink-50 border-pink-100 scale-105" 
                        : "opacity-40 sm:opacity-0 group-hover/msg:opacity-100"
                    )}
                    title="Add reaction"
                  >
                    <Smile size={14} />
                  </button>

                  {/* Reaction Picker Panel for Me */}
                  {activeReactionsMsgId === msg.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-40 bg-transparent cursor-default" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveReactionsMsgId(null);
                        }}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="absolute bottom-full right-0 mb-2 z-50 bg-white border border-slate-100 rounded-full px-2 py-1 shadow-lg shadow-pink-500/10 flex items-center gap-1 origin-bottom-right"
                      >
                        {['👍', '❤️', '😂', '😮', '😢', '🔥'].map((emoji) => {
                          const reactionUsers = msg.reactions?.[emoji] || [];
                          const hasReacted = user && reactionUsers.includes(user.uid);
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (user && id) {
                                  chatService.toggleMessageReaction(id, msg.id, user.uid, emoji);
                                }
                                setActiveReactionsMsgId(null);
                              }}
                              className={cn(
                                "w-7 h-7 flex items-center justify-center text-base rounded-full hover:scale-125 transition-transform active:scale-95",
                                hasReacted ? "bg-pink-100" : "hover:bg-slate-50"
                              )}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </motion.div>
                    </>
                  )}
                </div>
              )}

              <div className={cn(
                "max-w-[80%] px-4 py-3 rounded-[1.5rem] text-sm relative group transition-all shadow-sm flex flex-col gap-2",
                isMe 
                  ? "gradient-pink text-white rounded-tr-sm" 
                  : "bg-white text-slate-600 border border-slate-100 rounded-tl-sm shadow-slate-200/50"
              )}>
                {!isMe && isGroup && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-pink-500 block mb-0.5">
                    {senderName}
                  </span>
                )}
                
                {/* Voice Note attachment styling layout */}
                {msg.mediaType === 'voice' && msg.audioUrl && (
                  <VoicePlayer src={msg.audioUrl} isMe={isMe} />
                )}

                {/* Photo image attachment visual panel layout */}
                {msg.mediaType === 'image' && msg.imageUrl && (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-100 max-w-full cursor-zoom-in group/image" onClick={() => setActiveLightboxImage(msg.imageUrl!)}>
                    <img 
                      src={msg.imageUrl} 
                      className="max-h-60 w-auto object-cover rounded-2xl transition-transform duration-300 group-hover/image:scale-[1.02]" 
                      alt="Attachment" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors" />
                  </div>
                )}

                {/* File attachment download card block template */}
                {msg.mediaType === 'file' && msg.fileUrl && (
                  <a 
                    href={msg.fileUrl} 
                    download={msg.fileName || 'file'}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-2xl border transition-all select-none max-w-full",
                      isMe 
                        ? "bg-black/10 border-transparent hover:bg-black/15 text-white" 
                        : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-800"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
                      isMe ? "bg-white text-pink-500" : "bg-pink-100 text-pink-600"
                    )}>
                      <FileText size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold leading-tight truncate">
                        {msg.fileName ? highlightText(msg.fileName, searchQuery) : 'Document'}
                      </p>
                      <span className={cn(
                        "text-[9px] mt-0.5 block font-bold tracking-tight opacity-75",
                        isMe ? "text-pink-50" : "text-slate-400"
                      )}>{msg.fileSize || 'Unknown Size'}</span>
                    </div>
                    <Download size={14} className="opacity-60 flex-shrink-0" />
                  </a>
                )}

                {/* Regular text label - check to see if we should suppress default placeholder texts */}
                {msg.text && msg.text !== '📷 Sent a photo' && msg.text !== '🎤 Sent a voice note' && !msg.text.startsWith('📁 ') && (
                  <p className="font-semibold leading-relaxed px-1 break-words">
                    {highlightText(msg.text, searchQuery)}
                  </p>
                )}

                {/* Info footer timestamp block representation */}
                <div className={cn(
                  "flex items-center gap-1 opacity-70 px-1 mt-0.5 select-none",
                  isMe ? "justify-end text-pink-100" : "justify-start text-slate-400"
                )}>
                  <span className="text-[9px] font-bold uppercase">{getTime(msg.createdAt)}</span>
                  {isMe && (
                    <div 
                      className="flex items-center" 
                      title={msg.read ? "Seen / Read" : "Delivered / Sent"}
                    >
                      {msg.read ? (
                        <CheckCheck size={13} className="text-white ml-0.5 hover:scale-115 transition-transform" />
                      ) : (
                        <Check size={13} className="text-pink-200 ml-0.5 opacity-90" />
                      )}
                    </div>
                  )}
                </div>

                {/* Reactions badge overlay */}
                {hasAnyReactions && (
                  <div className={cn(
                    "absolute -bottom-3.5 flex flex-wrap gap-1 z-10 max-w-full px-1",
                    isMe ? "right-3 justify-end" : "left-3 justify-start"
                  )}>
                    {Object.entries(msg.reactions || {}).map(([emoji, userIds]) => {
                      if (!userIds || userIds.length === 0) return null;
                      const hasReacted = user && userIds.includes(user.uid);
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (user && id) {
                              chatService.toggleMessageReaction(id, msg.id, user.uid, emoji);
                            }
                          }}
                          className={cn(
                            "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black border transition-all active:scale-95 shadow-sm select-none",
                            hasReacted 
                              ? "bg-pink-500 border-pink-400 text-white hover:bg-pink-650" 
                              : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
                          )}
                          title={`${userIds.length} ${userIds.length === 1 ? 'reaction' : 'reactions'}`}
                        >
                          <span className="text-xs">{emoji}</span>
                          {userIds.length > 1 && (
                            <span className="text-[9px] font-extrabold">{userIds.length}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {!isMe && (
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveReactionsMsgId(activeReactionsMsgId === msg.id ? null : msg.id);
                    }}
                    className={cn(
                      "p-1.5 rounded-full bg-white hover:bg-slate-100 border border-slate-100 text-slate-400 hover:text-pink-500 transition-all shadow-sm active:scale-95",
                      activeReactionsMsgId === msg.id 
                        ? "opacity-100 text-pink-500 bg-pink-50 border-pink-100 scale-105" 
                        : "opacity-40 sm:opacity-0 group-hover/msg:opacity-100"
                    )}
                    title="Add reaction"
                  >
                    <Smile size={14} />
                  </button>

                  {/* Reaction Picker Panel for Other */}
                  {activeReactionsMsgId === msg.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-40 bg-transparent cursor-default" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveReactionsMsgId(null);
                        }}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="absolute bottom-full left-0 mb-2 z-50 bg-white border border-slate-100 rounded-full px-2 py-1 shadow-lg shadow-pink-500/10 flex items-center gap-1 origin-bottom-left"
                      >
                        {['👍', '❤️', '😂', '😮', '😢', '🔥'].map((emoji) => {
                          const reactionUsers = msg.reactions?.[emoji] || [];
                          const hasReacted = user && reactionUsers.includes(user.uid);
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (user && id) {
                                  chatService.toggleMessageReaction(id, msg.id, user.uid, emoji);
                                }
                                setActiveReactionsMsgId(null);
                              }}
                              className={cn(
                                "w-7 h-7 flex items-center justify-center text-base rounded-full hover:scale-125 transition-transform active:scale-95",
                                hasReacted ? "bg-pink-100" : "hover:bg-slate-50"
                              )}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </motion.div>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Preview media layout bar above keyboard inputs */}
      <AnimatePresence>
        {(previewImage || previewFile) && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="px-6 py-4.5 bg-white border-t border-slate-100/80 flex items-center justify-between gap-4 z-20 shadow-lg"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              {previewImage ? (
                <div className="relative w-15 h-15 rounded-xl overflow-hidden border border-slate-100 flex-shrink-0">
                  <img src={previewImage} className="w-full h-full object-cover" alt="Attachment Preview" referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center flex-shrink-0 border border-pink-100">
                  <FileText size={20} />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-slate-850 truncate">
                  {previewImage ? 'Photo selected for sync' : previewFile?.name}
                </p>
                <span className="text-[10px] text-slate-450 font-bold uppercase mt-1 block">
                  {previewImage ? 'Ready to sync' : previewFile?.size}
                </span>
              </div>
            </div>
            <button 
              onClick={() => { setPreviewImage(null); setPreviewFile(null); }}
              className="p-1.5 rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom inputs footer section */}
      <footer className="p-2.5 sm:p-4 bg-white border-t border-slate-100 z-20">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 sm:gap-3">
          
          {/* Animated voice recording full visual overlay bar */}
          <AnimatePresence mode="wait">
            {isRecording ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex-1 bg-rose-50 border border-rose-100/50 rounded-2xl flex items-center justify-between px-3 py-3 sm:px-5 sm:py-4 text-rose-600 min-w-0"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-rose-500 rounded-full animate-ping flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-rose-500 select-none truncate">
                    Recording {formatTime(recordingTime)}
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                  <button 
                    type="button" 
                    onClick={cancelRecording}
                    className="p-1.5 sm:p-2 text-rose-450 hover:bg-rose-100 hover:text-rose-700 rounded-xl transition-all"
                    title="Cancel and discard voice note"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button 
                    type="button" 
                    onClick={stopAndSendRecording}
                    className="p-1.5 sm:p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-all font-bold text-[10px] sm:text-xs uppercase px-2.5 sm:px-4.5 flex items-center gap-1 sm:gap-1.5 shadow-md shadow-rose-200"
                  >
                    <Send size={10} fill="white" />
                    Send
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl flex items-center px-2.5 sm:px-4 focus-within:ring-2 focus-within:ring-pink-150 transition-all min-w-0"
              >
                <button 
                  type="button" 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={cn(
                    "p-1.5 sm:p-2 rounded-xl transition-colors flex-shrink-0",
                    showEmojiPicker ? "text-pink-500 bg-pink-50" : "text-slate-400 hover:text-pink-500"
                  )}
                  title="Toggle emoji and sticker selector"
                >
                  <Smile size={18} />
                </button>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onFocus={() => setShowEmojiPicker(false)}
                  placeholder={isModerating ? "Syncing packets..." : "Text sync..."}
                  className="flex-1 py-3 sm:py-4.5 px-1.5 sm:px-2 bg-transparent text-slate-900 placeholder:text-slate-400 outline-none text-xs font-bold leading-tight min-w-0 w-full"
                  disabled={isModerating}
                />
                <div className="flex gap-1 sm:gap-1.5 flex-shrink-0">
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Attach any document file"
                  >
                    <Paperclip size={18} />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => imageInputRef.current?.click()}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-650 transition-colors"
                    title="Select and attach image photo"
                  >
                    <Camera size={18} />
                  </button>
                  <button 
                    type="button" 
                    onClick={startRecording}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-pink-500 transition-colors sm:hidden"
                    title="Record voice note"
                  >
                    <Mic size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!isRecording && (
            <button
              type="submit"
              disabled={(!inputText.trim() && !previewImage && !previewFile) || isModerating}
              className={cn(
                "w-11 h-11 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-xl flex-shrink-0",
                (inputText.trim() || previewImage || previewFile)
                  ? "gradient-pink text-white shadow-pink-200" 
                  : "bg-slate-100 text-slate-300 pointer-events-none shadow-none"
              )}
            >
              {isModerating ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                <Send size={16} className={(inputText.trim() || previewImage || previewFile) ? "translate-x-0.5 -translate-y-0.5" : ""} />
              )}
            </button>
          )}
        </form>
      </footer>

      {/* Elegant collapsable Emoji & Sticker keyboard panel */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white border-t border-slate-100 overflow-hidden relative z-20"
          >
            <div className="h-64 flex flex-col bg-slate-50/50">
              {/* Navigation/Tabs for Emojis vs Stickers */}
              <div className="flex border-b border-slate-100 bg-white px-4 sm:px-6 py-2.5 sm:py-3.5 justify-between items-center select-none">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStickerTab('emoji')}
                    className={cn(
                      "px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all",
                      stickerTab === 'emoji' 
                        ? "gradient-pink text-white shadow-md shadow-pink-200" 
                        : "bg-slate-50 text-slate-500 hover:text-slate-800"
                    )}
                  >
                    Emojis
                  </button>
                  <button
                    type="button"
                    onClick={() => setStickerTab('sticker')}
                    className={cn(
                      "px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all",
                      stickerTab === 'sticker' 
                        ? "gradient-pink text-white shadow-md shadow-pink-200" 
                        : "bg-slate-50 text-slate-500 hover:text-slate-800"
                    )}
                  >
                    Stickers
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
                {stickerTab === 'emoji' ? (
                  <div className="space-y-5">
                    {Object.entries(emojiCategories).map(([category, emojis]) => (
                      <div key={category}>
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">{category}</h4>
                        <div className="grid grid-cols-6 xs:grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1.5 sm:gap-3">
                          {emojis.map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleEmojiSelect(emoji)}
                              className="h-10 sm:h-11 hover:bg-pink-50 hover:scale-110 active:scale-95 text-xl sm:text-2xl flex items-center justify-center rounded-xl transition-all"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Expressive Stickers</h4>
                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
                      {meetoraStickers.map(sticker => (
                        <button
                          key={sticker.id}
                          type="button"
                          onClick={() => handleStickerSelect(sticker)}
                          className="p-2 sm:p-3 border border-slate-100 bg-white hover:border-pink-200 rounded-2xl hover:bg-pink-50/20 flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all hover:scale-105 active:scale-95 group shadow-sm hover:shadow-pink-100/50"
                        >
                          <img
                            src={sticker.url}
                            className="w-12 h-12 sm:w-14 sm:h-14 object-contain group-hover:rotate-6 transition-transform"
                            alt={sticker.name}
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 group-hover:text-pink-600 transition-colors truncate w-full text-center">
                            {sticker.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Lightbox Modal Overlay Viewport */}
      <AnimatePresence>
        {activeLightboxImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveLightboxImage(null)}
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex flex-col justify-center items-center p-4 cursor-zoom-out"
          >
            <button 
              onClick={() => setActiveLightboxImage(null)}
              className="absolute top-5 right-5 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <motion.img 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              src={activeLightboxImage} 
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/5" 
              alt="Attachment Fullscreen"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Elegant Custom Toast Notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900/90 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-xl border border-slate-800/50 backdrop-blur-md"
          >
            <div className={cn(
              "w-2 h-2 rounded-full",
              toast.type === 'error' ? "bg-rose-500" : toast.type === 'success' ? "bg-emerald-500" : "bg-blue-500"
            )} />
            <span>{toast.message}</span>
            <button 
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 hover:text-slate-300 transition-colors"
            >
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
