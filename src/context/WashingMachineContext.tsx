'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { WashingMachine } from '@/lib/types';
import {
  addWashingMachine,
  subscribeToWashingMachines,
  deleteWashingMachine,
} from '@/lib/services/washing-machine-service';
import { useAuth } from './AuthContext';

interface WashingMachineContextType {
  machines: WashingMachine[];
  loading: boolean;
  error: string | null;
  addMachine: (name: string) => Promise<boolean>;
  removeMachine: (id: string) => Promise<boolean>;
}

const WashingMachineContext = createContext<WashingMachineContextType | null>(null);

export function WashingMachineProvider({ children }: { children: React.ReactNode }) {
  const { userModel } = useAuth();
  const [machines, setMachines] = useState<WashingMachine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const familyCode = userModel?.familyCode;
    if (!familyCode) {
      setMachines([]);
      return;
    }

    setLoading(true);
    const unsub = subscribeToWashingMachines(
      familyCode,
      (data) => {
        setMachines(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [userModel?.familyCode]);

  const handleAdd = async (name: string): Promise<boolean> => {
    const familyCode = userModel?.familyCode;
    if (!familyCode) return false;
    try {
      await addWashingMachine(name, familyCode);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  const handleRemove = async (id: string): Promise<boolean> => {
    try {
      await deleteWashingMachine(id);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  return (
    <WashingMachineContext.Provider
      value={{ machines, loading, error, addMachine: handleAdd, removeMachine: handleRemove }}
    >
      {children}
    </WashingMachineContext.Provider>
  );
}

export function useWashingMachine() {
  const ctx = useContext(WashingMachineContext);
  if (!ctx) throw new Error('useWashingMachine must be used within WashingMachineProvider');
  return ctx;
}
