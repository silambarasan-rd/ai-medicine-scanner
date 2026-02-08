'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '../../utils/supabase/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCapsules } from '@fortawesome/free-solid-svg-icons';

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

export default function PharmacyMedicineDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [medicine, setMedicine] = useState<PharmacyMedicine | null>(null);

  useEffect(() => {
    const loadMedicine = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      try {
        const response = await fetch(`/api/pharmacy-medicines/${params.id}`);
        if (!response.ok) {
          throw new Error('Medicine not found');
        }

        const data = await response.json();
        setMedicine(data);
      } catch (error) {
        console.error('Error loading pharmacy medicine:', error);
        toast.error('Medicine not found');
        setTimeout(() => router.push('/digital-pharmacy'), 1500);
      } finally {
        setLoading(false);
      }
    };

    loadMedicine();
  }, [supabase, router, params]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!medicine) {
    return null;
  }

  return (
    <div className="min-h-screen bg-rosy-granite/5 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-blue-slate">Digital Pharmacy</p>
            <h1 className="text-3xl font-bold text-deep-space-blue">{medicine.name}</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/digital-pharmacy')}
              className="bg-dim-grey/20 hover:bg-dim-grey/30 text-charcoal-blue px-5 py-2 rounded-lg font-semibold transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => router.push(`/digital-pharmacy/edit/${medicine.id}`)}
              className="bg-charcoal-blue hover:bg-deep-space-blue text-white px-5 py-2 rounded-lg font-semibold transition-colors"
            >
              Edit
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="w-full md:w-56">
              <div className="w-full h-56 rounded-2xl bg-blue-slate/10 flex items-center justify-center overflow-hidden">
                {medicine.image_url ? (
                  <Image
                    src={medicine.image_url}
                    alt={medicine.name}
                    width={224}
                    height={224}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <FontAwesomeIcon icon={faCapsules} className="text-5xl text-blue-slate fa-1x" />
                )}
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-blue-slate">Category</p>
                  <p className="text-base font-semibold text-charcoal-blue">{medicine.category}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-slate">Stock</p>
                  <p className="text-base font-semibold text-charcoal-blue">
                    {medicine.available_stock} {medicine.stock_unit}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-blue-slate">Dosage</p>
                  <p className="text-base font-semibold text-charcoal-blue">
                    {medicine.dosage || 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-blue-slate">Tags</p>
                  {medicine.tags && medicine.tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {medicine.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="px-2 py-1 text-xs rounded-full bg-rosy-granite/20 text-charcoal-blue"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-base font-semibold text-charcoal-blue">No tags</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm text-blue-slate">Description</p>
                <p className="text-base text-charcoal-blue">
                  {medicine.description || 'No description provided.'}
                </p>
              </div>

              <div>
                <p className="text-sm text-blue-slate">Safety Warnings</p>
                <p className="text-base text-charcoal-blue">
                  {medicine.safety_warnings || 'No warnings provided.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
