'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { DryerQueueModel, QueueMessage } from '@/lib/types';
import {
  subscribeToDryerQueue,
  subscribeToAllActiveDryerQueues,
  subscribeToDryerQueueMessages,
  bookDryer,
  joinDryerWaitingQueue,
  cancelDryerBooking,
  completeDryerSessionAfterPickup,
  getDryerEstimatedWaitTime,
  sendDryerQueueMessage,
} from '@/lib/services/dryer-queue-service';
import { useAuth } from './AuthContext';

interface DryerQueueContextType {
  queueList: DryerQueueModel[];
  allQueues: DryerQueueModel[];
  messages: QueueMessage[];
  userActiveBooking: DryerQueueModel | null;
  loading: boolean;
  error: string | null;
  estimatedWaitMinutes: number;
  subscribeToMachine: (familyCode: string, dryerId: string) => void;
  subscribeToAll: (familyCode: string) => void;
  subscribeToMessages: (queueId: string) => void;
  cancelMessageSubscription: () => void;
  bookMachine: (opts: {
    userId: string;
    userName: string;
    familyCode: string;
    durationMinutes: number;
    dryerId: string;
    dryerName: string;
  }) => Promise<boolean>;
  joinQueue: (opts: {
    userId: string;
    userName: string;
    familyCode: string;
    durationMinutes: number;
    dryerId: string;
    dryerName: string;
  }) => Promise<boolean>;
  cancelBooking: (queueId: string) => Promise<boolean>;
  confirmPickup: (queueId: string) => Promise<boolean>;
  sendMessage: (opts: {
    queueId: string;
    senderId: string;
    senderName: string;
    message: string;
  }) => Promise<void>;
  loadEstimatedWait: (familyCode: string, dryerId: string) => Promise<void>;
}

const DryerQueueContext = createContext<DryerQueueContextType | null>(null);

export function DryerQueueProvider({ children }: { children: React.ReactNode }) {
  const { userModel } = useAuth();
  const [queueList, setQueueList] = useState<DryerQueueModel[]>([]);
  const [allQueues, setAllQueues] = useState<DryerQueueModel[]>([]);
  const [messages, setMessages] = useState<QueueMessage[]>([]);
  const [userActiveBooking, setUserActiveBooking] = useState<DryerQueueModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimatedWaitMinutes, setEstimatedWaitMinutes] = useState(0);

  const queueUnsubRef = useRef<(() => void) | null>(null);
  const allQueuesUnsubRef = useRef<(() => void) | null>(null);
  const messagesUnsubRef = useRef<(() => void) | null>(null);

  const subscribeToMachine = useCallback((familyCode: string, dryerId: string) => {
    queueUnsubRef.current?.();
    setQueueList([]);
    const unsub = subscribeToDryerQueue(familyCode, dryerId, (list) => {
      setQueueList(list);
      const uid = userModel?.uid;
      if (uid) {
        const booking = list.find((q) => q.userId === uid) ?? null;
        setUserActiveBooking(booking);
      }
    });
    queueUnsubRef.current = unsub;
  }, [userModel?.uid]);

  const subscribeToAll = useCallback((familyCode: string) => {
    allQueuesUnsubRef.current?.();
    const unsub = subscribeToAllActiveDryerQueues(familyCode, setAllQueues);
    allQueuesUnsubRef.current = unsub;
  }, []);

  const handleSubscribeToMessages = useCallback((queueId: string) => {
    messagesUnsubRef.current?.();
    const unsub = subscribeToDryerQueueMessages(queueId, (msgs) => setMessages(msgs));
    messagesUnsubRef.current = unsub;
  }, []);

  const cancelMessageSubscription = useCallback(() => {
    messagesUnsubRef.current?.();
    messagesUnsubRef.current = null;
    setMessages([]);
  }, []);

  const handleBook = useCallback(async (opts: Parameters<typeof bookDryer>[0]): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const booking = await bookDryer(opts);
      setUserActiveBooking(booking);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleJoinQueue = useCallback(async (opts: Parameters<typeof joinDryerWaitingQueue>[0]): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const booking = await joinDryerWaitingQueue(opts);
      setUserActiveBooking(booking);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCancelBooking = useCallback(async (queueId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await cancelDryerBooking(queueId);
      setQueueList((prev) => prev.filter((q) => q.id !== queueId));
      setUserActiveBooking(null);
      cancelMessageSubscription();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [cancelMessageSubscription]);

  const handleConfirmPickup = useCallback(async (queueId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await completeDryerSessionAfterPickup(queueId);
      if (userActiveBooking?.id === queueId) {
        setUserActiveBooking(null);
        cancelMessageSubscription();
      }
      setQueueList((prev) => prev.filter((q) => q.id !== queueId));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userActiveBooking, cancelMessageSubscription]);

  const handleSendMessage = useCallback(async (opts: Parameters<typeof sendDryerQueueMessage>[0]) => {
    try {
      await sendDryerQueueMessage(opts);
    } catch {
      // swallow
    }
  }, []);

  const loadEstimatedWait = useCallback(async (familyCode: string, dryerId: string) => {
    try {
      const minutes = await getDryerEstimatedWaitTime(familyCode, dryerId);
      setEstimatedWaitMinutes(minutes);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    return () => {
      queueUnsubRef.current?.();
      allQueuesUnsubRef.current?.();
      messagesUnsubRef.current?.();
    };
  }, []);

  return (
    <DryerQueueContext.Provider
      value={{
        queueList,
        allQueues,
        messages,
        userActiveBooking,
        loading,
        error,
        estimatedWaitMinutes,
        subscribeToMachine,
        subscribeToAll,
        subscribeToMessages: handleSubscribeToMessages,
        cancelMessageSubscription,
        bookMachine: handleBook,
        joinQueue: handleJoinQueue,
        cancelBooking: handleCancelBooking,
        confirmPickup: handleConfirmPickup,
        sendMessage: handleSendMessage,
        loadEstimatedWait,
      }}
    >
      {children}
    </DryerQueueContext.Provider>
  );
}

export function useDryerQueue() {
  const ctx = useContext(DryerQueueContext);
  if (!ctx) throw new Error('useDryerQueue must be used within DryerQueueProvider');
  return ctx;
}
