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
const scenarioResults = [];
const runtimeExceptions = [];

async function withTimeout(name, callback, timeout = 8_000) {
  let timeoutId;
  try {
    return await Promise.race([
      callback(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`步骤超时：${name}`)), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function step(name, callback, timeout) {
  process.stdout.write(`# M2 E2E：${name}\n`);
  return withTimeout(name, callback, timeout);
}

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

async function waitForPath(expectedPath, timeout = 8_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const page = await miniProgram.currentPage();
    if (page?.path === expectedPath) return page;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`页面未切换到 ${expectedPath}`);
}

async function closeAutomation() {
  if (!miniProgram) return;
  if (wsEndpoint) {
    miniProgram.disconnect();
    return;
  }
  let timeoutId;
  try {
    await Promise.race([
      miniProgram.close(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('关闭自动化会话超时')), 5_000);
      }),
    ]);
  } catch {
    miniProgram.disconnect();
  } finally {
    clearTimeout(timeoutId);
  }
}

before(async () => {
  await mkdir(artifactDir, { recursive: true });
  miniProgram = wsEndpoint
    ? await connectAutomation(wsEndpoint)
    : await automator.launch({
        cliPath,
        projectPath: projectRoot,
        timeout: 70_000,
        trustProject: true,
      });
  miniProgram.on('exception', (exception) => runtimeExceptions.push(exception));
}, { timeout: 90_000 });

after(async () => {
  try {
    await miniProgram?.callWxMethod('removeStorageSync', 'ph.favorites.v1');
    await miniProgram?.callWxMethod('removeStorageSync', 'ph.corrections.v1');
  } catch {
    // 测试清理尽力执行。
  }
  await closeAutomation();

  const summary = {
    generatedAt: new Date().toISOString(),
    milestone: 'M2',
    total: scenarioResults.length,
    passed: scenarioResults.filter((item) => item.status === 'passed').length,
    failed: scenarioResults.filter((item) => item.status === 'failed').length,
    runtimeExceptions,
    scenarios: scenarioResults,
  };
  await writeFile(
    path.join(artifactDir, scenarioResults.length > 0 ? 'm2-summary.json' : 'm2-attempt.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
}, { timeout: 30_000 });

test('从地图查看水域规则、收藏并提交本地纠错', { timeout: 45_000 }, async () => {
  const startedAt = Date.now();
  try {
    await step('清理收藏', () => miniProgram.callWxMethod('removeStorageSync', 'ph.favorites.v1'));
    await step('清理纠错', () => miniProgram.callWxMethod('removeStorageSync', 'ph.corrections.v1'));

    const mapPage = await step('打开地图页', () => miniProgram.reLaunch('/pages/map/index'));
    await step('选择近 7 天筛选', async () => {
      await (await element(mapPage, '#e2e-map-filter-recent')).tap();
    });
    await step('点击水域详情', async () => {
      await (await element(mapPage, '#e2e-map-open-detail')).tap();
    }, 12_000);

    const detailPage = await step(
      '等待水域详情页',
      () => waitForPath('package-water/detail/index'),
      12_000,
    );
    assert.equal(await (await element(detailPage, '#e2e-water-detail-title')).text(), '演示水域 A');
    assert.match(await (await element(detailPage, '#e2e-water-rule-status')).text(), /条件参考/);
    assert.match(await (await element(detailPage, '#e2e-method-fit-status')).text(), /台钓/);
    assert.match(await (await element(detailPage, '#e2e-trip-sample')).text(), /8 趟/);
    assert.match(await (await element(detailPage, '#e2e-trip-sample')).text(), /38%/);

    await step('收藏水域', async () => {
      await (await element(detailPage, '#e2e-toggle-favorite')).tap();
    });
    const favorites = await step(
      '读取收藏',
      () => miniProgram.callWxMethod('getStorageSync', 'ph.favorites.v1'),
    );
    assert.deepEqual(favorites, ['demo-jiangxia-a']);

    await step('展开纠错表单', async () => {
      await (await element(detailPage, '#e2e-open-correction')).tap();
    });
    await step('选择规则过期', async () => {
      await (await element(detailPage, '#e2e-correction-rule')).tap();
    });
    await step('提交本地纠错', async () => {
      await (await element(detailPage, '#e2e-submit-correction')).tap();
    });
    const corrections = await step(
      '读取纠错队列',
      () => miniProgram.callWxMethod('getStorageSync', 'ph.corrections.v1'),
    );
    assert.equal(corrections.length, 1);
    assert.equal(corrections[0].waterBodyId, 'demo-jiangxia-a');
    assert.equal(corrections[0].reason, 'rule_outdated');

    await detailPage.waitFor(250);

    await step('返回地图', () => miniProgram.navigateBack());
    const restoredMap = await step('等待地图恢复', () => waitForPath('pages/map/index'));
    assert.match(
      await (await element(restoredMap, '#e2e-map-filter-recent')).attribute('class'),
      /map-filter--active/,
    );

    scenarioResults.push({
      name: 'water-detail-favorite-correction',
      status: 'passed',
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const screenshotPath = path.join(artifactDir, 'm2-water-detail-failed.png');
    try {
      await withTimeout(
        '失败截图',
        () => miniProgram?.screenshot({ path: screenshotPath }),
        4_000,
      );
    } catch {
      // 截图失败不能覆盖原始错误。
    }
    scenarioResults.push({
      name: 'water-detail-favorite-correction',
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      screenshotPath,
    });
    throw error;
  }
});
