'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import LoadingSpinner from '../../components/LoadingSpinner';

interface MedicineForm {
  id: string;
  name: string;
  dosage: string;
  occurrence: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
  customOccurrence?: string;
  scheduledDate: string;
  notes: string;
  schedules: {
    morning: { enabled: boolean; time: string; mealTiming: 'before' | 'after' };
    afternoon: { enabled: boolean; time: string; mealTiming: 'before' | 'after' };
    night: { enabled: boolean; time: string; mealTiming: 'before' | 'after' };
  };
}

export default function EditMedicinePage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState<MedicineForm>({
    id: '',
    name: '',
    dosage: '',
    occurrence: 'daily',
    scheduledDate: new Date().toISOString().split('T')[0],
    notes: '',
    schedules: {
      morning: { enabled: true, time: '09:00', mealTiming: 'after' },
      afternoon: { enabled: false, time: '14:00', mealTiming: 'after' },
      night: { enabled: false, time: '21:00', mealTiming: 'after' },
    },
  });

  useEffect(() => {
    const loadMedicine = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const medicineId = params.id;
      try {
        const response = await fetch(`/api/medicines/${medicineId}`);
        if (!response.ok) {
          throw new Error('Medicine not found');
        }

        const medicine = await response.json();

        const loadedSchedules: {
          morning: { enabled: boolean; time: string; mealTiming: 'before' | 'after' };
          afternoon: { enabled: boolean; time: string; mealTiming: 'before' | 'after' };
          night: { enabled: boolean; time: string; mealTiming: 'before' | 'after' };
        } = {
          morning: { enabled: false, time: '09:00', mealTiming: 'after' },
          afternoon: { enabled: false, time: '14:00', mealTiming: 'after' },
          night: { enabled: false, time: '21:00', mealTiming: 'after' },
        };

        (medicine.schedules || []).forEach((schedule: { timing: string; meal_timing: 'before' | 'after' }) => {
          const hour = parseInt(schedule.timing.split(':')[0] || '0', 10);
          if (hour < 12) {
            loadedSchedules.morning = {
              enabled: true,
              time: schedule.timing,
              mealTiming: schedule.meal_timing,
            };
          } else if (hour < 18) {
            loadedSchedules.afternoon = {
              enabled: true,
              time: schedule.timing,
              mealTiming: schedule.meal_timing,
            };
          } else {
            loadedSchedules.night = {
              enabled: true,
              time: schedule.timing,
              mealTiming: schedule.meal_timing,
            };
          }
        });

        setForm({
          id: medicine.id,
          name: medicine.name,
          dosage: medicine.dosage || '',
          occurrence: medicine.occurrence || 'daily',
          customOccurrence: medicine.custom_occurrence || '',
          scheduledDate: medicine.scheduled_date,
          notes: medicine.notes || '',
          schedules: loadedSchedules,
        });
      } catch (error) {
        console.error('Error loading medicine:', error);
        setMessage({ type: 'error', text: 'Medicine not found' });
        setTimeout(() => router.push('/digital-cabinet'), 2000);
        return;
      }

      setLoading(false);
    };

    loadMedicine();
  }, [supabase, router, params]);

  const handleInputChange = (field: keyof MedicineForm, value: any) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleScheduleChange = (
    period: 'morning' | 'afternoon' | 'night',
    field: 'enabled' | 'time' | 'mealTiming',
    value: boolean | string
  ) => {
    setForm(prev => ({
      ...prev,
      schedules: {
        ...prev.schedules,
        [period]: {
          ...prev.schedules[period],
          [field]: value,
        },
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setMessage({ type: 'error', text: 'Medicine name is required' });
      return;
    }

    const selectedSchedules = (['morning', 'afternoon', 'night'] as const)
      .filter(period => form.schedules[period].enabled)
      .map(period => ({
        period,
        timing: form.schedules[period].time,
        meal_timing: form.schedules[period].mealTiming,
      }));

    if (selectedSchedules.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one time of day' });
      return;
    }

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/medicines/${form.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          dosage: form.dosage || null,
          occurrence: form.occurrence,
          custom_occurrence: form.customOccurrence || null,
          scheduled_date: form.scheduledDate,
          schedules: selectedSchedules,
          notes: form.notes || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update medicine');
      }

      setMessage({ type: 'success', text: 'Medicine updated successfully!' });
      setTimeout(() => {
        router.push('/digital-cabinet');
      }, 1500);
    } catch (err) {
      console.error('Error updating medicine:', err);
      setMessage({ type: 'error', text: 'Failed to update medicine. Please try again.' });
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
          <h1 className="text-3xl font-bold text-deep-space-blue mb-8">✏️ Edit Medicine</h1>

          {message && (
            <div
              className={`p-4 rounded-lg mb-6 ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Medicine Name */}
            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">
                Medicine Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Dolo 650, Aspirin"
                className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
              />
            </div>

            {/* Dosage */}
            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">
                Dosage
              </label>
              <input
                type="text"
                value={form.dosage}
                onChange={(e) => handleInputChange('dosage', e.target.value)}
                placeholder="e.g., 650mg, 100mg"
                className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
              />
            </div>

            {/* Scheduled Date */}
            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">
                Date *
              </label>
              <input
                type="date"
                value={form.scheduledDate}
                onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
                className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
              />
            </div>

            {/* Time of Day */}
            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">
                Times of Day *
              </label>
              <div className="space-y-3">
                {([
                  { key: 'morning', label: 'Morning' },
                  { key: 'afternoon', label: 'Afternoon' },
                  { key: 'night', label: 'Night' },
                ] as const).map(({ key, label }) => (
                  <div key={key} className="border border-dim-grey/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.schedules[key].enabled}
                          onChange={(e) => handleScheduleChange(key, 'enabled', e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm font-semibold text-charcoal-blue">{label}</span>
                      </label>
                    </div>
                    {form.schedules[key].enabled && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-charcoal-blue mb-2">
                            Time
                          </label>
                          <input
                            type="time"
                            value={form.schedules[key].time}
                            onChange={(e) => handleScheduleChange(key, 'time', e.target.value)}
                            className="w-full px-3 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-charcoal-blue mb-2">
                            Meal Timing
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            {(['before', 'after'] as const).map(option => (
                              <label key={option} className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  name={`mealTiming-${key}`}
                                  value={option}
                                  checked={form.schedules[key].mealTiming === option}
                                  onChange={(e) => handleScheduleChange(key, 'mealTiming', e.target.value)}
                                  className="mr-2"
                                />
                                <span className="text-xs font-medium text-charcoal-blue capitalize">
                                  {option} Meal
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Occurrence */}
            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">
                Frequency *
              </label>
              <select
                value={form.occurrence}
                onChange={(e) =>
                  handleInputChange('occurrence', e.target.value as any)
                }
                className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
              >
                <option value="once">Only Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Custom Occurrence */}
            {form.occurrence === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-charcoal-blue mb-2">
                  Custom Occurrence Pattern
                </label>
                <input
                  type="text"
                  value={form.customOccurrence || ''}
                  onChange={(e) =>
                    handleInputChange('customOccurrence', e.target.value)
                  }
                  placeholder="e.g., 2 times per week, Every other day"
                  className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
                />
              </div>
            )}


            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">
                Notes / Warnings
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Any additional notes or warnings about this medicine"
                rows={3}
                className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent resize-none"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-6">
              <button
                type="submit"
                disabled={saving}
                className={`flex-1 py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                  saving
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-charcoal-blue hover:bg-deep-space-blue'
                }`}
              >
                {saving ? 'Updating...' : '✅ Update Medicine'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/digital-cabinet')}
                className="flex-1 py-3 px-6 rounded-lg font-semibold text-charcoal-blue bg-gray-200 hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
