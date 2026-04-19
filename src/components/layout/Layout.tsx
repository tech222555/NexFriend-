import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, MessageCircle, User, LogOut, Search } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../services/firebase';
import { cn } from '../../utils';

export default function Layout() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { icon: Search, label: 'Discover', path: '/' },
    { icon: MessageCircle, label: 'Chats', path: '/chats' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 gradient-pink rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform">
              <span className="text-xl font-bold">N</span>
            </div>
            <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-purple-600 hidden sm:block">
              NexFriend
            </span>
          </Link>

          {user && profile && (
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2",
                      location.pathname === item.path
                        ? "bg-pink-50 text-pink-600"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <item.icon size={18} />
                    {item.label}
                  </Link>
                ))}
              </nav>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-footer text-gray-400 py-12 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div>
            <h3 className="text-white font-bold text-lg mb-4">NexFriend</h3>
            <p className="text-sm leading-relaxed">
              Connecting the world, one friendship at a time. Join our global community and find your next best friend.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="text-white font-semibold mb-2">Quick Links</h4>
            <Link to="/" className="hover:text-pink-400 text-sm">Discover</Link>
            <Link to="/chats" className="hover:text-pink-400 text-sm">Chats</Link>
            <Link to="/profile" className="hover:text-pink-400 text-sm">Profile</Link>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-2">Developer Credit</h4>
            <p className="text-sm">Developed by Abdallah Ikadullah</p>
            <p className="text-sm">Tamale, Ghana</p>
            <p className="text-sm mt-2 opacity-50">Tech Wizard Creations ©2026</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-gray-800 text-center text-xs">
          © 2026 NexFriend Platform. All rights reserved.
        </div>
      </footer>

      {/* Mobile Bottom Nav */}
      {user && profile && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center h-16 px-4 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full",
                location.pathname === item.path ? "text-pink-600" : "text-gray-400"
              )}
            >
              <item.icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
