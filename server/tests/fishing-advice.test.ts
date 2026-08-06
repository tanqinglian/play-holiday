import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFishingAdvice } from '../src/domain/fishing-advice.js';

test('风小、气压稳定且无明显降雨时给出可解释的出钓建议', () => {
  const advice = buildFishingAdvice({
    temperatureC: 24,
    pressureHpa: 1008,
    pressureChange3hHpa: 0.6,
    windSpeedKmh: 8,
    precipitationMm: 0,
    maxPrecipitationProbability3h: 20,
    localHour: 7,
  });

  assert.equal(advice.level, 'recommended');
  assert.ok(advice.score >= 75);
  assert.ok(advice.reasons.some((reason) => reason.includes('风力')));
  assert.ok(advice.tactics.some((tactic) => tactic.includes('钓')));
});

test('大风强降雨时明确降级并输出安全原因', () => {
  const advice = buildFishingAdvice({
    temperatureC: 33,
    pressureHpa: 995,
    pressureChange3hHpa: -4,
    windSpeedKmh: 31,
    precipitationMm: 7,
    maxPrecipitationProbability3h: 90,
    localHour: 14,
  });

  assert.equal(advice.level, 'avoid');
  assert.ok(advice.score < 45);
  assert.ok(advice.cautions.some((reason) => reason.includes('雨')));
  assert.ok(advice.cautions.some((reason) => reason.includes('风')));
});
