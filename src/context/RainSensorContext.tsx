'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { RainSensorData } from '@/lib/types';
import {
  subscribeToSensorData,
  subscribeToDeviceOnline,
  isDeviceOnline,
  sendServoCommand,
  restoreAutoMode,
} from '@/lib/services/rain-sensor-service';
import { useAuth } from './AuthContext';

interface RainSensorContextType {
  sensorData: RainSensorData | null;
  deviceOnline: boolean;
  sendCommand: (angle: number) => Promise<void>;
  setAutoMode: (wetAngle?: number, dryAngle?: number) => Promise<void>;
}

const RainSensorContext = createContext<RainSensorContextType | null>(null);

export function RainSensorProvider({ children }: { children: React.ReactNode }) {
  const { userModel } = useAuth();
  const [sensorData, setSensorData] = useState<RainSensorData | null>(null);
  const [rawOnline, setRawOnline] = useState(false);
  const lastConditionRef = useRef<string | null>(null);
  const sensorUnsubRef = useRef<(() => void) | null>(null);
  const onlineUnsubRef = useRef<(() => void) | null>(null);
  const stalenessTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const loggedIn = !!userModel;

    if (loggedIn && !sensorUnsubRef.current) {
      // Start sensor subscription
      sensorUnsubRef.current = subscribeToSensorData(async (data) => {
        // Trigger rain notification when condition transitions to WET
        if (
          data?.condition === 'WET' &&
          lastConditionRef.current !== 'WET' &&
          userModel?.familyCode
        ) {
          try {
            const { triggerFamilyNotification } = await import(
              '@/lib/services/notification-service'
            );
            await triggerFamilyNotification({
              title: 'Rain Detected!',
              body: "It's raining! Pull the clothes inside to keep them dry.",
              type: 'Rain',
              familyCode: userModel.familyCode,
            });
          } catch {
            // non-critical
          }
        }
        lastConditionRef.current = data?.condition ?? null;
        setSensorData(data);
      });

      // Start online status subscription
      onlineUnsubRef.current = subscribeToDeviceOnline(setRawOnline);

      // Periodically re-evaluate staleness (Arduino may stop sending without disconnecting)
      stalenessTimerRef.current = setInterval(() => {
        forceRender((n) => n + 1);
      }, 30_000);
    } else if (!loggedIn && sensorUnsubRef.current) {
      // Stop all subscriptions
      sensorUnsubRef.current();
      sensorUnsubRef.current = null;
      onlineUnsubRef.current?.();
      onlineUnsubRef.current = null;
      if (stalenessTimerRef.current) {
        clearInterval(stalenessTimerRef.current);
        stalenessTimerRef.current = null;
      }
      setSensorData(null);
      setRawOnline(false);
      lastConditionRef.current = null;
    }
  }, [userModel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sensorUnsubRef.current?.();
      onlineUnsubRef.current?.();
      if (stalenessTimerRef.current) clearInterval(stalenessTimerRef.current);
    };
  }, []);

  const deviceOnline = isDeviceOnline(rawOnline, sensorData);

  const handleSendCommand = useCallback(async (angle: number) => {
    await sendServoCommand(angle);
  }, []);

  const handleSetAutoMode = useCallback(
    async (wetAngle = 0, dryAngle = 150) => {
      await restoreAutoMode(wetAngle, dryAngle);
    },
    []
  );

  return (
    <RainSensorContext.Provider
      value={{
        sensorData,
        deviceOnline,
        sendCommand: handleSendCommand,
        setAutoMode: handleSetAutoMode,
      }}
    >
      {children}
    </RainSensorContext.Provider>
  );
}

export function useRainSensor() {
  const ctx = useContext(RainSensorContext);
  if (!ctx) throw new Error('useRainSensor must be used within RainSensorProvider');
  return ctx;
}
