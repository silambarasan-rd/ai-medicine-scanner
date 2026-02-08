'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';

interface PharmacyMedicine {
  id: string;
  name: string;
}

interface StockHistoryEntry {
  id: string;
  medicine_id: string;
  medicine_name?: string | null;
  delta: number;
  before_stock: number;
  after_stock: number;
  stock_unit: string;
  source: 'initial_stock' | 'refill' | 'taken' | 'manual_adjustment';
  note?: string | null;
  created_at: string;
}

const sourceLabels: Record<StockHistoryEntry['source'], string> = {
  initial_stock: 'Initial stock',
  refill: 'Refill',
  taken: 'Taken',
  manual_adjustment: 'Manual adjustment',
};

export default function PharmacyHistoryPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [medicines, setMedicines] = useState<PharmacyMedicine[]>([]);
  const [history, setHistory] = useState<StockHistoryEntry[]>([]);
  const [selectedMedicineId, setSelectedMedicineId] = useState('all');
  const [initialized, setInitialized] = useState(false);

  const fetchMedicines = useCallback(async () => {
    try {
      const response = await fetch('/api/pharmacy-medicines');
      if (!response.ok) {
        throw new Error('Failed to fetch medicines');
      }
      const data = await response.json();
      setMedicines(data || []);
    } catch (error) {
      console.error('Error loading medicines:', error);
      toast.error('Failed to load medicines');
    }
  }, []);

  const fetchHistory = useCallback(async (medicineId: string) => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (medicineId && medicineId !== 'all') {
        params.set('medicineId', medicineId);
      }

      const response = await fetch(`/api/pharmacy-medicines/history?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }

      const data = await response.json();
      setHistory(data || []);
    } catch (error) {
      console.error('Error loading stock history:', error);
      toast.error('Failed to load stock history');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    const ensureSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      await fetchMedicines();
      setInitialized(true);
      setLoading(false);
    };

    ensureSession();
  }, [supabase, router, fetchMedicines, fetchHistory]);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    fetchHistory(selectedMedicineId);
  }, [initialized, selectedMedicineId, fetchHistory]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-rosy-granite/5 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-deep-space-blue mb-2">Pharmacy Stock History</h1>
            <p className="text-blue-slate">Track every inventory change across your pharmacy</p>
          </div>
          <button
            onClick={() => router.push('/digital-pharmacy')}
            className="bg-dim-grey/20 hover:bg-dim-grey/30 text-charcoal-blue px-5 py-2 rounded-lg font-semibold transition-colors"
          >
            Back to Pharmacy
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-charcoal-blue">Filter by medicine</label>
              <select
                value={selectedMedicineId}
                onChange={(e) => setSelectedMedicineId(e.target.value)}
                className="w-full md:w-80 px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
              >
                <option value="all">All medicines</option>
                {medicines.map((medicine) => (
                  <option key={medicine.id} value={medicine.id}>
                    {medicine.name}
                  </option>
                ))}
              </select>
            </div>
            {loadingHistory && (
              <LoadingSpinner fullScreen={false} />
            )}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">No stock history yet</p>
            <p className="text-blue-slate">Stock changes will appear here after refills or doses are taken.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => {
              const deltaValue = Number(entry.delta || 0);
              const deltaLabel = `${deltaValue > 0 ? '+' : ''}${deltaValue}`;
              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-lg shadow-md p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm text-blue-slate">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                    <h3 className="text-lg font-bold text-deep-space-blue">
                      {entry.medicine_name || 'Unknown medicine'}
                    </h3>
                    <p className="text-sm text-charcoal-blue">Source: {sourceLabels[entry.source]}</p>
                    {entry.note && (
                      <p className="text-sm text-blue-slate">Note: {entry.note}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 md:items-end">
                    <div
                      className={`text-sm font-semibold ${deltaValue >= 0 ? 'text-emerald-700' : 'text-red-600'}`}
                    >
                      Delta: {deltaLabel} {entry.stock_unit}
                    </div>
                    <div className="text-sm text-charcoal-blue">
                      Before: {entry.before_stock} {entry.stock_unit}
                    </div>
                    <div className="text-sm text-charcoal-blue">
                      After: {entry.after_stock} {entry.stock_unit}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
