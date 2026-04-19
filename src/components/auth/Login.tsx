import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { LogIn, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 border border-gray-100"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 gradient-pink rounded-3xl flex items-center justify-center text-white mx-auto shadow-xl mb-6">
            <span className="text-4xl font-black italic">M</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Welcome Back</h1>
          <p className="text-gray-500 font-medium">Log in to your Meetora connect account</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 mb-8 text-sm font-medium">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 px-6 bg-white border-2 border-gray-100 text-gray-700 rounded-2xl font-bold shadow-sm hover:border-pink-200 hover:bg-pink-50/30 active:scale-95 transition-all flex items-center justify-center gap-4 group"
          >
            {loading ? (
              <div className="w-6 h-6 border-3 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6 group-hover:scale-110 transition-transform" alt="" />
                <span className="text-lg">Continue with Google</span>
              </>
            )}
          </button>
          
          <p className="text-center text-xs text-gray-400 font-medium pt-4">
            By continuing, you agree to our Terms and Service.
          </p>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-100 text-center">
          <p className="text-gray-500 font-medium">
            New to Meetora connect?{' '}
            <Link to="/signup" className="text-pink-600 font-bold hover:underline">
              Create Account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
