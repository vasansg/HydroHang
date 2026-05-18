import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dryer } from '@/lib/types';

const COLLECTION = 'dryers';

export async function addDryer(name: string, familyCode: string): Promise<Dryer> {
  const ref = await addDoc(collection(db, COLLECTION), { name, familyCode });
  return { id: ref.id, name, familyCode };
}

export function subscribeToDryers(
  familyCode: string,
  onData: (dryers: Dryer[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, COLLECTION), where('familyCode', '==', familyCode));
  return onSnapshot(
    q,
    (snap) => {
      const dryers: Dryer[] = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name ?? 'Unnamed Dryer',
        familyCode: d.data().familyCode ?? '',
      }));
      onData(dryers);
    },
    (err) => onError?.(err as Error)
  );
}

export async function deleteDryer(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
