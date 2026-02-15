'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './StatsCard.module.css';

type TodaySchedule = {
  total: number;
  taken: number;
  pending: number;
};

type CalendarDay = {
  date: string;
  total: number;
  taken: number;
  percentage: number;
  status: 'complete' | 'partial' | 'none';
};

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPercentageClass = (value: number) => {
  if (value >= 80) return styles.good;
  if (value >= 50) return styles.mid;
  return styles.low;
};

export default function StatsCard() {
  const [todayData, setTodayData] = useState<TodaySchedule | null>(null);
  const [monthDays, setMonthDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const [todayResponse, monthResponse] = await Promise.all([
        fetch('/api/today-schedule', { cache: 'no-store' }),
        fetch(`/api/calendar-data?year=${year}&month=${month}`, { cache: 'no-store' }),
      ]);

      if (!todayResponse.ok || !monthResponse.ok) {
        throw new Error('Failed to load stats');
      }

      const todayPayload = (await todayResponse.json()) as TodaySchedule;
      const monthPayload = (await monthResponse.json()) as { days: CalendarDay[] };

      setTodayData(todayPayload);
      setMonthDays(monthPayload.days || []);
    } catch (err) {
      console.error('Error loading stats:', err);
      setError('Unable to load stats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { weekRate, monthRate } = useMemo(() => {
    const dayMap = new Map(monthDays.map((day) => [day.date, day]));
    const now = new Date();

    let weekTotal = 0;
    let weekTaken = 0;
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const key = formatDateKey(date);
      const day = dayMap.get(key);
      if (day) {
        weekTotal += day.total;
        weekTaken += day.taken;
      }
    }

    let monthTotal = 0;
    let monthTaken = 0;
    monthDays.forEach((day) => {
      monthTotal += day.total;
      monthTaken += day.taken;
    });

    const weekRateValue = weekTotal ? Math.round((weekTaken / weekTotal) * 100) : 0;
    const monthRateValue = monthTotal ? Math.round((monthTaken / monthTotal) * 100) : 0;

    return { weekRate: weekRateValue, monthRate: monthRateValue };
  }, [monthDays]);

  if (loading) {
    return (
      <section className={styles.card} aria-busy="true">
        <div className={styles.skeletonRow}></div>
        <div className={styles.skeletonRow}></div>
        <div className={styles.skeletonRow}></div>
      </section>
    );
  }

  if (error || !todayData) {
    return (
      <section className={styles.card}>
        <div className={styles.error}>{error || 'No stats available.'}</div>
        <button className={styles.retryButton} onClick={loadData} type="button">
          Retry
        </button>
      </section>
    );
  }

  const totalToday = todayData.total || 0;
  const takenToday = todayData.taken || 0;
  const completionToday = totalToday ? Math.round((takenToday / totalToday) * 100) : 0;

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Quick Stats</h3>
      </div>
      <div className={styles.grid}>
        <div className={styles.statBox}>
          <p className={styles.statLabel}>Total Today</p>
          <p className={styles.statValue}>{totalToday}</p>
          <p className={styles.statSubtext}>Scheduled doses</p>
        </div>
        <div className={`${styles.statBox} ${getPercentageClass(completionToday)}`}>
          <p className={styles.statLabel}>Completion Today</p>
          <p className={styles.statValue}>{completionToday}%</p>
          <p className={styles.statSubtext}>{takenToday} taken</p>
        </div>
        <div className={`${styles.statBox} ${getPercentageClass(weekRate)}`}>
          <p className={styles.statLabel}>This Week</p>
          <p className={styles.statValue}>{weekRate}%</p>
          <p className={styles.statSubtext}>Last 7 days</p>
        </div>
        <div className={`${styles.statBox} ${getPercentageClass(monthRate)}`}>
          <p className={styles.statLabel}>This Month</p>
          <p className={styles.statValue}>{monthRate}%</p>
          <p className={styles.statSubtext}>Month to date</p>
        </div>
      </div>
    </section>
  );
}
