import type { AppPrismaClient } from '../db.js';
import type { ImageRepository, StoredImageVariant } from '../services/image-storage-service.js';

export class PrismaImageRepository implements ImageRepository {
  constructor(private readonly prisma: AppPrismaClient) {}

  async create(input: Parameters<ImageRepository['create']>[0]) {
    const record = await this.prisma.imageAsset.create({
      data: {
        ...input,
        data: Uint8Array.from(input.data),
        thumbnailData: Uint8Array.from(input.thumbnailData),
      },
    });
    return {
      id: record.id,
      ownerType: record.ownerType,
      ownerId: record.ownerId,
      mimeType: record.mimeType,
      width: record.width,
      height: record.height,
      byteSize: record.byteSize,
      thumbnailByteSize: record.thumbnailByteSize,
      sha256: record.sha256,
      createdAt: record.createdAt,
    };
  }

  async read(id: string, variant: StoredImageVariant) {
    if (variant === 'thumbnail') {
      const record = await this.prisma.imageAsset.findUnique({
        where: { id },
        select: { mimeType: true, sha256: true, thumbnailData: true },
      });
      return record
        ? { data: Buffer.from(record.thumbnailData), mimeType: record.mimeType, sha256: record.sha256 }
        : null;
    }
    const record = await this.prisma.imageAsset.findUnique({
      where: { id },
      select: { mimeType: true, sha256: true, data: true },
    });
    return record
      ? { data: Buffer.from(record.data), mimeType: record.mimeType, sha256: record.sha256 }
      : null;
  }
}
