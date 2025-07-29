import React from 'react';
import { Link } from 'react-router-dom';
import { Mic, User, LogOut, Menu, X, Crown, Brain } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface HeaderProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ isOpen, setIsOpen }) => {
  const { user, signOut } = useAuthStore();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <Mic className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">LiveTranslate</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-blue-600 transition-colors">
              Home
            </Link>
            <Link to="/live-translation" className="text-gray-700 hover:text-blue-600 transition-colors">
              Live Translation
            </Link>
            <Link to="/upload" className="text-gray-700 hover:text-blue-600 transition-colors">
              Upload
            </Link>
            <Link to="/history" className="text-gray-700 hover:text-blue-600 transition-colors">
              History
            </Link>
            <Link to="/summary" className="text-gray-700 hover:text-blue-600 transition-colors">
              <div className="flex items-center space-x-1">
                <Brain className="h-4 w-4" />
                <span>Summary</span>
              </div>
            </Link>
            <Link to="/subscription" className="text-gray-700 hover:text-blue-600 transition-colors">
              <div className="flex items-center space-x-1">
                <Crown className="h-4 w-4" />
                <span>Plans</span>
              </div>
            </Link>
            {user && (
              <Link to="/profile" className="text-gray-700 hover:text-blue-600 transition-colors">
                Profile
              </Link>
            )}
          </nav>

          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">{user.email}</span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-2 text-gray-700 hover:text-red-600 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link to="/sign-in" className="btn-secondary">
                  Sign In
                </Link>
                <Link to="/sign-up" className="btn-primary">
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 transition-colors"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200">
            <Link
              to="/"
              className="block px-3 py-2 text-gray-700 hover:text-blue-600 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/live-translation"
              className="block px-3 py-2 text-gray-700 hover:text-blue-600 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Live Translation
            </Link>
            <Link
              to="/upload"
              className="block px-3 py-2 text-gray-700 hover:text-blue-600 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Upload
            </Link>
            <Link
              to="/history"
              className="block px-3 py-2 text-gray-700 hover:text-blue-600 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              History
            </Link>
            <Link
              to="/summary"
              className="block px-3 py-2 text-gray-700 hover:text-blue-600 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <div className="flex items-center space-x-2">
                <Brain className="h-4 w-4" />
                <span>Summary</span>
              </div>
            </Link>
            <Link
              to="/subscription"
              className="block px-3 py-2 text-gray-700 hover:text-blue-600 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <div className="flex items-center space-x-2">
                <Crown className="h-4 w-4" />
                <span>Plans</span>
              </div>
            </Link>
            {user && (
              <Link
                to="/profile"
                className="block px-3 py-2 text-gray-700 hover:text-blue-600 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Profile
              </Link>
            )}
            {user ? (
              <button
                onClick={() => {
                  handleSignOut();
                  setIsOpen(false);
                }}
                className="block w-full text-left px-3 py-2 text-gray-700 hover:text-red-600 transition-colors"
              >
                Sign Out
              </button>
            ) : (
              <div className="space-y-2 pt-2">
                <Link
                  to="/sign-in"
                  className="block px-3 py-2 text-gray-700 hover:text-blue-600 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  to="/sign-up"
                  className="block px-3 py-2 text-blue-600 hover:text-blue-700 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}; 