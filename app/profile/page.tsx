'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from 'react-toastify';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string;
  emergency_contact: string;
  medical_conditions: string;
  profile_picture_url?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    id: '',
    email: '',
    name: '',
    phone: '',
    emergency_contact: '',
    medical_conditions: '',
    profile_picture_url: '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      try {
        const response = await fetch('/api/profile');
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const existingProfile = await response.json();

        if (existingProfile && existingProfile.id) {
          setProfile({
            id: session.user.id,
            email: session.user.email || '',
            name: existingProfile.name || '',
            phone: existingProfile.phone || '',
            emergency_contact: existingProfile.emergency_contact || '',
            medical_conditions: existingProfile.medical_conditions || '',
            profile_picture_url: existingProfile.profile_picture_url || '',
          });
        } else {
          setProfile(prev => ({
            ...prev,
            id: session.user.id,
            email: session.user.email || '',
          }));
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }

      setLoading(false);
    };

    loadProfile();
  }, [supabase, router]);

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    setProfile(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('file', file);

      const data = await toast.promise(
        fetch('/api/profile/upload', {
          method: 'POST',
          body: formData,
        }).then(async (response) => {
          if (!response.ok) {
            throw new Error('Failed to upload profile picture');
          }
          return response.json();
        }),
        {
          pending: 'Uploading profile picture...',
          success: 'Profile picture updated successfully!'
        }
      );

      setProfile(prev => ({
        ...prev,
        profile_picture_url: data.profile_picture_url,
      }));

    } catch (err) {
      console.error('Error uploading profile picture:', err);
      toast.error('Failed to upload profile picture');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      await toast.promise(
        fetch('/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: profile.name,
            phone: profile.phone,
            emergency_contact: profile.emergency_contact,
            medical_conditions: profile.medical_conditions,
            profile_picture_url: profile.profile_picture_url,
          }),
        }).then((response) => {
          if (!response.ok) {
            throw new Error('Failed to save profile');
          }
          return response;
        }),
        {
          pending: 'Saving profile...',
          success: 'Profile saved successfully!'
        }
      );
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-rosy-granite/5 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-deep-space-blue mb-8">👤 Profile</h1>

          {/* Profile Picture Section */}
          <div className="mb-8 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-dim-grey/20 flex items-center justify-center mb-4 overflow-hidden border-4 border-blue-200">
              {profile.profile_picture_url ? (
                <img
                  src={profile.profile_picture_url}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl font-bold text-charcoal-blue">
                  {profile.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer bg-charcoal-blue hover:bg-deep-space-blue text-white px-4 py-2 rounded-lg transition-colors">
              <span>📷 Change Picture</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleProfilePictureChange}
                disabled={saving}
                className="hidden"
              />
            </label>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">Email</label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg bg-gray-100 text-blue-slate cursor-not-allowed"
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="Enter your phone number"
                className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
              />
            </div>

            {/* Emergency Contact */}
            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">
                Emergency Contact
              </label>
              <input
                type="text"
                value={profile.emergency_contact}
                onChange={(e) => handleInputChange('emergency_contact', e.target.value)}
                placeholder="Enter emergency contact name and phone"
                className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
              />
            </div>

            {/* Medical Conditions */}
            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">
                Medical Conditions
              </label>
              <textarea
                value={profile.medical_conditions}
                onChange={(e) => handleInputChange('medical_conditions', e.target.value)}
                placeholder="Enter any existing medical conditions, allergies, etc."
                rows={4}
                className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-8 flex gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex-1 py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                saving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-charcoal-blue hover:bg-deep-space-blue'
              }`}
            >
              {saving ? 'Saving...' : '💾 Save Profile'}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 py-3 px-6 rounded-lg font-semibold text-charcoal-blue bg-gray-200 hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
