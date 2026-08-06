import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrismaClient } from '../src/db.js';
import {
  normalizeSeedPlace,
  type RawCoordinateSeedPlace,
  type RawSeedDetail,
  type RawSeedPlace,
} from '../src/import/seed-normalizer.js';

interface SeedPayload {
  records: RawSeedPlace[];
}

interface DetailRecord extends RawSeedDetail {
  placeId: string;
}

interface DetailPayload {
  records: DetailRecord[];
}

interface CoordinatePayload {
  records: RawCoordinateSeedPlace[];
}

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(serverRoot, '..');

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

async function main() {
  const [seedPayload, detailPayload, coordinatePayload] = await Promise.all([
    readJson<SeedPayload>(path.join(projectRoot, 'src/data/seed/wuhan-fishing-places.v1.json')),
    readJson<DetailPayload>(path.join(projectRoot, 'initdata-script/data/wuhan-place-details.v1.json')),
    readJson<CoordinatePayload>(path.join(projectRoot, 'initdata-script/data/wuhan-coordinate-places.v1.json')),
  ]);
  const details = new Map(detailPayload.records.map((detail) => [detail.placeId, detail]));
  const normalized = seedPayload.records.map((place) => normalizeSeedPlace(place, details.get(place.id)));
  const prisma = createPrismaClient();

  try {
    for (const place of normalized) {
      await prisma.place.upsert({
        where: { id: place.id },
        create: {
          id: place.id,
          name: place.name,
          district: place.district,
          address: place.address,
          category: place.category,
          feeType: place.feeType,
          feeText: place.feeText,
          latitude: place.latitude,
          longitude: place.longitude,
          coordinateStatus: place.coordinateStatus,
          locationPrecision: place.locationPrecision,
          detailAvailable: place.detailAvailable,
        },
        update: {
          name: place.name,
          district: place.district,
          address: place.address,
          category: place.category,
          feeType: place.feeType,
          feeText: place.feeText,
          latitude: place.latitude,
          longitude: place.longitude,
          coordinateStatus: place.coordinateStatus,
          locationPrecision: place.locationPrecision,
          detailAvailable: place.detailAvailable,
        },
      });

      await prisma.placeSource.upsert({
        where: {
          platform_sourceRecordId: {
            platform: place.source.platform,
            sourceRecordId: place.sourceRecordId,
          },
        },
        create: {
          placeId: place.id,
          platform: place.source.platform,
          sourceRecordId: place.sourceRecordId,
          sourceUrl: place.source.url,
          capturedAt: new Date(place.source.capturedAt),
        },
        update: {
          placeId: place.id,
          sourceUrl: place.source.url,
          capturedAt: new Date(place.source.capturedAt),
        },
      });

      if (place.sceneTags.length || place.methodTags.length || place.speciesTags.length) {
        await prisma.placeTag.createMany({
          data: [
            ...place.sceneTags.map((value) => ({ placeId: place.id, category: 'scene' as const, value })),
            ...place.methodTags.map((value) => ({ placeId: place.id, category: 'method' as const, value })),
            ...place.speciesTags.map((value) => ({ placeId: place.id, category: 'species' as const, value })),
          ],
          skipDuplicates: true,
        });
      }

      if (place.comments.length) {
        await prisma.placeComment.createMany({
          data: place.comments.map((comment) => ({
            id: comment.id,
            placeId: place.id,
            text: comment.text,
            rating: comment.rating,
            publishedLabel: comment.publishedLabel,
            contentType: comment.contentType,
            sourcePlatform: place.source.platform,
            sourceCapturedAt: new Date(place.source.capturedAt),
          })),
          skipDuplicates: true,
        });
      }

      if (place.images.length) {
        await prisma.placeImage.createMany({
          data: place.images.map((image, index) => ({
            id: image.id,
            placeId: place.id,
            sourceUrl: image.sourceUrl,
            localPath: image.thumbnailUrl?.replace(/^\/media\//, ''),
            thumbnailUrl: image.thumbnailUrl,
            bytes: image.bytes,
            sortOrder: index,
          })),
          skipDuplicates: true,
        });
      }
    }

    let coordinateNewCount = 0;
    for (const coordinatePlace of coordinatePayload.records) {
      const placeId = coordinatePlace.id;
      await prisma.place.upsert({
        where: { id: placeId },
        create: {
          id: placeId,
          name: coordinatePlace.name,
          district: coordinatePlace.district,
          address: coordinatePlace.address,
          category: /钓场|垂钓|鱼塘|农庄/.test(coordinatePlace.name) ? 'fishery' : 'water_body',
          feeType: 'unknown',
          feeText: '收费未知',
          latitude: coordinatePlace.latitude,
          longitude: coordinatePlace.longitude,
          coordinateStatus: 'source_provided',
          locationPrecision: 'public_exact',
          detailAvailable: true,
        },
        update: {
          name: coordinatePlace.name,
          district: coordinatePlace.district,
          address: coordinatePlace.address,
          latitude: coordinatePlace.latitude,
          longitude: coordinatePlace.longitude,
          coordinateStatus: 'source_provided',
          locationPrecision: 'public_exact',
        },
      });
      coordinateNewCount += 1;

      await prisma.placeSource.upsert({
        where: {
          platform_sourceRecordId: {
            platform: coordinatePlace.sourcePlatform,
            sourceRecordId: coordinatePlace.sourceRecordId,
          },
        },
        create: {
          placeId,
          platform: coordinatePlace.sourcePlatform,
          sourceRecordId: coordinatePlace.sourceRecordId,
          sourceUrl: coordinatePlace.sourceUrl,
          capturedAt: new Date(coordinatePlace.sourceCapturedAt),
        },
        update: {
          placeId,
          sourceUrl: coordinatePlace.sourceUrl,
          capturedAt: new Date(coordinatePlace.sourceCapturedAt),
        },
      });
    }

    const [placeCount, mappablePlaceCount, commentCount, imageCount] = await Promise.all([
      prisma.place.count(),
      prisma.place.count({ where: { coordinateStatus: { not: 'missing' } } }),
      prisma.placeComment.count(),
      prisma.placeImage.count(),
    ]);
    process.stdout.write(`${JSON.stringify({ event: 'seed_complete', placeCount, mappablePlaceCount, coordinateImportedCount: coordinateNewCount, commentCount, imageCount })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ event: 'seed_failed', message: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
});
