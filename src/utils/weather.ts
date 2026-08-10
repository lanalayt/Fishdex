// Weather data from Open-Meteo (free, no API key)

export interface WeatherData {
  temperature: number; // °F
  condition: string;
  windSpeed: number; // mph
  precipChance: number; // %
  humidity: number;
}

export async function getCurrentWeather(lat: number, lng: number): Promise<WeatherData | null> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation_probability&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`
    );
    if (!response.ok) return null;
    const data = await response.json();
    const current = data?.current;
    if (!current) return null;

    return {
      temperature: Math.round(current.temperature_2m),
      condition: weatherCodeToText(current.weather_code),
      windSpeed: Math.round(current.wind_speed_10m),
      precipChance: current.precipitation_probability ?? 0,
      humidity: current.relative_humidity_2m,
    };
  } catch {
    return null;
  }
}

function weatherCodeToText(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
}

export interface DayForecast {
  date: string;
  dayName: string;
  high: number;
  low: number;
  condition: string;
  precipChance: number;
  windSpeed: number;
}

export async function get7DayForecast(lat: number, lng: number): Promise<DayForecast[]> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=7`
    );
    if (!response.ok) return [];
    const data = await response.json();
    const daily = data?.daily;
    if (!daily?.time) return [];

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return daily.time.map((date: string, i: number) => {
      const d = new Date(date + 'T00:00:00');
      const isToday = i === 0;
      return {
        date,
        dayName: isToday ? 'Today' : days[d.getDay()],
        high: Math.round(daily.temperature_2m_max[i]),
        low: Math.round(daily.temperature_2m_min[i]),
        condition: weatherCodeToText(daily.weather_code[i]),
        precipChance: daily.precipitation_probability_max[i] ?? 0,
        windSpeed: Math.round(daily.wind_speed_10m_max[i]),
      };
    });
  } catch {
    return [];
  }
}

export function weatherIcon(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('clear') || c.includes('sunny')) return 'sunny-outline';
  if (c.includes('partly')) return 'partly-sunny-outline';
  if (c.includes('cloud') || c.includes('fog')) return 'cloud-outline';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return 'rainy-outline';
  if (c.includes('snow')) return 'snow-outline';
  if (c.includes('thunder')) return 'thunderstorm-outline';
  return 'cloud-outline';
}
