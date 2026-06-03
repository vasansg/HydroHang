'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModulePermissions {
  schedules: boolean;
  queue: boolean;
  weather: boolean;
  manualControl: boolean;
  badges: boolean;
  notifications: boolean;
  notificationSettings: boolean;
}

export const DEFAULT_PERMISSIONS: ModulePermissions = {
  schedules: true,
  queue: true,
  weather: true,
  manualControl: true,
  badges: true,
  notifications: true,
  notificationSettings: true,
};

/** Maps a Next.js pathname prefix to the ModulePermissions key that guards it. */
export const ROUTE_PERMISSION_MAP: Partial<Record<string, keyof ModulePermissions>> = {
  '/schedules': 'schedules',
  '/queue': 'queue',
  '/weather': 'weather',
  '/manual-control': 'manualControl',
  '/badges': 'badges',
  '/notifications': 'notifications',
  '/notification-settings': 'notificationSettings',
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface FamilyPermissionsContextType {
  /** The current authenticated user's own module permissions. */
  permissions: ModulePermissions;
  loading: boolean;
  /**
   * Primary-only: write permissions for any family member.
   * @param targetUid  The UID of the member whose permissions to update.
   * @param perms      The full ModulePermissions object to save.
   */
  updateUserPermissions: (targetUid: string, perms: ModulePermissions) => Promise<void>;
  /** Returns true if the current user may access the given module. Primary always returns true. */
  canAccess: (module: keyof ModulePermissions) => boolean;
}

const FamilyPermissionsContext = createContext<FamilyPermissionsContextType | null>(null);

export function FamilyPermissionsProvider({ children }: { children: React.ReactNode }) {
  const { userModel } = useAuth();
  const [permissions, setPermissions] = useState<ModulePermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  const familyCode = userModel?.familyCode;
  const uid = userModel?.uid;
  const isPrimary = userModel?.role === 'Primary';

  // Listen to THIS user's own per-user permissions document.
  // Path: families/{familyCode}/memberPermissions/{uid}
  useEffect(() => {
    if (!familyCode || !uid) { setLoading(false); return; }

    const ref = doc(db, 'families', familyCode, 'memberPermissions', uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setPermissions({ ...DEFAULT_PERMISSIONS, ...(snap.data().modulePermissions ?? {}) });
        } else {
          setPermissions(DEFAULT_PERMISSIONS);
        }
        setLoading(false);
      },
      () => { setPermissions(DEFAULT_PERMISSIONS); setLoading(false); }
    );
    return unsub;
  }, [familyCode, uid]);

  /** Primary-only: save permissions for any member. */
  const updateUserPermissions = async (targetUid: string, perms: ModulePermissions) => {
    if (!familyCode || !isPrimary) return;
    await setDoc(
      doc(db, 'families', familyCode, 'memberPermissions', targetUid),
      { modulePermissions: perms },
      { merge: true }
    );
  };

  const canAccess = (module: keyof ModulePermissions): boolean => {
    if (!userModel) return false;
    if (userModel.role === 'Primary') return true;
    return permissions[module];
  };

  return (
    <FamilyPermissionsContext.Provider value={{ permissions, loading, updateUserPermissions, canAccess }}>
      {children}
    </FamilyPermissionsContext.Provider>
  );
}

export function useFamilyPermissions() {
  const ctx = useContext(FamilyPermissionsContext);
  if (!ctx) throw new Error('useFamilyPermissions must be used within FamilyPermissionsProvider');
  return ctx;
}
