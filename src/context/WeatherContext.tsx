'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { WeatherData, WeatherForecast } from '@/lib/types';
import {
  getWeatherData,
  getWeatherDataByCoords,
  getDryingRecommendation,
  PRESET_CITIES,
} from '@/lib/services/weather-service';

const STORAGE_KEY_CITY = 'weather_selected_city';
const STORAGE_KEY_FAVORITES = 'weather_favorite_cities';

interface WeatherContextType {
  current: WeatherData | null;
  forecast: WeatherForecast[];
  loading: boolean;
  error: string | null;
  selectedCity: string;
  lastUpdated: Date | null;
  favoriteCities: string[];
  presetCities: readonly string[];
  useDeviceLocation: boolean;
  dryingRecommendation: string;
  loadWeather: (city?: string) => Promise<void>;
  loadWeatherByLocation: () => Promise<void>;
  setCity: (city: string) => Promise<void>;
  toggleFavoriteCity: (city: string) => void;
  isFavoriteCity: (city: string) => boolean;
  refresh: () => Promise<void>;
}

const WeatherContext = createContext<WeatherContextType | null>(null);

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>('Parit Raja');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [favoriteCities, setFavoriteCities] = useState<string[]>([]);
  const [useDeviceLocation, setUseDeviceLocation] = useState(false);

  // Load persisted preferences from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedCity = localStorage.getItem(STORAGE_KEY_CITY);
      if (storedCity && storedCity.trim()) setSelectedCity(storedCity.trim());

      const storedFavs = localStorage.getItem(STORAGE_KEY_FAVORITES);
      if (storedFavs) {
        const parsed = JSON.parse(storedFavs) as string[];
        setFavoriteCities(parsed.filter((c) => c.trim()));
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  function savePreferences(city: string, favorites: string[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_CITY, city);
      localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }

  const loadWeather = useCallback(
    async (city?: string) => {
      const cityToUse = city ?? selectedCity;
      setLoading(true);
      setError(null);
      try {
        const { current: c, forecast: f } = await getWeatherData(cityToUse);
        setCurrent(c);
        setForecast(f);
        setSelectedCity(cityToUse);
        setLastUpdated(new Date());
        setUseDeviceLocation(false);
        savePreferences(cityToUse, favoriteCities);
      } catch (e) {
        setError((e as Error).message);
        setCurrent(null);
        setForecast([]);
      } finally {
        setLoading(false);
      }
    },
    [selectedCity, favoriteCities]
  );

  const loadWeatherByLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!('geolocation' in navigator)) {
        throw new Error('Geolocation is not supported by your browser.');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10_000,
        });
      });

      const { current: c, forecast: f } = await getWeatherDataByCoords(
        position.coords.latitude,
        position.coords.longitude,
        'My Location'
      );
      setCurrent(c);
      setForecast(f);
      setUseDeviceLocation(true);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setUseDeviceLocation(false);
      setError((e as Error).message);
      // Fall back to selected city
      setLoading(false);
      await loadWeather(selectedCity);
      return;
    } finally {
      setLoading(false);
    }
  }, [selectedCity, loadWeather]);

  const setCity = useCallback(
    async (city: string) => {
      setUseDeviceLocation(false);
      await loadWeather(city);
    },
    [loadWeather]
  );

  const toggleFavoriteCity = useCallback((city: string) => {
    setFavoriteCities((prev) => {
      const next = prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city];
      savePreferences(selectedCity, next);
      return next;
    });
  }, [selectedCity]);

  const isFavoriteCity = useCallback(
    (city: string) => favoriteCities.includes(city),
    [favoriteCities]
  );

  const refresh = useCallback(async () => {
    if (useDeviceLocation) {
      await loadWeatherByLocation();
    } else {
      await loadWeather(selectedCity);
    }
  }, [useDeviceLocation, loadWeatherByLocation, loadWeather, selectedCity]);

  const dryingRecommendation = current ? getDryingRecommendation(current) : '';

  return (
    <WeatherContext.Provider
      value={{
        current,
        forecast,
        loading,
        error,
        selectedCity,
        lastUpdated,
        favoriteCities,
        presetCities: PRESET_CITIES,
        useDeviceLocation,
        dryingRecommendation,
        loadWeather,
        loadWeatherByLocation,
        setCity,
        toggleFavoriteCity,
        isFavoriteCity,
        refresh,
      }}
    >
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeather() {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error('useWeather must be used within WeatherProvider');
  return ctx;
}
