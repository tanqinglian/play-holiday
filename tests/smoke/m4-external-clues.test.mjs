import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('外部内容只进入待审核线索池，不伪装成站内趟次', async () => {
  const types = await readFile(path.join(projectRoot, 'src/types/product.ts'), 'utf8');
  const service = await readFile(path.join(projectRoot, 'src/services/external-clues.ts'), 'utf8');

  assert.match(types, /interface ExternalFishingClue/);
  assert.match(types, /reviewStatus: 'pending_review'/);
  assert.match(types, /countsTowardTripStats: false/);
  assert.match(service, /ph\.external\.clues\.v1/);
  assert.doesNotMatch(service, /ph\.trip\.drafts\.v1/);
});

test('分享文本导入只保留必要来源信息并限制摘录长度', async () => {
  const service = await readFile(path.join(projectRoot, 'src/services/external-clues.ts'), 'utf8');

  assert.match(service, /inferExternalPlatform/);
  assert.match(service, /extractFirstHttpUrl/);
  assert.match(service, /slice\(0, 200\)/);
  assert.match(service, /countsTowardTripStats: false/);
  assert.doesNotMatch(service, /authorAvatar|authorId|userId/);
});

test('运营导入页明确展示来源、审核状态和统计隔离', async () => {
  const appConfig = await readFile(path.join(projectRoot, 'src/app.config.ts'), 'utf8');
  const page = await readFile(path.join(projectRoot, 'src/package-ops/clues/index.tsx'), 'utf8');

  assert.match(appConfig, /package-ops/);
  assert.match(page, /钓点资料库/);
  assert.match(page, /wuhan-fishing-places\.v1\.json/);
  assert.match(page, /初始收录/);
  assert.match(page, /后续用户更新会追加新记录/);
  assert.match(page, /近 7 日趟次和口况只使用钓友的新记录/);
  assert.match(page, /待核实/);
  assert.match(page, /saveExternalClue/);
  assert.doesNotMatch(page, /request\(|uploadFile\(/);
});

test('用户对地点的更新追加保存，不覆盖初始基线', async () => {
  const types = await readFile(path.join(projectRoot, 'src/types/product.ts'), 'utf8');
  const service = await readFile(path.join(projectRoot, 'src/services/place-updates.ts'), 'utf8');

  assert.match(types, /interface LocalPlaceUpdateRecord/);
  assert.match(types, /updateType: PlaceUpdateType/);
  assert.match(service, /ph\.place\.updates\.v1/);
  assert.match(service, /\[update, \.\.\.getPlaceUpdates\(\)\]/);
  assert.doesNotMatch(service, /wuhan-fishing-places\.v1\.json/);
});
