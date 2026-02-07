'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCapsules } from '@fortawesome/free-solid-svg-icons';

interface PharmacyMedicine {
  id: string;
  name: string;
  dosage?: string | null;
  category: string;
  available_stock: number;
  stock_unit: string;
}

interface MedicineForm {
  pharmacyMedicineId: string;
  name: string;
  dosage: string;
  doseUnit: string;
  occurrence: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
  customOccurrence?: string;
  scheduledDate: string;
  notes: string;
  schedules: {
    morning: { enabled: boolean; time: string; mealTiming: 'before' | 'after'; doseAmount: string };
    afternoon: { enabled: boolean; time: string; mealTiming: 'before' | 'after'; doseAmount: string };
    night: { enabled: boolean; time: string; mealTiming: 'before' | 'after'; doseAmount: string };
  };
}

export default function AddMedicinePage() {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [pharmacyMedicines, setPharmacyMedicines] = useState<PharmacyMedicine[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [form, setForm] = useState<MedicineForm>({
    pharmacyMedicineId: '',
    name: '',
    dosage: '',
    doseUnit: 'tablet',
    occurrence: 'daily',
    scheduledDate: new Date().toISOString().split('T')[0],
    notes: '',
    schedules: {
      morning: { enabled: true, time: '09:00', mealTiming: 'after', doseAmount: '1' },
      afternoon: { enabled: false, time: '14:00', mealTiming: 'after', doseAmount: '1' },
      night: { enabled: false, time: '21:00', mealTiming: 'after', doseAmount: '1' },
    },
  });

  const handleInputChange = <K extends keyof MedicineForm>(field: K, value: MedicineForm[K]) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  useEffect(() => {
    const loadPharmacyMedicines = async () => {
      try {
        const response = await fetch('/api/pharmacy-medicines');
        if (!response.ok) {
          throw new Error('Failed to fetch pharmacy medicines');
        }
        const data: PharmacyMedicine[] = await response.json();
        setPharmacyMedicines(data || []);
      } catch (error) {
        console.error('Error loading pharmacy medicines:', error);
        toast.error('Failed to load pharmacy medicines');
      } finally {
        setLoadingOptions(false);
      }
    };

    loadPharmacyMedicines();
  }, []);

  const handleMedicineSelect = (medicineId: string) => {
    const selected = pharmacyMedicines.find((medicine) => medicine.id === medicineId);
    if (!selected) {
      setForm((prev) => ({
        ...prev,
        pharmacyMedicineId: '',
        name: '',
        doseUnit: 'tablet',
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      pharmacyMedicineId: medicineId,
      name: selected.name,
      doseUnit: selected.stock_unit || (selected.category === 'syrup' ? 'ml' : 'tablet'),
    }));
  };

  const handleScheduleChange = (
    period: 'morning' | 'afternoon' | 'night',
    field: 'enabled' | 'time' | 'mealTiming' | 'doseAmount',
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

    if (!form.pharmacyMedicineId) {
      toast.error('Select a medicine from Digital Pharmacy');
      return;
    }

    const selectedSchedules = (['morning', 'afternoon', 'night'] as const)
      .filter(period => form.schedules[period].enabled)
      .map(period => ({
        period,
        timing: form.schedules[period].time,
        meal_timing: form.schedules[period].mealTiming,
        dose_amount: Number(form.schedules[period].doseAmount),
      }));

    if (selectedSchedules.length === 0) {
      toast.error('Select at least one time of day');
      return;
    }

    const invalidDose = selectedSchedules.find((schedule) =>
      Number.isNaN(schedule.dose_amount) || schedule.dose_amount <= 0
    );
    if (invalidDose) {
      toast.error('Enter a valid dose amount for each selected time');
      return;
    }

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Detect user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      await toast.promise(
        fetch('/api/medicines', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: form.name,
            pharmacy_medicine_id: form.pharmacyMedicineId,
            dosage: form.dosage || null,
            occurrence: form.occurrence,
            custom_occurrence: form.customOccurrence || null,
            scheduled_date: form.scheduledDate,
            schedules: selectedSchedules,
            dose_unit: form.doseUnit,
            notes: form.notes || null,
            timezone: userTimezone, // Send timezone to backend
          }),
        }).then((response) => {
          if (!response.ok) {
            throw new Error('Failed to add medicine');
          }
          return response;
        }),
        {
          pending: 'Adding medicine...',
          success: 'Medicine added successfully!'
        }
      );
      setTimeout(() => {
        router.push('/medication');
      }, 1500);
    } catch (err) {
      console.error('Error adding medicine:', err);
      toast.error('Failed to add medicine. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-rosy-granite/5 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-deep-space-blue mb-8 flex items-center gap-2">
            <FontAwesomeIcon icon={faCapsules} className="fa-1x" />
            Add Medication
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Pharmacy Medicine Selection */}
            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">
                Pharmacy Medicine *
              </label>
              <select
                value={form.pharmacyMedicineId}
                onChange={(e) => handleMedicineSelect(e.target.value)}
                className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
              >
                <option value="">{loadingOptions ? 'Loading medicines...' : 'Select medicine'}</option>
                {pharmacyMedicines.map((medicine) => (
                  <option key={medicine.id} value={medicine.id}>
                    {medicine.name} ({medicine.available_stock} {medicine.stock_unit})
                  </option>
                ))}
              </select>
              {pharmacyMedicines.length === 0 && !loadingOptions && (
                <p className="text-xs text-blue-slate mt-2">
                  No medicines available. Add one in Digital Pharmacy first.
                </p>
              )}
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
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                        <div>
                          <label className="block text-xs font-medium text-charcoal-blue mb-2">
                            Dose ({form.doseUnit})
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={form.schedules[key].doseAmount}
                            onChange={(e) => handleScheduleChange(key, 'doseAmount', e.target.value)}
                            className="w-full px-3 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
                          />
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
                  handleInputChange('occurrence', e.target.value as MedicineForm['occurrence'])
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
                {saving ? 'Adding...' : (
                  <span className="inline-flex items-center gap-2">
                    <FontAwesomeIcon icon={faCheck} className="fa-1x" />
                    Add Medication
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => router.push('/medication')}
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
