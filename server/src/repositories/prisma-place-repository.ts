import type { AppPrismaClient } from '../db.js';
import type {
  PlaceDetail,
  PlaceListQuery,
  PlaceMapQuery,
  PlaceRepository,
  PlaceSummary,
} from '../domain/place.js';
import { summarizeLiveReports, type LiveReportView } from '../domain/live-condition.js';

type PlaceRecord = Awaited<ReturnType<AppPrismaClient['place']['findFirst']>>;
type SummaryRecord = NonNullable<PlaceRecord> & {
  tags: Array<{ category: string; value: string }>;
  liveReports?: LiveReportView[];
};

function tagsByCategory(tags: Array<{ category: string; value: string }>, category: string) {
  return tags.filter((tag) => tag.category === category).map((tag) => tag.value);
}

function toSummary(record: SummaryRecord): PlaceSummary {
  return {
    id: record.id,
    name: record.name,
    district: record.district,
    address: record.address,
    category: record.category,
    feeType: record.feeType,
    feeText: record.feeText,
    latitude: record.latitude,
    longitude: record.longitude,
    coordinateStatus: record.coordinateStatus,
    locationPrecision: record.locationPrecision,
    detailAvailable: record.detailAvailable,
    sceneTags: tagsByCategory(record.tags, 'scene'),
    methodTags: tagsByCategory(record.tags, 'method'),
    speciesTags: tagsByCategory(record.tags, 'species'),
    liveCondition: summarizeLiveReports(record.liveReports ?? []),
  };
}

function visibleWhere(query: Pick<PlaceListQuery, 'query' | 'feeType' | 'sceneTag'>) {
  return {
    visibility: 'visible' as const,
    ...(query.feeType ? { feeType: query.feeType } : {}),
    ...(query.sceneTag ? { tags: { some: { category: 'scene' as const, value: query.sceneTag } } } : {}),
    ...(query.query
      ? {
          OR: [
            { name: { contains: query.query } },
            { address: { contains: query.query } },
            { district: { contains: query.query } },
            { tags: { some: { value: { contains: query.query } } } },
          ],
        }
      : {}),
  };
}

export class PrismaPlaceRepository implements PlaceRepository {
  constructor(private readonly prisma: AppPrismaClient) {}

  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: 'up' as const };
    } catch {
      return { database: 'down' as const };
    }
  }

  async list(query: PlaceListQuery) {
    const where = visibleWhere(query);
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const [items, total] = await Promise.all([
      this.prisma.place.findMany({
        where,
        include: { tags: true, liveReports: { where: { observedAt: { gte: since } }, orderBy: { observedAt: 'desc' }, take: 20 } },
        orderBy: [{ detailAvailable: 'desc' }, { district: 'asc' }, { name: 'asc' }],
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.place.count({ where }),
    ]);
    return { items: items.map(toSummary), total };
  }

  async map(query: PlaceMapQuery) {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const items = await this.prisma.place.findMany({
      where: {
        ...visibleWhere(query),
        coordinateStatus: { not: 'missing' },
        latitude: { not: null, gte: query.south, lte: query.north },
        longitude: { not: null, gte: query.west, lte: query.east },
      },
      include: { tags: true, liveReports: { where: { observedAt: { gte: since } }, orderBy: { observedAt: 'desc' }, take: 20 } },
      orderBy: { updatedAt: 'desc' },
      take: query.limit,
    });
    return items.map(toSummary);
  }

  async findById(id: string): Promise<PlaceDetail | null> {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const place = await this.prisma.place.findFirst({
      where: { id, visibility: 'visible' },
      include: {
        tags: true,
        sources: { orderBy: { capturedAt: 'desc' }, take: 1 },
        comments: { orderBy: { id: 'asc' } },
        images: { where: { isVisible: true }, orderBy: { sortOrder: 'asc' } },
        liveReports: { where: { observedAt: { gte: since } }, orderBy: { observedAt: 'desc' }, take: 20 },
      },
    });
    if (!place) return null;
    const source = place.sources[0];
    return {
      ...toSummary(place),
      source: {
        platform: source?.platform ?? 'unknown',
        url: source?.sourceUrl ?? '',
        capturedAt: (source?.capturedAt ?? place.updatedAt).toISOString(),
      },
      comments: place.comments.map((comment) => ({
        id: comment.id,
        text: comment.text,
        rating: comment.rating ?? undefined,
        publishedLabel: comment.publishedLabel,
        contentType: comment.contentType,
      })),
      images: place.images.map((image) => ({
        id: image.id,
        sourceUrl: image.sourceUrl,
        thumbnailUrl: image.thumbnailUrl ?? undefined,
        bytes: image.bytes ?? undefined,
      })),
    };
  }

  async createLiveReport(input: {
    id: string;
    idempotencyKey: string;
    placeId: string;
    biteStatus: 'no_bite' | 'occasional' | 'active';
    crowdLevel: 'quiet' | 'normal' | 'crowded';
    observedAt: Date;
  }) {
    await this.prisma.placeLiveReport.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: input,
      update: {},
    });
    const reports = await this.prisma.placeLiveReport.findMany({
      where: { placeId: input.placeId, observedAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
      orderBy: { observedAt: 'desc' },
      take: 20,
    });
    return summarizeLiveReports(reports);
  }
}
