'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faBell, faBellSlash, faCapsules, faChevronDown, faHouse, faSyringe, faUser, faSignOutAlt, faXmark } from '@fortawesome/free-solid-svg-icons';
import { checkNotificationStatus, subscribeToPushNotifications, unsubscribeFromPushNotifications } from '../utils/pushNotifications';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  profile_picture_url?: string;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        try {
          // Fetch user profile data from API
          const response = await fetch('/api/profile');
          if (response.ok) {
            const profile = await response.json();

            setUser({
              id: session.user.id,
              email: session.user.email || '',
              name: profile?.name || 'User',
              profile_picture_url: profile?.profile_picture_url,
            });
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: 'User',
            profile_picture_url: undefined,
          });
        }
      }
    };
    getUser();
  }, [supabase]);

  useEffect(() => {
    const loadNotificationStatus = async () => {
      try {
        const status = await checkNotificationStatus();
        setNotificationsEnabled(status.subscribed);
      } catch (error) {
        console.error('Error checking notification status:', error);
      }
    };

    loadNotificationStatus();
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
  }, [pathname]);

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

  const handleMobileNavClose = () => {
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
  };

  const handleToggleNotifications = async () => {
    setNotificationLoading(true);
    try {
      if (notificationsEnabled) {
        await unsubscribeFromPushNotifications();
        setNotificationsEnabled(false);
      } else {
        await subscribeToPushNotifications();
        setNotificationsEnabled(true);
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to toggle notifications: ${errorMessage}\n\nCheck the browser console for details.`);
    } finally {
      setNotificationLoading(false);
    }
  };

  const isActive = (href: string) => pathname === href;
  const notificationLabel = notificationsEnabled ? 'Disable notifications' : 'Enable notifications';
  const navToggleLabel = 'Toggle navigation';

  // Don't show navbar on login page
  if (pathname === '/login') {
    return null;
  }

  return (
    <nav className="bg-white shadow-md border-b border-rosy-granite/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label={navToggleLabel}
              data-tooltip-id="app-tooltip"
              data-tooltip-content={navToggleLabel}
              aria-controls="mobile-nav"
              aria-expanded={isMobileMenuOpen}
              className="md:hidden h-10 w-10 rounded-full border border-rosy-granite/40 flex items-center justify-center text-charcoal-blue transition-colors hover:border-charcoal-blue hover:text-charcoal-blue"
            >
              <FontAwesomeIcon icon={isMobileMenuOpen ? faXmark : faBars} className="fa-1x" />
            </button>

            {/* Logo/Brand */}
            <div className="flex-shrink-0">
              <Link
                href="/dashboard">
                <h1 className="text-2xl font-bold text-[#1794f1] flex items-center gap-2">
                  <img src="/medicine-logo.svg" alt="MathirAI" className="w-6 h-6" />
                  MathirAI
                </h1>
              </Link>
            </div>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/dashboard"
              className={`transition-colors flex items-center gap-2 ${
                isActive('/dashboard')
                  ? 'text-charcoal-blue border-b-2 border-charcoal-blue pb-1'
                  : 'text-charcoal-blue hover:text-charcoal-blue'
              }`}
            >
              <FontAwesomeIcon icon={faHouse} className="fa-1x" />
              Dashboard
            </Link>
            <Link
              href="/digital-pharmacy"
              className={`transition-colors flex items-center gap-2 ${
                isActive('/digital-pharmacy')
                  ? 'text-charcoal-blue border-b-2 border-charcoal-blue pb-1'
                  : 'text-charcoal-blue hover:text-charcoal-blue'
              }`}
            >
              <FontAwesomeIcon icon={faCapsules} className="fa-1x" />
              Digital Pharmacy
            </Link>
            <Link
              href="/medication"
              className={`transition-colors flex items-center gap-2 ${
                isActive('/medication')
                  ? 'text-charcoal-blue border-b-2 border-charcoal-blue pb-1'
                  : 'text-charcoal-blue hover:text-charcoal-blue'
              }`}
            >
              <FontAwesomeIcon icon={faSyringe} className="fa-1x" />
              Medication
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleNotifications}
              disabled={notificationLoading}
              aria-label={notificationLabel}
              data-tooltip-id="app-tooltip"
              data-tooltip-content={notificationLabel}
              className={`h-10 w-10 rounded-full border border-rosy-granite/40 flex items-center justify-center text-charcoal-blue transition-colors hover:border-charcoal-blue hover:text-charcoal-blue disabled:opacity-50 disabled:cursor-not-allowed ${
                notificationsEnabled ? 'bg-green-50' : 'bg-white'
              }`}
            >
              <FontAwesomeIcon icon={notificationsEnabled ? faBell : faBellSlash} className="fa-1x" />
            </button>

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
                    className="w-10 h-10 rounded-full object-cover border-2 border-dim-grey/40 group-hover:border-charcoal-blue transition-colors"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-charcoal-blue flex items-center justify-center text-white font-bold">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <span className="text-charcoal-blue text-sm font-medium hidden sm:inline">
                  {user?.name || 'Profile'}
                </span>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={`w-4 h-4 text-blue-slate transition-transform fa-1x ${isDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-rosy-granite/30 z-50">
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-4 py-2 text-charcoal-blue hover:bg-blue-slate/10 hover:text-charcoal-blue rounded-t-lg transition-colors text-sm font-medium"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <FontAwesomeIcon icon={faUser} className="w-4 h-4 fa-1x" />
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-charcoal-blue hover:bg-red-50 hover:text-red-600 rounded-b-lg transition-colors text-sm font-medium border-t border-rosy-granite/20"
                  >
                    <FontAwesomeIcon icon={faSignOutAlt} className="w-4 h-4 fa-1x" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Nav Links */}
        {isMobileMenuOpen && (
          <div id="mobile-nav" className="md:hidden flex flex-col gap-3 pb-4 border-t border-rosy-granite/30 mt-4 pt-4">
            <Link
              href="/dashboard"
              className={`transition-colors text-sm flex items-center gap-2 ${
                isActive('/dashboard')
                  ? 'text-charcoal-blue font-semibold'
                  : 'text-charcoal-blue hover:text-charcoal-blue'
              }`}
              onClick={handleMobileNavClose}
            >
              <FontAwesomeIcon icon={faHouse} className="fa-1x" />
              Dashboard
            </Link>
            <Link
              href="/digital-pharmacy"
              className={`transition-colors text-sm flex items-center gap-2 ${
                isActive('/digital-pharmacy')
                  ? 'text-charcoal-blue font-semibold'
                  : 'text-charcoal-blue hover:text-charcoal-blue'
              }`}
              onClick={handleMobileNavClose}
            >
              <FontAwesomeIcon icon={faCapsules} className="fa-1x" />
              Digital Pharmacy
            </Link>
            <Link
              href="/medication"
              className={`transition-colors text-sm flex items-center gap-2 ${
                isActive('/medication')
                  ? 'text-charcoal-blue font-semibold'
                  : 'text-charcoal-blue hover:text-charcoal-blue'
              }`}
              onClick={handleMobileNavClose}
            >
              <FontAwesomeIcon icon={faSyringe} className="fa-1x" />
              Medication
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
