import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { UserProfile, Gender } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, User, Hash, Globe, Heart, Camera, Check, Upload } from 'lucide-react';
import { cn } from '../../utils';
import { fileToBase64, resizeImage } from '../../utils/image';

const INTEREST_OPTIONS = [
  'Music', 'Coding', 'Sports', 'Gaming', 'Movies', 'Travel', 'Art', 'Cooking', 'Tech', 'Fitness', 'Reading', 'Photography'
];

export default function OnboardingFlow() {
  const { user, profile, setProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // Prevent users who already have a profile from accessing onboarding
  React.useEffect(() => {
    if (profile) {
      navigate('/');
    }
  }, [profile, navigate]);

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    gender: 'Other' as Gender,
    age: 18,
    country: '',
    city: '',
    interests: [] as string[],
    profilePicture: `https://picsum.photos/seed/${user?.uid || 'user'}/200`,
    bio: '',
    preferences: {
      gender: 'All' as const,
      ageRange: [18, 50] as [number, number]
    }
  });

  const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    if (!user) return;
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      ...formData,
      badges: ['New Explorer'],
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'users', user.uid), profile);
      setProfile(profile);
      navigate('/');
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Failed to save profile. Please try again.');
    }
  };

  const toggleInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      const resized = await resizeImage(base64);
      setFormData(prev => ({ ...prev, profilePicture: resized }));
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Failed to process image. Please try another one.');
    }
  };

  return (
    <div className="max-w-xl mx-auto py-10">
      <div className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Let's set up your profile</h2>
          <span className="text-sm font-medium text-gray-400">Step {step} of {totalSteps}</span>
        </div>
        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
          <motion.div 
            className="h-full gradient-pink"
            initial={{ width: '0%' }}
            animate={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100"
        >
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="relative inline-block group">
                  <img src={formData.profilePicture} className="w-24 h-24 rounded-full border-4 border-pink-100 object-cover shadow-sm" alt="Profile" />
                  <label className="absolute bottom-0 right-0 p-2 gradient-pink text-white rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform active:scale-90">
                    <Camera size={14} />
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                  <div className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center pointer-events-none transition-opacity">
                    <Upload size={20} className="text-white" />
                  </div>
                </div>
                <h3 className="mt-4 font-bold text-gray-900">Choose your photo</h3>
                <p className="text-xs text-gray-400 mt-1">Tap the camera to upload a real photo</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={e => setFormData({...formData, fullName: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:bg-white"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:bg-white"
                      placeholder="johndoe123"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={e => setFormData({...formData, gender: e.target.value as Gender})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                  <input
                    type="number"
                    min="13"
                    value={formData.age}
                    onChange={e => setFormData({...formData, age: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={formData.country}
                      onChange={e => setFormData({...formData, country: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500"
                      placeholder="e.g. USA"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={formData.city}
                      onChange={e => setFormData({...formData, city: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500"
                      placeholder="e.g. New York"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <label className="block text-sm font-medium text-gray-700">What are you interested in? (Pick 3+)</label>
              <div className="grid grid-cols-3 gap-2">
                {INTEREST_OPTIONS.map(interest => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1",
                      formData.interests.includes(interest)
                        ? "bg-pink-500 border-pink-500 text-white"
                        : "bg-gray-50 border-gray-100 text-gray-600 hover:border-pink-300"
                    )}
                  >
                    {formData.interests.includes(interest) && <Check size={12} />}
                    {interest}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                <textarea
                  rows={4}
                  value={formData.bio}
                  onChange={e => setFormData({...formData, bio: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                  placeholder="Tell potential friends about yourself..."
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center text-pink-500 mx-auto">
                  <Heart size={40} className="animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Matching Preferences</h3>
                <p className="text-sm text-gray-500 italic">We'll use these to find your perfect matches</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">I want to meet</label>
                  <select
                    value={formData.preferences.gender}
                    onChange={e => setFormData({...formData, preferences: {...formData.preferences, gender: e.target.value as any}})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                  >
                    <option value="All">Anyone</option>
                    <option value="Male">Men</option>
                    <option value="Female">Women</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="pt-4 border-t border-gray-50 text-center">
                  <p className="text-xs text-gray-400">By completing this flow, you agree to our terms and safety community guidelines.</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4 mt-10">
            {step > 1 && (
              <button
                onClick={prevStep}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
            )}
            {step < totalSteps ? (
              <button
                onClick={nextStep}
                disabled={step === 1 && (!formData.fullName || !formData.username)}
                className="flex-1 py-3 px-4 gradient-pink text-white rounded-xl font-semibold shadow-lg hover:shadow-pink-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 px-4 bg-pink-600 text-white rounded-xl font-semibold shadow-xl hover:bg-pink-700 active:scale-95 transition-all"
              >
                Complete Profile
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
