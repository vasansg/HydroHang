'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { QueueModel, QueueMessage } from '@/lib/types';
import {
  subscribeToMachineQueue,
  subscribeToAllActiveQueues,
  subscribeToQueueMessages,
  bookWashingMachine,
  joinWaitingQueue,
  cancelBooking,
  completeSessionAfterPickup,
  getEstimatedWaitTime,
  sendQueueMessage,
} from '@/lib/services/queue-service';
import { useAuth } from './AuthContext';

interface QueueContextType {
  queueList: QueueModel[];
  allQueues: QueueModel[];
  messages: QueueMessage[];
  userActiveBooking: QueueModel | null;
  loading: boolean;
  error: string | null;
  estimatedWaitMinutes: number;
  subscribeToMachine: (familyCode: string, machineId: string) => void;
  subscribeToAll: (familyCode: string) => void;
  subscribeToMessages: (queueId: string) => void;
  cancelMessageSubscription: () => void;
  bookMachine: (opts: {
    userId: string;
    userName: string;
    familyCode: string;
    durationMinutes: number;
    washingMachineId: string;
    washingMachineName: string;
  }) => Promise<boolean>;
  joinQueue: (opts: {
    userId: string;
    userName: string;
    familyCode: string;
    durationMinutes: number;
    washingMachineId: string;
    washingMachineName: string;
  }) => Promise<boolean>;
  cancelBooking: (queueId: string) => Promise<boolean>;
  confirmPickup: (queueId: string) => Promise<boolean>;
  sendMessage: (opts: {
    queueId: string;
    senderId: string;
    senderName: string;
    message: string;
  }) => Promise<void>;
  loadEstimatedWait: (familyCode: string, machineId: string) => Promise<void>;
}

const QueueContext = createContext<QueueContextType | null>(null);

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const { userModel } = useAuth();
  const [queueList, setQueueList] = useState<QueueModel[]>([]);
  const [allQueues, setAllQueues] = useState<QueueModel[]>([]);
  const [messages, setMessages] = useState<QueueMessage[]>([]);
  const [userActiveBooking, setUserActiveBooking] = useState<QueueModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimatedWaitMinutes, setEstimatedWaitMinutes] = useState(0);

  const queueUnsubRef = useRef<(() => void) | null>(null);
  const allQueuesUnsubRef = useRef<(() => void) | null>(null);
  const messagesUnsubRef = useRef<(() => void) | null>(null);

  const subscribeToMachine = useCallback((familyCode: string, machineId: string) => {
    queueUnsubRef.current?.();
    setQueueList([]);
    const unsub = subscribeToMachineQueue(familyCode, machineId, (list) => {
      setQueueList(list);
      // Update user's active booking if present
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
    const unsub = subscribeToAllActiveQueues(familyCode, setAllQueues);
    allQueuesUnsubRef.current = unsub;
  }, []);

  const handleSubscribeToMessages = useCallback((queueId: string) => {
    messagesUnsubRef.current?.();
    const unsub = subscribeToQueueMessages(queueId, (msgs) => setMessages(msgs));
    messagesUnsubRef.current = unsub;
  }, []);

  const cancelMessageSubscription = useCallback(() => {
    messagesUnsubRef.current?.();
    messagesUnsubRef.current = null;
    setMessages([]);
  }, []);

  const handleBook = useCallback(async (opts: Parameters<typeof bookWashingMachine>[0]): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const booking = await bookWashingMachine(opts);
      setUserActiveBooking(booking);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleJoinQueue = useCallback(async (opts: Parameters<typeof joinWaitingQueue>[0]): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const booking = await joinWaitingQueue(opts);
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
      await cancelBooking(queueId);
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
      await completeSessionAfterPickup(queueId);
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

  const handleSendMessage = useCallback(async (opts: Parameters<typeof sendQueueMessage>[0]) => {
    try {
      await sendQueueMessage(opts);
    } catch {
      // swallow
    }
  }, []);

  const loadEstimatedWait = useCallback(async (familyCode: string, machineId: string) => {
    try {
      const minutes = await getEstimatedWaitTime(familyCode, machineId);
      setEstimatedWaitMinutes(minutes);
    } catch {
      // silent
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      queueUnsubRef.current?.();
      allQueuesUnsubRef.current?.();
      messagesUnsubRef.current?.();
    };
  }, []);

  return (
    <QueueContext.Provider
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
    </QueueContext.Provider>
  );
}

export function useQueue() {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useQueue must be used within QueueProvider');
  return ctx;
}
