import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(path.join(projectRoot, relativePath), 'utf8');

test('生产小程序通过云托管私有链路访问 API 和上传压缩图片', async () => {
  const [app, service, packageJson] = await Promise.all([
    read('src/app.tsx'),
    read('src/services/places-api.ts'),
    read('package.json'),
  ]);
  assert.match(app, /Taro\.cloud\.init/);
  assert.match(service, /Taro\.cloud\.callContainer/);
  assert.match(service, /X-WX-SERVICE/);
  assert.match(service, /Taro\.compressImage/);
  assert.match(service, /contentBase64/);
  assert.match(packageJson, /PLAY_HOLIDAY_CLOUD_ENV_ID=play-holiday-d7guw68wn3455561a/);
});

test('地图使用真实 API 并提供地图列表双模式', async () => {
  const source = await read('src/pages/map/index.tsx');
  assert.match(source, /listPlaces/);
  assert.match(source, /listMapPlaces/);
  assert.match(source, /e2e-view-map/);
  assert.match(source, /e2e-view-list/);
  assert.match(source, /无坐标/);
  assert.doesNotMatch(source, /MOCK_WATERS|演示数据/);
});

test('钓点列表使用紧凑浏览卡片，整卡进详情且地图为次级动作', async () => {
  const [source, styles] = await Promise.all([
    read('src/pages/map/index.tsx'),
    read('src/pages/map/index.less'),
  ]);
  assert.match(source, /place-card__content/);
  assert.match(source, /place-card__status/);
  assert.match(source, /place-card__map-action/);
  assert.match(source, /onClick=\{\(\) => openDetail\(place\)\}/);
  assert.doesNotMatch(source, /place-card__actions/);
  assert.match(styles, /\.place-card__content/);
  assert.match(styles, /\.place-card__status/);
  assert.doesNotMatch(styles, /\.place-card__actions/);
  assert.match(source, /places-toolbar__primary/);
  assert.match(source, /places-toolbar__secondary/);
  assert.doesNotMatch(source, /className='view-switch'/);
  assert.doesNotMatch(source, /className='list-summary'/);
});

test('首页以附近钓情和实时天气代替数据库宣传', async () => {
  const [home, api] = await Promise.all([
    readFile(path.join(projectRoot, 'src/pages/index/index.tsx'), 'utf8'),
    readFile(path.join(projectRoot, 'src/services/places-api.ts'), 'utf8'),
  ]);
  assert.match(home, /附近钓情/);
  assert.match(home, /getLocation/);
  assert.match(home, /getWeatherDecision/);
  assert.match(home, /pressureLabel/);
  assert.match(home, /hourly\.slice\(0, 3\)/);
  assert.match(home, /districtLabel/);
  assert.match(home, /出钓建议/);
  assert.match(home, /e2e-home-info/);
  assert.match(home, /className='home-navigation'/);
  assert.match(home, /出钓参考/);
  assert.match(home, /windForceRange/);
  assert.match(home, /风力\{windForceRange\(weather\.current\.windSpeedKmh\)\}/);
  assert.match(home, /出发前请二次核实/);
  assert.doesNotMatch(home, /钓点资料库/);
  assert.doesNotMatch(home, /武汉城区|未来6小时|建议钓法|Open-Meteo|className='risk-note'/);
  assert.doesNotMatch(home, /Math\.round\(weather\.current\.windSpeedKmh\)\}km\/h/);
  assert.match(api, /\/api\/weather/);
});

test('地图视野结束后按真实可见边界重新加载 marker', async () => {
  const source = await readFile(path.join(projectRoot, 'src/pages/map/index.tsx'), 'utf8');
  assert.match(source, /event\.detail\.type === 'end'/);
  assert.match(source, /event\.detail\.causedBy === 'scale'/);
  assert.match(source, /getRegion/);
  assert.match(source, /listNearbyPlaces/);
  assert.match(source, /DEFAULT_RADIUS_KM = 10/);
  assert.match(source, /Taro\.getLocation/);
  assert.doesNotMatch(source, /\{ type\?: string \}\)\.type === 'end'/);
});

test('真实详情支持导航、历史评论与置灰审核入口', async () => {
  const source = await read('src/package-water/detail/index.tsx');
  assert.match(source, /getPlaceDetail/);
  assert.match(source, /Taro\.openLocation/);
  assert.match(source, /external_historical/);
  assert.match(source, /发表评论（审核功能即将开放）/);
  assert.doesNotMatch(source, /MOCK_WATER_DETAILS|演示结构/);
});

test('钓点详情提供结构化现场钓情入口且不上传精准站位', async () => {
  const [detail, api] = await Promise.all([
    read('src/package-water/detail/index.tsx'),
    read('src/services/places-api.ts'),
  ]);
  assert.match(detail, /我在这里，更新钓情/);
  assert.match(detail, /不上传你的精准站位/);
  assert.match(detail, /e2e-submit-live/);
  assert.match(api, /live-reports/);
});

test('首页和地图选点记录不再依赖运行时 Mock', async () => {
  const [home, record] = await Promise.all([
    read('src/pages/index/index.tsx'),
    read('src/pages/record/index.tsx'),
  ]);
  assert.match(home, /listMapPlaces/);
  assert.match(record, /chooseLocation/);
  assert.doesNotMatch(record, /listPlaces/);
  assert.doesNotMatch(home, /MOCK_WATERS/);
  assert.doesNotMatch(record, /MOCK_WATERS/);
});

test('我的页面只承载用户数据，不暴露公共资料库或运营入口', async () => {
  const mine = await read('src/pages/mine/index.tsx');
  assert.match(mine, /本机趟次/);
  assert.match(mine, /私人标点/);
  assert.match(mine, /收藏水域/);
  assert.match(mine, /我的趟次/);
  assert.doesNotMatch(mine, /钓点资料库/);
  assert.doesNotMatch(mine, /package-ops\/clues/);
  assert.doesNotMatch(mine, /e2e-open-clues/);
  assert.doesNotMatch(mine, /mine-hero|你的私人钓鱼本|先留住每一趟|本机记录可编辑删除/);
});
