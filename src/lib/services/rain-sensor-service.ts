import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import { RainSensorData } from '@/lib/types';

// The RTDB lives on a different regional URL than the default Firestore project.
const RTDB_URL =
  'https://laundrymanagementapp-f7146-default-rtdb.asia-southeast1.firebasedatabase.app';

function getRtdb() {
  // Reuse the already-initialized Firebase app but point at the RTDB URL
  const app = getApps()[0];
  return getDatabase(app, RTDB_URL);
}

const BASE_PATH = 'rain_sensor';

const STALE_THRESHOLD_MS = 120_000; // 2 minutes

/**
 * Returns true when [timestamp] is a valid Unix epoch (seconds or ms, 2020–2035)
 * and is within the stale threshold. Relative timestamps (Arduino millis()) fall
 * outside this range and we return true (trust the status flag).
 */
function isSensorDataFresh(timestamp: number): boolean {
  if (timestamp <= 0) return true;

  const nowMs = Date.now();
  const y2020ms = 1_577_836_800_000;
  const y2035ms = 2_051_222_400_000;
  const y2020s = 1_577_836_800;
  const y2035s = 2_051_222_400;

  let ageMs: number;
  if (timestamp > y2020ms && timestamp < y2035ms) {
    ageMs = nowMs - timestamp;
  } else if (timestamp > y2020s && timestamp < y2035s) {
    ageMs = nowMs - timestamp * 1000;
  } else {
    // Relative timestamp — cannot determine staleness
    return true;
  }

  return ageMs >= 0 && ageMs <= STALE_THRESHOLD_MS;
}

/** Subscribe to rain sensor readings */
export function subscribeToSensorData(
  onData: (data: RainSensorData | null) => void
): () => void {
  const db = getRtdb();
  const sensorRef = ref(db, `${BASE_PATH}/sensors`);

  const unsub = onValue(sensorRef, (snapshot) => {
    const raw = snapshot.val();
    if (!raw) {
      onData(null);
      return;
    }
    onData({
      value: (raw.value as number) ?? 0,
      condition: (raw.condition as 'WET' | 'DRY' | 'UNKNOWN') ?? 'UNKNOWN',
      servoPosition: (raw.servo as number) ?? 0,
      timestamp: (raw.timestamp as number) ?? 0,
    });
  });

  return unsub;
}

/** Subscribe to device online status */
export function subscribeToDeviceOnline(
  onStatus: (online: boolean) => void
): () => void {
  const db = getRtdb();
  const statusRef = ref(db, `${BASE_PATH}/status`);

  return onValue(statusRef, (snapshot) => {
    onStatus(snapshot.val() === 'online');
  });
}

/**
 * Determine effective online status (both Firebase online flag AND fresh sensor data).
 */
export function isDeviceOnline(
  rawOnline: boolean,
  sensorData: RainSensorData | null
): boolean {
  if (!rawOnline) return false;
  if (!sensorData) return false;
  return isSensorDataFresh(sensorData.timestamp);
}

/** Command servo to a given angle (switches to manual mode) */
export async function sendServoCommand(angle: number): Promise<void> {
  const db = getRtdb();
  await update(ref(db, `${BASE_PATH}/commands`), {
    set_auto_mode: false,
    servo_angle: angle,
  });
}

/** Restore automatic rain-detection mode */
export async function restoreAutoMode(
  wetAngle = 0,
  dryAngle = 150
): Promise<void> {
  const db = getRtdb();
  await update(ref(db, `${BASE_PATH}/commands`), {
    set_auto_mode: true,
    wet_angle: wetAngle,
    dry_angle: dryAngle,
  });
}
