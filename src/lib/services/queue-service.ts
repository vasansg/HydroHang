import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { QueueModel, QueueMessage } from '@/lib/types';
import { triggerFamilyNotification } from './notification-service';

const COLLECTION = 'washing_queue';

export function subscribeToMachineQueue(
  familyCode: string,
  washingMachineId: string,
  onData: (queue: QueueModel[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where('familyCode', '==', familyCode),
    where('washingMachineId', '==', washingMachineId),
    where('status', 'in', ['active', 'waiting']),
    orderBy('startTime')
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as QueueModel))),
    (err) => onError?.(err as Error)
  );
}

export function subscribeToAllActiveQueues(
  familyCode: string,
  onData: (queue: QueueModel[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where('familyCode', '==', familyCode),
    where('status', 'in', ['active', 'waiting']),
    orderBy('startTime')
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as QueueModel))),
    (err) => onError?.(err as Error)
  );
}

export async function getUserActiveBooking(
  userId: string,
  washingMachineId: string
): Promise<QueueModel | null> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('userId', '==', userId),
      where('washingMachineId', '==', washingMachineId),
      where('status', 'in', ['active', 'waiting']),
      limit(1)
    )
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as QueueModel;
}

export async function bookWashingMachine({
  userId,
  userName,
  familyCode,
  durationMinutes,
  washingMachineId,
  washingMachineName,
}: {
  userId: string;
  userName: string;
  familyCode: string;
  durationMinutes: number;
  washingMachineId: string;
  washingMachineName: string;
}): Promise<QueueModel> {
  // Check if machine is in use
  const activeSnap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('washingMachineId', '==', washingMachineId),
      where('status', '==', 'active')
    )
  );
  if (!activeSnap.empty) throw new Error('Washing machine is currently in use');

  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

  const ref = await addDoc(collection(db, COLLECTION), {
    userId,
    userName,
    familyCode,
    startTime: Timestamp.fromDate(startTime),
    endTime: Timestamp.fromDate(endTime),
    durationMinutes,
    durationHours: Math.ceil(durationMinutes / 60),
    status: 'active',
    pickupReminderSent: false,
    position: 0,
    washingMachineId,
    washingMachineName,
  });

  const snap = await getDoc(ref);
  return { id: snap.id, ...snap.data() } as QueueModel;
}

export async function joinWaitingQueue({
  userId,
  userName,
  familyCode,
  durationMinutes,
  washingMachineId,
  washingMachineName,
}: {
  userId: string;
  userName: string;
  familyCode: string;
  durationMinutes: number;
  washingMachineId: string;
  washingMachineName: string;
}): Promise<QueueModel> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('washingMachineId', '==', washingMachineId),
      where('status', 'in', ['active', 'waiting']),
      orderBy('startTime')
    )
  );
  const position = snap.docs.length;

  const ref = await addDoc(collection(db, COLLECTION), {
    userId,
    userName,
    familyCode,
    startTime: Timestamp.now(),
    endTime: null,
    durationMinutes,
    durationHours: Math.ceil(durationMinutes / 60),
    status: 'waiting',
    position,
    washingMachineId,
    washingMachineName,
  });

  const docSnap = await getDoc(ref);
  return { id: docSnap.id, ...docSnap.data() } as QueueModel;
}

export async function cancelBooking(queueId: string): Promise<void> {
  const ref = doc(db, COLLECTION, queueId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const wasActive = data.status === 'active';
  const machineId = data.washingMachineId as string;

  await updateDoc(ref, {
    status: 'cancelled',
    endTime: Timestamp.now(),
  });

  if (wasActive && machineId) {
    await activateNextInQueue(machineId);
  }
}

export async function completeSessionAfterPickup(queueId: string): Promise<void> {
  const ref = doc(db, COLLECTION, queueId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  if (data.status !== 'active') return;

  const machineId = data.washingMachineId as string;

  await updateDoc(ref, {
    status: 'completed',
    endTime: Timestamp.now(),
  });

  if (machineId) {
    await activateNextInQueue(machineId);
  }
}

async function activateNextInQueue(washingMachineId: string): Promise<void> {
  // Check if machine is still occupied
  const activeSnap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('washingMachineId', '==', washingMachineId),
      where('status', '==', 'active'),
      limit(1)
    )
  );
  if (!activeSnap.empty) return;

  // Find next waiting
  const waitingSnap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('washingMachineId', '==', washingMachineId),
      where('status', '==', 'waiting')
    )
  );

  if (waitingSnap.empty) return;

  const sorted = waitingSnap.docs
    .slice()
    .sort((a, b) => {
      const aTs = (a.data().startTime as Timestamp)?.toDate() ?? new Date(0);
      const bTs = (b.data().startTime as Timestamp)?.toDate() ?? new Date(0);
      return aTs.getTime() - bTs.getTime();
    });

  const next = sorted[0];
  const raw = next.data();
  const durationMins =
    typeof raw.durationMinutes === 'number'
      ? raw.durationMinutes
      : ((raw.durationHours as number) ?? 1) * 60;

  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + durationMins * 60000);

  await updateDoc(next.ref, {
    status: 'active',
    startTime: Timestamp.fromDate(startTime),
    endTime: Timestamp.fromDate(endTime),
    pickupReminderSent: false,
    position: 0,
  });
}

export async function getEstimatedWaitTime(
  familyCode: string,
  washingMachineId: string
): Promise<number> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('familyCode', '==', familyCode),
      where('washingMachineId', '==', washingMachineId),
      where('status', 'in', ['active', 'waiting']),
      orderBy('startTime')
    )
  );

  let totalMs = 0;
  const now = Date.now();

  for (const d of snap.docs) {
    const data = d.data();
    const startMs = (data.startTime as Timestamp).toDate().getTime();
    const durationMs =
      typeof data.durationMinutes === 'number'
        ? data.durationMinutes * 60000
        : ((data.durationHours as number) ?? 1) * 3600000;

    if (data.status === 'active') {
      const endMs = startMs + durationMs;
      if (endMs > now) totalMs += endMs - now;
    } else {
      totalMs += durationMs;
    }
  }

  return Math.floor(totalMs / 60000); // minutes
}

export async function getCompletedSessions(
  familyCode: string,
  washingMachineId: string,
  since?: Date
): Promise<QueueModel[]> {
  const q = query(
    collection(db, COLLECTION),
    where('familyCode', '==', familyCode),
    where('washingMachineId', '==', washingMachineId),
    where('status', '==', 'completed')
  );

  const snap = await getDocs(q);
  let results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as QueueModel));

  if (since) {
    results = results.filter((r) => {
      const endTime = r.endTime ? (r.endTime as Timestamp).toDate() : null;
      return endTime && endTime >= since;
    });
  }

  return results;
}

// ─── Chat / Messages ─────────────────────────────────────────────────────────

export function subscribeToQueueMessages(
  queueId: string,
  onData: (messages: QueueMessage[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, COLLECTION, queueId, 'messages'),
    orderBy('timestamp', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as QueueMessage))),
    (err) => onError?.(err as Error)
  );
}

export async function sendQueueMessage({
  queueId,
  senderId,
  senderName,
  message,
}: {
  queueId: string;
  senderId: string;
  senderName: string;
  message: string;
}): Promise<void> {
  const queueSnap = await getDoc(doc(db, COLLECTION, queueId));
  if (!queueSnap.exists()) return;

  const data = queueSnap.data();
  if (data.status !== 'active') throw new Error('Chat is unavailable after pickup.');

  await addDoc(collection(db, COLLECTION, queueId, 'messages'), {
    senderId,
    senderName,
    message,
    timestamp: Timestamp.now(),
  });

  await triggerFamilyNotification({
    title: 'New machine message',
    body: `${senderName} sent a message for ${data.washingMachineName}: '${message}'`,
    type: 'Queue',
    familyCode: data.familyCode as string,
    excludeUid: senderId,
  });
}

export async function checkAndNotifyExpiredSessions(familyCode: string): Promise<void> {
  const now = new Date();
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('familyCode', '==', familyCode),
      where('status', '==', 'active')
    )
  );

  for (const d of snap.docs) {
    const data = d.data();
    const endTime = data.endTime ? (data.endTime as Timestamp).toDate() : null;
    const reminderSent = data.pickupReminderSent === true;

    if (endTime && endTime <= now && !reminderSent) {
      const userId = data.userId as string;
      if (userId) {
        // Import notification service to avoid circular deps: write inline
        const { createNotificationForUser } = await import('./notification-service');
        await createNotificationForUser(
          userId,
          'Washing cycle finished',
          `${data.washingMachineName ?? 'Washing machine'} session has finished. Please collect your laundry.`,
          'Queue'
        );
      }
      await updateDoc(d.ref, { pickupReminderSent: true });
    }
  }
}
