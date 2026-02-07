'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../utils/supabase/client';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ScannerModal from '../../../components/ScannerModal';
import { toast } from 'react-toastify';

interface PharmacyTag {
  id: string;
  name: string;
}

interface PharmacyForm {
  name: string;
  dosage: string;
  description: string;
  safety_warnings: string;
  category: string;
  tags: string;
  image_url: string;
  available_stock: number;
  stock_unit: string;
}

interface MedicineData {
  brand_name: string;
  dosage?: string;
  purpose: string | string[];
  active_ingredient: string | string[];
  warnings: string[];
  usage_timing: string;
  safety_flags: {
    drive: boolean;
    alcohol: boolean;
  };
}

export default function EditPharmacyMedicinePage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [form, setForm] = useState<PharmacyForm>({
    name: '',
    dosage: '',
    description: '',
    safety_warnings: '',
    category: '',
    tags: '',
    image_url: '',
    available_stock: 0,
    stock_unit: 'tablet',
  });

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

        const medicine = await response.json();
        const tagNames = (medicine.tags as PharmacyTag[] | undefined)?.map((tag) => tag.name).join(', ') || '';

        setForm({
          name: medicine.name || '',
          dosage: medicine.dosage || '',
          description: medicine.description || '',
          safety_warnings: medicine.safety_warnings || '',
          category: medicine.category || '',
          tags: tagNames,
          image_url: medicine.image_url || '',
          available_stock: Number(medicine.available_stock || 0),
          stock_unit: medicine.stock_unit || (medicine.category === 'syrup' ? 'ml' : 'tablet'),
        });
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

  const handleInputChange = (field: keyof PharmacyForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleScanConfirm = (medicineData: MedicineData) => {
    const activeIngredient = Array.isArray(medicineData.active_ingredient)
      ? medicineData.active_ingredient
      : medicineData.active_ingredient
      ? [medicineData.active_ingredient]
      : [];
    const notesParts = [] as string[];
    if (activeIngredient.length > 0) {
      notesParts.push(`Active ingredients: ${activeIngredient.join(', ')}`);
    }
    if (medicineData.warnings.length > 0) {
      notesParts.push(`Warnings: ${medicineData.warnings.join('; ')}`);
    }

    setForm((prev) => ({
      ...prev,
      name: medicineData.brand_name,
      dosage: medicineData.dosage ? medicineData.dosage : prev.dosage,
      description: prev.description || notesParts.join('\n'),
      safety_warnings: prev.safety_warnings || medicineData.warnings.join('; '),
    }));

    toast.success('Medicine details scanned successfully!');
  };

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/pharmacy-medicines/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      handleInputChange('image_url', data.image_url);
      toast.success('Image uploaded');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error('Medicine name is required');
      return;
    }

    if (!form.category) {
      toast.error('Category is required');
      return;
    }

    if (!form.tags.trim()) {
      toast.error('At least one tag is required');
      return;
    }

    const tags = form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      await toast.promise(
        fetch(`/api/pharmacy-medicines/${params.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            dosage: form.dosage || null,
            description: form.description || null,
            safety_warnings: form.safety_warnings || null,
            category: form.category,
            tags,
            image_url: form.image_url || null,
          }),
        }).then((response) => {
          if (!response.ok) {
            throw new Error('Failed to update medicine');
          }
          return response;
        }),
        {
          pending: 'Saving changes...',
          success: 'Medicine updated!',
        }
      );

      setTimeout(() => {
        router.push('/digital-pharmacy');
      }, 1200);
    } catch (error) {
      console.error('Error updating pharmacy medicine:', error);
      toast.error('Failed to update medicine');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-rosy-granite/5 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-deep-space-blue mb-8">🧪 Edit Pharmacy Medicine</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">Medicine Name *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="flex-1 px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-4 py-2 bg-dim-grey/20 hover:bg-dim-grey/30 text-charcoal-blue rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  📷 Scan
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal-blue mb-2">Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
                >
                  <option value="">Select category</option>
                  <option value="tablet">Tablet</option>
                  <option value="syrup">Syrup</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal-blue mb-2">Dosage</label>
                <input
                  type="text"
                  value={form.dosage}
                  onChange={(e) => handleInputChange('dosage', e.target.value)}
                  className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">Description / Notes</label>
              <textarea
                value={form.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
                rows={4}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">Safety Warnings</label>
              <textarea
                value={form.safety_warnings}
                onChange={(e) => handleInputChange('safety_warnings', e.target.value)}
                className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal-blue mb-2">Tags *</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => handleInputChange('tags', e.target.value)}
                  className="w-full px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
                />
                <p className="text-xs text-blue-slate mt-2">Separate tags with commas.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal-blue mb-2">Available Stock</label>
                <div className="px-4 py-2 border border-dim-grey/30 rounded-lg bg-blue-slate/5 text-charcoal-blue">
                  {form.available_stock} {form.stock_unit}
                </div>
                <p className="text-xs text-blue-slate mt-2">Use Refill on the list to update stock.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-blue mb-2">Picture</label>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  type="text"
                  value={form.image_url}
                  onChange={(e) => handleInputChange('image_url', e.target.value)}
                  placeholder="Paste an image URL or upload"
                  className="flex-1 px-4 py-2 border border-dim-grey/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal-blue focus:border-transparent"
                />
                <label className="px-4 py-2 bg-dim-grey/20 hover:bg-dim-grey/30 text-charcoal-blue rounded-lg font-semibold transition-colors cursor-pointer">
                  {uploading ? 'Uploading...' : 'Upload'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleUpload(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-charcoal-blue hover:bg-deep-space-blue text-white py-3 rounded-lg font-semibold transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>

      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onConfirm={handleScanConfirm}
      />
    </div>
  );
}
