import { createHash } from 'node:crypto';
import sharp from 'sharp';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface EncodedImage {
  data: Buffer;
  thumbnailData: Buffer;
  mimeType: 'image/webp';
  width: number;
  height: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  sha256: string;
}

export interface ImageCodec {
  encode(input: Buffer, declaredMimeType: string): Promise<EncodedImage>;
}

export class SharpImageCodec implements ImageCodec {
  async encode(input: Buffer, declaredMimeType: string): Promise<EncodedImage> {
    if (!ALLOWED_MIME_TYPES.has(declaredMimeType)) {
      throw Object.assign(new Error('不支持的图片格式'), { statusCode: 415 });
    }

    try {
      const source = sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 });
      const metadata = await source.metadata();
      if (!metadata.width || !metadata.height || !['jpeg', 'png', 'webp'].includes(metadata.format || '')) {
        throw new Error('无法解码图片');
      }

      const data = await source
        .clone()
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78, effort: 4 })
        .toBuffer();
      const mainMetadata = await sharp(data).metadata();
      const thumbnailData = await sharp(data)
        .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 72, effort: 4 })
        .toBuffer();
      const thumbnailMetadata = await sharp(thumbnailData).metadata();

      return {
        data,
        thumbnailData,
        mimeType: 'image/webp',
        width: mainMetadata.width || 0,
        height: mainMetadata.height || 0,
        thumbnailWidth: thumbnailMetadata.width || 0,
        thumbnailHeight: thumbnailMetadata.height || 0,
        sha256: createHash('sha256').update(data).digest('hex'),
      };
    } catch (error) {
      if (error instanceof Error && (error.message.includes('不支持') || error.message.includes('无法解码'))) throw error;
      throw Object.assign(new Error('图片无法解码或文件已损坏'), { statusCode: 400, cause: error });
    }
  }
}
