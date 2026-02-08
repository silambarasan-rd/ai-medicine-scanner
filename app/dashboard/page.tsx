'use client';

import React, { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
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
import { faUtensils, faBell, faBellSlash, faCircle, faCircleCheck, faSlash, faCalendarDays, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
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
  scheduled_date?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
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
  mealTiming?: string;
}

interface ConfirmationRecord {
  medicine_id: string;
  scheduled_datetime: string;
  taken: boolean;
  skipped?: boolean;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const confirmId = searchParams.get('confirm');
  const confirmTime = searchParams.get('time');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [confirmations, setConfirmations] = useState<ConfirmationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationData | null>(null);
  const [eventActionStatus, setEventActionStatus] = useState<'taken' | 'skipped' | ''>('');
  const [eventActionNotes, setEventActionNotes] = useState('');
  const [eventActionLoading, setEventActionLoading] = useState(false);
  const [eventActionError, setEventActionError] = useState<string | null>(null);

  const loadConfirmations = useCallback(async () => {
    try {
      const response = await fetch('/api/confirmations');
      if (response.ok) {
        const data: { confirmations?: ConfirmationRecord[] } = await response.json();
        const nextConfirmations = data.confirmations || [];
        setConfirmations(nextConfirmations);
        return nextConfirmations;
      }
    } catch (error) {
      console.error('Error loading confirmations:', error);
    }
    return [] as ConfirmationRecord[];
  }, []);

  const generateEvents = useCallback((medicinesList: Medicine[], confirmationsList: ConfirmationRecord[]) => {
    console.log('📋 Generating events from medicines:', medicinesList);
    const generatedEvents: CalendarEvent[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight for date comparison
    const endDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000); // Next 90 days

    const scheduledColors = {
      backgroundColor: '#ffffff',
      borderColor: '#000000',
      textColor: '#000000'
    };
    const takenColors = {
      backgroundColor: '#000000',
      borderColor: '#000000',
      textColor: '#ffffff'
    };
    const skippedColors = {
      backgroundColor: '#ffffff',
      borderColor: '#d1d5db',
      textColor: '#d1d5db'
    };

    // Helper function to convert 24h to 12h format with AM/PM
    const formatTime12Hour = (hours: number, minutes: number) => {
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      const mins = minutes.toString().padStart(2, '0');
      return `${hour12}:${mins} ${period}`;
    };

    // Helper to check if event is confirmed
    const getConfirmationStatus = (medicineId: string, eventStart: Date) => {
      const confirmation = confirmationsList.find(c =>
        c.medicine_id === medicineId &&
        new Date(c.scheduled_datetime).getTime() === eventStart.getTime()
      );
      return confirmation ? { confirmed: true, taken: confirmation.taken } : { confirmed: false, taken: false };
    };

    medicinesList.forEach((medicine, index) => {
      console.log(`Processing medicine ${index}:`, medicine);
      const getEventColors = (confirmed: boolean, taken: boolean) => {
        if (!confirmed) return scheduledColors;
        return taken ? takenColors : skippedColors;
      };

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
            const eventColors = getEventColors(confirmStatus.confirmed, confirmStatus.taken);
            
            const event = {
              id: `${medicine.id}-${scheduleDate.getTime()}`,
              title: `${medicine.name} - ${timeFormatted}`,
              start: eventStart.toISOString(),
              end: new Date(eventStart.getTime() + 3600000).toISOString(),
              backgroundColor: eventColors.backgroundColor,
              borderColor: eventColors.borderColor,
              textColor: eventColors.textColor,
              extendedProps: { 
                medicine,
                confirmed: confirmStatus.confirmed,
                taken: confirmStatus.taken
              },
            };
            console.log('  Added once event:', event);
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
              const eventColors = getEventColors(confirmStatus.confirmed, confirmStatus.taken);

              generatedEvents.push({
                id: `${medicine.id}-${currentDate.toDateString()}`,
                title: `${medicine.name} - ${timeFormatted}`,
                start: eventStart.toISOString(),
                end: new Date(eventStart.getTime() + 3600000).toISOString(),
                backgroundColor: eventColors.backgroundColor,
                borderColor: eventColors.borderColor,
                textColor: eventColors.textColor,
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
          console.log(`  Added ${count} daily events`);
        } else if (medicine.occurrence === 'weekly') {
          // Generate weekly events
          const currentDate = new Date(scheduleDate);
          let count = 0;
          while (currentDate <= endDate && count < 13) {
            if (currentDate >= today) {
              const eventStart = new Date(currentDate);
              eventStart.setHours(hours, minutes, 0);

              const confirmStatus = getConfirmationStatus(medicine.id, eventStart);
              const eventColors = getEventColors(confirmStatus.confirmed, confirmStatus.taken);

              generatedEvents.push({
                id: `${medicine.id}-${currentDate.toDateString()}`,
                title: `${medicine.name} - ${timeFormatted}`,
                start: eventStart.toISOString(),
                end: new Date(eventStart.getTime() + 3600000).toISOString(),
                backgroundColor: eventColors.backgroundColor,
                borderColor: eventColors.borderColor,
                textColor: eventColors.textColor,
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
          console.log(`  Added ${count} weekly events`);
        } else if (medicine.occurrence === 'monthly') {
          // Generate monthly events
          const currentDate = new Date(scheduleDate);
          let count = 0;
          while (currentDate <= endDate && count < 3) {
            if (currentDate >= today) {
              const eventStart = new Date(currentDate);
              eventStart.setHours(hours, minutes, 0);

              const confirmStatus = getConfirmationStatus(medicine.id, eventStart);
              const eventColors = getEventColors(confirmStatus.confirmed, confirmStatus.taken);

              generatedEvents.push({
                id: `${medicine.id}-${currentDate.toDateString()}`,
                title: `${medicine.name} - ${timeFormatted}`,
                start: eventStart.toISOString(),
                end: new Date(eventStart.getTime() + 3600000).toISOString(),
                backgroundColor: eventColors.backgroundColor,
                borderColor: eventColors.borderColor,
                textColor: eventColors.textColor,
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
          console.log(`  Added ${count} monthly events`);
        }
      } else {
        console.log('  Missing scheduled_date or timing');
      }
    });

    console.log('Total events generated:', generatedEvents.length, generatedEvents);
    setEvents(generatedEvents);
  }, []);

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

        const medicinesData: Medicine[] = await response.json();

        if (medicinesData) {
          setMedicines(medicinesData);
          await loadConfirmations();
        }

        const medicineLookup = new Map(medicinesData.map((medicine) => [medicine.id, medicine]));

        // Check notification status
        const status = await checkNotificationStatus();
        setNotificationsEnabled(status.subscribed);

        // Setup service worker listener for confirmation modal
        setupServiceWorkerListener((medicineId, scheduledDatetime, medicineName, dosage, mealTiming) => {
          const matchedMedicine = medicineLookup.get(medicineId);
          setConfirmationModal({
            medicineId,
            scheduledDatetime,
            medicineName: medicineName || matchedMedicine?.name || '',
            dosage: dosage || matchedMedicine?.dosage,
            mealTiming: mealTiming || matchedMedicine?.meal_timing
          });
        });

        // Check if opened from notification with query params
        if (confirmId && confirmTime) {
          const medicine = medicinesData.find((m) => m.id === confirmId);
          if (medicine) {
            setConfirmationModal({
              medicineId: confirmId,
              scheduledDatetime: confirmTime,
              medicineName: medicine.name,
              dosage: medicine.dosage,
              mealTiming: medicine.meal_timing
            });
          }
        }
      } catch (error) {
        console.error('Error loading medicines:', error);
      }

      setLoading(false);
    };

    loadMedicines();
  }, [supabase, router, confirmId, confirmTime, loadConfirmations]);

  useEffect(() => {
    if (medicines.length === 0) {
      setEvents([]);
      return;
    }

    generateEvents(medicines, confirmations);
  }, [medicines, confirmations, generateEvents]);

  useEffect(() => {
    if (!selectedEvent) {
      setEventActionStatus('');
      setEventActionNotes('');
      setEventActionError(null);
      return;
    }

    if (selectedEvent.extendedProps.confirmed) {
      setEventActionStatus(selectedEvent.extendedProps.taken ? 'taken' : 'skipped');
    } else {
      setEventActionStatus('');
    }
    setEventActionNotes('');
    setEventActionError(null);
  }, [selectedEvent]);

  

  const handleToggleNotifications = async () => {
    setNotificationLoading(true);
    try {
      if (notificationsEnabled) {
        console.log('Unsubscribing from notifications...');
        await unsubscribeFromPushNotifications();
        setNotificationsEnabled(false);
        console.log('Unsubscribed successfully');
      } else {
        console.log('Subscribing to notifications...');
        await subscribeToPushNotifications();
        setNotificationsEnabled(true);
        console.log('Subscribed successfully');
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to toggle notifications: ${errorMessage}\n\nCheck the browser console for details.`);
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleConfirmMedicine = async (taken: boolean, notes?: string) => {
    if (!confirmationModal) return;

    try {
      await toast.promise(
        fetch('/api/confirmations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            medicineId: confirmationModal.medicineId,
            scheduledDatetime: confirmationModal.scheduledDatetime,
            taken,
            skipped: !taken,
            notes
          })
        }).then((response) => {
          if (!response.ok) {
            throw new Error('Failed to save confirmation');
          }
          return response;
        }),
        {
          pending: 'Saving confirmation...',
          success: taken ? 'Marked as taken' : 'Marked as skipped'
        }
      );

      // Reload confirmations and regenerate events
      const confirmationsData = await loadConfirmations();
      generateEvents(medicines, confirmationsData);
      setConfirmationModal(null);
    } catch (error) {
      console.error('Error confirming medicine:', error);
      toast.error('Failed to save confirmation');
      throw error;
    }
  };

  const handleEventConfirmation = async (taken: boolean, notes?: string) => {
    if (!selectedEvent) return;

    if (!selectedEvent.start) {
      setEventActionError('Missing event time. Please reopen the event and try again.');
      return;
    }

    const scheduledDatetime = new Date(selectedEvent.start).toISOString();

    setEventActionLoading(true);
    setEventActionError(null);

    try {
      await toast.promise(
        fetch('/api/confirmations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            medicineId: selectedEvent.extendedProps.medicine.id,
            scheduledDatetime,
            taken,
            skipped: !taken,
            notes
          })
        }).then((response) => {
          if (!response.ok) {
            throw new Error('Failed to save confirmation');
          }
          return response;
        }),
        {
          pending: 'Saving confirmation...',
          success: taken ? 'Marked as taken' : 'Marked as skipped'
        }
      );

      const confirmationsData = await loadConfirmations();
      generateEvents(medicines, confirmationsData);
      setSelectedEvent((prev) =>
        prev
          ? {
              ...prev,
              extendedProps: {
                ...prev.extendedProps,
                confirmed: true,
                taken
              }
            }
          : prev
      );
      setEventActionStatus(taken ? 'taken' : 'skipped');
      setEventActionNotes('');
    } catch (error) {
      console.error('Error confirming medicine:', error);
      setEventActionError('Failed to save confirmation. Please try again.');
      toast.error('Failed to save confirmation');
    } finally {
      setEventActionLoading(false);
    }
  };

  

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-rosy-granite/5 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-deep-space-blue mb-2 flex items-center gap-2">
              <FontAwesomeIcon icon={faCalendarDays} className="fa-1x" />
              Medicine Schedule
            </h1>
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
            <FontAwesomeIcon icon={notificationsEnabled ? faBell : faBellSlash} className="fa-1x" />
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
              eventClick={(info) =>
                setSelectedEvent({
                  id: info.event.id,
                  title: info.event.title,
                  start: info.event.start ? info.event.start.toISOString() : '',
                  end: info.event.end ? info.event.end.toISOString() : '',
                  backgroundColor: info.event.backgroundColor,
                  borderColor: info.event.borderColor,
                  textColor: info.event.textColor,
                  extendedProps: info.event.extendedProps as CalendarEvent['extendedProps']
                })
              }
              eventDisplay="block"
              dayMaxEvents={3}
              eventContent={(eventInfo) => {
                const isTaken = !!eventInfo.event.extendedProps.taken;
                const showMealIcon = eventInfo.event.extendedProps.medicine?.meal_timing === 'after';
                return (
                  <div className="flex items-center gap-1 px-1">
                    {isTaken && (
                      <FontAwesomeIcon icon={faCircleCheck} className="text-green-500 text-xs" />
                    )}
                    <span className="truncate">{eventInfo.event.title}</span>
                    {showMealIcon && (
                      <FontAwesomeIcon icon={faUtensils} className="text-xs fa-1x" />
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
              <div className="w-4 h-4 rounded border border-black bg-black flex items-center justify-center">
                <FontAwesomeIcon icon={faCircleCheck} className="text-green-500 text-[10px]" />
              </div>
              <span className="text-black">Taken</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border" style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff' }}></div>
              <span style={{ color: '#d1d5db' }}>Skipped</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-black bg-white"></div>
              <span className="text-black">Scheduled</span>
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

              <span className='ml-1 inline-flex items-center rounded-md bg-rosy-granite/5 px-2 py-1 text-xs font-medium text-green-700 inset-ring inset-ring-pink-700/10' style={{ textTransform: 'capitalize' }}>
                { selectedEvent.extendedProps.medicine.meal_timing === 'after' ? 
                  <span className="fa-stack mr-1">
                    <FontAwesomeIcon icon={faCircle} className="fa-stack-2x" />
                    <FontAwesomeIcon icon={faUtensils} className="mr-1 fa-stack-1x fa-inverse" />
                  </span> : 
                  <span className="fa-stack mr-1">
                    <FontAwesomeIcon icon={faCircle} className="fa-stack-2x" />
                    <FontAwesomeIcon icon={faSlash} className="fa-stack-1x fa-inverse" />
                    <FontAwesomeIcon icon={faUtensils} className="mr-1 fa-stack-1x fa-inverse" />
                  </span> }
                { selectedEvent.extendedProps.medicine.meal_timing } meal
              </span>
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
                  <span className="inline-flex items-center gap-2">
                    <FontAwesomeIcon icon={selectedEvent.extendedProps.taken ? faCheck : faXmark} className="fa-1x" />
                    {selectedEvent.extendedProps.taken ? 'Taken' : 'Skipped'}
                  </span>
                </p>
              )}
            </div>
            {new Date(selectedEvent.start).getTime() <= Date.now() && (
              <div className="mb-6 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-charcoal-blue">Update status</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEventActionStatus('taken')}
                      className={`px-3 py-2 rounded-md text-sm font-semibold border transition-colors ${
                        eventActionStatus === 'taken'
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-green-700 border-green-600 hover:bg-green-50'
                      }`}
                    >
                      Taken
                    </button>
                    <button
                      type="button"
                      onClick={() => setEventActionStatus('skipped')}
                      className={`px-3 py-2 rounded-md text-sm font-semibold border transition-colors ${
                        eventActionStatus === 'skipped'
                          ? 'bg-gray-700 text-white border-gray-700'
                          : 'bg-white text-gray-700 border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      Skipped
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-charcoal-blue" htmlFor="event-notes">
                    Notes (optional)
                  </label>
                  <textarea
                    id="event-notes"
                    value={eventActionNotes}
                    onChange={(e) => setEventActionNotes(e.target.value)}
                    rows={3}
                    placeholder="Add any notes about this dose..."
                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-deep-space-blue/40"
                  />
                </div>
                {eventActionError && (
                  <div className="text-sm text-red-600">{eventActionError}</div>
                )}
                <button
                  type="button"
                  onClick={() => handleEventConfirmation(eventActionStatus === 'taken', eventActionNotes || undefined)}
                  disabled={eventActionLoading || !eventActionStatus}
                  className="w-full bg-deep-space-blue hover:bg-charcoal-blue text-white px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {eventActionLoading ? 'Saving...' : 'Save status'}
                </button>
              </div>
            )}
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
          mealTiming={confirmationModal.mealTiming}
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
