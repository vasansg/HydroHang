import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LaundryActivity } from '@/lib/types';

const COLLECTION = 'laundry_activities';

export async function logActivity(activity: Omit<LaundryActivity, 'id'>): Promise<void> {
  await addDoc(collection(db, COLLECTION), {
    userId: activity.userId,
    userName: activity.userName,
    timestamp: Timestamp.fromDate(
      activity.timestamp instanceof Date
        ? activity.timestamp
        : (activity.timestamp as Timestamp).toDate()
    ),
    type: activity.type,
    action: activity.action,
    weatherCondition: activity.weatherCondition,
    temperature: activity.temperature,
    familyCode: activity.familyCode,
  });
}

export function subscribeToFamilyActivities(
  familyCode: string,
  onData: (activities: LaundryActivity[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where('familyCode', '==', familyCode),
    orderBy('timestamp', 'desc'),
    limit(50)
  );

  return onSnapshot(
    q,
    (snap) => {
      const activities: LaundryActivity[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId ?? '',
          userName: data.userName ?? 'Unknown',
          timestamp: data.timestamp,
          type: data.type ?? 'Manual',
          action: data.action ?? '',
          weatherCondition: data.weatherCondition ?? '',
          temperature: (data.temperature as number) ?? 0,
          familyCode: data.familyCode ?? '',
        };
      });
      onData(activities);
    },
    (err) => onError?.(err as Error)
  );
}
