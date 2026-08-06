import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const automator = require('miniprogram-automator');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cliPath = process.env.WECHAT_DEVTOOLS_CLI || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const wsEndpoint = process.env.WECHAT_AUTOMATION_WS;
const artifactDir = path.join(projectRoot, '.artifacts', 'e2e');

let miniProgram;
const scenarios = [];
const runtimeExceptions = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeText = (value) => String(value).replace(/\s+/g, '');
const distanceKm = (latitudeA, longitudeA, latitudeB, longitudeB) => {
  const radians = (value) => value * Math.PI / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

async function connectAutomation(endpoint, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try { return await automator.connect({ wsEndpoint: endpoint }); }
    catch (error) { lastError = error; await sleep(500); }
  }
  throw lastError ?? new Error(`无法连接微信自动化端口：${endpoint}`);
}

async function element(page, selector, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await page.$(selector);
    if (result) return result;
    await page.waitFor(150);
  }
  throw new Error(`等待元素超时：${selector}`);
}

async function waitUntil(check, description, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(180);
  }
  throw new Error(`等待超时：${description}`);
}

async function waitForPath(expectedPath, timeout = 10_000) {
  let found;
  await waitUntil(async () => {
    found = await miniProgram.currentPage();
    return found?.path === expectedPath;
  }, `页面切换到 ${expectedPath}`, timeout);
  return found;
}

async function ensureListMode(page) {
  const listModeButton = await page.$('#e2e-view-list');
  if (listModeButton) await listModeButton.tap();
  await element(page, '#e2e-place-search');
}

async function runScenario(name, callback) {
  const startedAt = Date.now();
  try {
    await callback();
    scenarios.push({ name, status: 'passed', durationMs: Date.now() - startedAt });
  } catch (error) {
    const screenshotPath = path.join(artifactDir, `${name}-failed.png`);
    try { await miniProgram?.screenshot({ path: screenshotPath }); } catch { /* preserve original error */ }
    scenarios.push({ name, status: 'failed', durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error), screenshotPath });
    throw error;
  }
}

before(async () => {
  await mkdir(artifactDir, { recursive: true });
  miniProgram = wsEndpoint
    ? await connectAutomation(wsEndpoint)
    : await automator.launch({ cliPath, projectPath: projectRoot, timeout: 70_000, trustProject: true });
  miniProgram.on('exception', (exception) => runtimeExceptions.push(exception));
}, { timeout: 90_000 });

after(async () => {
  for (const key of ['ph.trip.drafts.v1', 'ph.favorites.v1', 'ph.private.spots.v1']) {
    try { await miniProgram?.callWxMethod('removeStorageSync', key); } catch { /* best-effort cleanup */ }
  }
  if (wsEndpoint) miniProgram?.disconnect();
  else await miniProgram?.close();
  await writeFile(path.join(artifactDir, 'summary.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    milestone: 'real-data-api',
    total: scenarios.length,
    passed: scenarios.filter((item) => item.status === 'passed').length,
    failed: scenarios.filter((item) => item.status === 'failed').length,
    runtimeExceptions,
    scenarios,
  }, null, 2)}\n`, 'utf8');
}, { timeout: 30_000 });

test('首页加载 MySQL 真实钓点并可进入记录', { timeout: 35_000 }, async () => {
  await runScenario('home-real-data', async () => {
    const page = await miniProgram.reLaunch('/pages/index/index');
    await waitUntil(async () => (await page.$$('.home-place-card')).length > 0, '首页真实钓点卡片');
    await waitUntil(async () => !(await (await element(page, '#e2e-weather-title')).text()).includes('正在更新'), '首页实时天气决策');
    assert.match(normalizeText(await (await element(page, '.section-title')).text()), /附近钓情/);
    const homeText = normalizeText(await (await element(page, '.home-page')).text());
    assert.match(homeText, /出钓参考/);
    assert.match(homeText, /城区·出钓建议/);
    assert.match(homeText, /风力\d+～\d+级/);
    assert.doesNotMatch(homeText, /km\/h/);
    assert.match(homeText, /气压(?:偏高|偏低|适中)·未来3小时降雨最高\d+%/);
    assert.doesNotMatch(homeText, /建议钓法|Open-Meteo|出发前请二次核实/);
    const info = await element(page, '#e2e-home-info');
    const title = await element(page, '#e2e-home-page-title');
    const [infoOffset, titleOffset, titleSize] = await Promise.all([info.offset(), title.offset(), title.size()]);
    assert.ok(infoOffset.left >= titleOffset.left + titleSize.width, '提示图标应位于“出钓参考”右侧');
    await miniProgram.screenshot({ path: path.join(artifactDir, 'home-weather-compact.png') });
    const cta = await element(page, '#e2e-home-record-cta');
    assert.equal(await cta.text(), '记录现场钓情');
    assert.ok(Number.parseFloat(String((await cta.size()).height)) >= 48);
    await cta.tap();
    await waitForPath('pages/record/index');
  });
});

test('列表搜索真实钓点，无坐标时禁用地图操作', { timeout: 40_000 }, async () => {
  await runScenario('list-search-no-coordinate', async () => {
    const page = await miniProgram.switchTab('/pages/map/index');
    await ensureListMode(page);
    await element(page, '#e2e-first-place');
    const totalText = normalizeText(await (await element(page, '.toolbar-result-count')).text());
    assert.match(totalText, /\d+个/);
    assert.ok(Number(totalText.match(/\d+/)?.[0]) >= 664);
    assert.equal(await (await element(page, '#e2e-first-place-map')).property('disabled'), true);
    await (await element(page, '#e2e-place-search')).input('竹林湖');
    await waitUntil(async () => normalizeText(await (await element(page, '#e2e-first-place')).text()).includes('竹林湖'), '搜索竹林湖');
    const toolbarSize = await (await element(page, '.places-toolbar')).size();
    assert.ok(Number.parseFloat(String(toolbarSize.height)) <= 108, `列表工具区过高：${toolbarSize.height}px`);
    const cardSize = await (await element(page, '#e2e-first-place')).size();
    assert.ok(Number.parseFloat(String(cardSize.height)) <= 132, `列表卡片过高：${cardSize.height}px`);
    await miniProgram.screenshot({ path: path.join(artifactDir, 'compact-place-list.png') });
  });
});

test('记录页以地图坐标、照片和位置描述替代已有钓点选择器', { timeout: 45_000 }, async () => {
  await runScenario('record-coordinate-first', async () => {
    await miniProgram.callWxMethod('removeStorageSync', 'ph.trip.drafts.v1');
    const page = await miniProgram.switchTab('/pages/record/index');
    assert.equal(await page.$('#e2e-water-picker'), null);
    await element(page, '#e2e-coordinate-picker');
    await element(page, '#e2e-photo-picker');
    await (await element(page, '#e2e-location-description')).input('沿堤走到第二个闸口后下坡');
    await (await element(page, '#e2e-open-tags')).tap();
    await (await element(page, '#e2e-tag-walk')).tap();
    await miniProgram.screenshot({ path: path.join(artifactDir, 'record-coordinate-tags.png') });
    await (await element(page, '#e2e-trip-result-bite')).tap();
    await (await element(page, '#e2e-save-trip')).tap();
    const drafts = await miniProgram.callWxMethod('getStorageSync', 'ph.trip.drafts.v1');
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].locationDescription, '沿堤走到第二个闸口后下坡');
    assert.equal(drafts[0].accessMode, 'walk');
    assert.ok(drafts[0].tags.some((tag) => tag.label === '需步行一段' && tag.source === 'system'));
    assert.equal(drafts[0].syncStatus, 'local');
    assert.match(drafts[0].idempotencyKey, /^trip-local-/);
  });
});

test('地图模式默认严格只渲染用户 10km 内坐标', { timeout: 60_000 }, async () => {
  await runScenario('map-coordinate-only', async () => {
    const page = await miniProgram.switchTab('/pages/map/index');
    const mapModeButton = await page.$('#e2e-view-map');
    if (mapModeButton) await mapModeButton.tap();
    const map = await element(page, '#e2e-map');
    await waitUntil(async () => normalizeText(await (await element(page, '#e2e-map-scope')).text()).includes('当前位置10km内'), '用户当前位置 10km 钓点');
    await waitUntil(async () => {
      const value = await map.property('markers');
      return (Array.isArray(value) ? value : JSON.parse(value || '[]')).length > 0;
    }, '地图加载带坐标钓点');
    const markers = await map.property('markers');
    const markerCount = (Array.isArray(markers) ? markers : JSON.parse(markers || '[]')).length;
    assert.ok(markerCount > 0);
    assert.ok(markerCount < 100);
    const latitude = Number(await map.property('latitude'));
    const longitude = Number(await map.property('longitude'));
    const publicMarkers = (Array.isArray(markers) ? markers : JSON.parse(markers || '[]')).filter((marker) => marker.id < 100_000);
    assert.ok(publicMarkers.every((marker) => distanceKm(latitude, longitude, marker.latitude, marker.longitude) <= 10.01));
    const circles = await map.property('circles');
    assert.equal((Array.isArray(circles) ? circles : JSON.parse(circles || '[]'))[0].radius, 10_000);
    await miniProgram.screenshot({ path: path.join(artifactDir, 'map-markers-rendered.png') });
  });
});

test('带坐标钓点详情展示当地实时天气并可导航', { timeout: 45_000 }, async () => {
  await runScenario('coordinate-detail-weather', async () => {
    const mapPage = await miniProgram.switchTab('/pages/map/index');
    await ensureListMode(mapPage);
    const search = await element(mapPage, '#e2e-place-search');
    await search.input('径河大池垂钓园');
    await waitUntil(async () => normalizeText(await (await element(mapPage, '#e2e-first-place')).text()).includes('径河大池垂钓园'), '带坐标钓点搜索结果');
    assert.equal(await (await element(mapPage, '#e2e-first-place-map')).property('disabled'), false);
    await (await element(mapPage, '#e2e-first-place-detail')).tap();
    const page = await waitForPath('package-water/detail/index');
    await element(page, '#e2e-place-weather');
    assert.equal(await (await element(page, '#e2e-open-location')).property('disabled'), false);
    await (await element(page, '#e2e-open-live-form')).tap();
    await element(page, '#e2e-live-form');
    assert.equal(await (await element(page, '#e2e-submit-live')).property('disabled'), true);
    await (await element(page, '#e2e-bite-active')).tap();
    await (await element(page, '#e2e-crowd-normal')).tap();
    assert.equal(await (await element(page, '#e2e-submit-live')).property('disabled'), false);
  });
});

test('真实详情展示历史评论，无坐标时导航禁用', { timeout: 40_000 }, async () => {
  await runScenario('real-detail', async () => {
    const mapPage = await miniProgram.switchTab('/pages/map/index');
    await ensureListMode(mapPage);
    const search = await element(mapPage, '#e2e-place-search');
    await search.input('竹林湖');
    await waitUntil(async () => normalizeText(await (await element(mapPage, '#e2e-first-place')).text()).includes('竹林湖'), '详情入口搜索结果');
    await (await element(mapPage, '#e2e-first-place-detail')).tap();
    const page = await waitForPath('package-water/detail/index');
    assert.equal(await (await element(page, '#e2e-water-detail-title')).text(), '竹林湖');
    assert.equal(await (await element(page, '#e2e-open-location')).property('disabled'), true);
    assert.equal(await (await element(page, '#e2e-submit-comment')).property('disabled'), true);
    assert.match(normalizeText(await (await element(page, '.comment-card')).text()), /很久以前/);
  });
});

test('我的页面只展示用户维度数据', { timeout: 30_000 }, async () => {
  await runScenario('mine-personal-data-only', async () => {
    const page = await miniProgram.switchTab('/pages/mine/index');
    const pageText = normalizeText(await (await element(page, '.mine-page')).text());
    assert.match(pageText, /本机趟次/);
    assert.match(pageText, /私人标点/);
    assert.match(pageText, /收藏水域/);
    assert.match(pageText, /我的趟次/);
    assert.doesNotMatch(pageText, /钓点资料库|武汉钓点/);
    assert.doesNotMatch(pageText, /你的私人钓鱼本|先留住每一趟|本机记录可编辑删除/);
    assert.equal(await page.$('#e2e-open-clues'), null);
    await miniProgram.screenshot({ path: path.join(artifactDir, 'mine-personal-data-only.png') });
  });
});
