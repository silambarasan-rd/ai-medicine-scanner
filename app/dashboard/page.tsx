'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { setupServiceWorkerListener } from '../utils/pushNotifications';
import StreakCard from '../components/StreakCard';
import StatsCard from '../components/StatsCard';
import MiniCalendar from '../components/MiniCalendar';
import TodaySchedule from '../components/TodaySchedule';
import ConfirmationModal from '../components/ConfirmationModal';
import styles from './Dashboard.module.css';

interface Medicine {
  id: string;
  name: string;
  dosage?: string;
  meal_timing?: string;
}

interface ConfirmationData {
  medicineId: string;
  scheduledDatetime: string;
  medicineName: string;
  dosage?: string;
  mealTiming?: string;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const confirmId = searchParams.get('confirm');
  const confirmTime = searchParams.get('time');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationData | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const loadMedicines = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      try {
        const response = await fetch('/api/medicines');
        if (!response.ok) throw new Error('Failed to fetch medicines');

        const medicinesData: Medicine[] = await response.json();
        if (medicinesData) {
          setMedicines(medicinesData);
        }

        const medicineLookup = new Map(medicinesData.map((medicine) => [medicine.id, medicine]));

        setupServiceWorkerListener((medicineId, scheduledDatetime, medicineName, dosage, mealTiming) => {
          const matchedMedicine = medicineLookup.get(medicineId);
          setConfirmationModal({
            medicineId,
            scheduledDatetime,
            medicineName: medicineName || matchedMedicine?.name || '',
            dosage: dosage || matchedMedicine?.dosage,
            mealTiming: mealTiming || matchedMedicine?.meal_timing
          });
        });

        if (confirmId && confirmTime) {
          const medicine = medicinesData.find((m) => m.id === confirmId);
          if (medicine) {
            setConfirmationModal({
              medicineId: confirmId,
              scheduledDatetime: confirmTime,
              medicineName: medicine.name,
              dosage: medicine.dosage,
              mealTiming: medicine.meal_timing
            });
          }
        }
      } catch (error) {
        console.error('Error loading medicines:', error);
      }
    };

    loadMedicines();
  }, [supabase, router, confirmId, confirmTime]);

  const handleConfirmation = useCallback(async (taken: boolean, notes?: string) => {
    if (!confirmationModal) return;

    const response = await fetch('/api/confirmations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        medicineId: confirmationModal.medicineId,
        scheduledDatetime: confirmationModal.scheduledDatetime,
        taken,
        skipped: !taken,
        notes: notes || null,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save confirmation');
    }

    setConfirmationModal(null);
    setRefreshKey(prev => prev + 1);
  }, [confirmationModal]);

  return (
    <>
      <div className={styles.dashboardContainer}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Dashboard Overview</h1>
          <p className={styles.pageSubtitle}>Track your progress and upcoming doses.</p>
        </div>

        <div className={styles.topRow}>
          <StreakCard key={`streak-${refreshKey}`} />
          <StatsCard key={`stats-${refreshKey}`} />
          <MiniCalendar key={`calendar-${refreshKey}`} />
        </div>

        <div className={styles.bottomRow}>
          <TodaySchedule key={`schedule-${refreshKey}`} />
        </div>
      </div>

      {confirmationModal && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setConfirmationModal(null)}
          medicineName={confirmationModal.medicineName}
          medicineId={confirmationModal.medicineId}
          scheduledDatetime={confirmationModal.scheduledDatetime}
          dosage={confirmationModal.dosage}
          mealTiming={confirmationModal.mealTiming}
          onConfirm={handleConfirmation}
        />
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}