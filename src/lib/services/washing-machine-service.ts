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
import { WashingMachine } from '@/lib/types';

const COLLECTION = 'washing_machines';

export async function addWashingMachine(
  name: string,
  familyCode: string
): Promise<WashingMachine> {
  const ref = await addDoc(collection(db, COLLECTION), { name, familyCode });
  return { id: ref.id, name, familyCode };
}

export function subscribeToWashingMachines(
  familyCode: string,
  onData: (machines: WashingMachine[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, COLLECTION), where('familyCode', '==', familyCode));
  return onSnapshot(
    q,
    (snap) => {
      const machines: WashingMachine[] = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name ?? 'Unnamed Machine',
        familyCode: d.data().familyCode ?? '',
      }));
      onData(machines);
    },
    (err) => onError?.(err as Error)
  );
}

export async function deleteWashingMachine(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
