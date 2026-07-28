import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, MessageCircle, User, LogOut, Search, Heart, Compass, Bell, X, MessageSquare, CircleDot } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { auth, db } from '../../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { cn } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../../hooks/useNotifications';

interface SimulatedNotification {
  id: string;
  title: string;
  message: string;
  matchId: string;
}

export default function Layout() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeNotification, setActiveNotification] = useState<SimulatedNotification | null>(null);

  // Subscribe to live notifications persistently at Layout level instead of tear-down and setup on every route migration
  useNotifications();

  useEffect(() => {
    // Listen for custom incoming app notification events
    const handleNotification = (e: Event) => {
      const customEvent = e as CustomEvent<SimulatedNotification>;
      const notif = customEvent.detail;
      
      // Do not display if we are already in the chat room of the sender!
      const currentChatPath = `/chat/${notif.matchId}`;
      if (location.pathname === currentChatPath) {
        // Quietly mark as read instantly since the user is in the chat
        if (user) {
          updateDoc(doc(db, `users/${user.uid}/notifications`, notif.id), { read: true })
            .catch(() => {});
        }
        return;
      }

      // Defer state update to next event loop iteration to fully decouple and prevent React render conflicts
      setTimeout(() => {
        setActiveNotification(notif);
      }, 0);

      // Auto-dismiss after 6 seconds
      setTimeout(() => {
        setActiveNotification(prev => prev?.id === notif.id ? null : prev);
      }, 6000);
    };

    // Listen for clicks on background native OS notification to handle redirection
    const handleNotificationClick = (e: Event) => {
      const customEvent = e as CustomEvent<SimulatedNotification>;
      const notif = customEvent.detail;
      navigate(`/chat/${notif.matchId}`);
    };

    window.addEventListener('app-notification', handleNotification);
    window.addEventListener('app-notification-click', handleNotificationClick);

    return () => {
      window.removeEventListener('app-notification', handleNotification);
      window.removeEventListener('app-notification-click', handleNotificationClick);
    };
  }, [location.pathname, user, navigate]);

  const handleNotificationTap = () => {
    if (!activeNotification) return;
    
    // Mark as read in Firestore
    if (user && !activeNotification.id.startsWith('mock-')) {
      updateDoc(doc(db, `users/${user.uid}/notifications`, activeNotification.id), { read: true })
        .catch(err => console.error("Could not mark active notification read:", err));
    }

    const roomId = activeNotification.matchId;
    setActiveNotification(null);
    navigate(`/chat/${roomId}`);
  };

  const handleNotificationDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeNotification && user && !activeNotification.id.startsWith('mock-')) {
      updateDoc(doc(db, `users/${user.uid}/notifications`, activeNotification.id), { read: true })
        .catch(() => {});
    }
    setActiveNotification(null);
  };

  const handleLogout = async () => {
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          lastActive: new Date(0)
        });
      } catch (err) {
        console.error('Failed to set offline status on logout:', err);
      }
    }
    await auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { icon: Compass, label: 'Explore', path: '/' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: CircleDot, label: 'Status', path: '/status' },
    { icon: MessageCircle, label: 'Chats', path: '/chats' },
    { icon: Heart, label: 'Likes', path: '/likes' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const isChatRoute = location.pathname.startsWith('/chats') || location.pathname.startsWith('/chat');

  if (!user || !profile) return <Outlet />;

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row font-sans bg-[#fbfbfd] text-slate-900 overflow-hidden">
      {/* Premium iOS / Android Push Notification Banner Simulator */}
      <AnimatePresence>
        {activeNotification && (
          <motion.div
            initial={{ y: -120, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1, transition: { type: 'spring', damping: 15, stiffness: 120 } }}
            exit={{ y: -100, opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            id="simulated-phone-push"
            onClick={handleNotificationTap}
            className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[9999] cursor-pointer"
          >
            <div className="relative overflow-hidden rounded-[2rem] bg-slate-900/95 text-white shadow-2xl border border-slate-800/80 backdrop-blur-xl p-4 flex flex-col gap-2 hover:bg-slate-900 transition-colors">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-gradient-to-tr from-pink-500 to-rose-400 rounded-lg flex items-center justify-center shadow-md">
                    <Heart size={12} fill="white" className="text-white" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">MEETORA CONNECT • NOW</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Mobile Sync</span>
                  <button 
                    onClick={handleNotificationDismiss}
                    className="p-1 text-slate-500 hover:text-white transition-colors ml-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-start gap-3 pt-1">
                <div className="w-11 h-11 bg-pink-500/10 rounded-2xl flex items-center justify-center flex-shrink-0 border border-slate-800/80">
                  <MessageSquare size={20} className="text-pink-400 animate-bounce" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold truncate text-white">{activeNotification.title}</h4>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-2 font-medium leading-relaxed">
                    {activeNotification.message}
                  </p>
                </div>
              </div>
              <div className="mt-1 pt-1 border-t border-slate-900/60 flex justify-end gap-2">
                <span className="text-[9px] font-bold text-pink-400 uppercase tracking-widest">Tap to reply →</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Left navigation bar rail / sidebar */}
      <aside className="hidden md:flex flex-col w-[76px] bg-slate-950 text-white h-full justify-between items-center py-6 px-1 border-r border-slate-900/40 z-30 flex-shrink-0">
        <div className="flex flex-col items-center gap-8 w-full">
          {/* Top client avatar & identity */}
          <Link to="/" className="relative group flex items-center justify-center">
            <div className="w-11 h-11 bg-slate-900 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-center text-pink-500 group-hover:scale-110 transition-transform">
              <Heart size={20} fill="currentColor" />
            </div>
          </Link>

          {/* Center application tabs links */}
          <nav className="flex flex-col gap-5 w-full items-center">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path === '/chats' && location.pathname.startsWith('/chat/'));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center transition-all group relative",
                    isActive
                      ? "bg-pink-500 text-white shadow-lg shadow-pink-500/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-900/80"
                  )}
                  title={item.label}
                >
                  <item.icon size={20} />
                  {/* Tooltip detail style */}
                  <div className="absolute left-[88px] top-1/2 -translate-y-1/2 bg-slate-900 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl border border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-xl z-50">
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom actions list */}
        <div className="flex flex-col items-center gap-5 w-full">
          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-pink-400/80 relative" title="Active user profile node">
            <img src={profile.profilePicture} className="w-full h-full object-cover" alt="User profile" referrerPolicy="no-referrer" />
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-white animate-pulse" />
          </div>
          <button
            onClick={handleLogout}
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
            title="Log out connection session"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-rose-100/50 px-5 py-3.5 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-tr from-pink-500 to-rose-400 rounded-xl flex items-center justify-center text-white shadow-md shadow-pink-100">
            <Heart size={16} fill="white" />
          </div>
          <span className="text-sm font-black tracking-tight uppercase">
            Meetora <span className="text-pink-500 font-extrabold">connect</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-pink-100">
            <img src={profile.profilePicture} className="w-full h-full object-cover" alt="Profile" referrerPolicy="no-referrer" />
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Core Main Outlet section container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {isChatRoute ? (
          <main className="flex-1 h-full overflow-hidden">
            <Outlet />
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
            <div className="max-w-6xl mx-auto w-full pb-20 md:pb-4">
              <Outlet />
            </div>
          </main>
        )}
      </div>

      {/* Mobile Bottom Navigation menu bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center h-16 px-2 z-40">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path === '/chats' && location.pathname.startsWith('/chat/'));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all relative",
                isActive ? "text-pink-500 font-bold" : "text-slate-400"
              )}
            >
              <item.icon size={20} />
              <span className="text-[9px] font-black uppercase tracking-widest scale-90">{item.label}</span>
              {isActive && (
                <motion.div 
                  layoutId="activeTabIndicator" 
                  className="absolute bottom-0 w-8 h-[3px] bg-pink-500 rounded-full" 
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
