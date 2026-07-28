import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { User, MapPin, Award, Heart, Edit2, Check, X, Camera, Globe, Upload, Bell, Smartphone, Sparkles, Volume2, ShieldCheck, Zap, Mail, Send, CheckCircle, RefreshCw, Trash2, ExternalLink, Inbox } from 'lucide-react';
import { cn } from '../../utils';
import { fileToBase64, resizeImage } from '../../utils/image';
import { playNotificationSound } from '../../hooks/useNotifications';

export default function Profile() {
  const { profile, setProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(profile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // States for the Notification Simulator Laboratory
  const [permission, setPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'not-supported'
  );
  const [countdown, setCountdown] = useState<number | null>(null);

  // States for Offline Email Sync Logs
  const [emails, setEmails] = useState<any[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  const fetchEmailLogs = async () => {
    try {
      const res = await fetch('/api/emails');
      if (res.ok) {
        const data = await res.json();
        setEmails(data);
      }
    } catch (err) {
      console.error('Failed to fetch email logs:', err);
    }
  };

  const clearEmailLogs = async () => {
    try {
      const res = await fetch('/api/emails/clear', { method: 'POST' });
      if (res.ok) {
        setEmails([]);
      }
    } catch (err) {
      console.error('Failed to clear emails:', err);
    }
  };

  React.useEffect(() => {
    fetchEmailLogs();
    const interval = setInterval(fetchEmailLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  // Keep editData in sync with profile updates from server
  React.useEffect(() => {
    if (!isEditing) {
      setEditData(profile);
    }
  }, [profile, isEditing]);

  if (!profile) return null;

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const res = await Notification.requestPermission();
      setPermission(res);
    } catch (err) {
      console.warn('Failed to request notification permission:', err);
    }
  };

  const triggerTestSimulation = () => {
    // Play synthetic chord bell chime
    playNotificationSound();

    // Dispatch custom notification event
    window.dispatchEvent(new CustomEvent('app-notification', {
      detail: {
        id: 'mock-test-' + Math.random(),
        matchId: 'test-room',
        title: 'Sarah Connor 🛰️',
        message: 'Hey! Just saw your operational interests on Meetora. Let’s sync up soon! 🌸'
      }
    }));
  };

  const triggerBackgroundTest = () => {
    if (countdown !== null) return;
    
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          
          // 1. Play synthetic bell chime
          playNotificationSound();

          // 2. Build real native OS browser background notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('Jamie (Operational Match)', {
                body: 'Incoming match connection alert! Tap here to respond on Meetora.',
                icon: '/vite.svg',
                tag: 'match-simulation'
              });
            } catch (err) {
              console.warn('Native notification blocked or rejected in this environment context:', err);
            }
          }

          // 3. Keep fallback inline simulation active
          window.dispatchEvent(new CustomEvent('app-notification', {
            detail: {
              id: 'mock-bg-' + Math.random(),
              matchId: 'test-room',
              title: 'Jamie (Operational Match)',
              message: 'Incoming match connection alert! Tap here to respond on Meetora.'
            }
          }));

          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // State for sending test emails
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<'success' | 'error' | null>(null);

  const triggerTestEmail = async () => {
    if (!profile || !profile.email) return;
    setSendingTestEmail(true);
    setTestEmailStatus(null);
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: profile.email,
          recipientName: profile.fullName,
          title: 'Direct SMTP Testing Connection 📡',
          message: 'This is a high-fidelity background sync test email. If you receive this, your offline notification routing pipeline is fully operational!'
        })
      });
      if (res.ok) {
        setTestEmailStatus('success');
        fetchEmailLogs();
        // Clear success toast after a few seconds
        setTimeout(() => setTestEmailStatus(null), 5000);
      } else {
        setTestEmailStatus('error');
      }
    } catch (err) {
      console.error('Test email sending failed:', err);
      setTestEmailStatus('error');
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleSave = async () => {
    if (!editData) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), { ...editData });
      setProfile(editData);
      setIsEditing(false);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const base64 = await fileToBase64(file);
      const resized = await resizeImage(base64);
      
      // Instantly update on server if not in editing mode, or just update local state if in editing mode
      if (!isEditing) {
        await updateDoc(doc(db, 'users', profile.uid), { profilePicture: resized });
        setProfile({ ...profile, profilePicture: resized });
      } else {
        setEditData(prev => prev ? ({ ...prev, profilePicture: resized }) : null);
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      setError('Failed to process image. Please try another one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-100/80 rounded-2xl text-rose-650 text-xs font-bold flex justify-between items-center">
          <span>{error}</span>
          <button 
            type="button"
            onClick={() => setError(null)} 
            className="text-rose-500 hover:text-rose-700 font-extrabold uppercase tracking-widest text-[9px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Profile Section */}
      <div className="relative mb-20">
        <div className="h-64 w-full gradient-pink rounded-[3rem] shadow-xl overflow-hidden relative">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute bottom-10 left-10 flex items-center gap-6">
            <div className="relative group">
              <img 
                src={isEditing ? editData?.profilePicture : profile.profilePicture} 
                className={cn(
                  "w-32 h-32 rounded-full border-4 border-white shadow-2xl object-cover transition-all",
                  loading && "opacity-50 grayscale"
                )} 
                alt="Profile"
                referrerPolicy="no-referrer"
              />
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {loading ? (
                  <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Camera size={24} />
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </>
                )}
              </label>
              {!isEditing && (
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                </div>
              )}
            </div>
            <div className="text-white">
              <h1 className="text-4xl font-black italic tracking-tight leading-none">{profile.fullName}</h1>
              <p className="font-bold opacity-80 flex items-center gap-2 mt-1 uppercase text-xs tracking-widest">
                @{profile.username} • {profile.age} years old
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={loading}
          className={cn(
            "absolute -bottom-6 right-10 px-8 py-4 rounded-2xl shadow-xl font-bold flex items-center gap-2 transition-all active:scale-95",
            isEditing 
              ? "bg-green-500 text-white hover:bg-green-600 shadow-green-100" 
              : "bg-white text-pink-500 hover:bg-slate-50 shadow-slate-200/50 hover:text-pink-600"
          )}
        >
          {loading ? (
             <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isEditing ? (
            <><Check size={20} /> Save Changes</>
          ) : (
            <><Edit2 size={20} /> Edit Profile</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Details */}
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">PERSONAL INFO</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-600">
                <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                  <User size={16} />
                </div>
                <span className="text-sm font-bold">{profile.gender}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                  <MapPin size={16} />
                </div>
                <span className="text-sm font-bold">{profile.city}, {profile.country}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                  <Globe size={16} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-pink-500">Live Member</span>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">SYNC BADGES</h3>
            <div className="flex flex-wrap gap-2">
              {profile.badges.map(badge => (
                <div key={badge} className="px-3 py-1.5 bg-pink-50 text-pink-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 border border-pink-100">
                  <Award size={12} />
                  {badge}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Bio & Interests */}
        <div className="md:col-span-2 space-y-6">
           <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">MEMBER DOSSIER</h3>
            {isEditing ? (
              <textarea
                className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:ring-2 focus:ring-pink-100 resize-none h-32 font-medium text-sm transition-all"
                value={editData?.bio}
                onChange={e => setEditData(prev => prev ? ({ ...prev, bio: e.target.value }) : null)}
              />
            ) : (
              <p className="text-slate-600 leading-relaxed italic text-lg">
                "{profile.bio || "No dossier data yet... help people find you!"}"
              </p>
            )}
          </section>

          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">OPERATIONAL INTERESTS</h3>
            <div className="flex flex-wrap gap-3">
              {profile.interests.map(interest => (
                <div key={interest} className="px-5 py-2.5 bg-slate-50 text-slate-600 rounded-2xl text-sm font-bold flex items-center gap-2 border border-slate-50 hover:border-pink-200 transition-all cursor-default">
                  <Heart size={14} className="text-pink-400 group-hover:scale-110" />
                  {interest}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Premium Glassmorphic Mobile Sync & Notification Lab */}
      <section className="mt-12 overflow-hidden rounded-[2.5rem] bg-slate-950 p-8 text-white shadow-2xl border border-slate-800 relative group">
        <div className="absolute top-0 right-0 p-8 text-pink-500/10 pointer-events-none group-hover:scale-110 transition-transform duration-500">
          <Smartphone size={240} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-pink-500/10 text-pink-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-pink-500/20 mb-3">
              <Sparkles size={12} className="animate-pulse" />
              Sync Laboratory
            </div>
            <h2 className="text-3xl font-black italic tracking-tighter text-white">MOBILE PUSH SYNC SIMULATOR</h2>
            <p className="text-slate-400 text-xs mt-1 max-w-xl font-medium leading-relaxed">
              Experience dynamic, multi-channel system notifications. Test how incoming sync messages alert you on your desktop or phone even when you are browsing other tabs or have closed the window.
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">DEVICE CHANNEL:</span>
            <div className="px-3.5 py-1.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-2 text-xs font-bold">
              <div className={cn(
                "w-2 h-2 rounded-full animate-ping", 
                permission === 'granted' ? "bg-green-500" : permission === 'denied' ? "bg-red-500" : "bg-amber-500"
              )} />
              <span className="uppercase text-[10px] tracking-wider text-slate-300">
                {permission === 'granted' ? 'Native Push Active' : permission === 'denied' ? 'Native Push Blocked' : 'Simulated Sandbox'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 relative z-10">
          {/* Left Block: Device Actions */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-pink-500" />
              SYSTEM PERMISSIONS
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              Meetora uses smart system protocols to deliver real-time background syncs. Click below to authorize your browser to show real operational notifications directly in your operating system's action center.
            </p>
            {permission === 'granted' ? (
              <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl flex items-center gap-3">
                <Volume2 size={20} className="flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-bold">SYSTEM PUSH COMMITTED</p>
                  <p className="text-[10px] opacity-80 mt-0.5">Authorization complete. Notifications will pop up as native alerts with double bell chimes!</p>
                </div>
              </div>
            ) : (
              <button
                onClick={handleRequestPermission}
                className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-pink-500/15 transition-all active:scale-98"
              >
                Request Native Notification Access
              </button>
            )}
            <p className="text-[9px] text-slate-500 italic">
              Note: If running inside sandboxed frames, falling back gracefully to gorgeous full-screen simulated push banners is automatically enabled.
            </p>
          </div>

          {/* Right Block: Simulation workbench */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Zap size={14} className="text-pink-500" />
              SIMULATION ENGINE
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Test native alert logic. Try background simulation to minimize the tab or turn off your device screen to see the notification pop up on your system!
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={triggerTestSimulation}
                className="py-3.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <Smartphone size={14} className="text-pink-400" />
                Test Inline Pop-up
              </button>

              <button
                disabled={countdown !== null}
                onClick={triggerBackgroundTest}
                className={cn(
                  "py-3.5 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 border",
                  countdown !== null
                    ? "bg-pink-500/20 text-pink-300 border-pink-500/30 cursor-not-allowed"
                    : "bg-pink-500 border-pink-500 text-white hover:bg-pink-600 hover:border-pink-600"
                )}
              >
                {countdown !== null ? (
                  <>
                    <Bell size={14} className="animate-spin" />
                    Lock screen in {countdown}s...
                  </>
                ) : (
                  <>
                    <Bell size={14} />
                    Test Background Sync
                  </>
                )}
              </button>
            </div>

            {countdown !== null && (
              <div className="p-3 bg-pink-500/10 border border-pink-500/20 rounded-xl text-center text-[10px] font-black tracking-wider text-pink-400 animate-pulse uppercase">
                ⏱️ Quick: Switch browser tabs or lock your phone screen now!
              </div>
            )}
          </div>
        </div>

        {/* Brand New: High-Fidelity Offline Email Sync Dashboard */}
        <div className="mt-10 pt-8 border-t border-slate-800 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/10 text-rose-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-500/20 mb-3 animate-pulse">
                <Mail size={12} />
                SMTP Router Active
              </div>
              <h2 className="text-2xl font-black italic tracking-tighter text-white">OFFLINE EMAIL SYNC TRANSMITTER</h2>
              <p className="text-slate-400 text-xs mt-1 max-w-2xl font-medium leading-relaxed">
                Meetora auto-routes all notifications directly to your email address <span className="text-rose-400 font-bold underline">{profile.email}</span> when you are offline or out of the app. Try triggering a status update, receiving a message, or matching to see it in action!
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={fetchEmailLogs}
                className="p-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-all"
                title="Refresh logs"
              >
                <RefreshCw size={14} className={loadingEmails ? "animate-spin" : ""} />
              </button>
              <button
                onClick={triggerTestEmail}
                disabled={sendingTestEmail}
                className={cn(
                  "flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                  sendingTestEmail
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/10"
                )}
              >
                <Send size={12} />
                {sendingTestEmail ? "Sending sync..." : "Trigger Test Email"}
              </button>
            </div>
          </div>

          {testEmailStatus === 'success' && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle size={14} />
              Test Email Delivered! Verification routing confirmed in our SMTP logs below.
            </div>
          )}

          {testEmailStatus === 'error' && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
              <X size={14} />
              SMTP Gateway error. Please check your network or server logs.
            </div>
          )}

          <div className="bg-slate-950/80 rounded-2xl border border-slate-900 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-900 mb-4">
              <div className="flex items-center gap-2">
                <Inbox size={16} className="text-slate-400" />
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">LIVE SMTP TRANSMISSION HISTORY</span>
                <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-md text-[9px] font-bold text-slate-400">
                  {emails.length} log{emails.length !== 1 ? 's' : ''}
                </span>
              </div>
              {emails.length > 0 && (
                <button
                  onClick={clearEmailLogs}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 size={12} />
                  Clear Logs
                </button>
              )}
            </div>

            {emails.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center justify-center">
                <Mail size={32} className="text-slate-700 mb-3 animate-bounce" />
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">No SMTP deliveries logged yet</p>
                <p className="text-[11px] text-slate-600 mt-1 max-w-sm">
                  Click the "Trigger Test Email" button above or trigger a live background action (like posting a status) to test the offline notification pipeline.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    className="p-4 bg-slate-900/50 rounded-xl border border-slate-900 hover:border-slate-800 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-950">
                      <div className="flex items-center gap-2">
                        {email.success ? (
                          <span className="px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md text-[9px] font-black uppercase tracking-wider">
                            Delivered
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-[9px] font-black uppercase tracking-wider">
                            Failed
                          </span>
                        )}
                        <span className="text-[10px] font-black text-slate-400">
                          To: <span className="text-rose-400 font-medium">{email.to}</span> ({email.recipientName})
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500">
                        {new Date(email.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="py-3">
                      <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        {email.title}
                      </h4>
                      <p className="text-slate-400 text-xs mt-1.5 pl-3 border-l-2 border-slate-800 italic">
                        {email.message}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-950/50 justify-between">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                        SMTP server: <span className="text-slate-400 font-normal">smtp.ethereal.email (Virtual)</span>
                      </span>
                      <div className="flex gap-2">
                        {email.previewUrl && (
                          <a
                            href={email.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest transition-colors"
                          >
                            <ExternalLink size={10} />
                            View HTML Output
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
