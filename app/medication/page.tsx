'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSyringe, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';

interface Medicine {
  id: string;
  group_id?: string;
  name: string;
  dosage?: string;
  occurrence?: string;
  custom_occurrence?: string;
  scheduled_date?: string;
  timing?: string;
  meal_timing?: string;
  notes?: string;
  created_at?: string;
}

interface MedicineGroup {
  id: string;
  name: string;
  dosage?: string;
  occurrence?: string;
  custom_occurrence?: string;
  scheduled_date?: string;
  notes?: string;
  schedules: { timing?: string; meal_timing?: string }[];
}

export default function MedicationPage() {
  const router = useRouter();
  const supabase = createClient();
  const [medicines, setMedicines] = useState<MedicineGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

        const medicinesData: Medicine[] = await response.json();

        const grouped = (medicinesData || []).reduce<Record<string, MedicineGroup>>((acc, medicine) => {
          const groupId = medicine.group_id || medicine.id;
          if (!acc[groupId]) {
            acc[groupId] = {
              id: groupId,
              name: medicine.name,
              dosage: medicine.dosage,
              occurrence: medicine.occurrence,
              custom_occurrence: medicine.custom_occurrence,
              scheduled_date: medicine.scheduled_date,
              notes: medicine.notes,
              schedules: [],
            };
          }
          acc[groupId].schedules.push({
            timing: medicine.timing,
            meal_timing: medicine.meal_timing,
          });
          return acc;
        }, {});

        setMedicines(Object.values(grouped));
      } catch (error) {
        console.error('Error loading medicines:', error);
        toast.error('Failed to load medicines');
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
      await toast.promise(
        fetch(`/api/medicines/${medicineId}`, {
          method: 'DELETE',
        }).then((response) => {
          if (!response.ok) {
            throw new Error('Failed to delete medicine');
          }
          return response;
        }),
        {
          pending: 'Deleting medicine...',
          success: 'Medicine deleted successfully!'
        }
      );

      setMedicines((prev) => prev.filter((medicine) => medicine.id !== medicineId));
    } catch (err) {
      console.error('Error deleting medicine:', err);
      toast.error('Failed to delete medicine');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (medicineId: string) => {
    router.push(`/edit-medicine/${medicineId}`);
  };

  const handleView = (medicineId: string) => {
    router.push(`/medicine-details/${medicineId}`);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-rosy-granite/5 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-deep-space-blue mb-2 flex items-center gap-2">
              <FontAwesomeIcon icon={faSyringe} className="fa-1x" />
              Medication
            </h1>
            <p className="text-blue-slate">Manage your scheduled medications</p>
          </div>
          <button
            onClick={() => router.push('/add-medicine')}
            className="w-full bg-charcoal-blue hover:bg-deep-space-blue text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 sm:w-auto"
          >
            <FontAwesomeIcon icon={faPlus} className="fa-1x" />
            <span>Add Medication</span>
          </button>
        </div>

        {medicines.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">No medications scheduled yet</p>
            <button
              onClick={() => router.push('/add-medicine')}
              className="inline-block bg-charcoal-blue hover:bg-deep-space-blue text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              + Add Your First Medication
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {medicines.map((medicine) => (
              <div key={medicine.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <button
                      type="button"
                      onClick={() => handleView(medicine.id)}
                      className="text-left text-xl font-bold text-deep-space-blue hover:underline"
                    >
                      {medicine.name}
                    </button>
                    {medicine.dosage && (
                      <p className="text-sm text-blue-slate mt-1">Dosage: {medicine.dosage}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-4 text-sm text-charcoal-blue">
                  {medicine.occurrence && (
                    <p>
                      <span className="font-semibold">Frequency:</span> {medicine.occurrence}
                      {medicine.custom_occurrence ? ` (${medicine.custom_occurrence})` : ''}
                    </p>
                  )}
                  {medicine.scheduled_date && (
                    <p>
                      <span className="font-semibold">Start Date:</span> {medicine.scheduled_date}
                    </p>
                  )}
                  {medicine.schedules.length > 0 && (
                    <div>
                      <p className="font-semibold">Times:</p>
                      <ul className="mt-1 space-y-1">
                        {medicine.schedules.map((schedule, index) => (
                          <li key={`${medicine.id}-${index}`}>
                            {schedule.timing} {schedule.meal_timing ? `(${schedule.meal_timing} meal)` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {medicine.notes && (
                    <p>
                      <span className="font-semibold">Notes:</span> {medicine.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 pt-4 border-t border-rosy-granite/30 sm:flex-row">
                  <button
                    onClick={() => handleEdit(medicine.id)}
                    className="flex-1 bg-dim-grey/20 hover:bg-dim-grey/30 text-charcoal-blue font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <FontAwesomeIcon icon={faPenToSquare} className="fa-1x" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(medicine.id)}
                    disabled={deletingId === medicine.id}
                    className={`flex-1 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      deletingId === medicine.id
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-red-100 hover:bg-red-200 text-red-700'
                    }`}
                  >
                    {deletingId === medicine.id ? '...' : (
                      <>
                        <FontAwesomeIcon icon={faTrash} className="fa-1x" />
                        Delete
                      </>
                    )}
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
