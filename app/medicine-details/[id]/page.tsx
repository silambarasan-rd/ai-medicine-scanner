'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUtensils, faCircle, faSlash, faArrowLeft, faClock, faCalendar, faPills, faNotesMedical, faCapsules } from '@fortawesome/free-solid-svg-icons';

interface Medicine {
  id: string;
  name: string;
  timing: string;
  dosage?: string;
  occurrence?: string;
  scheduled_date?: string;
  meal_timing?: string;
  notes?: string;
  created_at?: string;
}

export default function MedicineDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const supabase = createClient();
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMedicine = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      try {
        const resolvedParams = await params;
        const response = await fetch(`/api/medicines/${resolvedParams.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch medicine');
        }

        const data = await response.json();
        setMedicine(data);
      } catch (err) {
        console.error('Error loading medicine:', err);
        setError('Failed to load medicine details');
      } finally {
        setLoading(false);
      }
    };

    loadMedicine();
  }, [params, supabase, router]);

  const formatTime = (time: string) => {
    const timeParts = time.split(':');
    const hours = parseInt(timeParts[0] || '0', 10);
    const minutes = parseInt(timeParts[1] || '0', 10);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getOccurrenceLabel = (occurrence?: string) => {
    switch (occurrence) {
      case 'once':
        return 'One Time Only';
      case 'daily':
        return 'Every Day';
      case 'weekly':
        return 'Every Week';
      case 'monthly':
        return 'Every Month';
      default:
        return 'Not Set';
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !medicine) {
    return (
      <div className="min-h-screen bg-rosy-granite/5 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            {error || 'Medicine not found'}
          </div>
          <button
            onClick={() => router.back()}
            className="mt-4 text-charcoal-blue hover:text-deep-space-blue font-semibold"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rosy-granite/5 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-charcoal-blue hover:text-deep-space-blue font-semibold mb-4 transition-colors"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="fa-1x" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-deep-space-blue">Medicine Details</h1>
          <p className="text-blue-slate mt-1">View only - No editing available</p>
        </div>

        {/* Medicine Card */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Medicine Name Header */}
          <div className="bg-gradient-to-r from-charcoal-blue to-deep-space-blue text-white p-6">
            <div className="flex items-start gap-4">
              <div className="text-5xl">
                <FontAwesomeIcon icon={faCapsules} className="fa-1x" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">{medicine.name}</h2>
                {medicine.dosage && (
                  <p className="text-white/90 text-lg">{medicine.dosage}</p>
                )}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 space-y-6">
            {/* Timing */}
            <div className="border-b border-gray-200 pb-4">
              <div className="flex items-center gap-2 text-gray-700 mb-2">
                <FontAwesomeIcon icon={faClock} className="text-charcoal-blue fa-1x" />
                <h3 className="font-semibold">Timing</h3>
              </div>
              <p className="text-2xl font-bold text-deep-space-blue ml-6">
                {formatTime(medicine.timing)}
              </p>
            </div>

            {/* Meal Timing */}
            {medicine.meal_timing && (
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center gap-2 text-gray-700 mb-2">
                  <FontAwesomeIcon icon={faUtensils} className="text-charcoal-blue fa-1x" />
                  <h3 className="font-semibold">Meal Timing</h3>
                </div>
                <div className="ml-6">
                  {medicine.meal_timing === 'after' ? (
                    <span className="inline-flex items-center rounded-md bg-green-50 px-4 py-2 text-base font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                      <FontAwesomeIcon icon={faUtensils} className="mr-2 fa-1x" />
                      After Meal
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-4 py-2 text-base font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                      <span className="fa-stack" style={{ fontSize: '0.8em', verticalAlign: 'middle', marginRight: '4px' }}>
                        <FontAwesomeIcon icon={faCircle} className="fa-stack-2x" />
                        <FontAwesomeIcon icon={faSlash} className="fa-stack-1x fa-inverse" />
                        <FontAwesomeIcon icon={faUtensils} className="fa-stack-1x fa-inverse" />
                      </span>
                      Before Meal
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Schedule */}
            {medicine.scheduled_date && (
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center gap-2 text-gray-700 mb-2">
                  <FontAwesomeIcon icon={faCalendar} className="text-charcoal-blue fa-1x" />
                  <h3 className="font-semibold">Start Date</h3>
                </div>
                <p className="text-lg text-gray-800 ml-6">
                  {formatDate(medicine.scheduled_date)}
                </p>
              </div>
            )}

            {/* Occurrence */}
            {medicine.occurrence && (
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center gap-2 text-gray-700 mb-2">
                  <FontAwesomeIcon icon={faPills} className="text-charcoal-blue fa-1x" />
                  <h3 className="font-semibold">Frequency</h3>
                </div>
                <p className="text-lg text-gray-800 ml-6">
                  {getOccurrenceLabel(medicine.occurrence)}
                </p>
              </div>
            )}

            {/* Notes */}
            {medicine.notes && (
              <div className="pb-4">
                <div className="flex items-center gap-2 text-gray-700 mb-2">
                  <FontAwesomeIcon icon={faNotesMedical} className="text-charcoal-blue fa-1x" />
                  <h3 className="font-semibold">Notes</h3>
                </div>
                <p className="text-gray-700 ml-6 whitespace-pre-wrap">
                  {medicine.notes}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4">
            <p className="text-sm text-gray-600">
              Added on {medicine.created_at ? new Date(medicine.created_at).toLocaleDateString('en-IN') : 'N/A'}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-charcoal-blue hover:bg-deep-space-blue text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
