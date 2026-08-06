import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('趟次以地图坐标为位置主体，并支持私人记录与匿名贡献', async () => {
  const types = await readFile(path.join(projectRoot, 'src/types/product.ts'), 'utf8');
  const recordPage = await readFile(path.join(projectRoot, 'src/pages/record/index.tsx'), 'utf8');

  assert.match(types, /TripPurpose/);
  assert.match(types, /anonymous_water/);
  assert.match(types, /interface TripCoordinate/);
  assert.match(types, /coordinate\?: TripCoordinate/);
  assert.match(types, /locationDescription\?: string/);
  assert.match(types, /photoPaths: string\[\]/);
  assert.match(types, /accessMode\?: TripAccessMode/);
  assert.match(types, /interface TripTag/);
  assert.match(types, /tags: TripTag\[\]/);
  assert.match(recordPage, /useState<TripPurpose>\('private'\)/);
  assert.match(recordPage, /Taro\.chooseLocation/);
  assert.match(recordPage, /Taro\.chooseMedia/);
  assert.match(recordPage, /Taro\.saveFile/);
  assert.match(recordPage, /位置描述/);
  assert.match(recordPage, /TripTagPicker/);
  assert.doesNotMatch(recordPage, /关联水域|搜索真实钓点|record-hero|result-choice__helper|purpose-privacy|save-helper/);
});

test('匿名贡献进入带幂等键的本地离线队列且必须先选坐标', async () => {
  const types = await readFile(path.join(projectRoot, 'src/types/product.ts'), 'utf8');
  const recordPage = await readFile(path.join(projectRoot, 'src/pages/record/index.tsx'), 'utf8');

  assert.match(types, /syncStatus: 'local' \| 'queued'/);
  assert.match(types, /idempotencyKey/);
  assert.match(recordPage, /syncStatus: purpose === 'anonymous_water' \? 'queued' : 'local'/);
  assert.match(recordPage, /disabled=\{!coordinate\}/);
});

test('历史私人点只从带版本的本机存储层读取', async () => {
  const types = await readFile(path.join(projectRoot, 'src/types/product.ts'), 'utf8');
  const mapPage = await readFile(path.join(projectRoot, 'src/pages/map/index.tsx'), 'utf8');

  assert.match(types, /interface PrivateSpot/);
  assert.match(types, /syncStatus: 'local'/);
  assert.match(mapPage, /ph\.private\.spots\.v1/);
  assert.match(mapPage, /Taro\.getStorageSync<PrivateSpot\[]>/);
  assert.match(mapPage, /仅本机可见/);
  assert.doesNotMatch(mapPage, /request\(|uploadFile\(/);
});

test('趟次历史支持本机编辑和确认删除', async () => {
  const minePage = await readFile(path.join(projectRoot, 'src/pages/mine/index.tsx'), 'utf8');

  assert.match(minePage, /updateTripResult/);
  assert.match(minePage, /deleteTrip/);
  assert.match(minePage, /确认删除这条私人日志/);
  assert.match(minePage, /Taro\.setStorageSync/);
  assert.match(minePage, /draft\.locationDescription/);
  assert.match(minePage, /draft\.photoPaths/);
  assert.match(minePage, /draft\.tags/);
});

test('标签选择器支持分类、搜索、自定义和个人标签持久化', async () => {
  const tagPicker = await readFile(path.join(projectRoot, 'src/components/trip-tag-picker/index.tsx'), 'utf8');

  assert.match(tagPicker, /ph\.custom\.trip-tags\.v1/);
  assert.match(tagPicker, /到达/);
  assert.match(tagPicker, /水情/);
  assert.match(tagPicker, /钓位/);
  assert.match(tagPicker, /现场/);
  assert.match(tagPicker, /设施/);
  assert.match(tagPicker, /汽车可达/);
  assert.match(tagPicker, /电动车可达/);
  assert.match(tagPicker, /需步行一段/);
  assert.match(tagPicker, /e2e-custom-tag-input/);
  assert.match(tagPicker, /新增标签/);
});
