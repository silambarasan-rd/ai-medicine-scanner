'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmationModal from '../components/ConfirmationModal';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import styles from './Dashboard.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUtensils, faBell, faBellSlash } from '@fortawesome/free-solid-svg-icons';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  checkNotificationStatus,
  setupServiceWorkerListener
} from '../utils/pushNotifications';

interface Medicine {
  id: string;
  name: string;
  timing: string;
  dosage?: string;
  occurrence?: string;
  nextDueDate?: string;
  meal_timing?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    medicine: Medicine;
    confirmed?: boolean;
    taken?: boolean;
  };
}

interface ConfirmationData {
  medicineId: string;
  scheduledDatetime: string;
  medicineName: string;
  dosage?: string;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [confirmations, setConfirmations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationData | null>(null);

  useEffect(() => {
    const loadMedicines = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      try {
        // Load medicines
        const response = await fetch('/api/medicines');
        if (!response.ok) {
          throw new Error('Failed to fetch medicines');
        }

        const medicinesData = await response.json();

        if (medicinesData) {
          setMedicines(medicinesData);
          await loadConfirmations();
          generateEvents(medicinesData);
        }

        // Check notification status
        const status = await checkNotificationStatus();
        setNotificationsEnabled(status.subscribed);

        // Setup service worker listener for confirmation modal
        setupServiceWorkerListener((medicineId, scheduledDatetime) => {
          const medicine = medicinesData.find((m: any) => m.id === medicineId);
          if (medicine) {
            setConfirmationModal({
              medicineId,
              scheduledDatetime,
              medicineName: medicine.name,
              dosage: medicine.dosage
            });
          }
        });

        // Check if opened from notification with query params
        const confirmId = searchParams.get('confirm');
        const confirmTime = searchParams.get('time');
        if (confirmId && confirmTime) {
          const medicine = medicinesData.find((m: any) => m.id === confirmId);
          if (medicine) {
            setConfirmationModal({
              medicineId: confirmId,
              scheduledDatetime: confirmTime,
              medicineName: medicine.name,
              dosage: medicine.dosage
            });
          }
        }
      } catch (error) {
        console.error('Error loading medicines:', error);
      }

      setLoading(false);
    };

    loadMedicines();
  }, [supabase, router, searchParams]);

  const loadConfirmations = async () => {
    try {
      const response = await fetch('/api/confirmations');
      if (response.ok) {
        const data = await response.json();
        setConfirmations(data.confirmations || []);
      }
    } catch (error) {
      console.error('Error loading confirmations:', error);
    }
  };

  const handleToggleNotifications = async () => {
    setNotificationLoading(true);
    try {
      if (notificationsEnabled) {
        await unsubscribeFromPushNotifications();
        setNotificationsEnabled(false);
      } else {
        await subscribeToPushNotifications();
        setNotificationsEnabled(true);
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      alert('Failed to toggle notifications. Please check your browser settings.');
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleConfirmMedicine = async (taken: boolean, notes?: string) => {
    if (!confirmationModal) return;

    try {
      const response = await fetch('/api/confirmations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicineId: confirmationModal.medicineId,
          scheduledDatetime: confirmationModal.scheduledDatetime,
          taken,
          skipped: !taken,
          notes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save confirmation');
      }

      // Reload confirmations and regenerate events
      await loadConfirmations();
      generateEvents(medicines);
      setConfirmationModal(null);
    } catch (error) {
      console.error('Error confirming medicine:', error);
      throw error;
    }
  };

  const generateEvents = (medicinesList: any[]) => {
    console.log('📋 Generating events from medicines:', medicinesList);
    const generatedEvents: CalendarEvent[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight for date comparison
    const endDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000); // Next 90 days

    const colors = ['#3e4c5e', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    // Helper function to convert 24h to 12h format with AM/PM
    const formatTime12Hour = (hours: number, minutes: number) => {
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      const mins = minutes.toString().padStart(2, '0');
      return `${hour12}:${mins} ${period}`;
    };

    // Helper to check if event is confirmed
    const getConfirmationStatus = (medicineId: string, eventStart: Date) => {
      const confirmation = confirmations.find(c => 
        c.medicine_id === medicineId &&
        new Date(c.scheduled_datetime).getTime() === eventStart.getTime()
      );
      return confirmation ? { confirmed: true, taken: confirmation.taken } : { confirmed: false, taken: false };
    };

    medicinesList.forEach((medicine, index) => {
      console.log(`Processing medicine ${index}:`, medicine);
      const color = colors[index % colors.length];

      // Parse the medicine's scheduled date and time
      if (medicine.scheduled_date && medicine.timing) {
        // Parse scheduled_date properly (PostgreSQL DATE comes as YYYY-MM-DD string)
        const scheduleDate = new Date(medicine.scheduled_date + 'T00:00:00');
        
        console.log(`  Schedule date: ${scheduleDate}, Today: ${today}, In range: ${scheduleDate >= today && scheduleDate <= endDate}`);
        
        // Handle timing format (can be HH:MM or HH:MM:SS from PostgreSQL TIME type)
        const timeParts = medicine.timing.split(':');
        const hours = parseInt(timeParts[0] || '9', 10);
        const minutes = parseInt(timeParts[1] || '0', 10);
        const timeFormatted = formatTime12Hour(hours, minutes);
        
        console.log(`  Time parts: ${hours}:${minutes} (${timeFormatted})`);

        // Handle different occurrence types
        if (medicine.occurrence === 'once') {
          if (scheduleDate >= today && scheduleDate <= endDate) {
            const eventStart = new Date(scheduleDate);
            eventStart.setHours(hours, minutes, 0);
            
            const confirmStatus = getConfirmationStatus(medicine.id, eventStart);
            const eventColor = confirmStatus.confirmed 
              ? (confirmStatus.taken ? '#10b981' : '#9ca3af')
              : color;
            
            const event = {
              id: `${medicine.id}-${scheduleDate.getTime()}`,
              title: `${confirmStatus.confirmed ? (confirmStatus.taken ? '✓' : '✗') : ''} ${medicine.name} - ${timeFormatted}`.trim(),
              start: eventStart.toISOString(),
              end: new Date(eventStart.getTime() + 3600000).toISOString(),
              backgroundColor: eventColor,
              borderColor: eventColor,
              extendedProps: { 
                medicine,
                confirmed: confirmStatus.confirmed,
                taken: confirmStatus.taken
              },
            };
            console.log('  ✅ Added once event:', event);
            generatedEvents.push(event);
          }
        } else if (medicine.occurrence === 'daily') {
          // Generate daily events for 90 days
          const currentDate = new Date(scheduleDate);
          let count = 0;
          while (currentDate <= endDate && count < 90) {
            if (currentDate >= today) {
              const eventStart = new Date(currentDate);
              eventStart.setHours(hours, minutes, 0);

              const confirmStatus = getConfirmationStatus(medicine.id, eventStart);
              const eventColor = confirmStatus.confirmed 
                ? (confirmStatus.taken ? '#10b981' : '#9ca3af')
                : color;

              generatedEvents.push({
                id: `${medicine.id}-${currentDate.toDateString()}`,
                title: `${confirmStatus.confirmed ? (confirmStatus.taken ? '✓' : '✗') : ''} ${medicine.name} - ${timeFormatted}`.trim(),
                start: eventStart.toISOString(),
                end: new Date(eventStart.getTime() + 3600000).toISOString(),
                backgroundColor: eventColor,
                borderColor: eventColor,
                extendedProps: { 
                  medicine,
                  confirmed: confirmStatus.confirmed,
                  taken: confirmStatus.taken
                },
              });
              count++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
          console.log(`  ✅ Added ${count} daily events`);
        } else if (medicine.occurrence === 'weekly') {
          // Generate weekly events
          const currentDate = new Date(scheduleDate);
          let count = 0;
          while (currentDate <= endDate && count < 13) {
            if (currentDate >= today) {
              const eventStart = new Date(currentDate);
              eventStart.setHours(hours, minutes, 0);

              const confirmStatus = getConfirmationStatus(medicine.id, eventStart);
              const eventColor = confirmStatus.confirmed 
                ? (confirmStatus.taken ? '#10b981' : '#9ca3af')
                : color;

              generatedEvents.push({
                id: `${medicine.id}-${currentDate.toDateString()}`,
                title: `${confirmStatus.confirmed ? (confirmStatus.taken ? '✓' : '✗') : ''} ${medicine.name} - ${timeFormatted}`.trim(),
                start: eventStart.toISOString(),
                end: new Date(eventStart.getTime() + 3600000).toISOString(),
                backgroundColor: eventColor,
                borderColor: eventColor,
                extendedProps: { 
                  medicine,
                  confirmed: confirmStatus.confirmed,
                  taken: confirmStatus.taken
                },
              });
              count++;
            }
            currentDate.setDate(currentDate.getDate() + 7);
          }
          console.log(`  ✅ Added ${count} weekly events`);
        } else if (medicine.occurrence === 'monthly') {
          // Generate monthly events
          const currentDate = new Date(scheduleDate);
          let count = 0;
          while (currentDate <= endDate && count < 3) {
            if (currentDate >= today) {
              const eventStart = new Date(currentDate);
              eventStart.setHours(hours, minutes, 0);

              const confirmStatus = getConfirmationStatus(medicine.id, eventStart);
              const eventColor = confirmStatus.confirmed 
                ? (confirmStatus.taken ? '#10b981' : '#9ca3af')
                : color;

              generatedEvents.push({
                id: `${medicine.id}-${currentDate.toDateString()}`,
                title: `${confirmStatus.confirmed ? (confirmStatus.taken ? '✓' : '✗') : ''} ${medicine.name} - ${timeFormatted}`.trim(),
                start: eventStart.toISOString(),
                end: new Date(eventStart.getTime() + 3600000).toISOString(),
                backgroundColor: eventColor,
                borderColor: eventColor,
                extendedProps: { 
                  medicine,
                  confirmed: confirmStatus.confirmed,
                  taken: confirmStatus.taken
                },
              });
              count++;
            }
            currentDate.setMonth(currentDate.getMonth() + 1);
          }
          console.log(`  ✅ Added ${count} monthly events`);
        }
      } else {
        console.log('  ❌ Missing scheduled_date or timing');
      }
    });

    console.log('📅 Total events generated:', generatedEvents.length, generatedEvents);
    setEvents(generatedEvents);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-rosy-granite/5 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-deep-space-blue mb-2">📅 Medicine Schedule</h1>
            <p className="text-blue-slate">View your medicine schedule by month, week, or day</p>
          </div>
          
          {/* Notification Toggle Button */}
          <button
            onClick={handleToggleNotifications}
            disabled={notificationLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
              notificationsEnabled
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <FontAwesomeIcon icon={notificationsEnabled ? faBell : faBellSlash} />
            {notificationLoading ? 'Loading...' : notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className={styles.calendarContainer}>
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth',
              }}
              events={events}
              height="auto"
              eventClick={(info) => setSelectedEvent(info.event as any)}
              eventDisplay="block"
              dayMaxEvents={3}
              eventContent={(eventInfo) => {
                const showMealIcon = eventInfo.event.extendedProps.medicine?.meal_timing === 'after';
                return (
                  <div className="flex items-center gap-1 px-1">
                    <span className="truncate">{eventInfo.event.title}</span>
                    {showMealIcon && (
                      <FontAwesomeIcon icon={faUtensils} className="text-xs" />
                    )}
                  </div>
                );
              }}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 bg-white rounded-lg shadow-md p-4">
          <h3 className="font-semibold text-sm mb-2">Legend:</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span>✓ Taken</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-400"></div>
              <span>✗ Skipped</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500"></div>
              <span>Scheduled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-deep-space-blue mb-4">
              {selectedEvent.title}
            </h2>
            <div className="space-y-3 text-charcoal-blue mb-6">
              <p>
                <span className="font-semibold">Date & Time:</span>{' '}
                {new Date(selectedEvent.start).toLocaleString()}
              </p>
              {selectedEvent.extendedProps.medicine.dosage && (
                <p>
                  <span className="font-semibold">Dosage:</span>{' '}
                  {selectedEvent.extendedProps.medicine.dosage}
                </p>
              )}
              {selectedEvent.extendedProps.confirmed && (
                <p>
                  <span className="font-semibold">Status:</span>{' '}
                  {selectedEvent.extendedProps.taken ? '✓ Taken' : '✗ Skipped'}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedEvent(null)}
              className="w-full bg-charcoal-blue hover:bg-deep-space-blue text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationModal && (
        <ConfirmationModal
          isOpen={!!confirmationModal}
          onClose={() => setConfirmationModal(null)}
          medicineName={confirmationModal.medicineName}
          medicineId={confirmationModal.medicineId}
          scheduledDatetime={confirmationModal.scheduledDatetime}
          dosage={confirmationModal.dosage}
          onConfirm={handleConfirmMedicine}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DashboardContent />
    </Suspense>
  );
}
