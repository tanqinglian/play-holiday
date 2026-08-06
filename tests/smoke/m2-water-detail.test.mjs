import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(path.join(projectRoot, relativePath), 'utf8');

test('钓点详情进入独立分包，避免增加主包启动负担', async () => {
  const appConfig = JSON.parse(await read('dist/app.json'));
  const waterPackage = appConfig.subPackages?.find((item) => item.root === 'package-water');
  assert.ok(waterPackage, '缺少 package-water 分包');
  assert.ok(waterPackage.pages.includes('detail/index'), '分包缺少钓点详情页');
});

test('详情严格依据路由 ID 请求真实 API，无效 ID 不会回退首条', async () => {
  const source = await read('src/package-water/detail/index.tsx');
  assert.match(source, /getPlaceDetail\(placeId\)/);
  assert.match(source, /这条钓点资料不可用/);
  assert.doesNotMatch(source, /MOCK_WATER_DETAILS\[0\]|\?\?\s*MOCK/);
});

test('详情展示历史评论原始时间标签，评论入口暂时置灰', async () => {
  const source = await read('src/package-water/detail/index.tsx');
  assert.match(source, /publishedLabel/);
  assert.match(source, /external_historical/);
  assert.match(source, /发表评论（审核功能即将开放）/);
  assert.match(source, /disabled/);
});

test('导航仅在真实坐标可用时开放，收藏使用带版本的本地键', async () => {
  const source = await read('src/package-water/detail/index.tsx');
  assert.match(source, /place\.mapAvailable/);
  assert.match(source, /Taro\.openLocation/);
  assert.match(source, /ph\.favorites\.v1/);
});
