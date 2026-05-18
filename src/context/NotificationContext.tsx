'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppNotification, NotificationPreferences } from '@/lib/types';
import {
  subscribeToNotifications,
  subscribeToUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  updateNotificationPreferences,
} from '@/lib/services/notification-service';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (notificationId: string) => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { userModel } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const notifUnsubRef = useRef<(() => void) | null>(null);
  const countUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const uid = userModel?.uid;

    // Unsubscribe from previous listeners
    notifUnsubRef.current?.();
    countUnsubRef.current?.();
    notifUnsubRef.current = null;
    countUnsubRef.current = null;

    if (!uid) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);

    notifUnsubRef.current = subscribeToNotifications(
      uid,
      (data) => {
        setNotifications(data);
        setLoading(false);
      },
      () => setLoading(false)
    );

    countUnsubRef.current = subscribeToUnreadCount(uid, setUnreadCount);

    return () => {
      notifUnsubRef.current?.();
      countUnsubRef.current?.();
    };
  }, [userModel?.uid]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      notifUnsubRef.current?.();
      countUnsubRef.current?.();
    };
  }, []);

  const handleMarkRead = useCallback(
    async (notificationId: string) => {
      const uid = userModel?.uid;
      if (!uid) return;
      await markAsRead(uid, notificationId);
    },
    [userModel?.uid]
  );

  const handleMarkAllRead = useCallback(async () => {
    const uid = userModel?.uid;
    if (!uid) return;
    await markAllAsRead(uid);
  }, [userModel?.uid]);

  const handleRemove = useCallback(
    async (notificationId: string) => {
      const uid = userModel?.uid;
      if (!uid) return;
      await deleteNotification(uid, notificationId);
    },
    [userModel?.uid]
  );

  const handleUpdatePreferences = useCallback(
    async (prefs: Partial<NotificationPreferences>) => {
      const uid = userModel?.uid;
      if (!uid) return;
      await updateNotificationPreferences(uid, prefs);
    },
    [userModel?.uid]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markRead: handleMarkRead,
        markAllRead: handleMarkAllRead,
        remove: handleRemove,
        updatePreferences: handleUpdatePreferences,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}
