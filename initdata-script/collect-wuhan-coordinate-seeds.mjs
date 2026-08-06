import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBaohuDetailPage, parseBaohuDirectoryPage } from './lib/seed-source.mjs';

const DIRECTORY_SLUGS = [
  'jiangan', 'jianghan', 'qiaokou', 'hanyang', 'wuhanshiwuchang',
  'wuhanshiqingshan', 'wuhanshihongshan', 'dongxihu', 'hannan',
  'caidian', 'jiangxia', 'huangbei', 'wuhanshixinzhou',
];

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(projectRoot, 'initdata-script/data/wuhan-coordinate-places.v1.json');
const delayArgument = process.argv.find((argument) => argument.startsWith('--delay='));
const delayMs = Math.max(2_000, Number.parseInt(delayArgument?.split('=')[1] ?? '2000', 10));
const maxArgument = process.argv.find((argument) => argument.startsWith('--max-details='));
const maxDetails = Math.max(1, Number.parseInt(maxArgument?.split('=')[1] ?? '1000', 10));
const capturedAt = new Date().toISOString();

const wait = () => new Promise((resolve) => setTimeout(resolve, delayMs));

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'PlayHolidayCoordinateCollector/0.1 (+CC-BY attribution; contact via local product research)',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`请求失败 ${response.status}: ${url}`);
  return response.text();
}

const candidates = new Map();
for (const slug of DIRECTORY_SLUGS) {
  const url = `https://www.baohugongjuxiang.cn/fishing/${slug}`;
  const html = await fetchHtml(url);
  const records = parseBaohuDirectoryPage(html);
  for (const record of records) candidates.set(record.sourceRecordId, record);
  process.stdout.write(`目录 ${slug}：${records.length} 条，累计去重 ${candidates.size} 条\n`);
  await wait();
}

const records = [];
const selected = [...candidates.values()].slice(0, maxDetails);
for (const [index, candidate] of selected.entries()) {
  try {
    const detail = parseBaohuDetailPage(await fetchHtml(candidate.sourceUrl));
    if (detail) {
      records.push({
        id: `baohu-wuhan-${candidate.sourceRecordId}`,
        ...detail,
        sourcePlatform: 'baohu_toolbox',
        sourceRecordId: candidate.sourceRecordId,
        sourceUrl: candidate.sourceUrl,
        sourceCapturedAt: capturedAt,
        sourceLicense: 'CC-BY-4.0',
        sourceLicenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        coordinateStatus: 'source_provided',
        coordinateSystem: 'gcj02_unverified',
        locationPrecision: 'public_exact',
        imageUrl: candidate.imageUrl,
      });
    }
  } catch (error) {
    process.stderr.write(`跳过 ${candidate.sourceUrl}: ${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.stdout.write(`详情 ${index + 1}/${selected.length}，武汉有效 ${records.length} 条\n`);
  if (index < selected.length - 1) await wait();
}

records.sort((left, right) => left.id.localeCompare(right.id));
const payload = {
  schemaVersion: 1,
  city: '武汉市',
  generatedAt: capturedAt,
  source: {
    name: '爆护工具箱',
    entryUrl: 'https://www.baohugongjuxiang.cn/fishing',
    robotsUrl: 'https://www.baohugongjuxiang.cn/robots.txt',
    minimumDelayMs: delayMs,
    license: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  policy: {
    publicPagesOnly: true,
    authenticationBypassed: false,
    userIdentityCollected: false,
    importedAsIndependentPlaces: true,
    coordinateSystemRequiresConfirmation: true,
  },
  records,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
process.stdout.write(`完成：${records.length} 条武汉带坐标钓点写入 ${outputPath}\n`);
