'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Module permission keys are intentionally snake_case to match the Flutter app's
 * Firestore data model (stored as users/{uid}.modulePermissions).
 *
 * Shared with Flutter: queue, weather, manual_control, smart_schedule
 * Web-only extras: badges, notifications, notification_settings
 */
export interface ModulePermissions {
  queue: boolean;
  weather: boolean;
  manual_control: boolean;
  smart_schedule: boolean;
  badges: boolean;
  notifications: boolean;
  notification_settings: boolean;
}

export const DEFAULT_PERMISSIONS: ModulePermissions = {
  queue: true,
  weather: true,
  manual_control: true,
  smart_schedule: true,
  badges: true,
  notifications: true,
  notification_settings: true,
};

/**
 * Maps a Next.js pathname prefix → the ModulePermissions key that guards it.
 * Exported so Sidebar, BottomNav and AppShell can import this single source of truth.
 */
export const ROUTE_PERMISSION_MAP: Partial<Record<string, keyof ModulePermissions>> = {
  '/schedules':             'smart_schedule',
  '/queue':                 'queue',
  '/weather':               'weather',
  '/manual-control':        'manual_control',
  '/badges':                'badges',
  '/notifications':         'notifications',
  '/notification-settings': 'notification_settings',
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface FamilyPermissionsContextType {
  /** Current authenticated user's own module permissions (real-time). */
  permissions: ModulePermissions;
  loading: boolean;
  /**
   * Primary-only: update another family member's modulePermissions.
   * Writes directly to users/{targetUid}.modulePermissions, aligned with Flutter.
   */
  updateUserPermissions: (targetUid: string, perms: ModulePermissions) => Promise<void>;
  /**
   * Primary-only: remove a Secondary member from the family.
   * Sets isActive:false and clears familyCode, aligned with Flutter.
   */
  removeFamilyMember: (targetUid: string) => Promise<void>;
  /** true if the current user may access the given module (Primary always true). */
  canAccess: (module: keyof ModulePermissions) => boolean;
}

const FamilyPermissionsContext = createContext<FamilyPermissionsContextType | null>(null);

export function FamilyPermissionsProvider({ children }: { children: React.ReactNode }) {
  const { userModel } = useAuth();
  const [permissions, setPermissions] = useState<ModulePermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  const uid = userModel?.uid;
  const isPrimary = userModel?.role === 'Primary';

  // Listen to THIS user's own document for real-time modulePermissions updates.
  // This is the same collection Flutter reads from: users/{uid}.modulePermissions
  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const ref = doc(db, 'users', uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const raw = snap.data().modulePermissions ?? {};
          setPermissions({ ...DEFAULT_PERMISSIONS, ...raw });
        } else {
          setPermissions(DEFAULT_PERMISSIONS);
        }
        setLoading(false);
      },
      () => { setPermissions(DEFAULT_PERMISSIONS); setLoading(false); }
    );
    return unsub;
  }, [uid]);

  /** Write modulePermissions to users/{targetUid} — Primary only, matches Flutter. */
  const updateUserPermissions = async (targetUid: string, perms: ModulePermissions) => {
    if (!isPrimary) return;
    await updateDoc(doc(db, 'users', targetUid), { modulePermissions: perms });
  };

  /** Remove a Secondary member: isActive=false + clear familyCode — matches Flutter. */
  const removeFamilyMember = async (targetUid: string) => {
    if (!isPrimary) return;
    await updateDoc(doc(db, 'users', targetUid), {
      isActive: false,
      familyCode: deleteField(),
    });
  };

  const canAccess = (module: keyof ModulePermissions): boolean => {
    if (!userModel) return false;
    if (userModel.role === 'Primary') return true;
    return permissions[module];
  };

  return (
    <FamilyPermissionsContext.Provider
      value={{ permissions, loading, updateUserPermissions, removeFamilyMember, canAccess }}
    >
      {children}
    </FamilyPermissionsContext.Provider>
  );
}

export function useFamilyPermissions() {
  const ctx = useContext(FamilyPermissionsContext);
  if (!ctx) throw new Error('useFamilyPermissions must be used within FamilyPermissionsProvider');
  return ctx;
}
