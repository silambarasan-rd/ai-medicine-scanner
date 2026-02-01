'use client';

import React, { useState } from 'react';
import styles from './ConfirmationModal.module.css';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicineName: string;
  medicineId: string;
  scheduledDatetime: string;
  dosage?: string;
  onConfirm: (taken: boolean, notes?: string) => Promise<void>;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  medicineName,
  scheduledDatetime,
  dosage,
  onConfirm
}: ConfirmationModalProps) {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async (taken: boolean) => {
    setLoading(true);
    setError(null);

    try {
      await onConfirm(taken, notes || undefined);
      onClose();
    } catch (err) {
      console.error('Error confirming medicine:', err);
      setError('Failed to save confirmation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (datetime: string) => {
    const date = new Date(datetime);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Medicine Confirmation</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.medicineInfo}>
            <div className={styles.medicineIcon}>💊</div>
            <div>
              <h3>{medicineName}</h3>
              {dosage && <p className={styles.dosage}>{dosage}</p>}
              <p className={styles.scheduledTime}>
                Scheduled for: {formatDateTime(scheduledDatetime)}
              </p>
            </div>
          </div>

          <div className={styles.question}>
            <p>Did you take this medicine?</p>
          </div>

          <div className={styles.notesSection}>
            <label htmlFor="notes">Notes (optional):</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this dose..."
              rows={3}
              className={styles.notesInput}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.modalFooter}>
          <button
            className={`${styles.button} ${styles.skipButton}`}
            onClick={() => handleConfirm(false)}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Skipped'}
          </button>
          <button
            className={`${styles.button} ${styles.takenButton}`}
            onClick={() => handleConfirm(true)}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Taken ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}
