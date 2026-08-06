import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeLiveReports } from '../src/domain/live-condition.js';

test('近六小时钓情以最新现场状态展示并统计样本', () => {
  const summary = summarizeLiveReports([
    { biteStatus: 'occasional', crowdLevel: 'quiet', observedAt: new Date('2026-08-04T08:00:00Z') },
    { biteStatus: 'active', crowdLevel: 'crowded', observedAt: new Date('2026-08-04T09:00:00Z') },
  ]);
  assert.deepEqual(summary, {
    sampleCount6h: 2,
    biteLabel: '鱼口活跃',
    crowdLabel: '较拥挤',
    latestObservedAt: '2026-08-04T09:00:00.000Z',
  });
});

test('无近期样本时明确返回暂无实况', () => {
  assert.deepEqual(summarizeLiveReports([]), {
    sampleCount6h: 0,
    biteLabel: '暂无钓友实况',
    crowdLabel: '未知',
  });
});
