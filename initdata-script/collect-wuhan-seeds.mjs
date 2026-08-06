import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeSeedPlaces, parseDiaoyuListPage } from './lib/seed-source.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(projectRoot, 'src/data/seed/wuhan-fishing-places.v1.json');
const maxPagesArgument = process.argv.find((argument) => argument.startsWith('--pages='));
const maxPages = Math.max(1, Number.parseInt(maxPagesArgument?.split('=')[1] ?? '49', 10));
const delayArgument = process.argv.find((argument) => argument.startsWith('--delay='));
const delayMs = Math.max(300, Number.parseInt(delayArgument?.split('=')[1] ?? '600', 10));
const collectedAt = new Date().toISOString();

function pageUrl(page) {
  return page === 1
    ? 'https://m.diaoyu.com/diaochang/wuhan/'
    : `https://m.diaoyu.com/diaochang/wuhan/list-0-0-0-${page}.html`;
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'PlayHolidaySeedCollector/0.1 (+local product research)',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`请求失败 ${response.status}: ${url}`);
  return response.text();
}

const collected = [];
for (let page = 1; page <= maxPages; page += 1) {
  const url = pageUrl(page);
  const html = await fetchPage(url);
  const parsed = parseDiaoyuListPage(html, collectedAt);
  if (parsed.length === 0) break;
  collected.push(...parsed);
  process.stdout.write(`已读取第 ${page} 页：${parsed.length} 条\n`);
  if (page < maxPages) await new Promise((resolve) => setTimeout(resolve, delayMs));
}

const places = mergeSeedPlaces(collected);
const payload = {
  schemaVersion: 1,
  city: '武汉市',
  generatedAt: collectedAt,
  policy: {
    purpose: 'initial_place_baseline',
    countsTowardTripStats: false,
    userIdentityCollected: false,
    imagesCollected: false,
    descriptionsCollected: false,
    coordinatesRequireGeocoding: true,
  },
  records: places,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
process.stdout.write(`完成：${places.length} 条种子地点写入 ${outputPath}\n`);
