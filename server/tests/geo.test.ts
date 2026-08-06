import assert from 'node:assert/strict';
import test from 'node:test';
import { boundingBox, distanceKm } from '../src/domain/geo.js';

test('10km 半径边界和球面距离计算稳定', () => {
  const bounds = boundingBox(30.5928, 114.3055, 10);
  assert.ok(bounds.north > 30.68 && bounds.north < 30.69);
  assert.ok(bounds.south > 30.50 && bounds.south < 30.51);
  assert.ok(distanceKm(30.5928, 114.3055, 30.5928, 114.3055) < 0.001);
  assert.ok(distanceKm(30.5928, 114.3055, bounds.north, 114.3055) > 9.9);
});
