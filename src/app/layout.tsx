import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { GamificationProvider } from '@/context/GamificationContext';
import { ScheduleProvider } from '@/context/ScheduleContext';
import { QueueProvider } from '@/context/QueueContext';
import { WashingMachineProvider } from '@/context/WashingMachineContext';
import { DryerProvider } from '@/context/DryerContext';
import { RainSensorProvider } from '@/context/RainSensorContext';
import { WeatherProvider } from '@/context/WeatherContext';

export const metadata: Metadata = {
  title: 'HydroHang – Laundry Management',
  description: 'Smart laundry management for your family',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <NotificationProvider>
            <GamificationProvider>
              <ScheduleProvider>
                <QueueProvider>
                  <WashingMachineProvider>
                    <DryerProvider>
                      <RainSensorProvider>
                        <WeatherProvider>
                          {children}
                        </WeatherProvider>
                      </RainSensorProvider>
                    </DryerProvider>
                  </WashingMachineProvider>
                </QueueProvider>
              </ScheduleProvider>
            </GamificationProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
