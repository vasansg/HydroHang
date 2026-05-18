'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthContext';

// We work with JS Dates internally; Firestore Timestamps are converted on read.
interface LaundrySchedule {
  id: string;
  userId: string;
  userName: string;
  scheduledDate: Date;
  timeSlot: string;
  status: string;
  taskName: string;
  weatherCondition?: string;
  familyCode: string;
}

const COLLECTION = 'laundry_schedules';

interface ScheduleContextType {
  schedules: LaundrySchedule[];
  loading: boolean;
  error: string | null;
  pendingCount: number;
  completedCount: number;
  upcomingSchedules: LaundrySchedule[];
  nextSchedule: LaundrySchedule | null;
  addSchedule: (schedule: Omit<LaundrySchedule, 'id'>) => Promise<boolean>;
  deleteSchedule: (id: string) => Promise<boolean>;
  completeSchedule: (id: string) => Promise<boolean>;
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const { userModel } = useAuth();
  const [schedules, setSchedules] = useState<LaundrySchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  // Track which schedule ids we have already triggered an in-app reminder for
  const triggeredIdsRef = useRef<Set<string>>(new Set());
  const reminderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Build a reminder body matching the Flutter implementation
  function buildReminderBody(schedule: LaundrySchedule, timeText: string): string {
    const taskLabel = schedule.taskName.trim() || 'Laundry task';
    return `It's time now — do the task: ${taskLabel} (${timeText}, ${schedule.timeSlot}).`;
  }

  function formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  // Check due schedules and create in-app notifications for overdue ones
  const checkDueReminders = useCallback(
    async (currentSchedules: LaundrySchedule[]) => {
      const nowUtc = new Date();
      for (const schedule of currentSchedules) {
        if (schedule.status.toLowerCase() !== 'pending') continue;
        if (triggeredIdsRef.current.has(schedule.id)) continue;
        if (schedule.scheduledDate > nowUtc) continue;

        triggeredIdsRef.current.add(schedule.id);
        const local = new Date(schedule.scheduledDate);
        const timeText = formatTime(local);

        try {
          const { triggerNotificationForUser } = await import(
            '@/lib/services/notification-service'
          );
          await triggerNotificationForUser({
            userId: schedule.userId,
            title: 'Smart schedule reminder',
            body: buildReminderBody(schedule, timeText),
            type: 'Schedule',
            forceInApp: true,
          });
        } catch {
          // non-critical
        }
      }
    },
    []
  );

  useEffect(() => {
    const familyCode = userModel?.familyCode;
    // Unsubscribe from previous listener
    unsubRef.current?.();
    unsubRef.current = null;

    if (!familyCode) {
      setSchedules([]);
      triggeredIdsRef.current.clear();
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, COLLECTION),
      where('familyCode', '==', familyCode),
      orderBy('scheduledDate', 'asc')
    );

    unsubRef.current = onSnapshot(
      q,
      (snapshot) => {
        const list: LaundrySchedule[] = snapshot.docs.map((d) => {
          const data = d.data();
          const rawDate = data.scheduledDate;
          let scheduledDate: Date;
          if (rawDate && typeof (rawDate as { toDate?: unknown }).toDate === 'function') {
            scheduledDate = (rawDate as Timestamp).toDate();
          } else if (rawDate instanceof Date) {
            scheduledDate = rawDate;
          } else {
            scheduledDate = new Date(rawDate as string);
          }
          return {
            id: d.id,
            userId: data.userId as string,
            userName: data.userName as string,
            scheduledDate,
            timeSlot: data.timeSlot as string,
            status: data.status as string,
            taskName: (data.taskName as string) ?? '',
            weatherCondition: data.weatherCondition as string | undefined,
            familyCode: data.familyCode as string,
          };
        });
        setSchedules(list);
        setLoading(false);
        setError(null);
        checkDueReminders(list);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [userModel?.familyCode, checkDueReminders]);

  // Periodic reminder check (every minute, like Flutter's Timer.periodic)
  useEffect(() => {
    reminderTimerRef.current = setInterval(() => {
      checkDueReminders(schedules);
    }, 60_000);

    return () => {
      if (reminderTimerRef.current) clearInterval(reminderTimerRef.current);
    };
  }, [schedules, checkDueReminders]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubRef.current?.();
      if (reminderTimerRef.current) clearInterval(reminderTimerRef.current);
    };
  }, []);

  const addSchedule = useCallback(
    async (schedule: Omit<LaundrySchedule, 'id'>): Promise<boolean> => {
      try {
        const payload = {
          ...schedule,
          scheduledDate: Timestamp.fromDate(
            schedule.scheduledDate instanceof Date
              ? schedule.scheduledDate
              : new Date(schedule.scheduledDate)
          ),
        };
        await addDoc(collection(db, COLLECTION), payload);
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      }
    },
    []
  );

  const deleteSchedule = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteDoc(doc(db, COLLECTION, id));
      triggeredIdsRef.current.delete(id);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }, []);

  const completeSchedule = useCallback(async (id: string): Promise<boolean> => {
    try {
      await updateDoc(doc(db, COLLECTION, id), { status: 'Completed' });
      triggeredIdsRef.current.add(id);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }, []);

  const pendingCount = useMemo(
    () => schedules.filter((s) => s.status.toLowerCase() === 'pending').length,
    [schedules]
  );

  const completedCount = useMemo(
    () => schedules.filter((s) => s.status.toLowerCase() === 'completed').length,
    [schedules]
  );

  const upcomingSchedules = useMemo(() => {
    const now = new Date();
    return schedules
      .filter((s) => s.status.toLowerCase() === 'pending' && s.scheduledDate > now)
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
  }, [schedules]);

  const nextSchedule = useMemo(
    () => (upcomingSchedules.length > 0 ? upcomingSchedules[0] : null),
    [upcomingSchedules]
  );

  return (
    <ScheduleContext.Provider
      value={{
        schedules,
        loading,
        error,
        pendingCount,
        completedCount,
        upcomingSchedules,
        nextSchedule,
        addSchedule,
        deleteSchedule,
        completeSchedule,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error('useSchedule must be used within ScheduleProvider');
  return ctx;
}
