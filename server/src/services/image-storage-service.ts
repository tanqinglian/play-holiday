import { randomUUID } from 'node:crypto';
import type { ImageCodec } from './image-service.js';

export type ImageOwnerType = 'place' | 'trip';
export type StoredImageVariant = 'full' | 'thumbnail';

export interface StoredImage {
  id: string;
  ownerType: ImageOwnerType;
  ownerId: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  thumbnailByteSize: number;
  sha256: string;
  createdAt: Date;
}

export interface ImageRepository {
  create(input: StoredImage & { data: Buffer; thumbnailData: Buffer }): Promise<StoredImage>;
  read(id: string, variant: StoredImageVariant): Promise<{ data: Buffer; mimeType: string; sha256: string } | null>;
}

export interface ImageService {
  upload(input: { ownerType: ImageOwnerType; ownerId: string; data: Buffer; mimeType: string }): Promise<StoredImage>;
  read(id: string, variant: StoredImageVariant): Promise<{ data: Buffer; mimeType: string; sha256: string } | null>;
}

export class MysqlImageService implements ImageService {
  constructor(
    private readonly repository: ImageRepository,
    private readonly codec: ImageCodec,
  ) {}

  async upload(input: { ownerType: ImageOwnerType; ownerId: string; data: Buffer; mimeType: string }) {
    const encoded = await this.codec.encode(input.data, input.mimeType);
    return this.repository.create({
      id: `img-${randomUUID()}`,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      mimeType: encoded.mimeType,
      width: encoded.width,
      height: encoded.height,
      byteSize: encoded.data.length,
      thumbnailByteSize: encoded.thumbnailData.length,
      sha256: encoded.sha256,
      data: encoded.data,
      thumbnailData: encoded.thumbnailData,
      createdAt: new Date(),
    });
  }

  read(id: string, variant: StoredImageVariant) {
    return this.repository.read(id, variant);
  }
}
