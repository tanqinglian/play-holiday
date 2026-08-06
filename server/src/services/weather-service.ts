import { buildFishingAdvice, type FishingAdvice } from '../domain/fishing-advice.js';

export interface WeatherDecision {
  location: { latitude: number; longitude: number; timezone: string };
  updatedAt: string;
  current: {
    observedAt: string;
    temperatureC: number;
    apparentTemperatureC: number;
    humidityPercent: number;
    pressureHpa: number;
    precipitationMm: number;
    windSpeedKmh: number;
    windDirectionDeg: number;
    windDirectionLabel: string;
    weatherCode: number;
    weatherLabel: string;
  };
  hourly: Array<{
    time: string;
    temperatureC: number;
    precipitationProbability: number;
    precipitationMm: number;
    windSpeedKmh: number;
  }>;
  advice: FishingAdvice;
  source: { provider: 'Open-Meteo'; modelBased: true };
}

export interface WeatherService {
  getDecision(latitude: number, longitude: number): Promise<WeatherDecision>;
}

interface OpenMeteoPayload {
  latitude: number;
  longitude: number;
  timezone: string;
  current: Record<string, number | string>;
  hourly: Record<string, Array<number | string>>;
}

interface WeatherServiceOptions {
  fetcher?: typeof fetch;
  now?: () => Date;
  cacheTtlMs?: number;
  baseUrl?: string;
  apiKey?: string;
}

const WEATHER_LABELS: Record<number, string> = {
  0: '晴', 1: '大部晴朗', 2: '多云', 3: '阴', 45: '有雾', 48: '雾凇',
  51: '小毛毛雨', 53: '毛毛雨', 55: '较强毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨',
  80: '阵雨', 81: '较强阵雨', 82: '强阵雨', 95: '雷雨', 96: '雷雨伴冰雹', 99: '强雷雨伴冰雹',
};

function windDirectionLabel(degrees: number) {
  const labels = ['北风', '东北风', '东风', '东南风', '南风', '西南风', '西风', '西北风'];
  return labels[Math.round(((degrees % 360) + 360) % 360 / 45) % 8]!;
}

function numberField(record: Record<string, number | string>, key: string) {
  const value = Number(record[key]);
  if (!Number.isFinite(value)) throw new Error(`天气数据缺少字段：${key}`);
  return value;
}

function hourlyNumbers(hourly: OpenMeteoPayload['hourly'], key: string) {
  const values = hourly[key];
  if (!Array.isArray(values)) throw new Error(`天气数据缺少字段：${key}`);
  return values.map(Number);
}

export class OpenMeteoWeatherService implements WeatherService {
  private readonly fetcher: typeof fetch;
  private readonly now: () => Date;
  private readonly cacheTtlMs: number;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly cache = new Map<string, { expiresAt: number; value: WeatherDecision }>();

  constructor(options: WeatherServiceOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.cacheTtlMs = options.cacheTtlMs ?? 10 * 60 * 1000;
    this.baseUrl = options.baseUrl ?? 'https://api.open-meteo.com/v1/forecast';
    this.apiKey = options.apiKey;
  }

  async getDecision(latitude: number, longitude: number) {
    const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > this.now().getTime()) return cached.value;

    const params = new URLSearchParams({
      latitude: String(latitude), longitude: String(longitude), timezone: 'Asia/Shanghai', forecast_days: '2',
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m',
      hourly: 'temperature_2m,precipitation_probability,precipitation,pressure_msl,wind_speed_10m',
    });
    if (this.apiKey) params.set('apikey', this.apiKey);
    const response = await this.fetcher(`${this.baseUrl}?${params}`, { signal: AbortSignal.timeout(6_000) });
    if (!response.ok) throw new Error('天气数据暂时不可用');
    const payload = await response.json() as OpenMeteoPayload;
    const decision = this.normalize(payload);
    this.cache.set(key, { expiresAt: this.now().getTime() + this.cacheTtlMs, value: decision });
    return decision;
  }

  private normalize(payload: OpenMeteoPayload): WeatherDecision {
    const times = payload.hourly.time?.map(String) ?? [];
    const startIndex = Math.max(0, times.findIndex((time) => time >= String(payload.current.time)));
    const hourlyTemperature = hourlyNumbers(payload.hourly, 'temperature_2m');
    const hourlyPrecipitationProbability = hourlyNumbers(payload.hourly, 'precipitation_probability');
    const hourlyPrecipitation = hourlyNumbers(payload.hourly, 'precipitation');
    const hourlyPressure = hourlyNumbers(payload.hourly, 'pressure_msl');
    const hourlyWind = hourlyNumbers(payload.hourly, 'wind_speed_10m');
    const hourly = times.slice(startIndex, startIndex + 3).map((time, offset) => {
      const index = startIndex + offset;
      return {
        time,
        temperatureC: hourlyTemperature[index] ?? 0,
        precipitationProbability: hourlyPrecipitationProbability[index] ?? 0,
        precipitationMm: hourlyPrecipitation[index] ?? 0,
        windSpeedKmh: hourlyWind[index] ?? 0,
      };
    });
    const pressureHpa = numberField(payload.current, 'pressure_msl');
    const pressureIn3h = hourlyPressure[Math.min(startIndex + 3, hourlyPressure.length - 1)] ?? pressureHpa;
    const observedAt = String(payload.current.time);
    const temperatureC = numberField(payload.current, 'temperature_2m');
    const weatherCode = numberField(payload.current, 'weather_code');
    const windDirectionDeg = numberField(payload.current, 'wind_direction_10m');
    const advice = buildFishingAdvice({
      temperatureC,
      pressureHpa,
      pressureChange3hHpa: pressureIn3h - pressureHpa,
      windSpeedKmh: numberField(payload.current, 'wind_speed_10m'),
      precipitationMm: numberField(payload.current, 'precipitation'),
      maxPrecipitationProbability3h: Math.max(0, ...hourly.map((item) => item.precipitationProbability)),
      localHour: Number(observedAt.slice(11, 13)),
    });
    return {
      location: { latitude: payload.latitude, longitude: payload.longitude, timezone: payload.timezone },
      updatedAt: this.now().toISOString(),
      current: {
        observedAt, temperatureC, apparentTemperatureC: numberField(payload.current, 'apparent_temperature'),
        humidityPercent: numberField(payload.current, 'relative_humidity_2m'), pressureHpa,
        precipitationMm: numberField(payload.current, 'precipitation'), windSpeedKmh: numberField(payload.current, 'wind_speed_10m'),
        windDirectionDeg, windDirectionLabel: windDirectionLabel(windDirectionDeg), weatherCode,
        weatherLabel: WEATHER_LABELS[weatherCode] ?? '天气状况未知',
      },
      hourly,
      advice,
      source: { provider: 'Open-Meteo', modelBased: true },
    };
  }
}
