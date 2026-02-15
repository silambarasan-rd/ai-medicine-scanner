'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHospital, faPhone } from '@fortawesome/free-solid-svg-icons';

interface Hospital {
  id: string;
  external_id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  district?: string | null;
  speciality?: string | null;
  speciality_code?: string | null;
}

interface HospitalResponse {
  items: Hospital[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function HospitalsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [pendingFilters, setPendingFilters] = useState({ name: '', district: '', speciality: '' });
  const [appliedFilters, setAppliedFilters] = useState({ name: '', district: '', speciality: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const didMountRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHospitals = useCallback(async (options?: {
    pageOverride?: number;
    silent?: boolean;
    filtersOverride?: { name: string; district: string; speciality: string };
  }) => {
    const currentPage = options?.pageOverride ?? 1;
    const activeFilters = options?.filtersOverride ?? appliedFilters;

    if (!options?.silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: '25',
      });

      if (activeFilters.name.trim()) {
        params.set('name', activeFilters.name.trim());
      }

      if (activeFilters.district.trim()) {
        params.set('district', activeFilters.district.trim());
      }

      if (activeFilters.speciality.trim()) {
        params.set('speciality', activeFilters.speciality.trim());
      }

      const response = await fetch(`/api/hospitals?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch hospitals');
      }

      const data: HospitalResponse = await response.json();
      setHospitals(data.items || []);
      setPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Error loading hospitals:', error);
      toast.error('Failed to load hospitals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    const ensureSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      fetchHospitals({ pageOverride: 1 });
    };

    ensureSession();
  }, [supabase, router, fetchHospitals]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setPage(1);
      setAppliedFilters(pendingFilters);
      fetchHospitals({ pageOverride: 1, silent: true, filtersOverride: pendingFilters });
    }, 450);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [pendingFilters, fetchHospitals]);

  const handleSearch = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setPage(1);
    setAppliedFilters(pendingFilters);
    fetchHospitals({ pageOverride: 1, silent: true, filtersOverride: pendingFilters });
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages) {
      return;
    }
    setPage(nextPage);
    fetchHospitals({ pageOverride: nextPage, silent: true });
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
              <FontAwesomeIcon icon={faHospital} className="fa-1x" />
              Hospitals
            </h1>
            <p className="text-blue-slate">Browse hospitals by district and speciality</p>
          </div>
          <div className="text-sm text-blue-slate">
            {total > 0 ? `${total} hospitals found` : 'No hospitals found'}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <input
              type="text"
              value={pendingFilters.name}
              onChange={(event) => setPendingFilters((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Search by name"
              className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
            />
            <input
              type="text"
              value={pendingFilters.district}
              onChange={(event) => setPendingFilters((prev) => ({ ...prev, district: event.target.value }))}
              placeholder="Filter by district"
              className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
            />
            <input
              type="text"
              value={pendingFilters.speciality}
              onChange={(event) => setPendingFilters((prev) => ({ ...prev, speciality: event.target.value }))}
              placeholder="Filter by speciality"
              className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
            />
            <div className="flex items-center">
              <button
                type="button"
                onClick={handleSearch}
                className="w-full bg-dim-grey/20 hover:bg-dim-grey/30 text-charcoal-blue px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                {refreshing ? 'Filtering...' : 'Search / Filter'}
              </button>
            </div>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-blue-slate">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-3">
              {refreshing && <LoadingSpinner fullScreen={false} />}
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="px-4 py-2 rounded-lg border border-dim-grey/40 text-charcoal-blue font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-lg border border-dim-grey/40 text-charcoal-blue font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {hospitals.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500 text-lg">No hospitals match your filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {hospitals.map((hospital) => (
              <div
                key={hospital.id}
                className="bg-white rounded-lg shadow-md p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-slate/10 flex items-center justify-center">
                    <FontAwesomeIcon icon={faHospital} className="text-xl text-blue-slate fa-1x" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-deep-space-blue">{hospital.name}</h2>
                    <p className="text-sm text-blue-slate">{hospital.district || 'District not listed'}</p>
                    <p className="text-sm text-blue-slate">{hospital.speciality || 'Speciality not listed'}</p>
                    {hospital.address && (
                      <p className="mt-2 text-sm text-charcoal-blue">{hospital.address}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-3 md:items-end">
                  {hospital.phone ? (
                    <a
                      href={`tel:${hospital.phone}`}
                      className="w-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 sm:w-auto"
                    >
                      <FontAwesomeIcon icon={faPhone} className="fa-1x" />
                      Call
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full bg-gray-200 text-gray-400 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 sm:w-auto cursor-not-allowed"
                    >
                      <FontAwesomeIcon icon={faPhone} className="fa-1x" />
                      No phone
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-blue-slate">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-3">
              {refreshing && <LoadingSpinner fullScreen={false} />}
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="px-4 py-2 rounded-lg border border-dim-grey/40 text-charcoal-blue font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-lg border border-dim-grey/40 text-charcoal-blue font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
