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
import { DryerQueueModel, QueueMessage } from '@/lib/types';

const COLLECTION = 'dryer_queue';

export function subscribeToDryerQueue(
  familyCode: string,
  dryerId: string,
  onData: (queue: DryerQueueModel[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where('familyCode', '==', familyCode),
    where('dryerId', '==', dryerId),
    where('status', 'in', ['active', 'waiting']),
    orderBy('startTime')
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DryerQueueModel))),
    (err) => onError?.(err as Error)
  );
}

export function subscribeToAllActiveDryerQueues(
  familyCode: string,
  onData: (queue: DryerQueueModel[]) => void,
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
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DryerQueueModel))),
    (err) => onError?.(err as Error)
  );
}

export async function bookDryer({
  userId,
  userName,
  familyCode,
  durationMinutes,
  dryerId,
  dryerName,
}: {
  userId: string;
  userName: string;
  familyCode: string;
  durationMinutes: number;
  dryerId: string;
  dryerName: string;
}): Promise<DryerQueueModel> {
  const activeSnap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('dryerId', '==', dryerId),
      where('status', '==', 'active')
    )
  );
  if (!activeSnap.empty) throw new Error('Dryer is currently in use');

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
    dryerId,
    dryerName,
  });

  const snap = await getDoc(ref);
  return { id: snap.id, ...snap.data() } as DryerQueueModel;
}

export async function joinDryerWaitingQueue({
  userId,
  userName,
  familyCode,
  durationMinutes,
  dryerId,
  dryerName,
}: {
  userId: string;
  userName: string;
  familyCode: string;
  durationMinutes: number;
  dryerId: string;
  dryerName: string;
}): Promise<DryerQueueModel> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('dryerId', '==', dryerId),
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
    dryerId,
    dryerName,
  });

  const docSnap = await getDoc(ref);
  return { id: docSnap.id, ...docSnap.data() } as DryerQueueModel;
}

export async function cancelDryerBooking(queueId: string): Promise<void> {
  const ref = doc(db, COLLECTION, queueId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const wasActive = data.status === 'active';
  const dryerId = data.dryerId as string;

  await updateDoc(ref, {
    status: 'cancelled',
    endTime: Timestamp.now(),
  });

  if (wasActive && dryerId) {
    await activateNextDryerInQueue(dryerId);
  }
}

export async function completeDryerSessionAfterPickup(queueId: string): Promise<void> {
  const ref = doc(db, COLLECTION, queueId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  if (data.status !== 'active') return;

  const dryerId = data.dryerId as string;

  await updateDoc(ref, {
    status: 'completed',
    endTime: Timestamp.now(),
  });

  if (dryerId) {
    await activateNextDryerInQueue(dryerId);
  }
}

async function activateNextDryerInQueue(dryerId: string): Promise<void> {
  const activeSnap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('dryerId', '==', dryerId),
      where('status', '==', 'active'),
      limit(1)
    )
  );
  if (!activeSnap.empty) return;

  const waitingSnap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('dryerId', '==', dryerId),
      where('status', '==', 'waiting')
    )
  );

  if (waitingSnap.empty) return;

  const sorted = waitingSnap.docs.slice().sort((a, b) => {
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

export async function getDryerEstimatedWaitTime(
  familyCode: string,
  dryerId: string
): Promise<number> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('familyCode', '==', familyCode),
      where('dryerId', '==', dryerId),
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

  return Math.floor(totalMs / 60000);
}

export async function getDryerCompletedSessions(
  familyCode: string,
  dryerId: string,
  since?: Date
): Promise<DryerQueueModel[]> {
  const q = query(
    collection(db, COLLECTION),
    where('familyCode', '==', familyCode),
    where('dryerId', '==', dryerId),
    where('status', '==', 'completed')
  );

  const snap = await getDocs(q);
  let results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DryerQueueModel));

  if (since) {
    results = results.filter((r) => {
      const endTime = r.endTime ? (r.endTime as Timestamp).toDate() : null;
      return endTime && endTime >= since;
    });
  }

  return results;
}

// ─── Chat / Messages ─────────────────────────────────────────────────────────

export function subscribeToDryerQueueMessages(
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

export async function sendDryerQueueMessage({
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
}

export async function checkAndNotifyExpiredDryerSessions(familyCode: string): Promise<void> {
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
        const { createNotificationForUser } = await import('./notification-service');
        await createNotificationForUser(
          userId,
          'Drying cycle finished',
          `${data.dryerName ?? 'Dryer'} session has finished. Please collect your laundry.`,
          'Queue'
        );
      }
      await updateDoc(d.ref, { pickupReminderSent: true });
    }
  }
}
