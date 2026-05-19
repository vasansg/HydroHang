'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, firebaseReady } from '@/lib/firebase';
import { UserModel } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  userModel: UserModel | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    role: 'Primary' | 'Secondary',
    familyCode?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userModel, setUserModel] = useState<UserModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      try {
        if (firebaseUser) {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (snap.exists()) {
            setUserModel(snap.data() as UserModel);
          } else {
            setUserModel(null);
          }
        } else {
          setUserModel(null);
        }
      } catch {
        setUserModel(null);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, 'users', cred.user.uid));
    if (snap.exists()) setUserModel(snap.data() as UserModel);
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    role: 'Primary' | 'Secondary',
    familyCode?: string
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // Generate family code for Primary users
    const code =
      role === 'Primary'
        ? Math.random().toString(36).substring(2, 8).toUpperCase()
        : familyCode ?? '';

    const newUser: Omit<UserModel, 'createdAt'> & { createdAt: unknown } = {
      uid,
      email,
      name,
      role,
      familyCode: code,
      primaryUserId: role === 'Primary' ? uid : undefined,
      createdAt: serverTimestamp(),
      isActive: true,
      notificationPreferences: {
        pushEnabled: true,
        emailEnabled: true,
        rainAlerts: true,
        queueAlerts: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      },
    };

    await setDoc(doc(db, 'users', uid), newUser);
    setUserModel(newUser as UserModel);
  };

  const logout = async () => {
    await signOut(auth);
    setUserModel(null);
  };

  if (!firebaseReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white', flexDirection: 'column', gap: '12px', padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Firebase environment variables are missing.</p>
        <p style={{ color: '#94a3b8', maxWidth: '480px' }}>
          Add your Firebase config to Vercel: Settings → Environment Variables. See the README or deployment guide for the required variable names.
        </p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userModel, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
