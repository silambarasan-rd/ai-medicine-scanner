'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import styles from './MiniCalendar.module.css';
import { getTimeZoneDateKey, getTimeZoneTimestampMs, normalizeUtcDateKeyToTimeZone } from '../utils/timezone';

type CalendarDay = {
  date: string;
  total: number;
  taken: number;
  skipped: number;
  percentage: number;
  status: 'complete' | 'partial' | 'none';
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
      const normalizedDays = (payload.days || []).map((day) => ({
        ...day,
        date: normalizeUtcDateKeyToTimeZone(day.date),
      }));
      setCalendarDays(normalizedDays);
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

  const todayKey = getTimeZoneDateKey(new Date());
  const nowIstMs = getTimeZoneTimestampMs(new Date());

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
        showNavigation={true}
        tileDisabled={() => false}
        tileClassName={({ date, view }) => {
          if (view !== 'month') return null;
          const key = getTimeZoneDateKey(date);
          const day = dayMap.get(key);
          const classes = [styles.tile];
          if (day?.status) {
            classes.push(styles[day.status]);
          }
          if (key === todayKey) {
            classes.push(styles.today);
          }
          if (getTimeZoneTimestampMs(date) > nowIstMs) {
            classes.push(styles.future);
          }
          return classes.join(' ');
        }}
        tileContent={({ date, view }) => {
          if (view !== 'month') return null;
          const key = getTimeZoneDateKey(date);
          const day = dayMap.get(key);
          let title = 'No medicines scheduled';
          if (day) {
            const parts = [];
            if (day.taken > 0) parts.push(`${day.taken} Taken`);
            if (day.skipped > 0) parts.push(`${day.skipped} Skipped`);
            const pending = day.total - day.taken - day.skipped;
            if (pending > 0) parts.push(`${pending} Pending`);
            title = parts.length > 0 ? parts.join(', ') : `${day.total} medicines`;
          }
          return (
            <>
              <span 
                className={styles.tooltipOverlay} 
                data-tooltip-id="custom-tooltip" 
                data-tooltip-content={title}
              />
              <span className={styles.tileDot} />
            </>
          );
        }}
      />
      <Tooltip id="custom-tooltip" delayShow={400} openOnClick={true} />
    </section>
  );
}
