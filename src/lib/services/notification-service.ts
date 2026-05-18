import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AppNotification, NotificationPreferences } from '@/lib/types';

function isInQuietHours(prefs: Record<string, unknown>): boolean {
  const now = new Date();
  const startStr = (prefs.quietHoursStart as string) ?? '22:00';
  const endStr = (prefs.quietHoursEnd as string) ?? '08:00';

  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);

  const start = new Date(now);
  start.setHours(sh, sm, 0, 0);
  let end = new Date(now);
  end.setHours(eh, em, 0, 0);

  if (end <= start) {
    end = new Date(end.getTime() + 86400000);
  }

  return now >= start && now < end;
}

/** Write a notification doc into users/{uid}/notifications subcollection */
export async function createNotificationForUser(
  userId: string,
  title: string,
  body: string,
  type: string
): Promise<void> {
  await addDoc(collection(db, 'users', userId, 'notifications'), {
    title,
    body,
    timestamp: serverTimestamp(),
    type,
    isRead: false,
  });
}

/** Trigger notification for all family members matching preferences */
export async function triggerFamilyNotification({
  title,
  body,
  type,
  familyCode,
  excludeUid,
}: {
  title: string;
  body: string;
  type: string;
  familyCode: string;
  excludeUid?: string;
}): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'users'), where('familyCode', '==', familyCode))
  );

  for (const d of snap.docs) {
    const uid = d.id;
    if (excludeUid && uid === excludeUid) continue;

    const data = d.data();
    const prefs: Record<string, unknown> = (data.notificationPreferences as Record<string, unknown>) ?? {};

    let shouldSend = true;
    if (type === 'Rain' && !((prefs.rainAlerts as boolean) ?? true)) shouldSend = false;
    if (type === 'Queue' && !((prefs.queueAlerts as boolean) ?? true)) shouldSend = false;
    if (!((prefs.pushEnabled as boolean) ?? true)) shouldSend = false;
    if (type !== 'Schedule' && shouldSend && isInQuietHours(prefs)) shouldSend = false;

    if (shouldSend) {
      await createNotificationForUser(uid, title, body, type);
    }
  }
}

/** Trigger a notification for a single user, respecting their preferences */
export async function triggerNotificationForUser({
  userId,
  title,
  body,
  type,
  forceInApp = false,
}: {
  userId: string;
  title: string;
  body: string;
  type: string;
  forceInApp?: boolean;
}): Promise<void> {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return;

  const data = userDoc.data();
  const prefs: Record<string, unknown> = (data.notificationPreferences as Record<string, unknown>) ?? {};

  let shouldSend = true;
  if (type === 'Rain' && !((prefs.rainAlerts as boolean) ?? true)) shouldSend = false;
  if (type === 'Queue' && !((prefs.queueAlerts as boolean) ?? true)) shouldSend = false;
  if (!((prefs.pushEnabled as boolean) ?? true)) shouldSend = false;
  if (type !== 'Schedule' && shouldSend && isInQuietHours(prefs)) shouldSend = false;

  if (forceInApp || shouldSend) {
    await createNotificationForUser(userId, title, body, type);
  }
}

/** Subscribe to all notifications for a user (ordered by timestamp desc) */
export function subscribeToNotifications(
  userId: string,
  onData: (notifications: AppNotification[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'users', userId, 'notifications'),
    orderBy('timestamp', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification)));
    },
    (err) => onError?.(err as Error)
  );
}

/** Subscribe to unread notification count */
export function subscribeToUnreadCount(
  userId: string,
  onCount: (count: number) => void
): () => void {
  const q = query(
    collection(db, 'users', userId, 'notifications'),
    where('isRead', '==', false)
  );
  return onSnapshot(q, (snap) => onCount(snap.size));
}

export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), {
    isRead: true,
  });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, 'users', userId, 'notifications'),
      where('isRead', '==', false)
    )
  );
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { isRead: true }));
  await batch.commit();
}

export async function deleteNotification(
  userId: string,
  notificationId: string
): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'notifications', notificationId));
}

export async function updateNotificationPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>
): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    notificationPreferences: prefs,
  });
}
