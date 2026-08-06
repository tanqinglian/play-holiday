import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import { buildApp } from '../src/app.js';
import type {
  PlaceDetail,
  PlaceListQuery,
  PlaceMapQuery,
  PlaceRepository,
} from '../src/domain/place.js';
import type { WeatherService } from '../src/services/weather-service.js';
import type { ImageService, StoredImage, StoredImageVariant } from '../src/services/image-storage-service.js';

const places: PlaceDetail[] = [
  {
    id: 'mapped-1',
    name: '有坐标野钓点',
    district: '江夏区',
    address: '武汉市江夏区测试地址',
    category: 'wild_spot',
    feeType: 'free',
    feeText: '免费',
    latitude: 30.4,
    longitude: 114.3,
    coordinateStatus: 'source_provided',
    locationPrecision: 'public_coarse',
    detailAvailable: true,
    sceneTags: ['野钓'],
    methodTags: ['台钓'],
    speciesTags: ['鲫鱼'],
    liveCondition: { sampleCount6h: 0, biteLabel: '暂无钓友实况', crowdLabel: '未知' },
    source: {
      platform: 'diaoyu',
      url: 'https://example.com/mapped-1',
      capturedAt: '2026-08-04T00:00:00.000Z',
    },
    comments: [
      {
        id: 'comment-1',
        text: '历史评论正文',
        publishedLabel: '很久以前',
        contentType: 'external_historical',
      },
    ],
    images: [],
  },
  {
    id: 'missing-coordinate',
    name: '无坐标收费场',
    district: '黄陂区',
    address: '武汉市黄陂区测试地址',
    category: 'fishery',
    feeType: 'paid',
    feeText: '100元/天',
    latitude: null,
    longitude: null,
    coordinateStatus: 'missing',
    locationPrecision: 'public_exact',
    detailAvailable: true,
    sceneTags: ['黑坑'],
    methodTags: ['台钓'],
    speciesTags: ['鲤鱼'],
    liveCondition: { sampleCount6h: 0, biteLabel: '暂无钓友实况', crowdLabel: '未知' },
    source: {
      platform: 'diaoyu',
      url: 'https://example.com/missing-coordinate',
      capturedAt: '2026-08-04T00:00:00.000Z',
    },
    comments: [],
    images: [],
  },
];

class MemoryPlaceRepository implements PlaceRepository {
  private liveReports: Array<{ id: string; placeId: string; biteStatus: 'no_bite' | 'occasional' | 'active'; crowdLevel: 'quiet' | 'normal' | 'crowded'; observedAt: string }> = [];
  async health() {
    return { database: 'up' as const };
  }

  async list(query: PlaceListQuery) {
    const filtered = places.filter((place) => {
      if (query.query && !`${place.name}${place.address}${place.sceneTags.join('')}`.includes(query.query)) return false;
      if (query.feeType && place.feeType !== query.feeType) return false;
      return true;
    });
    return { items: filtered.slice(query.offset, query.offset + query.limit), total: filtered.length };
  }

  async map(query: PlaceMapQuery) {
    return places.filter((place) =>
      place.latitude !== null &&
      place.longitude !== null &&
      place.latitude <= query.north &&
      place.latitude >= query.south &&
      place.longitude <= query.east &&
      place.longitude >= query.west,
    );
  }

  async findById(id: string) {
    const place = places.find((item) => item.id === id);
    if (!place) return null;
    return { ...place, liveCondition: this.liveSummary(id) };
  }

  async createLiveReport(input: { id: string; idempotencyKey: string; placeId: string; biteStatus: 'no_bite' | 'occasional' | 'active'; crowdLevel: 'quiet' | 'normal' | 'crowded'; observedAt: Date }) {
    const existing = this.liveReports.find((report) => report.id === input.idempotencyKey);
    if (!existing) this.liveReports.push({ id: input.idempotencyKey, placeId: input.placeId, biteStatus: input.biteStatus, crowdLevel: input.crowdLevel, observedAt: input.observedAt.toISOString() });
    return this.liveSummary(input.placeId);
  }

  private liveSummary(placeId: string) {
    const latest = this.liveReports.filter((report) => report.placeId === placeId).at(-1);
    return {
      sampleCount6h: latest ? 1 : 0,
      biteLabel: latest?.biteStatus === 'active' ? '鱼口活跃' : latest?.biteStatus === 'occasional' ? '偶尔有口' : latest ? '暂时无口' : '暂无钓友实况',
      crowdLabel: latest?.crowdLevel === 'crowded' ? '较拥挤' : latest?.crowdLevel === 'normal' ? '人数一般' : latest?.crowdLevel === 'quiet' ? '人少' : '未知',
      latestObservedAt: latest?.observedAt,
    };
  }
}

const weatherService: WeatherService = {
  async getDecision(latitude, longitude) {
    return {
      location: { latitude, longitude, timezone: 'Asia/Shanghai' },
      updatedAt: '2026-08-04T07:05:00.000Z',
      current: {
        observedAt: '2026-08-04T07:00', temperatureC: 24, apparentTemperatureC: 25,
        humidityPercent: 75, pressureHpa: 1008, precipitationMm: 0,
        windSpeedKmh: 8, windDirectionDeg: 45, windDirectionLabel: '东北风',
        weatherCode: 2, weatherLabel: '多云',
      },
      hourly: [],
      advice: { score: 82, level: 'recommended', title: '较适合出钓', summary: '风小且气压稳定', tactics: ['钓浅边'], reasons: ['风力较小'], cautions: [] },
      source: { provider: 'Open-Meteo', modelBased: true },
    };
  },
};

const app = buildApp({ repository: new MemoryPlaceRepository(), weatherService, logger: false });
after(() => app.close());

class MemoryImageService implements ImageService {
  stored?: StoredImage;

  async upload(input: { ownerType: 'place' | 'trip'; ownerId: string; data: Buffer; mimeType: string }) {
    this.stored = {
      id: 'image-1', ownerType: input.ownerType, ownerId: input.ownerId,
      mimeType: 'image/webp', width: 800, height: 600, byteSize: 4,
      thumbnailByteSize: 2, sha256: 'abc', createdAt: new Date('2026-08-05T00:00:00.000Z'),
    };
    return this.stored;
  }

  async read(id: string, variant: StoredImageVariant) {
    if (id !== 'image-1') return null;
    return {
      data: variant === 'thumbnail' ? Buffer.from('tn') : Buffer.from('full'),
      mimeType: 'image/webp', sha256: 'abc',
    };
  }
}

function multipartImage(filename: string, mimeType: string, content: Buffer) {
  const boundary = '----play-holiday-test-boundary';
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
      content,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}

describe('places API contract', () => {
  test('health endpoint exposes database readiness and request id', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().database, 'up');
    assert.ok(response.headers['x-request-id']);
  });

  test('list includes places without coordinates and exposes map availability', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/places?page=1&pageSize=20' });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.meta.total, 2);
    assert.equal(body.data[1].id, 'missing-coordinate');
    assert.equal(body.data[1].mapAvailable, false);
    assert.equal(body.data[1].detailAvailable, true);
  });

  test('map endpoint only returns coordinates inside the current viewport', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/places/map?north=30.6&south=30.2&east=114.5&west=114.1',
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data.map((place: { id: string }) => place.id), ['mapped-1']);
  });

  test('附近钓点接口严格按用户位置 10km 半径过滤', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/places/nearby?latitude=30.4&longitude=114.3&radiusKm=10' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data.map((place: { id: string }) => place.id), ['mapped-1']);
    assert.ok(response.json().data[0].distanceKm < 0.01);
    assert.equal(response.json().meta.radiusKm, 10);

    const invalid = await app.inject({ method: 'GET', url: '/api/places/nearby?latitude=30.4&longitude=114.3&radiusKm=80' });
    assert.equal(invalid.statusCode, 400);
  });

  test('invalid bounds are rejected instead of querying all markers', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/places/map?north=30.2&south=30.6&east=114.5&west=114.1' });
    assert.equal(response.statusCode, 400);
  });

  test('detail preserves historical source time and invalid id returns 404', async () => {
    const detail = await app.inject({ method: 'GET', url: '/api/places/mapped-1' });
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.json().data.comments[0].publishedLabel, '很久以前');
    assert.equal(detail.json().data.comments[0].contentType, 'external_historical');

    const missing = await app.inject({ method: 'GET', url: '/api/places/not-exists' });
    assert.equal(missing.statusCode, 404);
  });

  test('weather endpoint validates coordinates and returns an explainable decision', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/weather?latitude=30.6&longitude=114.3' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.current.temperatureC, 24);
    assert.equal(response.json().data.advice.level, 'recommended');
    assert.equal(response.json().data.source.modelBased, true);

    const invalid = await app.inject({ method: 'GET', url: '/api/weather?latitude=200&longitude=114.3' });
    assert.equal(invalid.statusCode, 400);
  });

  test('结构化现场钓情可幂等提交并出现在详情近六小时聚合中', async () => {
    const payload = { idempotencyKey: 'live-report-test-1', biteStatus: 'active', crowdLevel: 'normal' };
    const first = await app.inject({ method: 'POST', url: '/api/places/mapped-1/live-reports', payload });
    const duplicate = await app.inject({ method: 'POST', url: '/api/places/mapped-1/live-reports', payload });
    assert.equal(first.statusCode, 201);
    assert.equal(duplicate.statusCode, 201);
    assert.equal(first.json().data.sampleCount6h, 1);
    assert.equal(first.json().data.biteLabel, '鱼口活跃');

    const detail = await app.inject({ method: 'GET', url: '/api/places/mapped-1' });
    assert.equal(detail.json().data.liveCondition.sampleCount6h, 1);
  });

  test('现场钓情拒绝自由文本和非法枚举', async () => {
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/places/mapped-1/live-reports',
      payload: { idempotencyKey: 'bad', biteStatus: 'boom', crowdLevel: 'normal', note: '不应接收' },
    });
    assert.equal(invalid.statusCode, 400);
  });
});

describe('images API contract', () => {
  const imageService = new MemoryImageService();
  const imageApp = buildApp({ repository: new MemoryPlaceRepository(), imageService, logger: false, mediaRoot: false });
  after(() => imageApp.close());

  test('上传图片后只返回元数据和读取地址，不返回 Base64', async () => {
    const multipart = multipartImage('spot.jpg', 'image/jpeg', Buffer.from('jpeg-data'));
    const response = await imageApp.inject({
      method: 'POST',
      url: '/api/images?ownerType=trip&ownerId=local-1',
      ...multipart,
    });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().data.id, 'image-1');
    assert.equal(response.json().data.url, '/api/images/image-1');
    assert.equal(response.json().data.thumbnailUrl, '/api/images/image-1?variant=thumbnail');
    assert.equal('data' in response.json().data, false);
  });

  test('云托管私有链路支持 JSON Base64 图片上传', async () => {
    const response = await imageApp.inject({
      method: 'POST',
      url: '/api/images',
      payload: {
        ownerType: 'trip',
        ownerId: 'cloud-trip-1',
        mimeType: 'image/jpeg',
        contentBase64: Buffer.from('jpeg-data').toString('base64'),
      },
    });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().data.id, 'image-1');
    assert.equal('contentBase64' in response.json().data, false);
  });

  test('图片读取支持缩略图、缓存头和不存在状态', async () => {
    const response = await imageApp.inject({ method: 'GET', url: '/api/images/image-1?variant=thumbnail' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'image/webp');
    assert.match(String(response.headers['cache-control']), /public/);
    assert.equal(response.body, 'tn');

    const missing = await imageApp.inject({ method: 'GET', url: '/api/images/missing' });
    assert.equal(missing.statusCode, 404);
  });

  test('拒绝缺少归属信息和非图片上传', async () => {
    const image = multipartImage('spot.jpg', 'image/jpeg', Buffer.from('jpeg-data'));
    const missingOwner = await imageApp.inject({ method: 'POST', url: '/api/images', ...image });
    assert.equal(missingOwner.statusCode, 400);

    const text = multipartImage('note.txt', 'text/plain', Buffer.from('hello'));
    const wrongType = await imageApp.inject({ method: 'POST', url: '/api/images?ownerType=trip&ownerId=local-1', ...text });
    assert.equal(wrongType.statusCode, 415);
  });
});
