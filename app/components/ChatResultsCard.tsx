// app/components/ChatResultsCard.tsx
'use client';

import Link from 'next/link';
import styles from './ChatResultsCard.module.css';

interface ResultItem {
  id?: string;
  name?: string;
  district?: string;
  phone?: string;
  speciality?: string;
  dosage?: string;
  occurrence?: string;
  quantity?: number;
  unit?: string;
  date_take?: string;
  status?: string;
  [key: string]: unknown;
}

interface ChatResultsCardProps {
  type: string;
  items: ResultItem[];
  total: number;
  viewAllUrl?: string;
}

export default function ChatResultsCard({
  type,
  items,
  total,
  viewAllUrl,
}: ChatResultsCardProps) {
  if (!items.length) {
    return (
      <div className={styles.noResults}>
        <p>No results found</p>
      </div>
    );
  }

  return (
    <div className={styles.resultsContainer}>
      <div className={styles.resultsList}>
        {type === 'hospitals' && (
          <div className={styles.hospitalsList}>
            {items.map((item, idx) => (
              <div key={item.id || idx} className={styles.hospitalCard}>
                <div className={styles.hospitalHeader}>
                  <h4>{item.name}</h4>
                  <span className={styles.district}>{item.district}</span>
                </div>
                <div className={styles.hospitalInfo}>
                  {item.phone && <p>📞 {item.phone}</p>}
                  {item.speciality && <p>🏥 {item.speciality}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {type === 'medicines' && (
          <div className={styles.medicinesList}>
            {items.map((item, idx) => (
              <div key={item.id || idx} className={styles.medicineCard}>
                <div className={styles.medicineHeader}>
                  <h4>{item.name}</h4>
                  <span className={styles.occurrence}>{item.occurrence}</span>
                </div>
                <p className={styles.dosage}>💊 {item.dosage}</p>
              </div>
            ))}
          </div>
        )}

        {type === 'pharmacy_medicines' && (
          <div className={styles.pharmList}>
            {items.map((item, idx) => (
              <div key={item.id || idx} className={styles.pharmCard}>
                <div className={styles.pharmHeader}>
                  <h4>{item.name}</h4>
                  <span className={styles.quantity}>{item.quantity} {item.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {type === 'confirmations' && (
          <div className={styles.confirmationsList}>
            {items.map((item, idx) => (
              <div
                key={idx}
                className={`${styles.confirmationCard} ${
                  item.status === 'taken' ? styles.taken : styles.skipped
                }`}
              >
                <span className={styles.date}>{item.date_take}</span>
                <span className={styles.statusBadge}>
                  {item.status === 'taken' ? '✓ Taken' : '✗ Skipped'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View All Button */}
      {total > 15 && viewAllUrl && (
        <Link href={viewAllUrl} className={styles.viewAllButton}>
          View All {total} Results →
        </Link>
      )}

      {/* Results Summary */}
      {total > 0 && (
        <p className={styles.resultsSummary}>
          Showing {Math.min(15, total)} of {total} results
        </p>
      )}
    </div>
  );
}
