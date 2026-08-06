import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const automator = require('miniprogram-automator');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const wsEndpoint = process.env.WECHAT_AUTOMATION_WS;
const artifactDir = path.join(projectRoot, '.artifacts', 'e2e');
let miniProgram;
const scenarios = [];
const runtimeExceptions = [];

async function connectAutomation(endpoint, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await automator.connect({ wsEndpoint: endpoint });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError ?? new Error(`无法连接微信自动化端口：${endpoint}`);
}

async function element(page, selector, timeout = 7_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await page.$(selector);
    if (result) return result;
    await page.waitFor(120);
  }
  throw new Error(`等待元素超时：${selector}`);
}

before(async () => {
  if (!wsEndpoint) throw new Error('M3 E2E 需要由 scripts/run-native-e2e.mjs 启动');
  await mkdir(artifactDir, { recursive: true });
  miniProgram = await connectAutomation(wsEndpoint);
  miniProgram.on('exception', (exception) => runtimeExceptions.push(exception));
});

after(async () => {
  try {
    await miniProgram?.callWxMethod('removeStorageSync', 'ph.trip.drafts.v1');
  } catch {
    // 测试清理尽力执行。
  }
  miniProgram?.disconnect();
  const summary = {
    generatedAt: new Date().toISOString(),
    milestone: 'M3',
    total: scenarios.length,
    passed: scenarios.filter((item) => item.status === 'passed').length,
    failed: scenarios.filter((item) => item.status === 'failed').length,
    runtimeExceptions,
    scenarios,
  };
  await writeFile(
    path.join(artifactDir, 'm3-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
});

test('趟次默认私人，地图、照片和位置描述入口可用', { timeout: 30_000 }, async () => {
  const startedAt = Date.now();
  try {
    await miniProgram.callWxMethod('removeStorageSync', 'ph.trip.drafts.v1');
    const page = await miniProgram.reLaunch('/pages/record/index');
    assert.equal(await page.$('.record-hero'), null);
    await element(page, '#e2e-coordinate-picker');
    await element(page, '#e2e-photo-picker');
    await element(page, '#e2e-location-description');
    await (await element(page, '#e2e-open-tags')).tap();
    await element(page, '#e2e-tag-car');
    await element(page, '#e2e-custom-tag-input');
    assert.equal(await (await element(page, '#e2e-purpose-anonymous')).property('disabled'), true);
    await (await element(page, '#e2e-trip-result-empty')).tap();
    await (await element(page, '#e2e-save-trip')).tap();
    await page.waitFor(250);

    const drafts = await miniProgram.callWxMethod('getStorageSync', 'ph.trip.drafts.v1');
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].purpose, 'private');
    assert.equal(drafts[0].syncStatus, 'local');
    assert.deepEqual(drafts[0].photoPaths, []);
    assert.match(drafts[0].idempotencyKey, /^trip-local-/);
    scenarios.push({ name: 'private-trip-default', status: 'passed', durationMs: Date.now() - startedAt });
  } catch (error) {
    scenarios.push({
      name: 'private-trip-default',
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});
