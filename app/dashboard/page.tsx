import StreakCard from '../components/StreakCard';
import StatsCard from '../components/StatsCard';
import MiniCalendar from '../components/MiniCalendar';
import TodaySchedule from '../components/TodaySchedule';
import styles from './Dashboard.module.css';

export const metadata = {
  title: 'Dashboard - Overview',
};

export default function DashboardPage() {
  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Dashboard Overview</h1>
        <p className={styles.pageSubtitle}>Track your progress and upcoming doses.</p>
      </div>

      <div className={styles.topRow}>
        <StreakCard />
        <StatsCard />
        <MiniCalendar />
      </div>

      <div className={styles.bottomRow}>
        <TodaySchedule />
      </div>
    </div>
  );
}