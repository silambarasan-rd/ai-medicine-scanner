'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './TodaySchedule.module.css';

type ScheduleStatus = 'pending' | 'taken' | 'skipped';

type MedicineSchedule = {
  id: string;
  name: string;
  dosage: string | null;
  timing: 'morning' | 'afternoon' | 'evening' | 'night';
  scheduled_time: string;
  meal_timing?: string | null;
  status: ScheduleStatus;
  scheduled_datetime: string;
};

type SchedulePayload = {
  total: number;
  taken: number;
  pending: number;
  medicines: MedicineSchedule[];
};

const timingOrder: Array<MedicineSchedule['timing']> = ['morning', 'afternoon', 'evening', 'night'];

const timingLabels: Record<MedicineSchedule['timing'], string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
};

export default function TodaySchedule() {
  const [data, setData] = useState<SchedulePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/today-schedule', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load today schedule');
      }
      const payload = (await response.json()) as SchedulePayload;
      setData(payload);
    } catch (err) {
      console.error('Error loading today schedule:', err);
      setError('Unable to load today schedule.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!data) return;
    setCollapsedGroups((prev) => {
      const nextCollapsed: Record<string, boolean> = { ...prev };
      timingOrder.forEach((timing) => {
        if (nextCollapsed[timing] !== undefined) return;
        const groupItems = data.medicines.filter((medicine) => medicine.timing === timing);
        if (groupItems.length === 0) return;
        const allDone = groupItems.every((medicine) => medicine.status !== 'pending');
        nextCollapsed[timing] = allDone;
      });
      return nextCollapsed;
    });
  }, [data]);

  const grouped = useMemo(() => {
    const groups: Record<MedicineSchedule['timing'], MedicineSchedule[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    };

    data?.medicines.forEach((medicine) => {
      groups[medicine.timing].push(medicine);
    });

    timingOrder.forEach((timing) => {
      groups[timing].sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
    });

    return groups;
  }, [data]);

  const completionRate = useMemo(() => {
    if (!data || data.total === 0) return 0;
    return Math.round((data.taken / data.total) * 100);
  }, [data]);

  const handleAction = useCallback(
    async (medicine: MedicineSchedule, status: ScheduleStatus) => {
      try {
        setUpdatingId(medicine.id);
        const response = await fetch('/api/confirmations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            medicineId: medicine.id,
            scheduledDatetime: medicine.scheduled_datetime,
            taken: status === 'taken',
            skipped: status === 'skipped',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update confirmation');
        }

        setData((prev) => {
          if (!prev) return prev;
          const nextMedicines = prev.medicines.map((item) =>
            item.id === medicine.id && item.scheduled_datetime === medicine.scheduled_datetime
              ? { ...item, status }
              : item
          );
          const nextTaken = nextMedicines.filter((item) => item.status === 'taken').length;
          const nextPending = nextMedicines.filter((item) => item.status === 'pending').length;

          return {
            ...prev,
            medicines: nextMedicines,
            taken: nextTaken,
            pending: nextPending,
          };
        });
      } catch (err) {
        console.error('Error updating confirmation:', err);
        setError('Unable to update confirmation.');
      } finally {
        setUpdatingId(null);
      }
    },
    []
  );

  if (loading) {
    return (
      <section className={styles.card} aria-busy="true">
        <div className={styles.skeletonRow}></div>
        <div className={styles.skeletonRow}></div>
        <div className={styles.skeletonRow}></div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className={styles.card}>
        <div className={styles.error}>{error || 'No schedule available.'}</div>
        <button className={styles.retryButton} onClick={loadData} type="button">
          Retry
        </button>
      </section>
    );
  }

  if (data.total === 0) {
    return (
      <section className={styles.card}>
        <h3 className={styles.title}>Today</h3>
        <p className={styles.empty}>No medicines scheduled for today.</p>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Today</h3>
          <p className={styles.subtitle}>
            {data.taken}/{data.total} doses completed
          </p>
        </div>
        <div className={styles.percentage}>{completionRate}%</div>
      </div>

      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${completionRate}%` }} />
      </div>

      {timingOrder.map((timing) => {
        const items = grouped[timing];
        if (!items || items.length === 0) return null;

        const doneCount = items.filter((item) => item.status !== 'pending').length;
        const collapsed = collapsedGroups[timing];

        return (
          <div key={timing} className={styles.group}>
            <button
              className={styles.groupHeader}
              type="button"
              onClick={() =>
                setCollapsedGroups((prev) => ({
                  ...prev,
                  [timing]: !prev[timing],
                }))
              }
            >
              <span className={styles.groupTitle}>{timingLabels[timing]}</span>
              <span className={styles.groupCount}>
                {doneCount}/{items.length}
              </span>
            </button>
            {!collapsed ? (
              <div className={styles.groupList}>
                {items.map((medicine) => (
                  <div key={`${medicine.id}-${medicine.scheduled_datetime}`} className={styles.medicineRow}>
                    <div className={styles.medicineInfo}>
                      <div className={styles.medicineName}>{medicine.name}</div>
                      <div className={styles.medicineMeta}>
                        <span>{medicine.dosage || 'Dose'}</span>
                        <span className={styles.dot}>·</span>
                        <span>{medicine.scheduled_time}</span>
                      </div>
                    </div>
                    <div className={styles.medicineActions}>
                      <span className={`${styles.status} ${styles[medicine.status]}`}>
                        {medicine.status}
                      </span>
                      {medicine.status === 'pending' && new Date(medicine.scheduled_datetime).getTime() <= Date.now() ? (
                        <div className={styles.actionButtons}>
                          <button
                            className={styles.takeButton}
                            type="button"
                            disabled={updatingId === medicine.id}
                            onClick={() => handleAction(medicine, 'taken')}
                          >
                            Mark taken
                          </button>
                          <button
                            className={styles.skipButton}
                            type="button"
                            disabled={updatingId === medicine.id}
                            onClick={() => handleAction(medicine, 'skipped')}
                          >
                            Skip
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
