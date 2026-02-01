'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import LoadingSpinner from '../components/LoadingSpinner';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';

interface Medicine {
  id: string;
  name: string;
  timing: string;
  dosage?: string;
  occurrence?: string;
  nextDueDate?: string;
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
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    const loadMedicines = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      try {
        const response = await fetch('/api/medicines');
        if (!response.ok) {
          throw new Error('Failed to fetch medicines');
        }

        const medicinesData = await response.json();

        if (medicinesData) {
          setMedicines(medicinesData);
          generateEvents(medicinesData);
        }
      } catch (error) {
        console.error('Error loading medicines:', error);
      }

      setLoading(false);
    };

    loadMedicines();
  }, [supabase, router]);

  const generateEvents = (medicinesList: any[]) => {
    console.log('📋 Generating events from medicines:', medicinesList);
    const generatedEvents: CalendarEvent[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight for date comparison
    const endDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000); // Next 90 days

    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    // Helper function to convert 24h to 12h format with AM/PM
    const formatTime12Hour = (hours: number, minutes: number) => {
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      const mins = minutes.toString().padStart(2, '0');
      return `${hour12}:${mins} ${period}`;
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
            
            const event = {
              id: `${medicine.id}-${scheduleDate.getTime()}`,
              title: `${medicine.name} - ${timeFormatted}`,
              start: eventStart.toISOString(),
              end: new Date(eventStart.getTime() + 3600000).toISOString(),
              backgroundColor: color,
              borderColor: color,
              extendedProps: { medicine },
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

              generatedEvents.push({
                id: `${medicine.id}-${currentDate.toDateString()}`,
                title: `${medicine.name} - ${timeFormatted}`,
                start: eventStart.toISOString(),
                end: new Date(eventStart.getTime() + 3600000).toISOString(),
                backgroundColor: color,
                borderColor: color,
                extendedProps: { medicine },
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

              generatedEvents.push({
                id: `${medicine.id}-${currentDate.toDateString()}`,
                title: `${medicine.name} - ${timeFormatted}`,
                start: eventStart.toISOString(),
                end: new Date(eventStart.getTime() + 3600000).toISOString(),
                backgroundColor: color,
                borderColor: color,
                extendedProps: { medicine },
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

              generatedEvents.push({
                id: `${medicine.id}-${currentDate.toDateString()}`,
                title: `${medicine.name} - ${timeFormatted}`,
                start: eventStart.toISOString(),
                end: new Date(eventStart.getTime() + 3600000).toISOString(),
                backgroundColor: color,
                borderColor: color,
                extendedProps: { medicine },
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
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📅 Medicine Schedule</h1>
          <p className="text-gray-600">View your medicine schedule by month, week, or day</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="calendar-container">
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
            />
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {selectedEvent.title}
            </h2>
            <div className="space-y-3 text-gray-700 mb-6">
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
            </div>
            <button
              onClick={() => setSelectedEvent(null)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .calendar-container :global(.fc) {
          font-family: inherit;
        }
        .calendar-container :global(.fc-button-primary) {
          background-color: #3b82f6;
          border-color: #3b82f6;
        }
        .calendar-container :global(.fc-button-primary:hover) {
          background-color: #2563eb;
          border-color: #2563eb;
        }
        .calendar-container :global(.fc-button-primary.fc-button-active) {
          background-color: #1d4ed8;
          border-color: #1d4ed8;
        }
        .calendar-container :global(.fc-theme-standard .fc-daygrid-day.fc-day-other) {
          background-color: #f9fafb;
        }
      `}</style>
    </div>
  );
}
