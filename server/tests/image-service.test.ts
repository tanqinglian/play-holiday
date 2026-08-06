import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, test } from 'node:test';
import sharp from 'sharp';
import { SharpImageCodec } from '../src/services/image-service.js';

describe('SharpImageCodec', () => {
  test('把上传图片旋转、缩放并编码为 WebP 主图和缩略图', async () => {
    const source = await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: '#1b6f56' },
    }).jpeg({ quality: 95 }).toBuffer();

    const encoded = await new SharpImageCodec().encode(source, 'image/jpeg');

    assert.equal(encoded.mimeType, 'image/webp');
    assert.equal(encoded.width, 1600);
    assert.equal(encoded.height, 800);
    assert.ok(encoded.thumbnailWidth <= 480);
    assert.ok(encoded.thumbnailHeight <= 480);
    assert.ok(encoded.data.length < source.length);
    assert.equal(encoded.sha256, createHash('sha256').update(encoded.data).digest('hex'));
  });

  test('拒绝伪装成图片的内容', async () => {
    await assert.rejects(
      () => new SharpImageCodec().encode(Buffer.from('not an image'), 'image/jpeg'),
      /无法解码|不支持/,
    );
  });
});
