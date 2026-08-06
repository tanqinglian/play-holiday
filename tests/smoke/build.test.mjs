import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(projectRoot, relativePath), 'utf8'));
}

test('编译产物包含四个主导航和五个页面', async () => {
  const app = await readJson('dist/app.json');
  assert.deepEqual(
    app.tabBar.list.map((item) => [item.text, item.pagePath]),
    [
      ['出钓', 'pages/index/index'],
      ['地图', 'pages/map/index'],
      ['记录', 'pages/record/index'],
      ['我的', 'pages/mine/index'],
    ],
  );

  for (const page of [
    'pages/index/index',
    'pages/map/index',
    'pages/record/index',
    'pages/mine/index',
    'pages/fish/index',
  ]) {
    await access(path.join(projectRoot, 'dist', `${page}.js`));
    await access(path.join(projectRoot, 'dist', `${page}.wxml`));
    await access(path.join(projectRoot, 'dist', `${page}.wxss`));
  }
});

test('定位权限是按需且带拒绝后的降级说明', async () => {
  const app = await readJson('dist/app.json');
  assert.deepEqual(app.requiredPrivateInfos, ['getLocation', 'chooseLocation']);
  const description = app.permission['scope.userLocation'].desc;
  assert.ok([...description].length <= 30, `定位权限说明超过微信 30 字限制：${[...description].length}`);
  assert.match(description, /地图选点/);
});

test('TabBar 图标和地图标记均进入微信产物', async () => {
  const assets = [
    'dist/assets/icons/home.png',
    'dist/assets/icons/home-active.png',
    'dist/assets/icons/map.png',
    'dist/assets/icons/map-active.png',
    'dist/assets/icons/record.png',
    'dist/assets/icons/record-active.png',
    'dist/assets/icons/user.png',
    'dist/assets/icons/user-active.png',
    'dist/assets/markers/water-open.png',
    'dist/assets/markers/water-conditional.png',
    'dist/assets/markers/water-unknown.png',
  ];

  for (const asset of assets) {
    const info = await stat(path.join(projectRoot, asset));
    assert.ok(info.size > 0, `${asset} 不应为空`);
  }
});

test('运行时页面不使用 Mock 钓点', async () => {
  const homeSource = await readFile(path.join(projectRoot, 'src/pages/index/index.tsx'), 'utf8');
  assert.match(homeSource, /listMapPlaces/);
  assert.match(homeSource, /附近钓情/);
  assert.doesNotMatch(homeSource, /MOCK_WATERS|演示数据/);
});
