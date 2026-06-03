'use client';

import { useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useWeather } from '@/context/WeatherContext';
import { Cloud, Sun, CloudRain, Wind, Droplets, MapPin, RefreshCw, Loader2, Star, StarOff, Navigation, Umbrella, ThermometerSun, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { WeatherForecast } from '@/lib/types';
import { clsx } from 'clsx';

function weatherIcon(code: string, size = 20) {
  const cls = `shrink-0`;
  if (code.startsWith('01')) return <Sun size={size} className={clsx(cls, 'text-yellow-400')} />;
  if (code.startsWith('09') || code.startsWith('10') || code.startsWith('11'))
    return <CloudRain size={size} className={clsx(cls, 'text-blue-400')} />;
  return <Cloud size={size} className={clsx(cls, 'text-white/50')} />;
}

function ForecastCard({ day, i }: { day: WeatherForecast; i: number }) {
  const isRainy = day.precipitationProbability > 50;
  return (
    <div
      className="group shrink-0 w-28 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 flex flex-col items-center gap-2 hover:bg-white/[0.07] hover:border-white/[0.14] transition-all duration-200 hover:-translate-y-0.5"
      style={{ animation: `fadeInUp 0.4s ease ${i * 55}ms both` }}
    >
      <p className="text-white/50 text-xs font-bold">{format(day.date, 'EEE')}</p>
      <p className="text-white/25 text-[10px]">{format(day.date, 'MMM d')}</p>
      <div className="my-0.5">{weatherIcon(day.icon, 22)}</div>
      <p className="text-[10px] text-white/45 text-center leading-tight font-medium">{day.description}</p>
      <div className="flex items-center gap-1 text-xs font-black">
        <span className="text-white">{Math.round(day.tempMax)}°</span>
        <span className="text-white/25">{Math.round(day.tempMin)}°</span>
      </div>
      <div className={clsx('flex items-center gap-1 text-[10px] font-bold', isRainy ? 'text-blue-400' : 'text-white/30')}>
        <Umbrella size={10} />
        {day.precipitationProbability}%
      </div>
    </div>
  );
}

export default function WeatherPage() {
  const {
    current, forecast, loading, error, selectedCity, lastUpdated,
    favoriteCities, presetCities, useDeviceLocation, dryingRecommendation,
    loadWeather, loadWeatherByLocation, setCity, toggleFavoriteCity, isFavoriteCity, refresh,
  } = useWeather();

  useEffect(() => {
    if (!current && !loading) loadWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allCities = Array.from(new Set([...presetCities, ...favoriteCities]));

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black">Weather</h1>
            {lastUpdated && (
              <p className="text-white/30 text-xs mt-1 font-medium">Updated at {format(lastUpdated, 'h:mm a')}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadWeatherByLocation}
              disabled={loading}
              title="Use my location"
              className={clsx(
                'flex h-10 w-10 items-center justify-center rounded-xl border transition-all active:scale-95',
                useDeviceLocation
                  ? 'bg-violet-500/20 border-violet-500/30 text-violet-300'
                  : 'bg-white/[0.05] border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.08]'
              )}
            >
              <Navigation size={16} />
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-all active:scale-95"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
          </div>
        </div>

        {/* ── City chips ── */}
        <div className="flex gap-2 flex-wrap">
          {allCities.map((city) => (
            <button
              key={city}
              onClick={() => setCity(city)}
              className={clsx(
                'group flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold border transition-all duration-200',
                selectedCity === city && !useDeviceLocation
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 border-transparent text-white shadow-lg shadow-violet-500/20'
                  : 'bg-white/[0.05] border-white/[0.08] text-white/55 hover:text-white hover:bg-white/[0.09]'
              )}
            >
              {city}
              <button
                onClick={(e) => { e.stopPropagation(); toggleFavoriteCity(city); }}
                className="opacity-50 group-hover:opacity-100 transition-opacity"
              >
                {isFavoriteCity(city)
                  ? <Star size={12} className="text-yellow-400 fill-yellow-400" />
                  : <StarOff size={12} />}
              </button>
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400 font-medium">
            {error}
          </div>
        )}

        {loading && !current && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={32} className="animate-spin text-violet-400" />
            <p className="text-white/30 text-sm font-medium">Fetching weather…</p>
          </div>
        )}

        {current && (
          <>
            {/* ── Main weather card ── */}
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] p-7 md:p-8"
              style={{
                background: current.isGoodForDrying
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.06), rgba(15,6,20,0))'
                  : 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.1), rgba(15,6,20,0))',
                borderColor: current.isGoodForDrying ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)',
              }}
            >
              <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl opacity-30"
                style={{ background: current.isGoodForDrying ? '#10B981' : '#3B82F6' }} />

              <div className="relative">
                <div className="flex items-start justify-between mb-6 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin size={13} className="text-white/40" />
                      <p className="text-white/50 text-sm font-semibold">
                        {useDeviceLocation ? 'My Location' : current.cityName}
                      </p>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                      <span className="text-7xl font-black leading-none">{Math.round(current.temperature)}°</span>
                      <span className="text-2xl font-bold text-white/40 mb-2">C</span>
                    </div>
                    <p className="text-white/60 font-medium capitalize">{current.description}</p>
                  </div>

                  <div
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border shadow-2xl"
                    style={{
                      background: current.isGoodForDrying ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                      borderColor: current.isGoodForDrying ? 'rgba(16,185,129,0.25)' : 'rgba(59,130,246,0.25)',
                    }}
                  >
                    {current.isGoodForDrying
                      ? <Sun size={40} className="text-yellow-400" />
                      : <CloudRain size={40} className="text-blue-400" />}
                  </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: <Droplets size={15} className="text-blue-400" />, label: 'Humidity', value: `${current.humidity}%` },
                    { icon: <Wind size={15} className="text-white/50" />, label: 'Wind', value: `${current.windSpeed.toFixed(1)} km/h` },
                    { icon: <Umbrella size={15} className="text-blue-300" />, label: 'Rain chance', value: `${current.precipitationProbability}%` },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/[0.06] border border-white/[0.08] py-3">
                      {icon}
                      <p className="text-white font-black text-sm">{value}</p>
                      <p className="text-white/30 text-[10px] font-bold">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Drying recommendation ── */}
            <div className={clsx(
              'flex items-start gap-4 rounded-2xl border p-5 transition-all',
              current.isGoodForDrying
                ? 'bg-emerald-500/8 border-emerald-500/20'
                : current.precipitationProbability > 30
                ? 'bg-amber-500/8 border-amber-500/20'
                : 'bg-white/[0.04] border-white/[0.08]'
            )}>
              <div className={clsx(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border',
                current.isGoodForDrying
                  ? 'bg-emerald-500/15 border-emerald-500/20'
                  : 'bg-amber-500/12 border-amber-500/18'
              )}>
                {current.isGoodForDrying
                  ? <CheckCircle size={20} className="text-emerald-400" />
                  : <AlertTriangle size={20} className="text-amber-400" />}
              </div>
              <div>
                <p className="font-black text-sm mb-1">
                  {current.isGoodForDrying ? 'Great drying conditions' : 'Drying advisory'}
                </p>
                <p className="text-white/50 text-sm font-medium leading-relaxed">{dryingRecommendation}</p>
              </div>
            </div>

            {/* ── 7-day forecast ── */}
            {forecast.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <ThermometerSun size={16} className="text-white/40" />
                  <h2 className="font-black">7-Day Forecast</h2>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {forecast.map((day, i) => <ForecastCard key={i} day={day} i={i} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
