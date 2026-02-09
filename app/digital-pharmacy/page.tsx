'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '../utils/supabase/client';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCapsules, faPenToSquare, faRotateRight, faTrash, faPlus, faClock } from '@fortawesome/free-solid-svg-icons';

interface PharmacyTag {
  id: string;
  name: string;
}

interface PharmacyMedicine {
  id: string;
  name: string;
  dosage?: string | null;
  category: string;
  description?: string | null;
  safety_warnings?: string | null;
  image_url?: string | null;
  available_stock: number;
  stock_unit: string;
  tags?: PharmacyTag[];
}

export default function DigitalPharmacyPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [medicines, setMedicines] = useState<PharmacyMedicine[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchMedicines = useCallback(async (options?: {
    silent?: boolean;
    filters?: { query: string; category: string; tags: string };
  }) => {
    if (!options?.silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const filters = options?.filters ?? { query: '', category: '', tags: '' };
      const params = new URLSearchParams();
      if (filters.query.trim()) {
        params.set('query', filters.query.trim());
      }
      if (filters.category.trim()) {
        params.set('category', filters.category.trim());
      }
      if (filters.tags.trim()) {
        params.set('tags', filters.tags.trim());
      }

      const response = await fetch(`/api/pharmacy-medicines?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch pharmacy medicines');
      }

      const data = await response.json();
      setMedicines(data || []);
    } catch (error) {
      console.error('Error loading pharmacy medicines:', error);
      toast.error('Failed to load pharmacy medicines');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const ensureSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      fetchMedicines({ filters: { query: '', category: '', tags: '' } });
    };

    ensureSession();
  }, [supabase, router, fetchMedicines]);

  const handleDelete = async (medicineId: string) => {
    if (!confirm('Are you sure you want to delete this medicine?')) {
      return;
    }

    try {
      setActionId(medicineId);
      await toast.promise(
        fetch(`/api/pharmacy-medicines/${medicineId}`, { method: 'DELETE' }).then((response) => {
          if (!response.ok) {
            throw new Error('Failed to delete medicine');
          }
          return response;
        }),
        {
          pending: 'Deleting medicine...',
          success: 'Medicine deleted successfully!',
        }
      );

      setMedicines((prev) => prev.filter((medicine) => medicine.id !== medicineId));
    } catch (error) {
      console.error('Error deleting pharmacy medicine:', error);
      toast.error('Failed to delete medicine');
    } finally {
      setActionId(null);
    }
  };

  const handleRefill = async (medicine: PharmacyMedicine) => {
    const label = medicine.stock_unit === 'ml' ? 'ml' : 'tablets';
    const input = window.prompt(`How many ${label} would you like to add?`);
    if (!input) {
      return;
    }

    const refillAmount = Number(input);
    if (Number.isNaN(refillAmount) || refillAmount <= 0) {
      toast.error('Enter a valid refill amount');
      return;
    }

    try {
      setActionId(medicine.id);
      await toast.promise(
        fetch(`/api/pharmacy-medicines/${medicine.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refill_amount: refillAmount }),
        }).then((response) => {
          if (!response.ok) {
            throw new Error('Failed to refill medicine');
          }
          return response.json();
        }),
        {
          pending: 'Updating stock...',
          success: 'Stock updated!',
        }
      ).then((updated) => {
        setMedicines((prev) =>
          prev.map((item) => (item.id === updated.id ? { ...item, available_stock: updated.available_stock } : item))
        );
      });
    } catch (error) {
      console.error('Error refilling medicine:', error);
      toast.error('Failed to update stock');
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-rosy-granite/5 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-deep-space-blue mb-2 flex items-center gap-2">
              <FontAwesomeIcon icon={faCapsules} className="fa-1x" />
              Digital Pharmacy
            </h1>
            <p className="text-blue-slate">Track inventory, tags, and stock levels</p>
          </div>
          <button
            onClick={() => router.push('/digital-pharmacy/add')}
            className="w-full bg-charcoal-blue hover:bg-deep-space-blue text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 sm:w-auto"
          >
            <FontAwesomeIcon icon={faPlus} className="fa-1x" />
            <span>Add Medicine</span>
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name"
              className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
            >
              <option value="">All categories</option>
              <option value="tablet">Tablet</option>
              <option value="syrup">Syrup</option>
            </select>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Tags (comma separated)"
              className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() =>
                  fetchMedicines({
                    silent: true,
                    filters: { query, category, tags: tagsInput },
                  })
                }
                className="w-full bg-dim-grey/20 hover:bg-dim-grey/30 text-charcoal-blue px-4 py-2 rounded-lg font-semibold transition-colors sm:w-auto"
              >
                {refreshing ? 'Filtering...' : 'Search / Filter'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/digital-pharmacy/history')}
                aria-label="View stock history"
                className="w-full bg-white border border-dim-grey/40 hover:border-charcoal-blue text-charcoal-blue px-3 py-2 rounded-lg transition-colors sm:w-auto"
              >
                <FontAwesomeIcon icon={faClock} className="w-5 h-5 fa-1x" />
              </button>
            </div>
          </div>
        </div>

        {medicines.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">No medicines in your pharmacy yet</p>
            <button
              onClick={() => router.push('/digital-pharmacy/add')}
              className="inline-block bg-charcoal-blue hover:bg-deep-space-blue text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              + Add Your First Medicine
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {medicines.map((medicine) => (
              <div
                key={medicine.id}
                className="bg-white rounded-lg shadow-md p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-blue-slate/10 flex items-center justify-center overflow-hidden">
                    {medicine.image_url ? (
                      <Image
                        src={medicine.image_url}
                        alt={medicine.name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <FontAwesomeIcon icon={faCapsules} className="text-2xl text-blue-slate fa-1x" />
                    )}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => router.push(`/digital-pharmacy/${medicine.id}`)}
                      className="text-left text-lg font-bold text-deep-space-blue hover:underline"
                    >
                      {medicine.name}
                    </button>
                    <p className="text-sm text-blue-slate">Category: {medicine.category}</p>
                    {medicine.tags && medicine.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {medicine.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="px-2 py-1 text-xs rounded-full bg-rosy-granite/20 text-charcoal-blue"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-3 md:items-end">
                  <div className="text-sm text-charcoal-blue">
                    <span className="font-semibold">Stock:</span> {medicine.available_stock} {medicine.stock_unit}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => router.push(`/digital-pharmacy/edit/${medicine.id}`)}
                      className="w-full bg-dim-grey/20 hover:bg-dim-grey/30 text-charcoal-blue font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 sm:w-auto"
                    >
                      <FontAwesomeIcon icon={faPenToSquare} className="fa-1x" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(medicine.id)}
                      disabled={actionId === medicine.id}
                      className={`w-full font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 sm:w-auto ${
                        actionId === medicine.id
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-red-100 hover:bg-red-200 text-red-700'
                      }`}
                    >
                      {actionId === medicine.id ? '...' : (
                        <>
                          <FontAwesomeIcon icon={faTrash} className="fa-1x" />
                          Delete
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleRefill(medicine)}
                      disabled={actionId === medicine.id}
                      className={`w-full font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 sm:w-auto ${
                        actionId === medicine.id
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                      }`}
                    >
                      {actionId === medicine.id ? '...' : (
                        <>
                          <FontAwesomeIcon icon={faRotateRight} className="fa-1x" />
                          Refill
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
