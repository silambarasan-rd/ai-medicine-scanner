'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import styles from './MiniCalendar.module.css';

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

export default function MiniCalendar() {
  const [activeStartDate, setActiveStartDate] = useState<Date>(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMonth = useCallback(async (date: Date) => {
    try {
      setLoading(true);
      setError(null);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const response = await fetch(`/api/calendar-data?year=${year}&month=${month}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load calendar data');
      }
      const payload = (await response.json()) as { days: CalendarDay[] };
      setCalendarDays(payload.days || []);
    } catch (err) {
      console.error('Error loading calendar data:', err);
      setError('Unable to load calendar data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMonth(activeStartDate);
  }, [activeStartDate, loadMonth]);

  const dayMap = useMemo(() => new Map(calendarDays.map((day) => [day.date, day])), [calendarDays]);

  const todayKey = formatDateKey(new Date());

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Mini Calendar</h3>
        {loading ? <span className={styles.status}>Updating...</span> : null}
      </div>
      {error ? <div className={styles.error}>{error}</div> : null}
      <Calendar
        className={styles.calendar}
        activeStartDate={activeStartDate}
        onActiveStartDateChange={({ activeStartDate: nextStartDate }) => {
          if (nextStartDate) {
            setActiveStartDate(nextStartDate);
          }
        }}
        tileDisabled={({ date, view }) => view === 'month' && date > new Date()}
        tileClassName={({ date, view }) => {
          if (view !== 'month') return null;
          const key = formatDateKey(date);
          const day = dayMap.get(key);
          const classes = [styles.tile];
          if (day?.status) {
            classes.push(styles[day.status]);
          }
          if (key === todayKey) {
            classes.push(styles.today);
          }
          if (date > new Date()) {
            classes.push(styles.future);
          }
          return classes.join(' ');
        }}
        tileContent={({ date, view }) => {
          if (view !== 'month') return null;
          const key = formatDateKey(date);
          const day = dayMap.get(key);
          const title = day
            ? `${day.taken}/${day.total} taken`
            : 'No medicines scheduled';
          return <span className={styles.tileDot} title={title} />;
        }}
      />
    </section>
  );
}
