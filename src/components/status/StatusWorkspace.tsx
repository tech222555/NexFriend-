import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  getDocs, 
  doc, 
  deleteDoc 
} from 'firebase/firestore';
import { 
  CircleDot, 
  Plus, 
  Type, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Users, 
  X, 
  Check, 
  ChevronRight, 
  Play, 
  Pause, 
  Trash2, 
  Search, 
  Info, 
  Globe, 
  Lock, 
  Eye, 
  ChevronLeft, 
  Volume2, 
  VolumeX,
  Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../../utils';
import { fileToBase64, resizeImage } from '../../utils/image';
import { StatusUpdate, UserProfile } from '../../types';
import { handleFirestoreError, OperationType } from '../../services/firestoreErrorHandler';

// High-fidelity background gradients for WhatsApp-like text status updates
const gradientPresets = [
  { id: 'purple-indigo', label: 'Indigo Velvet', class: 'from-purple-600 to-indigo-700 bg-gradient-to-br', text: '#ffffff' },
  { id: 'rose-sunset', label: 'Rose Sunset', class: 'from-rose-500 to-orange-500 bg-gradient-to-br', text: '#ffffff' },
  { id: 'ocean-calm', label: 'Ocean Breeze', class: 'from-teal-500 to-emerald-600 bg-gradient-to-br', text: '#ffffff' },
  { id: 'midnight-navy', label: 'Cosmic Slate', class: 'from-slate-900 to-slate-800 bg-gradient-to-br', text: '#e2e8f0' },
  { id: 'neon-glow', label: 'Ruby Glow', class: 'from-pink-600 to-rose-700 bg-gradient-to-br', text: '#ffffff' },
  { id: 'cyber-dark', label: 'Cyber Violet', class: 'from-violet-800 to-fuchsia-900 bg-gradient-to-br', text: '#e9d5ff' }
];

export default function StatusWorkspace() {
  const { user, profile } = useAuth();
  const [statuses, setStatuses] = useState<StatusUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  // Status creation form states
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [creatorType, setCreatorType] = useState<'text' | 'image' | 'video' | null>(null);
  const [textContent, setTextContent] = useState('');
  const [selectedGradientIdx, setSelectedGradientIdx] = useState(0);
  const [mediaFile, setMediaFile] = useState<string | null>(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaError, setMediaError] = useState('');

  // Audience view selector states
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedViewerIds, setSelectedViewerIds] = useState<string[]>([]);
  const [isAudienceSelectorOpen, setIsAudienceSelectorOpen] = useState(false);
  const [audienceSearchQuery, setAudienceSearchQuery] = useState('');

  // Status viewer states
  const [activeStoryUser, setActiveStoryUser] = useState<string | null>(null); // userId of active user status queue being viewed
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [storyPaused, setStoryPaused] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyMuted, setStoryMuted] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const progressTimerRef = useRef<any>(null);

  // Fetch all potential viewers (users list)
  useEffect(() => {
    if (!user) return;
    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const usersList = snapshot.docs
          .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
          .filter(u => u.uid !== user.uid);
        setAllUsers(usersList);
        // Default to sharing with all users (publicly within matched/joined community)
        setSelectedViewerIds(usersList.map(u => u.uid));
      } catch (err) {
        console.error("Error fetching potential status viewers:", err);
      }
    };
    fetchUsers();
  }, [user]);

  // Real-time subscribe to statuses (both my statuses and statuses shared with me)
  useEffect(() => {
    if (!user) return;

    setLoading(true);

    // Subscribe ONLY to statuses where current user is in viewerIds (which always includes the creator)
    const q = query(collection(db, 'statuses'), where('viewerIds', 'array-contains', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StatusUpdate));

      // Filter statuses:
      // 1. Must not be expired (createdAt within last 24 hours)
      // 2. Must belong to me OR include my user.uid in viewerIds
      const now = new Date();
      const validStatuses = fetched.filter(status => {
        // Calculate age
        const createdDate = status.createdAt?.toDate ? status.createdAt.toDate() : new Date(status.createdAt || now);
        const ageInMs = now.getTime() - createdDate.getTime();
        const isExpired = ageInMs > 24 * 60 * 60 * 1000; // 24 hours
        
        const isMine = status.userId === user.uid;
        const isSharedWithMe = status.viewerIds?.includes(user.uid);
        
        return !isExpired && (isMine || isSharedWithMe);
      });

      // Sort in descending order of createdAt in memory (to avoid composite index requirement)
      const sortedStatuses = [...validStatuses].sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime());
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime());
        return timeB - timeA;
      });

      setStatuses(sortedStatuses);
      setLoading(false);
    }, (err) => {
      console.error("Error reading statuses:", err);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // Story Viewer Auto-Progress Loop
  useEffect(() => {
    if (!activeStoryUser) {
      setStoryProgress(0);
      return;
    }

    const currentQueue = groupedStatuses[activeStoryUser] || [];
    const activeStatus = currentQueue[activeStoryIdx];
    if (!activeStatus) {
      // End of story queue for this user
      handleNextStoryUser();
      return;
    }

    if (storyPaused) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      return;
    }

    const duration = activeStatus.type === 'video' ? 10000 : 5000; // 10s for video, 5s for images/text
    const intervalTime = 50; // Update progress bar every 50ms
    const steps = duration / intervalTime;
    let currentStep = (storyProgress / 100) * steps;

    progressTimerRef.current = setInterval(() => {
      currentStep += 1;
      const progressPercent = (currentStep / steps) * 100;

      if (progressPercent >= 100) {
        clearInterval(progressTimerRef.current);
        setStoryProgress(0);
        if (activeStoryIdx < currentQueue.length - 1) {
          setActiveStoryIdx(prev => prev + 1);
        } else {
          // Finished this user's queue, advance to next user's queue
          handleNextStoryUser();
        }
      } else {
        setStoryProgress(progressPercent);
      }
    }, intervalTime);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [activeStoryUser, activeStoryIdx, storyPaused, storyProgress]);

  // Grouping statuses by creator
  const groupedStatuses = statuses.reduce<Record<string, StatusUpdate[]>>((acc, s) => {
    if (!acc[s.userId]) {
      acc[s.userId] = [];
    }
    acc[s.userId].push(s);
    return acc;
  }, {});

  // Group list sorted so my status is always first, followed by others sorted by latest post
  const creators = Object.keys(groupedStatuses).sort((a, b) => {
    if (a === user?.uid) return -1;
    if (b === user?.uid) return 1;
    const latestA = groupedStatuses[a][0]?.createdAt?.seconds || 0;
    const latestB = groupedStatuses[b][0]?.createdAt?.seconds || 0;
    return latestB - latestA;
  });

  const handleNextStoryUser = () => {
    if (!activeStoryUser) return;
    const currentIdx = creators.indexOf(activeStoryUser);
    if (currentIdx !== -1 && currentIdx < creators.length - 1) {
      // Go to next user's status queue
      setActiveStoryUser(creators[currentIdx + 1]);
      setActiveStoryIdx(0);
      setStoryProgress(0);
    } else {
      // Done with all stories
      setActiveStoryUser(null);
      setActiveStoryIdx(0);
      setStoryProgress(0);
    }
  };

  const handlePrevStoryUser = () => {
    if (!activeStoryUser) return;
    if (activeStoryIdx > 0) {
      setActiveStoryIdx(prev => prev - 1);
      setStoryProgress(0);
    } else {
      const currentIdx = creators.indexOf(activeStoryUser);
      if (currentIdx > 0) {
        const prevUser = creators[currentIdx - 1];
        setActiveStoryUser(prevUser);
        setActiveStoryIdx((groupedStatuses[prevUser]?.length || 1) - 1);
        setStoryProgress(0);
      } else {
        // At the absolute beginning, just restart the first one
        setStoryProgress(0);
      }
    }
  };

  // Process selected image
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaError('');
    if (file.size > 850 * 1024) {
      setMediaError('Image size is too large. Please select an image under 850KB.');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      // Resize to 500x500 for lightweight storage
      const resized = await resizeImage(base64, 500, 500);
      setMediaFile(resized);
    } catch (err) {
      console.error("Error converting image:", err);
      setMediaError('Failed to read image. Please try another file.');
    }
  };

  // Helper to extract video duration dynamically
  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => {
        resolve(0);
      };
      video.src = URL.createObjectURL(file);
    });
  };

  // Process selected video
  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaError('');

    // Enforce 5 minutes (300 seconds) duration check
    const duration = await getVideoDuration(file);
    if (duration > 300) {
      setMediaError('Video upload failed: The video duration exceeds the maximum limit of 5 minutes.');
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }

    // Firestore max document size is 1MB. Warn if larger.
    if (file.size > 950 * 1024) {
      setMediaError('Video file size exceeds 950KB. Firestore stores data up to 1MB. Please upload a short, low-res video clip.');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setMediaFile(base64);
    } catch (err) {
      console.error("Error converting video:", err);
      setMediaError('Failed to load video file.');
    }
  };

  // Submit new status to Firestore
  const handlePublishStatus = async () => {
    if (!user || !profile) return;
    if (creatorType === 'text' && !textContent.trim()) return;
    if ((creatorType === 'image' || creatorType === 'video') && !mediaFile) return;

    setIsSubmitting(true);
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Always include creator's own UID in viewerIds so that they are a viewer of their own status,
      // which allows query filtering by 'viewerIds' array-contains 'user.uid' without permission issues.
      const viewers = [...selectedViewerIds];
      if (!viewers.includes(user.uid)) {
        viewers.push(user.uid);
      }

      const statusData: Omit<StatusUpdate, 'id'> = {
        userId: user.uid,
        userFullName: profile.fullName,
        userProfilePicture: profile.profilePicture,
        type: creatorType!,
        content: creatorType === 'text' ? textContent.trim() : mediaFile!,
        createdAt: serverTimestamp(),
        expiresAt: expiresAt,
        viewerIds: viewers
      };

      if (creatorType === 'text') {
        statusData.bgGradient = gradientPresets[selectedGradientIdx].class;
        statusData.textColor = gradientPresets[selectedGradientIdx].text;
      } else if (mediaCaption.trim()) {
        statusData.bgGradient = mediaCaption.trim(); // store caption in bgGradient field for simplicity
      }

      await addDoc(collection(db, 'statuses'), statusData);

      // Notify selected status viewers via DB and email
      const activeViewers = selectedViewerIds.filter(vid => vid !== user.uid);
      activeViewers.forEach(async (viewerId) => {
        let messageBody = `Check out my new status update!`;
        if (creatorType === 'text') {
          messageBody = `"${textContent.trim()}"`;
        } else if (mediaCaption.trim()) {
          messageBody = `Shared a new photo: "${mediaCaption.trim()}"`;
        } else {
          messageBody = `Shared a new ${creatorType} update!`;
        }

        const matchedUser = allUsers.find(u => u.uid === viewerId);
        const recipientEmail = matchedUser?.email;
        const recipientName = matchedUser?.fullName || 'User';

        try {
          // 1. Add notification in Firestore
          await addDoc(collection(db, `users/${viewerId}/notifications`), {
            matchId: 'status',
            title: `${profile.fullName} updated status 🌟`,
            message: messageBody,
            read: false,
            createdAt: serverTimestamp()
          });

          // 2. Dispatch the offline email notification
          if (recipientEmail) {
            await fetch('/api/send-email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                to: recipientEmail,
                recipientName: recipientName,
                title: `${profile.fullName} updated status 🌟`,
                message: messageBody
              })
            }).catch(err => console.error('Fetch post status update email failed:', err));
          }
        } catch (err) {
          console.error(`Failed to notify viewer ${viewerId} about status update:`, err);
        }
      });

      // Clean up & Close
      setTextContent('');
      setMediaFile(null);
      setMediaCaption('');
      setCreatorType(null);
      setIsCreatorOpen(false);
    } catch (err) {
      console.error("Error creating status:", err);
      handleFirestoreError(err, OperationType.CREATE, 'statuses');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStatus = async (statusId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this status? This action is permanent.")) return;

    try {
      await deleteDoc(doc(db, 'statuses', statusId));
    } catch (err) {
      console.error("Error deleting status:", err);
      handleFirestoreError(err, OperationType.DELETE, `statuses/${statusId}`);
    }
  };

  // View specific user queue
  const openStoryViewer = (userId: string) => {
    setActiveStoryUser(userId);
    setActiveStoryIdx(0);
    setStoryProgress(0);
    setStoryPaused(false);
  };

  // Toggle specific user's view permission
  const handleToggleViewer = (uid: string) => {
    setSelectedViewerIds(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleSelectAllViewers = () => {
    if (selectedViewerIds.length === allUsers.length) {
      setSelectedViewerIds([]);
    } else {
      setSelectedViewerIds(allUsers.map(u => u.uid));
    }
  };

  // Audience list search
  const filteredAudience = allUsers.filter(u => 
    u.fullName.toLowerCase().includes(audienceSearchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(audienceSearchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#fafafc] overflow-hidden" id="status-workspace-node">
      {/* Sidebar - Creator Launcher and Status Lists */}
      <div className="w-full md:w-[380px] border-r border-slate-100 bg-white flex flex-col flex-shrink-0 h-full overflow-hidden shadow-sm">
        <header className="p-4 border-b border-slate-100 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-100 text-pink-500 rounded-xl flex items-center justify-center shadow-sm">
              <CircleDot size={18} className="animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Status Feed</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Updates vanish in 24 hours</p>
            </div>
          </div>
          <button
            onClick={() => setIsAudienceSelectorOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/50 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-wider transition-all"
            title="Configure viewing permissions"
          >
            <Users size={12} />
            <span>Audience</span>
          </button>
        </header>

        {/* My Current Status Section */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/40">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              {groupedStatuses[user?.uid || ''] ? (
                <button
                  onClick={() => openStoryViewer(user?.uid || '')}
                  className="w-14 h-14 rounded-full p-[3px] border-2 border-pink-500 hover:scale-105 active:scale-95 transition-all overflow-hidden bg-white"
                  title="Watch my active statuses"
                >
                  <img
                    src={profile?.profilePicture}
                    className="w-full h-full rounded-full object-cover"
                    alt="My Avatar"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ) : (
                <div className="w-14 h-14 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center p-0.5 bg-white">
                  <img
                    src={profile?.profilePicture}
                    className="w-full h-full rounded-full object-cover opacity-80"
                    alt="My Avatar"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 flex gap-1">
                <button
                  onClick={() => {
                    setCreatorType('text');
                    setIsCreatorOpen(true);
                  }}
                  className="w-6 h-6 bg-pink-500 text-white rounded-full flex items-center justify-center shadow hover:bg-pink-600 transition-colors"
                  title="Share text status"
                >
                  <Type size={11} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-black text-slate-800">My Status Updates</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 font-semibold">
                {groupedStatuses[user?.uid || '']
                  ? `${groupedStatuses[user!.uid].length} updates posted`
                  : 'Tap plus/icons to share your day'}
              </p>
              
              {/* Image & Video Launcher shortcuts directly */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => {
                    setCreatorType('image');
                    setIsCreatorOpen(true);
                    setTimeout(() => fileInputRef.current?.click(), 100);
                  }}
                  className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-pink-500 bg-white border border-slate-200/60 px-2 py-1 rounded-lg shadow-sm transition-all"
                >
                  <ImageIcon size={10} />
                  <span>Photo</span>
                </button>
                <button
                  onClick={() => {
                    setCreatorType('video');
                    setIsCreatorOpen(true);
                    setTimeout(() => videoInputRef.current?.click(), 100);
                  }}
                  className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-pink-500 bg-white border border-slate-200/60 px-2 py-1 rounded-lg shadow-sm transition-all"
                >
                  <VideoIcon size={10} />
                  <span>Video Clip</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Status Lists: Recent Updates */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <CircleDot size={12} className="text-pink-400" />
            <span>Recent Updates ({creators.filter(id => id !== user?.uid).length})</span>
          </h3>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-pink-100 border-t-pink-500 rounded-full animate-spin mb-2" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scanning Channel Statuses...</p>
            </div>
          ) : creators.length === 0 || (creators.length === 1 && creators[0] === user?.uid) ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200/50">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-100 mb-3 animate-pulse">
                <CircleDot size={20} />
              </div>
              <h4 className="text-xs font-black text-slate-800">No active statuses</h4>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs font-semibold leading-relaxed">
                Statuses from matched nodes and friends will render here. Publish a status first to inspire others!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {creators.map(creatorId => {
                const isMe = creatorId === user?.uid;
                if (isMe) return null; // My statuses are showcased on top already
                
                const queue = groupedStatuses[creatorId];
                const latest = queue[0];
                if (!latest) return null;

                const hasMultiple = queue.length > 1;

                return (
                  <button
                    key={creatorId}
                    onClick={() => openStoryViewer(creatorId)}
                    className="flex items-center gap-3 p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-100/50 transition-all text-left group shadow-sm hover:shadow active:scale-[0.99]"
                  >
                    {/* Ring around avatar representing status update chain */}
                    <div className="relative flex-shrink-0">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center p-[2.5px] transition-transform group-hover:scale-105",
                        hasMultiple ? "bg-gradient-to-tr from-pink-500 via-rose-400 to-amber-400" : "bg-pink-500"
                      )}>
                        <img
                          src={latest.userProfilePicture}
                          className="w-full h-full rounded-full object-cover border-2 border-white"
                          alt={latest.userFullName}
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      {hasMultiple && (
                        <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-pink-500 to-amber-500 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded-full scale-90 border border-white shadow-sm">
                          {queue.length}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-extrabold text-slate-800 group-hover:text-pink-500 transition-colors truncate">
                        {latest.userFullName}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase tracking-wide">
                        {queue.length} Update{hasMultiple ? 's' : ''} • {formatDate(latest.createdAt)}
                      </p>
                      {latest.type === 'text' ? (
                        <p className="text-[11px] text-slate-500 font-semibold truncate mt-1 italic">
                          "{latest.content}"
                        </p>
                      ) : (
                        <p className="text-[11px] text-pink-500 font-bold uppercase tracking-wider text-[10px] mt-1 flex items-center gap-1">
                          {latest.type === 'image' ? <ImageIcon size={10} /> : <VideoIcon size={10} />}
                          <span>Shared a {latest.type} {latest.bgGradient ? `"${latest.bgGradient}"` : ''}</span>
                        </p>
                      )}
                    </div>

                    <ChevronRight size={14} className="text-slate-300 group-hover:text-pink-500 transition-colors flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main View Area - Classic Placeholder / Interactive Canvas */}
      <div className="hidden md:flex flex-1 bg-slate-50/50 items-center justify-center p-8 relative overflow-hidden">
        {/* Subtle grid styling */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60" />

        <div className="max-w-md w-full text-center relative z-10 animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-gradient-to-tr from-pink-500 to-rose-400 rounded-3xl flex items-center justify-center text-white mx-auto shadow-xl shadow-pink-500/10 mb-6">
            <CircleDot size={36} className="animate-spin-slow" />
          </div>
          <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Status Board</h3>
          <p className="text-xs text-slate-500 mt-2 font-semibold leading-relaxed max-w-sm mx-auto">
            Click on any available user status ring on the left to watch their live story stream, or upload a custom status to show everyone what you're up to!
          </p>

          <div className="mt-8 pt-6 border-t border-slate-200/60 flex items-center justify-center gap-8 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Lock size={12} className="text-slate-400" />
              <span>Securely Shared</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye size={12} className="text-slate-400" />
              <span>Full Access Control</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Status Creator Panel */}
      <AnimatePresence>
        {isCreatorOpen && creatorType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden flex flex-col"
            >
              <header className="p-4 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-pink-50 text-pink-500 rounded-lg">
                    {creatorType === 'text' && <Type size={16} />}
                    {creatorType === 'image' && <ImageIcon size={16} />}
                    {creatorType === 'video' && <VideoIcon size={16} />}
                  </div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Create {creatorType} Status
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setCreatorType(null);
                    setMediaFile(null);
                    setMediaCaption('');
                    setTextContent('');
                    setIsCreatorOpen(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X size={16} />
                </button>
              </header>

              {/* Creator Canvas Area */}
              <div className="flex-1 p-6 flex flex-col gap-4">
                {/* Text status mode canvas */}
                {creatorType === 'text' && (
                  <div className="flex flex-col gap-4">
                    <div className={cn(
                      "w-full aspect-video rounded-2xl flex flex-col items-center justify-center p-6 text-center shadow-inner relative transition-all duration-300",
                      gradientPresets[selectedGradientIdx].class
                    )}>
                      <textarea
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value.slice(0, 200))}
                        placeholder="What's on your mind? (Max 200 chars)"
                        style={{ color: gradientPresets[selectedGradientIdx].text }}
                        className="w-full bg-transparent border-none text-center font-extrabold text-base md:text-lg focus:ring-0 focus:outline-none resize-none placeholder-white/60 leading-relaxed overflow-y-auto max-h-[140px]"
                        rows={3}
                        autoFocus
                      />
                      <span className="absolute bottom-3 right-4 text-[10px] font-bold text-white/50">
                        {textContent.length}/200
                      </span>
                    </div>

                    {/* Gradient picker carousel */}
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Select Canvas Gradient:</p>
                      <div className="grid grid-cols-6 gap-2">
                        {gradientPresets.map((preset, idx) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setSelectedGradientIdx(idx)}
                            className={cn(
                              "aspect-square rounded-xl shadow-sm border-2 transition-all relative",
                              preset.class,
                              selectedGradientIdx === idx ? "border-pink-500 scale-105" : "border-white hover:scale-102"
                            )}
                            title={preset.label}
                          >
                            {selectedGradientIdx === idx && (
                              <div className="absolute inset-0 bg-black/10 rounded-xl flex items-center justify-center">
                                <Check size={14} className="text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Picture/Video upload mode canvas */}
                {(creatorType === 'image' || creatorType === 'video') && (
                  <div className="flex flex-col gap-4">
                    {mediaFile ? (
                      <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-sm flex items-center justify-center">
                        {creatorType === 'image' ? (
                          <img 
                            src={mediaFile} 
                            className="w-full h-full object-contain" 
                            alt="Status Preview" 
                          />
                        ) : (
                          <video 
                            ref={videoPlayerRef}
                            src={mediaFile} 
                            className="w-full h-full object-contain" 
                            controls
                            autoPlay
                            muted
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setMediaFile(null)}
                          className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-full shadow transition-all scale-100 hover:scale-110 cursor-pointer border border-slate-700"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="aspect-video rounded-2xl border-2 border-dashed border-slate-300 hover:border-pink-500 hover:bg-pink-50/10 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all"
                           onClick={() => creatorType === 'image' ? fileInputRef.current?.click() : videoInputRef.current?.click()}>
                        <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 mb-3 shadow-sm">
                          {creatorType === 'image' ? <ImageIcon size={22} /> : <VideoIcon size={22} />}
                        </div>
                        <h4 className="text-xs font-black text-slate-800">Choose a {creatorType} file</h4>
                        <p className="text-[10px] text-slate-400 font-semibold mt-1 max-w-[240px]">
                          Upload a short {creatorType} from your local device storage. Maximum file size: 950KB.
                        </p>
                      </div>
                    )}

                    {mediaError && (
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10px] font-bold text-rose-600 flex items-start gap-2 leading-relaxed">
                        <Info size={12} className="flex-shrink-0 mt-0.5 text-rose-500" />
                        <span>{mediaError}</span>
                      </div>
                    )}

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageFileChange}
                      accept="image/*"
                      className="hidden"
                    />

                    <input
                      type="file"
                      ref={videoInputRef}
                      onChange={handleVideoFileChange}
                      accept="video/*"
                      className="hidden"
                    />

                    {/* Caption bar */}
                    {mediaFile && (
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1.5">Add Caption (Optional):</p>
                        <input
                          type="text"
                          placeholder="e.g. Beautiful sunset... ✨"
                          value={mediaCaption}
                          onChange={(e) => setMediaCaption(e.target.value.slice(0, 80))}
                          className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 font-semibold"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Info block: Shares with */}
                <div className="p-3.5 bg-pink-50/50 border border-pink-100/50 rounded-2xl flex items-start gap-3">
                  <div className="p-1 bg-pink-100 text-pink-500 rounded-lg mt-0.5">
                    <Globe size={12} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase text-pink-500 tracking-wider">Privacy & Viewers</p>
                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5 leading-snug">
                      Your update will be visible only to the <span className="text-slate-800 font-black">{selectedViewerIds.length} users</span> selected in your audience filters.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatorOpen(false);
                        setIsAudienceSelectorOpen(true);
                      }}
                      className="text-[9px] font-black uppercase text-pink-500 hover:text-pink-600 tracking-wider mt-2 block"
                    >
                      Change Audience →
                    </button>
                  </div>
                </div>
              </div>

              <footer className="p-4 px-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setCreatorType(null);
                    setMediaFile(null);
                    setMediaCaption('');
                    setTextContent('');
                    setIsCreatorOpen(false);
                  }}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 text-[10px] font-black rounded-xl transition-all uppercase tracking-wider border border-transparent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePublishStatus}
                  disabled={isSubmitting || (creatorType === 'text' && !textContent.trim()) || ((creatorType === 'image' || creatorType === 'video') && !mediaFile)}
                  className="px-5 py-2.5 bg-pink-500 hover:bg-pink-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-[10px] font-black rounded-xl shadow-lg shadow-pink-500/20 disabled:shadow-none transition-all uppercase tracking-wider flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <Check size={12} strokeWidth={3} />
                      <span>Publish Status</span>
                    </>
                  )}
                </button>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Audience Selector Dialog */}
      <AnimatePresence>
        {isAudienceSelectorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden flex flex-col max-h-[85vh]"
            >
              <header className="p-4 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-100 text-slate-500 rounded-lg">
                    <Users size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Status Audience</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Select who can view your updates</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAudienceSelectorOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X size={16} />
                </button>
              </header>

              {/* Viewer search bar */}
              <div className="p-4 border-b border-slate-100">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search people..."
                    value={audienceSearchQuery}
                    onChange={(e) => setAudienceSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 font-semibold"
                  />
                </div>
                
                {/* Select All Toggle */}
                <div className="flex items-center justify-between mt-3 px-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <span>Selected {selectedViewerIds.length} of {allUsers.length}</span>
                  <button
                    type="button"
                    onClick={handleSelectAllViewers}
                    className="text-pink-500 hover:text-pink-600 font-extrabold"
                  >
                    {selectedViewerIds.length === allUsers.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              {/* Interactive checkboxes list */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1.5">
                {filteredAudience.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 select-none">
                    <p className="text-xs font-bold">No contacts found</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto font-semibold">
                      Your connections and matches list is empty or matching search keywords.
                    </p>
                  </div>
                ) : (
                  filteredAudience.map(u => {
                    const isChecked = selectedViewerIds.includes(u.uid);
                    return (
                      <button
                        key={u.uid}
                        onClick={() => handleToggleViewer(u.uid)}
                        className={cn(
                          "flex items-center justify-between p-2 px-3 rounded-xl border transition-all text-left group",
                          isChecked 
                            ? "bg-pink-50/40 border-pink-100" 
                            : "bg-white border-transparent hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={u.profilePicture}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-100 shadow-sm"
                            alt={u.fullName}
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-800">{u.fullName}</p>
                            <p className="text-[10px] text-slate-400 font-semibold">@{u.username} • {u.city}</p>
                          </div>
                        </div>

                        {/* Custom visual checkbox state */}
                        <div className={cn(
                          "w-5 h-5 rounded-lg border flex items-center justify-center transition-all",
                          isChecked 
                            ? "bg-pink-500 border-pink-500 text-white" 
                            : "bg-slate-50 border-slate-200 group-hover:border-slate-300"
                        )}>
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <footer className="p-4 px-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAudienceSelectorOpen(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black rounded-xl shadow-md transition-all uppercase tracking-wider"
                >
                  Save & Apply Changes
                </button>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Full Screen Immersive Stories Viewer (WhatsApp style) */}
      <AnimatePresence>
        {activeStoryUser && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/98 md:bg-black/95 p-0 md:p-4 select-none backdrop-blur-md">
            <div className="relative w-full h-full md:max-w-lg md:h-[90vh] md:rounded-[2.5rem] overflow-hidden flex flex-col justify-between bg-zinc-950 text-white">
              
              {/* Top Progress Bar Indicators */}
              <div className="absolute top-0 inset-x-0 p-4 pt-5 z-20 bg-gradient-to-b from-black/80 to-transparent flex flex-col gap-3">
                <div className="flex gap-1.5 w-full">
                  {(groupedStatuses[activeStoryUser] || []).map((status, idx) => {
                    let fillPercent = 0;
                    if (idx < activeStoryIdx) fillPercent = 100;
                    else if (idx === activeStoryIdx) fillPercent = storyProgress;

                    return (
                      <div key={status.id} className="h-[3px] flex-1 bg-white/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-white transition-all duration-75"
                          style={{ width: `${fillPercent}%` }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Sender Header Details */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={(groupedStatuses[activeStoryUser] || [])[0]?.userProfilePicture}
                      className="w-10 h-10 rounded-full object-cover border-2 border-white/40 shadow"
                      alt="Creator"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="text-xs font-black text-white leading-tight">
                        {(groupedStatuses[activeStoryUser] || [])[0]?.userFullName}
                      </h4>
                      <p className="text-[9px] font-extrabold text-white/60 uppercase tracking-widest mt-0.5">
                        {formatDate((groupedStatuses[activeStoryUser] || [])[activeStoryIdx]?.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Audio mute switch for videos */}
                    {(groupedStatuses[activeStoryUser] || [])[activeStoryIdx]?.type === 'video' && (
                      <button
                        onClick={() => setStoryMuted(!storyMuted)}
                        className="p-2 text-white/80 hover:text-white bg-black/30 hover:bg-black/50 rounded-full border border-white/10"
                        title={storyMuted ? 'Unmute video sound' : 'Mute video sound'}
                      >
                        {storyMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>
                    )}

                    {/* Trash delete icon if own status */}
                    {activeStoryUser === user?.uid && (
                      <button
                        onClick={(e) => handleDeleteStatus((groupedStatuses[activeStoryUser] || [])[activeStoryIdx]?.id, e)}
                        className="p-2 text-rose-400 hover:text-rose-500 bg-black/30 hover:bg-black/50 rounded-full border border-white/10"
                        title="Delete this status update"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}

                    {/* Play/Pause switch */}
                    <button
                      onClick={() => setStoryPaused(!storyPaused)}
                      className="p-2 text-white/80 hover:text-white bg-black/30 hover:bg-black/50 rounded-full border border-white/10"
                      title={storyPaused ? 'Resume playing' : 'Pause playing'}
                    >
                      {storyPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                    </button>

                    {/* Close window */}
                    <button
                      onClick={() => {
                        setActiveStoryUser(null);
                        setActiveStoryIdx(0);
                        setStoryProgress(0);
                      }}
                      className="p-2 text-white/80 hover:text-white bg-black/30 hover:bg-black/50 rounded-full border border-white/10"
                      title="Close"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Left & Right Tappable Navigation Segments (Interactive story overlays) */}
              <div className="absolute inset-y-0 left-0 w-1/4 z-10 cursor-pointer" onClick={handlePrevStoryUser} />
              <div className="absolute inset-y-0 right-0 w-1/4 z-10 cursor-pointer" onClick={handleNextStoryUser} />

              {/* Core Content Presentation Screen */}
              <div className="flex-1 w-full h-full flex items-center justify-center relative">
                {(() => {
                  const status = (groupedStatuses[activeStoryUser] || [])[activeStoryIdx];
                  if (!status) return null;

                  if (status.type === 'text') {
                    return (
                      <div className={cn(
                        "w-full h-full flex flex-col items-center justify-center p-8 text-center",
                        status.bgGradient || "from-pink-600 to-rose-700 bg-gradient-to-tr"
                      )}>
                        <h2 
                          className="text-lg md:text-2xl font-black max-w-sm leading-relaxed px-4 break-words"
                          style={{ color: status.textColor || '#ffffff' }}
                        >
                          {status.content}
                        </h2>
                      </div>
                    );
                  }

                  if (status.type === 'image') {
                    return (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-black relative">
                        <img
                          src={status.content}
                          className="w-full h-full object-contain max-h-[80vh] md:max-h-full"
                          alt="Status content"
                        />
                        {status.bgGradient && (
                          <div className="absolute bottom-16 inset-x-0 text-center p-4 bg-gradient-to-t from-black/80 to-transparent pt-8">
                            <p className="text-sm font-bold text-white max-w-sm mx-auto line-clamp-3">
                              {status.bgGradient}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (status.type === 'video') {
                    return (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-black relative">
                        <video
                          src={status.content}
                          className="w-full h-full object-contain max-h-[80vh] md:max-h-full"
                          autoPlay
                          playsInline
                          loop
                          muted={storyMuted}
                        />
                        {status.bgGradient && (
                          <div className="absolute bottom-16 inset-x-0 text-center p-4 bg-gradient-to-t from-black/80 to-transparent pt-8">
                            <p className="text-sm font-bold text-white max-w-sm mx-auto line-clamp-3">
                              {status.bgGradient}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return null;
                })()}
              </div>

              {/* Bottom indicators: Caption or Quick view status details */}
              <div className="p-4 py-6 bg-gradient-to-t from-black/80 to-transparent text-center flex-shrink-0 z-20 flex flex-col items-center justify-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                  Tap left or right to toggle updates
                </span>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
