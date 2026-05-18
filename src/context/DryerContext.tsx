'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Dryer } from '@/lib/types';
import { addDryer, subscribeToDryers, deleteDryer } from '@/lib/services/dryer-service';
import { useAuth } from './AuthContext';

interface DryerContextType {
  dryers: Dryer[];
  loading: boolean;
  error: string | null;
  addDryer: (name: string) => Promise<boolean>;
  removeDryer: (id: string) => Promise<boolean>;
}

const DryerContext = createContext<DryerContextType | null>(null);

export function DryerProvider({ children }: { children: React.ReactNode }) {
  const { userModel } = useAuth();
  const [dryers, setDryers] = useState<Dryer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const familyCode = userModel?.familyCode;
    if (!familyCode) {
      setDryers([]);
      return;
    }

    setLoading(true);
    const unsub = subscribeToDryers(
      familyCode,
      (data) => {
        setDryers(data);
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

  const handleAddDryer = async (name: string): Promise<boolean> => {
    const familyCode = userModel?.familyCode;
    if (!familyCode) return false;
    try {
      await addDryer(name, familyCode);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  const handleRemoveDryer = async (id: string): Promise<boolean> => {
    try {
      await deleteDryer(id);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  return (
    <DryerContext.Provider
      value={{
        dryers,
        loading,
        error,
        addDryer: handleAddDryer,
        removeDryer: handleRemoveDryer,
      }}
    >
      {children}
    </DryerContext.Provider>
  );
}

export function useDryer() {
  const ctx = useContext(DryerContext);
  if (!ctx) throw new Error('useDryer must be used within DryerProvider');
  return ctx;
}
