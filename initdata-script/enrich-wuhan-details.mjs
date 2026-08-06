import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDiaoyuDetailPage } from './lib/seed-source.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const seedPath = path.join(projectRoot, 'src/data/seed/wuhan-fishing-places.v1.json');
const dataDir = path.join(scriptDir, 'data');
const detailPath = path.join(dataDir, 'wuhan-place-details.v1.json');
const imageRoot = path.join(dataDir, 'wuhan-images');

function numberArgument(name, fallback, minimum = 1) {
  const argument = process.argv.find((value) => value.startsWith(`--${name}=`));
  return Math.max(minimum, Number.parseInt(argument?.split('=')[1] ?? String(fallback), 10));
}

const limit = numberArgument('limit', Number.MAX_SAFE_INTEGER);
const delayMs = numberArgument('delay', 600, 300);
const maxImages = numberArgument('max-images', 3);
const shouldDownloadImages = !process.argv.includes('--urls-only');

async function fetchResponse(url) {
  const response = await fetch(url, {
    headers: {
      Accept: '*/*',
      'User-Agent': 'PlayHolidaySeedCollector/0.1 (+local product research)',
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`请求失败 ${response.status}: ${url}`);
  return response;
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(detailPath, 'utf8'));
  } catch {
    return { schemaVersion: 1, city: '武汉市', generatedAt: null, records: [] };
  }
}

async function persist(records) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(detailPath, `${JSON.stringify({
    schemaVersion: 1,
    city: '武汉市',
    generatedAt: new Date().toISOString(),
    policy: {
      commentsCollectedWithoutAuthorIdentity: true,
      imagesDownloadedOutsideMiniProgramBundle: shouldDownloadImages,
      sourceAttributionRequired: true,
    },
    records,
  }, null, 2)}\n`, 'utf8');
}

async function downloadImages(placeId, urls) {
  if (!shouldDownloadImages) return urls.map((sourceUrl) => ({ sourceUrl }));
  const placeDir = path.join(imageRoot, placeId);
  await mkdir(placeDir, { recursive: true });
  const images = [];
  for (const [index, sourceUrl] of urls.slice(0, maxImages).entries()) {
    try {
      const response = await fetchResponse(sourceUrl);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('图片超过 5MB');
      const extension = path.extname(new URL(sourceUrl).pathname).toLowerCase();
      const safeExtension = /^\.(?:jpe?g|png|webp|gif)$/.test(extension) ? extension : '.jpg';
      const relativePath = `wuhan-images/${placeId}/${String(index + 1).padStart(2, '0')}${safeExtension}`;
      await writeFile(path.join(dataDir, relativePath), bytes);
      images.push({ sourceUrl, localPath: relativePath, bytes: bytes.byteLength });
    } catch (error) {
      images.push({ sourceUrl, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return images;
}

const seed = JSON.parse(await readFile(seedPath, 'utf8'));
const existing = await readExisting();
const recordsById = new Map(existing.records.map((record) => [record.placeId, record]));
const targets = seed.records.slice(0, limit);
let completedThisRun = 0;

for (const [index, place] of targets.entries()) {
  if (recordsById.get(place.id)?.status === 'complete') continue;
  try {
    const html = await (await fetchResponse(place.sourceUrl)).text();
    const detail = parseDiaoyuDetailPage(html);
    const images = await downloadImages(place.id, detail.imageUrls);
    recordsById.set(place.id, {
      placeId: place.id,
      sourceUrl: place.sourceUrl,
      capturedAt: new Date().toISOString(),
      status: 'complete',
      comments: detail.comments,
      images,
    });
    completedThisRun += 1;
    process.stdout.write(`详情 ${index + 1}/${targets.length}：${place.name}，评论 ${detail.comments.length}，图片 ${images.length}\n`);
  } catch (error) {
    recordsById.set(place.id, {
      placeId: place.id,
      sourceUrl: place.sourceUrl,
      capturedAt: new Date().toISOString(),
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      comments: [],
      images: [],
    });
  }
  if (completedThisRun % 10 === 0) await persist([...recordsById.values()]);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

await persist([...recordsById.values()]);
process.stdout.write(`完成：详情数据 ${recordsById.size} 条，保存在 ${detailPath}\n`);
