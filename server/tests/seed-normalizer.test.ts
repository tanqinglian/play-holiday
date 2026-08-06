import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSeedPlace } from '../src/import/seed-normalizer.js';

test('seed normalizer keeps missing coordinates listable but not mappable', () => {
  const place = normalizeSeedPlace(
    {
      id: 'diaoyu-wuhan-1',
      name: '测试钓场',
      district: '黄陂区',
      address: '黄陂区测试地址',
      placeTypes: ['黑坑'],
      species: ['鲫鱼'],
      chargeText: '收费：100元/天',
      sourcePlatform: 'diaoyu',
      sourceUrl: 'https://example.com/1',
      sourceRecordId: '1',
      sourceCapturedAt: '2026-08-04T00:00:00.000Z',
      coordinateStatus: 'missing',
      latitude: null,
      longitude: null,
    },
    {
      comments: [{ text: '评论', publishedLabel: '很久以前' }],
      images: [{ sourceUrl: 'https://example.com/a.jpg', localPath: 'wuhan-images/1/a.jpg', bytes: 100 }],
    },
  );

  assert.equal(place.category, 'fishery');
  assert.equal(place.feeType, 'paid');
  assert.equal(place.mapAvailable, false);
  assert.deepEqual(place.sceneTags, ['黑坑']);
  assert.equal(place.comments[0]?.contentType, 'external_historical');
  assert.equal(place.comments[0]?.publishedLabel, '很久以前');
  assert.equal('author' in place.comments[0]!, false);
});
