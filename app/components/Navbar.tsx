'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faUser, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  profile_picture_url?: string;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Fetch user profile data
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        setUser({
          id: session.user.id,
          email: session.user.email || '',
          name: profile?.name || 'User',
          profile_picture_url: profile?.profile_picture_url,
        });
      }
    };
    getUser();
  }, [supabase]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (href: string) => pathname === href;

  // Don't show navbar on login page
  if (pathname === '/login') {
    return null;
  }

  return (
    <nav className="bg-white shadow-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold text-blue-600">💊 MathirAI</h1>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/dashboard"
              className={`transition-colors ${
                isActive('/dashboard')
                  ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                  : 'text-gray-700 hover:text-blue-600'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/digital-cabinet"
              className={`transition-colors ${
                isActive('/digital-cabinet')
                  ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                  : 'text-gray-700 hover:text-blue-600'
              }`}
            >
              Digital Cabinet
            </Link>
          </div>

          {/* Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 focus:outline-none group"
            >
              {user?.profile_picture_url ? (
                <img
                  src={user.profile_picture_url}
                  alt={user.name || 'Profile'}
                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-300 group-hover:border-blue-600 transition-colors"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <span className="text-gray-700 text-sm font-medium hidden sm:inline">
                {user?.name || 'Profile'}
              </span>
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`w-4 h-4 text-gray-600 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-t-lg transition-colors text-sm font-medium"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <FontAwesomeIcon icon={faUser} className="w-4 h-4" />
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-b-lg transition-colors text-sm font-medium border-t border-gray-100"
                >
                  <FontAwesomeIcon icon={faSignOutAlt} className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Nav Links */}
        <div className="md:hidden flex gap-4 pb-4 border-t border-gray-200 mt-4 pt-4">
          <Link
            href="/dashboard"
            className={`transition-colors text-sm ${
              isActive('/dashboard')
                ? 'text-blue-600 font-semibold'
                : 'text-gray-700 hover:text-blue-600'
            }`}
            onClick={() => setIsDropdownOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            href="/digital-cabinet"
            className={`transition-colors text-sm ${
              isActive('/digital-cabinet')
                ? 'text-blue-600 font-semibold'
                : 'text-gray-700 hover:text-blue-600'
            }`}
            onClick={() => setIsDropdownOpen(false)}
          >
            Digital Cabinet
          </Link>
        </div>
      </div>
    </nav>
  );
}
