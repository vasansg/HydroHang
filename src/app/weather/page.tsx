'use client';

import { useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { useWeather } from '@/context/WeatherContext';
import {
  Cloud,
  Sun,
  CloudRain,
  Wind,
  Droplets,
  MapPin,
  RefreshCw,
  Loader2,
  Star,
  StarOff,
  Navigation,
  Umbrella,
} from 'lucide-react';
import { format } from 'date-fns';
import { WeatherForecast } from '@/lib/types';

function weatherIcon(iconCode: string) {
  if (iconCode.startsWith('01')) return <Sun size={20} className="text-yellow-400" />;
  if (iconCode.startsWith('02') || iconCode.startsWith('03') || iconCode.startsWith('04'))
    return <Cloud size={20} className="text-white/60" />;
  if (iconCode.startsWith('09') || iconCode.startsWith('10') || iconCode.startsWith('11'))
    return <CloudRain size={20} className="text-blue-400" />;
  return <Cloud size={20} className="text-white/60" />;
}

function ForecastCard({ day }: { day: WeatherForecast }) {
  return (
    <div className="flex-shrink-0 w-28 bg-white/5 rounded-2xl p-3 flex flex-col items-center gap-2">
      <p className="text-white/50 text-xs font-semibold">
        {format(day.date, 'EEE')}
      </p>
      <p className="text-white/30 text-[10px]">{format(day.date, 'MMM d')}</p>
      <div>{weatherIcon(day.icon)}</div>
      <p className="text-xs text-white/60 text-center leading-tight">{day.description}</p>
      <div className="text-xs font-bold">
        <span className="text-white">{Math.round(day.tempMax)}°</span>
        <span className="text-white/30 ml-1">{Math.round(day.tempMin)}°</span>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-blue-400">
        <Umbrella size={10} />
        {day.precipitationProbability}%
      </div>
    </div>
  );
}

export default function WeatherPage() {
  const {
    current,
    forecast,
    loading,
    error,
    selectedCity,
    lastUpdated,
    favoriteCities,
    presetCities,
    useDeviceLocation,
    dryingRecommendation,
    loadWeather,
    loadWeatherByLocation,
    setCity,
    toggleFavoriteCity,
    isFavoriteCity,
    refresh,
  } = useWeather();

  useEffect(() => {
    if (!current && !loading) {
      loadWeather();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allCities = Array.from(new Set([...presetCities, ...favoriteCities]));

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Weather</h1>
            {lastUpdated && (
              <p className="text-white/30 text-xs mt-0.5">
                Updated {format(lastUpdated, 'h:mm a')}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadWeatherByLocation}
              disabled={loading}
              title="Use my location"
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <Navigation size={16} className={useDeviceLocation ? 'text-primary-light' : 'text-white/60'} />
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin text-white/60" />
              ) : (
                <RefreshCw size={16} className="text-white/60" />
              )}
            </button>
          </div>
        </div>

        {/* City chips */}
        <div className="flex gap-2 flex-wrap">
          {allCities.map((city) => (
            <button
              key={city}
              onClick={() => setCity(city)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                selectedCity === city && !useDeviceLocation
                  ? 'bg-primary text-white'
                  : 'bg-white/5 hover:bg-white/10 text-white/70'
              }`}
            >
              {city}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavoriteCity(city);
                }}
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
              >
                {isFavoriteCity(city) ? (
                  <Star size={12} className="text-yellow-400 fill-yellow-400" />
                ) : (
                  <StarOff size={12} />
                )}
              </button>
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {loading && !current && (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="animate-spin text-primary-light" />
          </div>
        )}

        {current && (
          <>
            {/* Main weather card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/40 to-secondary/30 border border-white/10 p-6">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-800/20" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin size={14} className="text-white/60" />
                      <p className="text-white/60 text-sm font-semibold">
                        {useDeviceLocation ? 'My Location' : current.cityName}
                      </p>
                    </div>
                    <p className="text-6xl font-black">{Math.round(current.temperature)}°C</p>
                    <p className="text-white/70 mt-1">{current.description}</p>
                  </div>
                  <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                    {current.isGoodForDrying ? (
                      <Sun size={36} className="text-yellow-400" />
                    ) : (
                      <CloudRain size={36} className="text-blue-400" />
                    )}
                  </div>
                </div>

                <div className="flex gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <Droplets size={16} className="text-blue-400" />
                    <span className="text-sm text-white/70">{current.humidity}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wind size={16} className="text-white/60" />
                    <span className="text-sm text-white/70">{current.windSpeed.toFixed(1)} km/h</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Umbrella size={16} className="text-blue-400" />
                    <span className="text-sm text-white/70">{current.precipitationProbability}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Drying recommendation */}
            <div
              className={`card flex items-start gap-4 ${
                current.isGoodForDrying
                  ? 'border-green-500/30 bg-green-500/5'
                  : current.precipitationProbability > 30
                  ? 'border-yellow-500/30 bg-yellow-500/5'
                  : 'border-white/10'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                {current.isGoodForDrying ? (
                  <Sun size={20} className="text-yellow-400" />
                ) : (
                  <CloudRain size={20} className="text-blue-400" />
                )}
              </div>
              <div>
                <p className="font-bold text-sm">Drying Recommendation</p>
                <p className="text-white/60 text-sm mt-0.5">{dryingRecommendation}</p>
              </div>
            </div>

            {/* 7-day forecast */}
            {forecast.length > 0 && (
              <div>
                <h2 className="font-bold mb-3">7-Day Forecast</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {forecast.map((day, i) => (
                    <ForecastCard key={i} day={day} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
