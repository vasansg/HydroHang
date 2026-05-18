import { WeatherData, WeatherForecast } from '@/lib/types';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

function getWeatherDescription(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Mainly clear';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
}

function getWeatherIcon(code: number): string {
  if (code === 0) return '01d';
  if (code <= 3) return '02d';
  if (code <= 48) return '50d';
  if (code <= 57) return '09d';
  if (code <= 67) return '10d';
  if (code <= 77) return '13d';
  if (code <= 82) return '09d';
  if (code <= 86) return '13d';
  return '11d';
}

function isGoodForDrying(
  precipitationProbability: number,
  humidity: number,
  description: string
): boolean {
  return (
    precipitationProbability < 30 &&
    humidity < 70 &&
    (description.toLowerCase().includes('clear') ||
      description.toLowerCase().includes('cloudy'))
  );
}

async function getCoordinates(city: string): Promise<{ lat: number; lon: number }> {
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to connect to location service.');

  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`City '${city}' not found. Please check the spelling.`);
  }

  return {
    lat: data.results[0].latitude as number,
    lon: data.results[0].longitude as number,
  };
}

function parseWeatherResponse(
  data: Record<string, unknown>,
  cityName: string
): { current: WeatherData; forecast: WeatherForecast[] } {
  const current = data.current as Record<string, unknown>;
  const hourly = data.hourly as Record<string, unknown> | undefined;
  const daily = data.daily as Record<string, unknown>;

  let pop = 0;
  if (hourly?.precipitation_probability) {
    pop = (hourly.precipitation_probability as number[])[0] ?? 0;
  }

  const code = (current.weather_code as number) ?? 0;
  const desc = getWeatherDescription(code);
  const humidity = (current.relative_humidity_2m as number) ?? 0;
  const precipProb = pop;

  const currentWeather: WeatherData = {
    cityName,
    temperature: (current.temperature_2m as number) ?? 0,
    description: desc,
    icon: getWeatherIcon(code),
    humidity,
    windSpeed: (current.wind_speed_10m as number) ?? 0,
    precipitationProbability: precipProb,
    timestamp: new Date(current.time as string),
    isGoodForDrying: isGoodForDrying(precipProb, humidity, desc),
  };

  const dailyTimes = daily.time as string[];
  const forecast: WeatherForecast[] = dailyTimes.slice(0, 7).map((time, i) => {
    const fc = daily as Record<string, unknown[]>;
    const fcCode = (fc.weather_code[i] as number) ?? 0;
    return {
      date: new Date(time),
      tempMin: (fc.temperature_2m_min[i] as number) ?? 0,
      tempMax: (fc.temperature_2m_max[i] as number) ?? 0,
      description: getWeatherDescription(fcCode),
      icon: getWeatherIcon(fcCode),
      precipitationProbability: (fc.precipitation_probability_max[i] as number) ?? 0,
    };
  });

  return { current: currentWeather, forecast };
}

async function fetchWeatherByCoords(
  lat: number,
  lon: number,
  cityName: string
): Promise<{ current: WeatherData; forecast: WeatherForecast[] }> {
  const url = `${WEATHER_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&hourly=precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch weather data from the server.');

  const data = await res.json();
  return parseWeatherResponse(data as Record<string, unknown>, cityName);
}

export async function getWeatherData(
  city: string
): Promise<{ current: WeatherData; forecast: WeatherForecast[] }> {
  const coords = await getCoordinates(city);
  return fetchWeatherByCoords(coords.lat, coords.lon, city);
}

export async function getWeatherDataByCoords(
  lat: number,
  lon: number,
  locationName = 'My Location'
): Promise<{ current: WeatherData; forecast: WeatherForecast[] }> {
  return fetchWeatherByCoords(lat, lon, locationName);
}

export function getDryingRecommendation(weather: WeatherData): string {
  if (weather.precipitationProbability > 70)
    return 'High chance of rain. Not recommended for outdoor drying.';
  if (weather.precipitationProbability > 30)
    return 'Possible rain. Indoor drying recommended.';
  if (weather.isGoodForDrying) return 'Perfect weather for drying laundry!';
  return 'Decent weather. You can dry laundry outdoors.';
}

export const PRESET_CITIES = [
  'Parit Raja',
  'Batu Pahat',
  'Kuala Lumpur',
  'Johor Bahru',
  'Singapore',
] as const;
