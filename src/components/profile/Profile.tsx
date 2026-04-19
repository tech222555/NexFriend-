import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { User, MapPin, Award, Heart, Edit2, Check, X, Camera, Globe, Upload } from 'lucide-react';
import { cn } from '../../utils';
import { fileToBase64, resizeImage } from '../../utils/image';

export default function Profile() {
  const { profile, setProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(profile);
  const [loading, setLoading] = useState(false);

  if (!profile) return null;

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
      alert('Failed to process image. Please try another one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
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
              <h1 className="text-4xl font-black italic tracking-tight">{profile.fullName}</h1>
              <p className="font-medium opacity-80 flex items-center gap-2">
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
              ? "bg-green-500 text-white hover:bg-green-600" 
              : "bg-white text-pink-600 hover:bg-gray-50"
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
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">PERSONAL INFO</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                  <User size={16} />
                </div>
                <span className="text-sm font-medium">{profile.gender}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                  <MapPin size={16} />
                </div>
                <span className="text-sm font-medium">{profile.city}, {profile.country}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                  <Globe size={16} />
                </div>
                <span className="text-sm font-medium">Global Citizen</span>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">BADGES</h3>
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
           <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">ABOUT ME</h3>
            {isEditing ? (
              <textarea
                className="w-full bg-gray-50 p-4 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-pink-500 resize-none h-32"
                value={editData?.bio}
                onChange={e => setEditData(prev => prev ? ({ ...prev, bio: e.target.value }) : null)}
              />
            ) : (
              <p className="text-gray-600 leading-relaxed italic">
                "{profile.bio || "No bio yet... help us know you better!"}"
              </p>
            )}
          </section>

          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">INTERESTS</h3>
            <div className="flex flex-wrap gap-3">
              {profile.interests.map(interest => (
                <div key={interest} className="px-5 py-2.5 bg-gray-50 text-gray-600 rounded-2xl text-sm font-semibold flex items-center gap-2 border border-gray-100 hover:border-pink-200 transition-colors cursor-default">
                  <Heart size={14} className="text-pink-400" />
                  {interest}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
