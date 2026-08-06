import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenMeteoWeatherService } from '../src/services/weather-service.js';

const payload = {
  latitude: 30.6,
  longitude: 114.3,
  timezone: 'Asia/Shanghai',
  current: {
    time: '2026-08-04T07:00',
    temperature_2m: 24,
    apparent_temperature: 25,
    relative_humidity_2m: 75,
    precipitation: 0,
    weather_code: 2,
    pressure_msl: 1008,
    wind_speed_10m: 8,
    wind_direction_10m: 45,
  },
  hourly: {
    time: ['2026-08-04T07:00', '2026-08-04T08:00', '2026-08-04T09:00', '2026-08-04T10:00', '2026-08-04T11:00', '2026-08-04T12:00'],
    temperature_2m: [24, 25, 26, 27, 28, 29],
    precipitation_probability: [10, 10, 20, 20, 30, 30],
    precipitation: [0, 0, 0, 0, 0, 0],
    pressure_msl: [1008, 1008.2, 1008.4, 1008.6, 1008.5, 1008.3],
    wind_speed_10m: [8, 8, 9, 10, 10, 11],
  },
};

test('天气服务归一化当前天气、三小时预报并按坐标缓存', async () => {
  let requestCount = 0;
  const service = new OpenMeteoWeatherService({
    fetcher: async () => {
      requestCount += 1;
      return new Response(JSON.stringify(payload), { status: 200 });
    },
    now: () => new Date('2026-08-04T07:05:00+08:00'),
  });

  const first = await service.getDecision(30.6001, 114.3001);
  const second = await service.getDecision(30.6002, 114.3002);

  assert.equal(requestCount, 1);
  assert.equal(first.current.weatherLabel, '多云');
  assert.equal(first.current.windDirectionLabel, '东北风');
  assert.equal(first.hourly.length, 3);
  assert.equal(first.advice.level, 'recommended');
  assert.equal(second.location.latitude, first.location.latitude);
});

test('上游天气服务失败时不伪造实时结果', async () => {
  const service = new OpenMeteoWeatherService({
    fetcher: async () => new Response('{}', { status: 503 }),
  });
  await assert.rejects(() => service.getDecision(30.6, 114.3), /天气数据暂时不可用/);
});
