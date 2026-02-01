'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import LoadingSpinner from '../components/LoadingSpinner';

interface Medicine {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  timing?: string;
  meal_timing?: string;
  notes?: string;
  created_at?: string;
}

export default function DigitalCabinetPage() {
  const router = useRouter();
  const supabase = createClient();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const loadMedicines = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      try {
        const response = await fetch('/api/medicines');
        if (!response.ok) {
          throw new Error('Failed to fetch medicines');
        }

        const medicinesData = await response.json();
        setMedicines(medicinesData || []);
      } catch (error) {
        console.error('Error loading medicines:', error);
        setMessage({ type: 'error', text: 'Failed to load medicines' });
      }

      setLoading(false);
    };

    loadMedicines();
  }, [supabase, router]);

  const handleDelete = async (medicineId: string) => {
    if (!confirm('Are you sure you want to delete this medicine?')) {
      return;
    }

    try {
      setDeletingId(medicineId);
      const response = await fetch(`/api/medicines/${medicineId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete medicine');
      }

      setMedicines(medicines.filter(m => m.id !== medicineId));
      setMessage({ type: 'success', text: 'Medicine deleted successfully' });
    } catch (err) {
      console.error('Error deleting medicine:', err);
      setMessage({ type: 'error', text: 'Failed to delete medicine' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (medicineId: string) => {
    router.push(`/edit-medicine/${medicineId}`);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-rosy-granite/5 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-deep-space-blue mb-2">💊 Digital Cabinet</h1>
            <p className="text-blue-slate">Manage your medicine collection</p>
          </div>
          <button
            onClick={() => router.push('/add-medicine')}
            className="bg-charcoal-blue hover:bg-deep-space-blue text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <span>+</span>
            <span>Add Medicine</span>
          </button>
        </div>

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

        {medicines.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">No medicines in your cabinet yet</p>
            <button
              onClick={() => router.push('/add-medicine')}
              className="inline-block bg-charcoal-blue hover:bg-deep-space-blue text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              + Add Your First Medicine
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {medicines.map((medicine) => (
              <div key={medicine.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-deep-space-blue">{medicine.name}</h3>
                    {medicine.dosage && (
                      <p className="text-sm text-blue-slate mt-1">Dosage: {medicine.dosage}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-4 text-sm text-charcoal-blue">
                  {medicine.frequency && (
                    <p>
                      <span className="font-semibold">Frequency:</span> {medicine.frequency}
                    </p>
                  )}
                  {medicine.timing && (
                    <p>
                      <span className="font-semibold">Timing:</span> {medicine.timing}
                    </p>
                  )}
                  {medicine.meal_timing && (
                    <p>
                      <span className="font-semibold">Meal Timing:</span> {medicine.meal_timing}
                    </p>
                  )}
                  {medicine.notes && (
                    <p>
                      <span className="font-semibold">Notes:</span> {medicine.notes}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-rosy-granite/30">
                  <button
                    onClick={() => handleEdit(medicine.id)}
                    className="flex-1 bg-dim-grey/20 hover:bg-dim-grey/30 text-charcoal-blue font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(medicine.id)}
                    disabled={deletingId === medicine.id}
                    className={`flex-1 font-semibold py-2 px-4 rounded-lg transition-colors ${
                      deletingId === medicine.id
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-red-100 hover:bg-red-200 text-red-700'
                    }`}
                  >
                    {deletingId === medicine.id ? '...' : '🗑️ Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
