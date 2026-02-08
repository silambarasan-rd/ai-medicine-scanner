'use client';

import React, { useState } from 'react';
import styles from './ConfirmationModal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCapsules, faUtensils, faCircle, faSlash } from '@fortawesome/free-solid-svg-icons';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicineName: string;
  medicineId: string;
  scheduledDatetime: string;
  dosage?: string;
  mealTiming?: string;
  onConfirm: (taken: boolean, notes?: string) => Promise<void>;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  medicineName,
  scheduledDatetime,
  dosage,
  mealTiming,
  onConfirm
}: ConfirmationModalProps) {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'taken' | 'skipped' | ''>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!status) {
      setError('Please select Taken or Skipped');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onConfirm(status === 'taken', notes || undefined);
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

    return date.toLocaleString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
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
            <div className={styles.medicineIcon}>
              <FontAwesomeIcon icon={faCapsules} className="fa-1x" />
            </div>
            <div>
              <h3>{medicineName}</h3>
              {dosage && <p className={styles.dosage}>{dosage}</p>}
            </div>
          </div>

          <div className={styles.scheduledInfo}>
            <p className={styles.scheduledTime}>
              <strong>Date & Time:</strong> {formatDateTime(scheduledDatetime)}
            </p>
            {mealTiming && (
              <div className={styles.mealBadge}>
                {mealTiming === 'after' ? (
                  <span className="inline-flex items-center rounded-md bg-green-50 px-3 py-1 text-sm font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                    <FontAwesomeIcon icon={faUtensils} className="mr-1 fa-1x" />
                    After Meal
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                    <span className="fa-stack" style={{ fontSize: '0.8em', verticalAlign: 'middle', marginRight: '4px' }}>
                      <FontAwesomeIcon icon={faCircle} className="fa-stack-2x" />
                      <FontAwesomeIcon icon={faSlash} className="fa-stack-1x fa-inverse" />
                      <FontAwesomeIcon icon={faUtensils} className="fa-stack-1x fa-inverse" />
                    </span>
                    Before Meal
                  </span>
                )}
              </div>
            )}
          </div>

          <div className={styles.statusSection}>
            <label htmlFor="status">Status:</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'taken' | 'skipped' | '')}
              className={styles.statusSelect}
            >
              <option value="">Select status...</option>
              <option value="taken">Taken</option>
              <option value="skipped">Skipped</option>
            </select>
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
            className={`${styles.button} ${styles.cancelButton}`}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className={`${styles.button} ${styles.confirmButton}`}
            onClick={handleConfirm}
            disabled={loading || !status}
          >
            {loading ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
