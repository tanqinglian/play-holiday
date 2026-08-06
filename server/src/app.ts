import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { FeeType, PlaceListQuery, PlaceMapQuery, PlaceRepository } from './domain/place.js';
import { toPlaceListItem } from './domain/place.js';
import { boundingBox, distanceKm } from './domain/geo.js';
import type { WeatherService } from './services/weather-service.js';
import type { ImageOwnerType, ImageService, StoredImageVariant } from './services/image-storage-service.js';

interface BuildAppOptions {
  repository: PlaceRepository;
  logger?: FastifyServerOptions['logger'];
  mediaRoot?: string | false;
  weatherService?: WeatherService;
  imageService?: ImageService;
}

function parsePositiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function parseFeeType(value: unknown): FeeType | undefined {
  return value === 'free' || value === 'paid' || value === 'unknown' ? value : undefined;
}

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    logger: options.logger ?? {
      level: process.env.LOG_LEVEL || 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    requestIdHeader: 'x-request-id',
    bodyLimit: 14 * 1024 * 1024,
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'request failed');
    const candidateStatus =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number(error.statusCode)
        : 500;
    const statusCode = Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus < 500
      ? candidateStatus
      : 500;
    const message = error instanceof Error ? error.message : '请求参数无效';
    reply.status(statusCode).send({
      error: statusCode === 500 ? 'internal_error' : 'bad_request',
      message: statusCode === 500 ? '服务暂时不可用' : message,
      requestId: request.id,
    });
  });

  app.get('/api/health', async (_request, reply) => {
    const health = await options.repository.health();
    if (health.database === 'down') reply.status(503);
    return { status: health.database === 'up' ? 'ok' : 'degraded', ...health };
  });

  app.get('/api/places', async (request) => {
    const query = request.query as Record<string, unknown>;
    const page = parsePositiveInteger(query.page, 1, 100_000);
    const pageSize = parsePositiveInteger(query.pageSize, 20, 50);
    const listQuery: PlaceListQuery = {
      query: typeof query.query === 'string' && query.query.trim() ? query.query.trim() : undefined,
      feeType: parseFeeType(query.feeType),
      sceneTag: typeof query.sceneTag === 'string' && query.sceneTag.trim() ? query.sceneTag.trim() : undefined,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    };
    const result = await options.repository.list(listQuery);
    return {
      data: result.items.map(toPlaceListItem),
      meta: { page, pageSize, total: result.total, hasMore: listQuery.offset + result.items.length < result.total },
    };
  });

  app.get('/api/places/map', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const north = Number(query.north);
    const south = Number(query.south);
    const east = Number(query.east);
    const west = Number(query.west);
    if (![north, south, east, west].every(Number.isFinite) || north <= south || east <= west) {
      return reply.status(400).send({ error: 'invalid_bounds', message: '地图视野边界无效', requestId: request.id });
    }
    const mapQuery: PlaceMapQuery = {
      north,
      south,
      east,
      west,
      feeType: parseFeeType(query.feeType),
      sceneTag: typeof query.sceneTag === 'string' && query.sceneTag.trim() ? query.sceneTag.trim() : undefined,
      limit: parsePositiveInteger(query.limit, 200, 500),
    };
    const items = await options.repository.map(mapQuery);
    return { data: items.map(toPlaceListItem), meta: { count: items.length } };
  });

  app.get('/api/places/nearby', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const latitude = Number(query.latitude);
    const longitude = Number(query.longitude);
    const radiusKm = Number(query.radiusKm ?? 10);
    if (
      !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      !Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 50
    ) {
      return reply.status(400).send({ error: 'invalid_nearby_query', message: '附近钓点范围参数无效', requestId: request.id });
    }
    const bounds = boundingBox(latitude, longitude, radiusKm);
    const candidates = await options.repository.map({
      ...bounds,
      feeType: parseFeeType(query.feeType),
      sceneTag: typeof query.sceneTag === 'string' && query.sceneTag.trim() ? query.sceneTag.trim() : undefined,
      limit: 500,
    });
    const data = candidates
      .flatMap((place) => {
        if (place.latitude === null || place.longitude === null) return [];
        const placeDistanceKm = distanceKm(latitude, longitude, place.latitude, place.longitude);
        return placeDistanceKm <= radiusKm ? [{ ...toPlaceListItem(place), distanceKm: placeDistanceKm }] : [];
      })
      .sort((left, right) => left.distanceKm - right.distanceKm);
    return { data, meta: { count: data.length, radiusKm, center: { latitude, longitude } } };
  });

  app.get('/api/places/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const place = await options.repository.findById(id);
    if (!place || !place.detailAvailable) {
      return reply.status(404).send({ error: 'place_not_found', message: '该钓点不存在或已下线', requestId: request.id });
    }
    return { data: { ...toPlaceListItem(place), source: place.source, comments: place.comments, images: place.images } };
  });

  app.get('/api/weather', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const latitude = Number(query.latitude);
    const longitude = Number(query.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return reply.status(400).send({ error: 'invalid_coordinates', message: '经纬度参数无效', requestId: request.id });
    }
    if (!options.weatherService) {
      return reply.status(503).send({ error: 'weather_unavailable', message: '天气服务未配置', requestId: request.id });
    }
    return { data: await options.weatherService.getDecision(latitude, longitude) };
  });

  app.post('/api/places/:id/live-reports', async (request, reply) => {
    const { id: placeId } = request.params as { id: string };
    const body = request.body as Record<string, unknown> | null;
    const allowedKeys = new Set(['idempotencyKey', 'biteStatus', 'crowdLevel']);
    const biteStatuses = new Set(['no_bite', 'occasional', 'active']);
    const crowdLevels = new Set(['quiet', 'normal', 'crowded']);
    const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
    if (
      !body ||
      Object.keys(body).some((key) => !allowedKeys.has(key)) ||
      idempotencyKey.length < 8 || idempotencyKey.length > 120 ||
      typeof body.biteStatus !== 'string' || !biteStatuses.has(body.biteStatus) ||
      typeof body.crowdLevel !== 'string' || !crowdLevels.has(body.crowdLevel)
    ) {
      return reply.status(400).send({ error: 'invalid_live_report', message: '现场钓情参数无效', requestId: request.id });
    }
    const place = await options.repository.findById(placeId);
    if (!place || !place.detailAvailable) {
      return reply.status(404).send({ error: 'place_not_found', message: '该钓点不存在或已下线', requestId: request.id });
    }
    const summary = await options.repository.createLiveReport({
      id: `live-${randomUUID()}`,
      idempotencyKey,
      placeId,
      biteStatus: body.biteStatus as 'no_bite' | 'occasional' | 'active',
      crowdLevel: body.crowdLevel as 'quiet' | 'normal' | 'crowded',
      observedAt: new Date(),
    });
    return reply.status(201).send({ data: summary });
  });

  if (options.imageService) {
    const imageService = options.imageService;
    app.register(fastifyMultipart, {
      limits: { files: 1, fields: 0, fileSize: 10 * 1024 * 1024 },
    });

    app.post('/api/images', async (request, reply) => {
      const query = request.query as Record<string, unknown>;
      const body = request.isMultipart() ? null : request.body as Record<string, unknown> | null;
      const ownerType = body?.ownerType ?? query.ownerType;
      const rawOwnerId = body?.ownerId ?? query.ownerId;
      const ownerId = typeof rawOwnerId === 'string' ? rawOwnerId.trim() : '';
      if ((ownerType !== 'place' && ownerType !== 'trip') || !ownerId || ownerId.length > 120) {
        return reply.status(400).send({ error: 'invalid_image_owner', message: '图片归属信息无效', requestId: request.id });
      }
      let mimeType: string;
      let data: Buffer;
      if (request.isMultipart()) {
        const file = await request.file();
        if (!file) {
          return reply.status(400).send({ error: 'image_required', message: '请选择图片', requestId: request.id });
        }
        mimeType = file.mimetype;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
          file.file.resume();
          return reply.status(415).send({ error: 'unsupported_image', message: '仅支持 JPEG、PNG 和 WebP 图片', requestId: request.id });
        }
        data = await file.toBuffer();
      } else {
        mimeType = typeof body?.mimeType === 'string' ? body.mimeType : '';
        const contentBase64 = typeof body?.contentBase64 === 'string' ? body.contentBase64 : '';
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
          return reply.status(415).send({ error: 'unsupported_image', message: '仅支持 JPEG、PNG 和 WebP 图片', requestId: request.id });
        }
        if (!contentBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(contentBase64)) {
          return reply.status(400).send({ error: 'image_required', message: '图片内容无效', requestId: request.id });
        }
        data = Buffer.from(contentBase64, 'base64');
        if (!data.length || data.length > 10 * 1024 * 1024) {
          return reply.status(413).send({ error: 'image_too_large', message: '图片不能超过 10MB', requestId: request.id });
        }
      }
      const image = await imageService.upload({
        ownerType: ownerType as ImageOwnerType,
        ownerId,
        data,
        mimeType,
      });
      return reply.status(201).send({
        data: {
          ...image,
          url: `/api/images/${encodeURIComponent(image.id)}`,
          thumbnailUrl: `/api/images/${encodeURIComponent(image.id)}?variant=thumbnail`,
        },
      });
    });

    app.get('/api/images/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const query = request.query as Record<string, unknown>;
      const variant: StoredImageVariant = query.variant === 'thumbnail' ? 'thumbnail' : 'full';
      const image = await imageService.read(id, variant);
      if (!image) {
        return reply.status(404).send({ error: 'image_not_found', message: '图片不存在', requestId: request.id });
      }
      const etag = `"${image.sha256}-${variant}"`;
      if (request.headers['if-none-match'] === etag) return reply.status(304).send();
      return reply
        .type(image.mimeType)
        .header('etag', etag)
        .header('cache-control', 'public, max-age=86400, immutable')
        .send(image.data);
    });
  }

  const defaultMediaRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../initdata-script/data');
  if (options.mediaRoot !== false) {
    app.register(fastifyStatic, {
      root: options.mediaRoot || defaultMediaRoot,
      prefix: '/media/',
      decorateReply: false,
      maxAge: '1h',
    });
  }

  return app;
}
