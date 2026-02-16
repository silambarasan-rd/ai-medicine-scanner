'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './StreakCard.module.css';

type Milestone = {
  days: number;
  label: string;
  tier: string;
  achieved: boolean;
  progress: number;
};

type StreakData = {
  currentStreak: number;
  bestStreak: number;
  milestones: Milestone[];
  completionRate: number;
};

const tierClassMap: Record<string, string> = {
  bronze: styles.tierBronze,
  silver: styles.tierSilver,
  gold: styles.tierGold,
  platinum: styles.tierPlatinum,
  diamond: styles.tierDiamond,
  crown: styles.tierCrown,
};

export default function StreakCard() {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/streak', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load streak');
      }
      const payload = (await response.json()) as StreakData;
      setData(payload);
    } catch (err) {
      console.error('Error loading streak:', err);
      setError('Unable to load streak data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <section className={styles.card} aria-busy="true">
        <div className={styles.skeletonHeader}></div>
        <div className={styles.skeletonBar}></div>
        <div className={styles.skeletonBar}></div>
        <div className={styles.skeletonBar}></div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className={styles.card}>
        <div className={styles.error}>{error || 'No data available.'}</div>
        <button className={styles.retryButton} onClick={loadData} type="button">
          Retry
        </button>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Current Streak</p>
          <h3 className={styles.streakValue}>
            {data.currentStreak} {data.currentStreak === 1 ? 'day' : 'days'}
          </h3>
          <p className={styles.bestValue}>
            Best: {data.bestStreak} {data.bestStreak === 1 ? 'day' : 'days'}
          </p>
        </div>
      </div>

      <div className={styles.milestones}>
        {data.milestones.map((milestone) => (
          <div key={milestone.days} className={styles.milestoneRow}>
            <div className={styles.milestoneHeader}>
              <span className={styles.milestoneLabel}>
                {milestone.label} - {milestone.days} days
              </span>
              <span className={styles.milestoneValue}>
                {milestone.achieved ? 'Done' : `${milestone.progress}%`}
              </span>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={`${styles.progressFill} ${tierClassMap[milestone.tier] || ''}`}
                style={{ width: `${milestone.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.completionRate}>Overall: {data.completionRate}% on time</div>
    </section>
  );
}
